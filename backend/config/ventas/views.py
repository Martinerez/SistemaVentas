"""
Vistas de Ventas y Reportes — App 'ventas'
============================================

Contiene:
  - ViewSets CRUD básicos para Venta y DetalleVenta.
  - Vistas de procesamiento atómico: ProcesarVenta, AnularVenta.
  - Vista de estadísticas del Dashboard.
  - Vistas de reportes gerenciales (funciones SQL simples).
  - Vistas de reportes avanzados (stored procedures sp_*).

PATRÓN GENERAL DE REPORTES:
    Cada vista de reporte delega la lógica a una función PL/pgSQL en PostgreSQL.
    Django solo actúa como proxy HTTP: recibe parámetros, los valida, los pasa
    a la función SQL y serializa la respuesta.
    Ventaja: La lógica de negocio compleja (JOINs, agregaciones, filtros) vive
    en la BD donde puede optimizarse con índices y planes de ejecución eficientes.

NORMALIZACIÓN DE CLAVES (k.lower()):
    Todas las respuestas de reportes normalizan las claves de columna a
    minúsculas con `{k.lower(): v for k, v in zip(columns, row)}`.
    PostgreSQL puede devolver columnas en cualquier capitalización dependiendo
    de cómo se definieron en la función. El frontend React espera siempre
    snake_case en minúsculas (ej: 'total_ventas', no 'Total_Ventas').
"""

from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from django.db import transaction, connection
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncDate

from .models import Venta, DetalleVenta
from catalogo.models import Producto, Proveedor
from inventario.models import Inventario, Perdida
from usuarios.models import Usuario
from usuarios.permissions import IsAdminRole, IsAdminOrReadOnly, CanProcessSale
from .serializers import VentaSerializer, DetalleVentaSerializer


# ─── VIEWSETS CRUD ────────────────────────────────────────────────────────────

class VentaViewSet(viewsets.ModelViewSet):
    """
    CRUD estándar para el modelo Venta.

    pagination_class = None: Se desactiva para que el historial completo
    sea accesible en una sola petición. El frontend pagina visualmente.

    Permisos: IsAdminOrReadOnly → vendedores pueden consultar (GET) el
    historial de ventas pero no crear/modificar directamente (para eso
    existe ProcesarVentaView que tiene su propia lógica atómica).
    """
    queryset = Venta.objects.all()
    serializer_class = VentaSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = None


class DetalleVentaViewSet(viewsets.ModelViewSet):
    """
    CRUD para detalles individuales de venta.

    Restringido a IsAdminRole porque modificar detalles de venta directamente
    (sin pasar por ProcesarVentaView) podría dejar el inventario inconsistente.
    """
    queryset = DetalleVenta.objects.all()
    serializer_class = DetalleVentaSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]


# ─── PROCESAMIENTO DE VENTAS ──────────────────────────────────────────────────

class ProcesarVentaView(APIView):
    """
    Endpoint principal de facturación. Registra una venta completa de forma atómica.

    POR QUÉ UNA VISTA SEPARADA (no usar VentaViewSet.create()):
        El proceso de venta involucra múltiples tablas (Venta, DetalleVenta,
        Inventario) y requiere select_for_update() para evitar vender la misma
        unidad dos veces en peticiones concurrentes. Un ModelViewSet estándar
        no tiene esta lógica transaccional.

    Endpoint: POST /api/ventas/procesar/

    Payload:
        {
          "usuarioId": 2,
          "fecha": "2026-04-20T14:30:00Z",
          "total": 150.00,
          "detalles": [
            {"inventarioId": 42, "precioVentaUnitario": 75.00},
            {"inventarioId": 43, "precioVentaUnitario": 75.00}
          ]
        }
    """
    # CanProcessSale: Permite tanto a admins como a vendedores registrar ventas.
    permission_classes = [CanProcessSale]

    @transaction.atomic
    def post(self, request):
        """
        Procesa una venta completa de forma transaccional.

        Flujo:
          1. Crear encabezado de Venta.
          2. Para cada ítem en 'detalles':
             a. Bloquear el registro de Inventario (select_for_update).
             b. Crear DetalleVenta vinculando Venta e Inventario.
             c. Cambiar el Estado del Inventario a 'Vendido'.
          3. Si CUALQUIER paso falla, el @transaction.atomic hace rollback
             de TODOS los cambios de este bloque.

        Args:
            request: Petición POST con datos de la venta.

        Returns:
            Response: 201 Created si exitoso, 400 Bad Request si error.
        """
        usuario_id = request.data.get('usuarioId')
        fecha = request.data.get('fecha')
        total = request.data.get('total')
        detalles = request.data.get('detalles', [])

        try:
            usuario = Usuario.objects.get(IdUsuario=usuario_id)
            venta = Venta.objects.create(IdUsuario=usuario, Fecha=fecha, Total=total)
            for d in detalles:
                inv_id = d.get('inventarioId')
                precio = d.get('precioVentaUnitario')
                # select_for_update(): Bloquea esta fila hasta que la transacción termine.
                # Si otro proceso intenta vender la misma unidad simultáneamente,
                # esperará hasta que este bloqueo sea liberado.
                inventario = Inventario.objects.select_for_update().get(IdInventario=inv_id)
                DetalleVenta.objects.create(
                    IdVenta=venta,
                    IdInventario=inventario,
                    PrecioVentaUnitario=precio
                )
                # Marcar como vendida para que deje de aparecer en el stock disponible
                inventario.Estado = "Vendido"
                inventario.save()
            return Response({
                "message": "Venta exitosa",
                "id": venta.IdVenta,
                "fecha": venta.Fecha,
                "total": venta.Total
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AnularVentaView(APIView):
    """
    Anula una venta y revierte el stock de todas sus unidades.

    POR QUÉ ANULAR EN LUGAR DE BORRAR:
        Borrar una venta elimina el registro contable. La anulación preserva
        el historial (importante para auditoría y reportes financieros) mientras
        deja de contar la venta como ingreso activo.

    Endpoint: POST /api/ventas/<pk>/anular/
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request, pk):
        """
        Anula la venta con ID=pk y revierte el inventario.

        GUARD: No se puede anular una venta que ya fue anulada (idempotencia).

        Args:
            request: Petición HTTP.
            pk (int): ID de la venta a anular.

        Returns:
            Response: 200 OK si exitoso. 404 si no existe. 400 si ya estaba anulada.
        """
        try:
            # select_for_update en la Venta: Evita dos anulaciones simultáneas
            venta = Venta.objects.select_for_update().get(pk=pk)
        except Venta.DoesNotExist:
            return Response({"error": "Venta no encontrada."}, status=status.HTTP_404_NOT_FOUND)

        # Verificación de idempotencia: No se puede anular dos veces
        if venta.Estado == 'Anulada':
            return Response(
                {"error": "Esta venta ya fue anulada previamente."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Revertir stock: cada unidad de inventario vuelve a 'Disponible'
        # select_related('IdInventario'): Optimización — obtiene el inventario
        # relacionado en el mismo query, evitando N queries adicionales.
        detalles = DetalleVenta.objects.filter(IdVenta=venta).select_related('IdInventario')
        for detalle in detalles:
            inventario = Inventario.objects.select_for_update().get(
                IdInventario=detalle.IdInventario_id
            )
            inventario.Estado = 'Disponible'
            # Actualizar FechaMovimiento para el registro de auditoría
            inventario.FechaMovimiento = timezone.now()
            inventario.save()

        venta.Estado = 'Anulada'
        venta.save()

        return Response(
            {"message": f"Venta #{pk} anulada correctamente. Stock revertido."},
            status=status.HTTP_200_OK
        )


# ─── DASHBOARD ────────────────────────────────────────────────────────────────

class DashboardStatsView(APIView):
    """
    Provee todas las estadísticas necesarias para el Dashboard en una sola petición.

    FILTRO DE PRIVACIDAD POR ROL:
        Los vendedores ven el Dashboard pero NO los datos financieros sensibles
        (weeklySales, weeklyLosses). Estos campos se anulan a None para su rol.
        El frontend maneja None mostrando '---' en lugar del valor.
        Esto implementa el principio de mínimo privilegio: cada rol solo ve
        lo que necesita para hacer su trabajo.

    Endpoint: GET /api/ventas/dashboard/stats/
    """
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def get(self, request):
        """
        Calcula y devuelve las estadísticas del Dashboard.

        Returns:
            Response: JSON con métricas de los últimos 7 días, productos con
                      stock bajo, ventas recientes y datos para el gráfico.
        """
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)

        # ── Métricas de conteo simples ─────────────────────────────────────
        total_products = Producto.objects.count()
        ventas_semana = Venta.objects.filter(Fecha__gte=seven_days_ago)
        # aggregate(total=Sum('Total')): Un solo query SQL con SUM().
        # El `or 0` maneja el caso de que no haya ventas (Sum devuelve None).
        weekly_sales = ventas_semana.aggregate(total=Sum('Total'))['total'] or 0
        total_proveedores = Proveedor.objects.count()

        # ── Productos con stock bajo (menos de 10 unidades disponibles) ────
        # annotate(): Añade el campo calculado 'stock' a cada Producto del queryset.
        # Count con filter(): Equivale a COUNT(CASE WHEN Estado='Disponible' THEN 1 END) en SQL.
        # detalleentradainventario__inventarios: Navegación de FK a través de related_name.
        low_stock_qs = Producto.objects.annotate(
            stock=Count(
                'detalleentradainventario__inventarios',
                filter=Q(detalleentradainventario__inventarios__Estado='Disponible')
            )
        ).filter(stock__lt=10).order_by('stock')[:5]

        low_stock_items = [{
            "id": p.IdProducto,
            "name": p.Nombre,
            "stock": p.stock,
            "category": p.IdCategoria.Nombre if p.IdCategoria else "General"
        } for p in low_stock_qs]

        # ── 5 ventas más recientes ─────────────────────────────────────────
        recent_sales_qs = Venta.objects.order_by('-Fecha')[:5]
        recent_sales = [{
            "id": v.IdVenta,
            "time": v.Fecha.strftime("%I:%M %p"),
            "items": v.detalles.count(),  # Usa related_name='detalles'
            "total": float(v.Total)
        } for v in recent_sales_qs]

        # ── Pérdidas de los últimos 7 días ─────────────────────────────────
        perdidas_semana = Perdida.objects.filter(Fecha__gte=seven_days_ago)
        weekly_losses = perdidas_semana.aggregate(total=Sum('Total'))['total'] or 0

        # ── Datos para el gráfico de barras de ventas diarias ──────────────
        # TruncDate: Trunca el DateTimeField a solo la fecha (sin hora).
        # Permite agrupar ventas del mismo día aunque tengan horas distintas.
        sales_by_date = ventas_semana.annotate(date=TruncDate('Fecha')).values('date').annotate(
            total=Sum('Total')
        ).order_by('date')

        chart_data = [{"date": s['date'].strftime('%a'), "total": float(s['total'])} for s in sales_by_date]
        # Fallback: Si no hay ventas en la semana, el gráfico no queda vacío
        if not chart_data:
            chart_data = [{"date": "Hoy", "total": 0}]

        response_data = {
            "totalProducts": total_products,
            "weeklySales": float(weekly_sales),
            "totalProveedores": total_proveedores,
            "lowStockItems": low_stock_items,
            "recentSales": recent_sales,
            "weeklyLosses": float(weekly_losses),
            "chartData": chart_data
        }

        # ── Filtro de privacidad: vendedores no ven datos financieros ───────
        # getattr con None como fallback: defensa contra usuarios sin el campo 'Rol'
        if getattr(request.user, 'Rol', None) == 'vendedor':
            response_data['weeklySales'] = None
            response_data['weeklyLosses'] = None

        return Response(response_data)


# ─── REPORTES SIMPLES (funciones PostgreSQL sin prefijo sp_) ──────────────────

class ReporteGerencialView(APIView):
    """
    Reporte ejecutivo: total vendido, promedio y producto estrella en un periodo.

    Llama a la función PostgreSQL: reporte_gerencial(inicio DATE, fin DATE)
    Retorna una sola fila con: (total_ventas, promedio_venta, producto_mas_vendido)
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        inicio, fin = request.query_params.get('inicio'), request.query_params.get('fin')
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM reporte_gerencial(%s, %s)", [inicio, fin])
            row = cursor.fetchone()
        return Response({
            "total_ventas": float(row[0]) if row and row[0] else 0,
            "promedio_venta": float(row[1]) if row and row[1] else 0,
            "producto_mas_vendido": row[2] if row and row[2] else "N/A"
        })


class ReportePivotVentasView(APIView):
    """
    Análisis mensual de ventas de un producto en un año (tabla pivot 12 columnas).

    Llama a: reporte_mensual_producto_pivot(anio INT, productoId INT)
    Retorna una fila con columnas: producto, ene, feb, mar, abr, may, jun,
                                   jul, ago, sep, oct, nov, dic

    DECISIÓN DE DISEÑO — Fila única vs. Múltiples filas:
        La función SQL devuelve UNA SOLA FILA con los 12 meses como columnas
        (formato pivot/crosstab). El frontend (Reportes.tsx) mapea directamente
        cada columna (d.ene, d.feb...) a una celda de la tabla visual.
        Esto es más eficiente que devolver 12 filas (una por mes) porque
        elimina la necesidad de transformar la respuesta en el cliente.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        anio, prod_id = request.query_params.get('anio'), request.query_params.get('productoId')
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM reporte_mensual_producto_pivot(%s, %s)", [anio, prod_id])
            columns = [col[0] for col in cursor.description]
            row = cursor.fetchone()
        # Normalizar claves a minúsculas para que el frontend lea d.ene, d.feb, etc.
        if row:
            return Response({k.lower(): v for k, v in zip(columns, row)})
        # Fallback con ceros para que el frontend no crashee si no hay datos
        return Response({"producto": "Sin datos", "ene": 0, "feb": 0, "mar": 0, "abr": 0,
                         "may": 0, "jun": 0, "jul": 0, "ago": 0, "sep": 0, "oct": 0, "nov": 0, "dic": 0})


class ProductosPorProveedorView(APIView):
    """
    Lista los productos vigentes suministrados por un proveedor específico.
    Llama a: reporte_productos_por_proveedor(proveedor_id INT)
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        proveedor_id = request.query_params.get('proveedorId')
        if not proveedor_id:
            return Response({"error": "Falta proveedorId"}, status=400)
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM reporte_productos_por_proveedor(%s)", [proveedor_id])
            columns = [col[0] for col in cursor.description]
            result = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return Response(result)


class ReporteDevolucionesView(APIView):
    """
    Reporte de devoluciones procesadas en un rango de fechas.
    Llama a: devoluciones_por_fecha(inicio DATE, fin DATE)
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        inicio = request.query_params.get('inicio')
        fin = request.query_params.get('fin')
        if not inicio or not fin:
            return Response({"error": "Faltan fechas de inicio y fin"}, status=400)
        try:
            with connection.cursor() as cursor:
                # Unimos los resultados de la función con la tabla de Usuarios para obtener el nombre
                query = """
                    SELECT r.*, u."Nombre" as usuario
                    FROM devoluciones_por_fecha(%s, %s) r
                    LEFT JOIN "SolicitudDevolucion" s ON r.id_solicitud = s."IdSolicitudDevolucion"
                    LEFT JOIN "Usuario" u ON s."IdUsuario" = u."IdUsuario"
                """
                cursor.execute(query, [inicio, fin])
                columns = [col[0] for col in cursor.description]
                # Normalización a minúsculas: El frontend accede a d.producto, d.cantidad, etc.
                result = [{k.lower(): v for k, v in zip(columns, row)} for row in cursor.fetchall()]
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class ReportePerdidasView(APIView):
    """
    Reporte de pérdidas registradas en un rango de fechas.
    Llama a: perdidas_por_fecha(inicio DATE, fin DATE)
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        inicio = request.query_params.get('inicio')
        fin = request.query_params.get('fin')
        if not inicio or not fin:
            return Response({"error": "Faltan fechas"}, status=400)
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT * FROM perdidas_por_fecha(%s, %s)", [inicio, fin])
                columns = [col[0] for col in cursor.description]
                result = [{k.lower(): v for k, v in zip(columns, row)} for row in cursor.fetchall()]
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# ─── REPORTES AVANZADOS (stored procedures sp_) ───────────────────────────────

class ReporteVentasFiltradasView(APIView):
    """
    Filtra ventas por rango de fechas y estado (Completada/Anulada/Todas).

    Llama a: sp_ventas_filtradas(inicio, fin, estado, usuario_id, monto_min, monto_max)
    Los parámetros 4, 5, 6 se pasan como NULL (sin filtro adicional).

    NORMALIZACIÓN DE 'estado':
        Si el usuario elige "Todas" en el frontend, el select envía una cadena
        vacía (""). Se debe normalizar a None antes de enviarlo a PostgreSQL,
        porque la función SQL espera NULL para "sin filtro de estado", no "".
        Pasar "" causaría que la función busque ventas con estado="" (vacío), 
        devolviendo cero resultados.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        inicio = request.query_params.get('inicio')
        fin = request.query_params.get('fin')
        estado = request.query_params.get('estado', None)

        if not inicio or not fin:
            return Response({"error": "Faltan fechas de inicio y fin"}, status=400)

        try:
            with connection.cursor() as cursor:
                # Normalizar cadena vacía → None → NULL en PostgreSQL
                estado_param = estado if estado else None
                cursor.execute(
                    "SELECT * FROM sp_ventas_filtradas(%s, %s, %s, %s, %s, %s)",
                    [inicio, fin, estado_param, None, None, None]
                )
                columns = [col[0] for col in cursor.description]
                result = [{k.lower(): v for k, v in zip(columns, row)} for row in cursor.fetchall()]
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class ReporteTopProductosView(APIView):
    """
    Devuelve los N productos más vendidos en un periodo, ordenados por ingreso.

    Llama a: sp_top_productos(inicio DATE, fin DATE)
    El LIMIT se aplica en Python (LIMIT %s en el SELECT) porque la función
    SQL no acepta un parámetro de límite en su firma actual. Esto evita
    modificar la función almacenada y mantiene la compatibilidad.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        inicio = request.query_params.get('inicio')
        fin = request.query_params.get('fin')
        limite = request.query_params.get('limite', 10)

        if not inicio or not fin:
            return Response({"error": "Faltan fechas de inicio y fin"}, status=400)

        try:
            # Validar y convertir 'limite' a entero. Si el usuario envía "abc", falla aquí.
            limite = int(limite)
        except (ValueError, TypeError):
            return Response({"error": "El parámetro 'limite' debe ser un número entero"}, status=400)

        try:
            with connection.cursor() as cursor:
                # LIMIT aplicado directamente en el SQL envolvente,
                # ya que la función sp_top_productos solo acepta (inicio, fin).
                cursor.execute(
                    "SELECT * FROM sp_top_productos(%s, %s) LIMIT %s",
                    [inicio, fin, limite]
                )
                columns = [col[0] for col in cursor.description]
                result = [{k.lower(): v for k, v in zip(columns, row)} for row in cursor.fetchall()]
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class ReporteGananciaProductoView(APIView):
    """
    Calcula la ganancia bruta por producto (o todos) en un periodo.

    Llama a: sp_ganancia_producto(inicio DATE, fin DATE, producto_id INT|NULL)

    Si producto_id es NULL, la función devuelve la ganancia de TODOS los productos.
    Si producto_id tiene un valor, filtra solo ese producto.

    NORMALIZACIÓN DE producto_id:
        Al igual que con 'estado' en otras vistas, una cadena vacía se normaliza
        a None para que PostgreSQL reciba NULL y la función aplique el comportamiento
        de "todos los productos".
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        inicio = request.query_params.get('inicio')
        fin = request.query_params.get('fin')
        producto_id = request.query_params.get('productoId', None)

        if not inicio or not fin:
            return Response({"error": "Faltan fechas de inicio y fin"}, status=400)

        try:
            with connection.cursor() as cursor:
                # Normalizar cadena vacía → None → NULL en SQL
                producto_id_param = producto_id if producto_id else None
                cursor.execute(
                    "SELECT * FROM sp_ganancia_producto(%s, %s, %s)",
                    [inicio, fin, producto_id_param]
                )
                columns = [col[0] for col in cursor.description]
                result = [{k.lower(): v for k, v in zip(columns, row)} for row in cursor.fetchall()]
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class ReporteComparacionVentasView(APIView):
    """
    Compara el desempeño de ventas entre dos periodos de tiempo distintos.

    CASTING EXPLÍCITO ::DATE EN SQL:
        Las fechas se pasan como strings ('2026-01-01') desde el frontend.
        PostgreSQL puede inferir el tipo en muchos casos, pero con funciones
        polimórficas o cuando hay ambigüedad de tipos, el cast explícito
        ::DATE garantiza que PostgreSQL interprete el parámetro correctamente.
        Sin el cast, podría surgir un error: "could not determine data type of
        parameter $1" o resultados incorrectos por comparación de tipos mixtos.

    La función sp_comparar_ventas() devuelve UNA SOLA FILA con estas columnas:
        ventas_a, productos_a  ← Métricas del Periodo A
        ventas_b, productos_b  ← Métricas del Periodo B

    El frontend (ejecutarComparacion en Reportes.tsx) transforma esa única fila
    en MÚLTIPLES filas visuales para la tabla comparativa, calculando además
    la diferencia (periodo_b - periodo_a) para cada métrica.

    Endpoint: GET /api/ventas/reporte-comparacion-ventas/
    Query params: inicioA, finA, inicioB, finB (fechas YYYY-MM-DD)
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        # Capturar los 4 parámetros de fecha (2 períodos de comparación)
        inicio_a = request.query_params.get('inicioA')
        fin_a = request.query_params.get('finA')
        inicio_b = request.query_params.get('inicioB')
        fin_b = request.query_params.get('finB')

        # Validar que todos los parámetros estén presentes
        if not all([inicio_a, fin_a, inicio_b, fin_b]):
            return Response({"error": "Faltan fechas para comparar"}, status=400)

        try:
            with connection.cursor() as cursor:
                # ::DATE: Cast explícito para garantizar que PostgreSQL interprete
                # los parámetros como DATE y no como TEXT/TIMESTAMP, evitando
                # ambigüedad en la resolución de la firma de la función.
                cursor.execute(
                    "SELECT * FROM sp_comparar_ventas(%s::DATE, %s::DATE, %s::DATE, %s::DATE)",
                    [inicio_a, fin_a, inicio_b, fin_b]
                )
                columns = [col[0] for col in cursor.description]
                # Normalizar a minúsculas: El frontend accede a d.ventas_a, d.productos_b, etc.
                result = [{k.lower(): v for k, v in zip(columns, row)} for row in cursor.fetchall()]
            return Response(result)
        except Exception as e:
            # print() ayuda a diagnosticar errores de tipo de dato en la terminal de Django
            print(f"Error en comparación: {str(e)}")
            return Response({"error": str(e)}, status=400)