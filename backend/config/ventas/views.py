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

# --- VIEWSETS PARA CRUD ---
class VentaViewSet(viewsets.ModelViewSet):
    queryset = Venta.objects.all()
    serializer_class = VentaSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = None

class DetalleVentaViewSet(viewsets.ModelViewSet):
    queryset = DetalleVenta.objects.all()
    serializer_class = DetalleVentaSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

# --- PROCESAR VENTA ---
class ProcesarVentaView(APIView):
    permission_classes = [CanProcessSale]

    @transaction.atomic
    def post(self, request):
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
                inventario = Inventario.objects.select_for_update().get(IdInventario=inv_id)
                DetalleVenta.objects.create(IdVenta=venta, IdInventario=inventario, PrecioVentaUnitario=precio)
                inventario.Estado = "Vendido"
                inventario.save()
            return Response({"message": "Venta exitosa"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

# --- ANULAR VENTA ---
class AnularVentaView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request, pk):
        try:
            venta = Venta.objects.select_for_update().get(pk=pk)
        except Venta.DoesNotExist:
            return Response({"error": "Venta no encontrada."}, status=status.HTTP_404_NOT_FOUND)

        if venta.Estado == 'Anulada':
            return Response(
                {"error": "Esta venta ya fue anulada previamente."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Revertir stock: marcar cada ítem de inventario como 'Disponible'
        detalles = DetalleVenta.objects.filter(IdVenta=venta).select_related('IdInventario')
        for detalle in detalles:
            inventario = Inventario.objects.select_for_update().get(
                IdInventario=detalle.IdInventario_id
            )
            inventario.Estado = 'Disponible'
            inventario.FechaMovimiento = timezone.now()
            inventario.save()

        venta.Estado = 'Anulada'
        venta.save()

        return Response(
            {"message": f"Venta #{pk} anulada correctamente. Stock revertido."},
            status=status.HTTP_200_OK
        )


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def get(self, request):
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)

        total_products = Producto.objects.count()
        ventas_semana = Venta.objects.filter(Fecha__gte=seven_days_ago)
        weekly_sales = ventas_semana.aggregate(total=Sum('Total'))['total'] or 0
        total_proveedores = Proveedor.objects.count()

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

        recent_sales_qs = Venta.objects.order_by('-Fecha')[:5]
        recent_sales = [{
            "id": v.IdVenta,
            "time": v.Fecha.strftime("%I:%M %p"),
            "items": v.detalles.count(),
            "total": float(v.Total)
        } for v in recent_sales_qs]


        # 6. Perdidas de los últimos 7 días
        perdidas_semana = Perdida.objects.filter(Fecha__gte=seven_days_ago)
        weekly_losses = perdidas_semana.aggregate(total=Sum('Total'))['total'] or 0

        # 7. Chart data (ventas diarias)
        sales_by_date = ventas_semana.annotate(date=TruncDate('Fecha')).values('date').annotate(
            total=Sum('Total')
        ).order_by('date')
        
        chart_data = [{"date": s['date'].strftime('%a'), "total": float(s['total'])} for s in sales_by_date]
        if not chart_data: chart_data = [{"date": "Hoy", "total": 0}]

        response_data = {
            "totalProducts": total_products,
            "weeklySales": float(weekly_sales),
            "totalProveedores": total_proveedores,
            "lowStockItems": low_stock_items,
            "recentSales": recent_sales,
            "weeklyLosses": float(weekly_losses),
            "chartData": chart_data
        }

        # Filtro de privacidad: los vendedores no ven datos financieros sensibles
        if getattr(request.user, 'Rol', None) == 'vendedor':
            response_data['weeklySales'] = None
            response_data['weeklyLosses'] = None

        return Response(response_data)

# --- REPORTES GENERALES ---
class ReporteGerencialView(APIView):
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
    permission_classes = [IsAuthenticated, IsAdminRole]
    def get(self, request):
        anio, prod_id = request.query_params.get('anio'), request.query_params.get('productoId')
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM reporte_mensual_producto_pivot(%s, %s)", [anio, prod_id])
            columns = [col[0] for col in cursor.description]
            row = cursor.fetchone()
        if row: return Response(dict(zip(columns, row)))
        return Response({"producto": "Sin datos", "ene":0, "feb":0, "mar":0, "abr":0, "may":0, "jun":0, "jul":0, "ago":0, "sep":0, "oct":0, "nov":0, "dic":0})
    
class ProductosPorProveedorView(APIView):
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
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        inicio = request.query_params.get('inicio')
        fin = request.query_params.get('fin')
        
        if not inicio or not fin:
            return Response({"error": "Faltan fechas de inicio y fin"}, status=400)

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT * FROM devoluciones_por_fecha(%s, %s)", [inicio, fin])
                columns = [col[0] for col in cursor.description]
                result = [dict(zip(columns, row)) for row in cursor.fetchall()]
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=400)
        
class ReportePerdidasView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        inicio = request.query_params.get('inicio')
        fin = request.query_params.get('fin')

        if not inicio or not fin:
            return Response({"error": "Faltan fechas"}, status=400)

        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM perdidas_por_fecha(%s, %s)",
                    [inicio, fin]
                )
                columns = [col[0] for col in cursor.description]
                result = [dict(zip(columns, row)) for row in cursor.fetchall()]

            return Response(result)

        except Exception as e:
            return Response({"error": str(e)}, status=400)