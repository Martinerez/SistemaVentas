"""
Vistas del Inventario — App 'inventario'
=========================================

Expone los endpoints para gestión completa del inventario: entradas de
mercancía, stock físico, procesamiento de pérdidas, gestión de devoluciones
y reportes especializados.

PATRÓN DE TRANSACCIONES ATÓMICAS (@transaction.atomic):
    Las operaciones que modifican múltiples tablas simultáneamente (ej:
    crear una pérdida Y marcar las unidades de inventario) usan @transaction.atomic.
    Esto garantiza que si cualquier paso falla, todos los cambios anteriores
    se revierten (rollback), dejando la BD en un estado consistente.

    Ejemplo: Si se registran 5 unidades perdidas y la 3ra falla, las 2 primeras
    NO quedarán como 'Perdido' en la BD. La transacción completa se deshace.

REPORTES SQL (sp_):
    Las vistas de reporte usan funciones PL/pgSQL almacenadas en PostgreSQL
    (prefijadas con 'sp_' = stored procedure). Estas funciones implementan
    lógica compleja de agregación y filtrado en la BD, donde es más eficiente
    que traer miles de registros a Python para procesarlos en memoria.
"""

from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.db import transaction, connection
from datetime import timedelta
from django.utils import timezone
from .models import (
    EntradaInventario, DetalleEntradaInventario, Inventario,
    Perdida, DetallePerdida, SolicitudDevolucion, DetalleSolicitudDevolucion
)
from usuarios.models import Usuario
from usuarios.permissions import IsAdminRole, IsAdminOrReadOnly
from .serializers import (
    EntradaInventarioSerializer, DetalleEntradaInventarioSerializer, InventarioSerializer,
    PerdidaSerializer, DetallePerdidaSerializer, SolicitudDevolucionSerializer,
    DetalleSolicitudDevolucionSerializer
)


class EntradaInventarioViewSet(viewsets.ModelViewSet):
    """
    CRUD completo para entradas de inventario (pedidos de compra).

    pagination_class = None: Se desactiva la paginación para que el frontend
    reciba TODAS las entradas en una sola petición. Esto facilita mostrar el
    historial completo de compras sin necesidad de manejar páginas.

    La acción personalizada `delete_completo` es necesaria porque el borrado
    en cascada por defecto de Django no respeta el orden correcto de eliminación
    cuando hay relaciones circulares o restricciones FK complejas.
    """
    queryset = EntradaInventario.objects.all()
    serializer_class = EntradaInventarioSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None

    @action(detail=True, methods=["delete"])
    @transaction.atomic
    def delete_completo(self, request, pk=None):
        """
        Elimina una entrada de inventario junto con todos sus datos relacionados.

        El orden de eliminación es crítico (de hijo a padre) para respetar las
        restricciones de clave foránea:
          1. Registros de Inventario (unidades físicas)
          2. Detalles de la entrada
          3. La entrada misma

        El decorador @transaction.atomic garantiza que si falla cualquier paso,
        ningún borrado parcial queda en la BD.

        Args:
            request: Petición HTTP.
            pk (int): ID de la entrada a eliminar.

        Returns:
            Response: HTTP 204 No Content si fue exitoso.
        """
        entrada = self.get_object()

        # Paso 1: Borrar todas las unidades de inventario vinculadas a esta entrada.
        # La doble FK (IdDetalleEntrada__IdEntradaInventario) navega desde Inventario
        # hasta EntradaInventario a través de DetalleEntradaInventario.
        Inventario.objects.filter(
            IdDetalleEntrada__IdEntradaInventario=entrada
        ).delete()

        # Paso 2: Borrar los detalles de la entrada
        DetalleEntradaInventario.objects.filter(
            IdEntradaInventario=entrada
        ).delete()

        # Paso 3: Borrar el encabezado de la entrada
        entrada.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class DetalleEntradaInventarioViewSet(viewsets.ModelViewSet):
    """
    CRUD para los detalles (líneas) de una entrada de inventario.

    Incluye filtrado por entrada: GET /api/inventario/detalles/?entradaInventarioId=5
    Incluye creación con generación automática de unidades de inventario.
    """
    queryset = DetalleEntradaInventario.objects.all()
    serializer_class = DetalleEntradaInventarioSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        """
        Filtra los detalles por entrada de inventario si se proporciona el parámetro.

        POR QUÉ FILTRAR EN get_queryset():
            Este es el patrón correcto de DRF para filtros dinámicos. Si se filtrara
            en el método `list()`, se rompería la compatibilidad con otras acciones
            del ViewSet (retrieve, update, delete) que también usan get_queryset().

        Returns:
            QuerySet: Todos los detalles si no hay filtro, o los del ID especificado.
        """
        entrada_id = self.request.query_params.get("entradaInventarioId")
        queryset = DetalleEntradaInventario.objects.all()
        if entrada_id:
            queryset = queryset.filter(IdEntradaInventario_id=entrada_id)
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        """
        Crea un detalle de entrada Y sus registros de inventario de forma atómica.

        POR QUÉ bulk_create():
            Para N unidades, bulk_create() genera UN SOLO INSERT SQL en lugar
            de N inserts individuales. Esto es significativamente más rápido
            para compras de lotes grandes (ej: 100 unidades de agua).

        Args:
            serializer: Serializador ya validado de DRF.
        """
        detalle = serializer.save()

        # Construir la lista de objetos Inventario en memoria antes de insertarlos
        inventarios = [
            Inventario(
                IdDetalleEntrada=detalle,
                Estado="Disponible",
                FechaMovimiento=timezone.now()
            )
            for _ in range(detalle.Cantidad)  # Una unidad por cada item del lote
        ]

        # Un solo INSERT con todas las unidades
        Inventario.objects.bulk_create(inventarios)


class InventarioViewSet(viewsets.ModelViewSet):
    """
    CRUD básico para registros individuales de inventario.

    Principalmente usado para consultas de estado (GET) y actualizaciones
    manuales de emergencia. Las actualizaciones normales de estado ocurren
    automáticamente durante el procesamiento de ventas, pérdidas y devoluciones.
    """
    queryset = Inventario.objects.all()
    serializer_class = InventarioSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = None


class PerdidaViewSet(viewsets.ModelViewSet):
    """ViewSet de solo lectura (para admins) del historial de pérdidas."""
    queryset = Perdida.objects.all()
    serializer_class = PerdidaSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None


class DetallePerdidaViewSet(viewsets.ModelViewSet):
    """ViewSet para consultar líneas de detalle de pérdidas."""
    queryset = DetallePerdida.objects.all()
    serializer_class = DetallePerdidaSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None


class SolicitudDevolucionViewSet(viewsets.ModelViewSet):
    """
    CRUD para solicitudes de devolución con protección de estado.

    LÓGICA DE NEGOCIO CRÍTICA:
        Una solicitud de devolución que ya fue aprobada o rechazada NO puede
        ser modificada. Esto simula un proceso de aprobación formal donde
        una vez tomada la decisión, el registro es inmutable.

        Se sobreescriben update() y partial_update() para añadir esta
        verificación antes de delegar al comportamiento estándar del ViewSet.
    """
    queryset = SolicitudDevolucion.objects.all()
    serializer_class = SolicitudDevolucionSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None

    def update(self, request, *args, **kwargs):
        """
        Actualización completa (PUT) con verificación de estado.

        Args:
            request: Petición HTTP con los datos actualizados.

        Returns:
            Response: 400 Bad Request si no está Pendiente. Delega a super() si sí.
        """
        instance = self.get_object()
        if instance.Estado != 'Pendiente':
            return Response(
                {"error": "No se puede modificar una solicitud que ya no está pendiente."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """
        Actualización parcial (PATCH) con la misma verificación de estado.

        Se sobreescribe por separado porque DRF diferencia entre PUT y PATCH
        en métodos distintos. Ambos deben tener la misma protección.
        """
        instance = self.get_object()
        if instance.Estado != 'Pendiente':
            return Response(
                {"error": "No se puede modificar una solicitud que ya no está pendiente."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().partial_update(request, *args, **kwargs)


class DetalleSolicitudDevolucionViewSet(viewsets.ModelViewSet):
    """ViewSet para líneas de detalle de solicitudes de devolución."""
    queryset = DetalleSolicitudDevolucion.objects.all()
    serializer_class = DetalleSolicitudDevolucionSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None


# ─── VISTAS DE PROCESAMIENTO ───────────────────────────────────────────────────

class ProcesarPerdidaView(APIView):
    """
    Registra una pérdida de mercancía de forma atómica.

    Crea el encabezado (Perdida), los detalles (DetallePerdida) y actualiza
    el estado de cada unidad de inventario involucrada en una sola transacción.

    Endpoint: POST /api/inventario/procesar-perdida/

    Payload esperado:
        {
          "usuarioId": 1,
          "tipoPerdida": "Otra",
          "fecha": "2026-04-20T10:00:00Z",
          "total": 150.00,
          "detalles": [
            {"inventarioId": 42, "precioCompraUnitario": 50.00},
            {"inventarioId": 43, "precioCompraUnitario": 50.00},
            {"inventarioId": 44, "precioCompraUnitario": 50.00}
          ]
        }
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        """
        Procesa el registro completo de una pérdida.

        select_for_update() en el Inventario bloquea las filas seleccionadas
        durante la transacción para evitar que dos procesos simultáneos
        modifiquen el mismo registro de inventario.

        Args:
            request: Petición HTTP con los datos de la pérdida.

        Returns:
            Response: 201 Created si exitoso, 400 Bad Request si error.
        """
        usuario_id = request.data.get('usuarioId')
        tipo_perdida = request.data.get('tipoPerdida', 'Otra')
        fecha = request.data.get('fecha')
        total = request.data.get('total')
        detalles = request.data.get('detalles', [])

        try:
            usuario = Usuario.objects.get(IdUsuario=usuario_id)
            perdida = Perdida.objects.create(
                IdUsuario=usuario,
                TipoPerdida=tipo_perdida,
                Fecha=fecha,
                Total=total
            )
            for d in detalles:
                inv_id = d.get('inventarioId')
                precio = d.get('precioCompraUnitario')
                # select_for_update: Bloquea el registro de inventario hasta que
                # la transacción termine. Previene condiciones de carrera.
                inventario = Inventario.objects.select_for_update().get(IdInventario=inv_id)
                DetallePerdida.objects.create(
                    IdPerdida=perdida,
                    IdInventario=inventario,
                    PrecioCompraUnitario=precio
                )
                # Cambiar el estado de la unidad para que deje de aparecer en el stock
                inventario.Estado = "Perdido"
                inventario.save()
            return Response({"message": "Pérdida procesada"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ProcesarDevolucionView(APIView):
    """
    Registra una solicitud de devolución de mercancía al proveedor.

    Al crear la solicitud, las unidades involucradas se marcan como 'Devuelto'
    para que dejen de aparecer como disponibles en el stock.

    Endpoint: POST /api/inventario/procesar-devolucion/
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        """
        Procesa la creación de una solicitud de devolución.

        Args:
            request: Petición HTTP con los datos de la solicitud.

        Returns:
            Response: 201 Created si exitoso, 400 Bad Request si error.
        """
        usuario_id = request.data.get('usuarioId')
        fecha = request.data.get('fechaSolicitud')
        detalles = request.data.get('detalles', [])

        try:
            usuario = Usuario.objects.get(IdUsuario=usuario_id)
            entrada_id = request.data.get('IdEntradaInventario')
            entrada = EntradaInventario.objects.get(IdEntradaInventario=entrada_id)

            # Crear el encabezado de la solicitud
            solicitud = SolicitudDevolucion.objects.create(
                IdEntradaInventario=entrada,
                IdUsuario=usuario,
                Estado=request.data.get('Estado', 'Pendiente'),
                Observaciones=request.data.get('Observaciones', ''),
                Fecha=fecha
            )

            # Crear detalles y actualizar estado de cada unidad física
            for d in detalles:
                inv_id = d.get('inventarioId')
                precio = d.get('PrecioCompraUnitario')
                motivo = d.get('MotivoRechazo')
                inventario = Inventario.objects.get(IdInventario=inv_id)
                DetalleSolicitudDevolucion.objects.create(
                    IdSolicitudDevolucion=solicitud,
                    IdInventario=inventario,
                    MotivoRechazo=motivo,
                    PrecioCompraUnitario=precio,
                    EstadoItem=d.get('EstadoItem', 'Pendiente')
                )
                # Marcar como 'Devuelto' para que no aparezca en el stock disponible
                # mientras la solicitud está en proceso de revisión con el proveedor.
                inventario.Estado = 'Devuelto'
                inventario.save()
            return Response({"message": "Solicitud de devolución procesada."}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class DevolverStockView(APIView):
    """
    Reintegra al stock las unidades de una devolución ACEPTADA por el proveedor.

    Este endpoint se invoca cuando el proveedor acepta la devolución y se
    emite la nota de crédito. Las unidades vuelven a estar 'Disponibles'
    para ser vendidas de nuevo o se contabilizan como crédito en el sistema.

    Endpoint: POST /api/inventario/devolver-stock/
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        """
        Devuelve al stock las unidades de una solicitud de devolución aceptada.

        GUARD: Solo funciona si la solicitud está en estado 'Aceptada'.
        Esto evita que se reactive stock de devoluciones que aún están
        en revisión o fueron rechazadas.

        Args:
            request: Petición HTTP con {'solicitud_id': <id>}.

        Returns:
            Response: 200 OK si exitoso. 400/404 si hay error.
        """
        solicitud_id = request.data.get('solicitud_id')
        try:
            solicitud = SolicitudDevolucion.objects.get(IdSolicitudDevolucion=solicitud_id)

            # Verificar que la solicitud fue formalmente aceptada antes de reintegrar stock
            if solicitud.Estado != 'Aceptada':
                return Response(
                    {"error": "La solicitud debe estar Aceptada para devolver stock."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Reintegrar cada unidad al stock y marcar su ítem como Aceptado
            detalles = DetalleSolicitudDevolucion.objects.filter(IdSolicitudDevolucion=solicitud)
            for det in detalles:
                inventario = det.IdInventario
                inventario.Estado = 'Disponible'  # Disponible para venta nuevamente
                inventario.save()

                det.EstadoItem = 'Aceptado'
                det.save()

            return Response({"message": "Stock devuelto exitosamente."}, status=status.HTTP_200_OK)
        except SolicitudDevolucion.DoesNotExist:
            return Response({"error": "Solicitud no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ─── REPORTES DE INVENTARIO (funciones sp_) ────────────────────────────────────

class ReporteComprasFiltradasView(APIView):
    """
    Reporte de entradas de inventario (compras) filtradas por fecha y proveedor.

    Delega la lógica de consulta a la función PostgreSQL sp_compras_filtradas(),
    que realiza los JOINs y filtros en la BD de forma optimizada.

    Query params:
        inicio (str): Fecha de inicio en formato YYYY-MM-DD.
        fin (str): Fecha de fin en formato YYYY-MM-DD.
        proveedorId (str, opcional): ID del proveedor para filtrar.

    Firma de la función SQL:
        sp_compras_filtradas(inicio DATE, fin DATE, proveedor_id INT, p4 NULL, p5 NULL)
        → Retorna una tabla con columnas: id_entrada, fecha_ingreso, nombre_proveedor, total_compra
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        """
        Ejecuta el reporte de compras filtradas.

        NORMALIZACIÓN DE PROVEEDOR ID:
            El parámetro 'proveedorId' puede llegar como:
            - Una cadena numérica: "5" → se convierte a int(5)
            - Una cadena vacía: "" → se normaliza a None (NULL en SQL)
            - La cadena "null": "null" → se normaliza a None (NULL en SQL)
            Sin esta normalización, PostgreSQL lanzaría un error de tipo al
            intentar pasar "" como INTEGER.

        Returns:
            Response: Lista de compras en formato JSON, o error 400.
        """
        inicio = request.query_params.get('inicio')
        fin = request.query_params.get('fin')
        proveedor_id = request.query_params.get('proveedorId')

        if not inicio or not fin:
            return Response({"error": "Faltan fechas de inicio y fin"}, status=400)

        try:
            with connection.cursor() as cursor:
                # Normalización: convierte el ID a entero o None para evitar
                # errores de tipo en PostgreSQL al pasar strings vacíos.
                p_id = int(proveedor_id) if proveedor_id and proveedor_id.strip() not in ["", "null"] else None

                # Los parámetros 4 y 5 (None, None) son requeridos por la firma
                # de la función SQL para mantener compatibilidad con versiones anteriores.
                cursor.execute(
                    "SELECT * FROM sp_compras_filtradas(%s, %s, %s, %s, %s)",
                    [inicio, fin, p_id, None, None]
                )

                # Normalización de claves a minúsculas para consistencia con el frontend React.
                # El frontend espera claves snake_case en minúsculas, pero PostgreSQL
                # puede devolver los nombres de columna en cualquier capitalización.
                columns = [col[0] for col in cursor.description]
                result = [{k.lower(): v for k, v in zip(columns, row)} for row in cursor.fetchall()]
            return Response(result)
        except Exception as e:
            # Imprime el error real en la terminal de Django para facilitar debugging
            print(f"Error en Reporte Compras: {str(e)}")
            return Response({"error": str(e)}, status=400)


class ReporteProductosSinMovimientoView(APIView):
    """
    Reporte de productos que no han tenido ventas en los últimos N días.

    Útil para identificar mercancía estancada que podría vencerse o
    necesitar estrategias de promoción para liquidar el stock.

    Query params:
        dias (int, opcional): Número de días sin movimiento. Por defecto: 30.

    Lógica de conversión:
        El frontend solo envía "días" (ej: 30). Esta vista convierte ese número
        en un rango de fechas real (fecha_inicio = hoy - 30 días, fecha_fin = hoy)
        porque la función SQL sp_productos_sin_movimiento() opera sobre fechas,
        no sobre un contador de días.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        """
        Ejecuta el reporte de productos sin movimiento.

        Args:
            request: Petición con query param 'dias'.

        Returns:
            Response: Lista de productos estancados con su stock y días sin venta.
        """
        dias = request.query_params.get('dias', 30)
        try:
            # Convertir el parámetro a entero con validación implícita
            dias_int = int(dias)
            # Calcular el rango de fechas dinámicamente desde hoy hacia atrás
            fecha_fin = timezone.now().date()
            fecha_inicio = fecha_fin - timedelta(days=dias_int)

            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM sp_productos_sin_movimiento(%s, %s)",
                    [fecha_inicio, fecha_fin]
                )
                columns = [col[0] for col in cursor.description]
                result = [{k.lower(): v for k, v in zip(columns, row)} for row in cursor.fetchall()]
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=400)