from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncDate

from .models import Venta, DetalleVenta
from .serializers import VentaSerializer, DetalleVentaSerializer
from catalogo.models import Producto, Proveedor
from inventario.models import Inventario
from usuarios.models import Usuario
from usuarios.permissions import IsAdminRole

class VentaViewSet(viewsets.ModelViewSet):
    queryset = Venta.objects.all()
    serializer_class = VentaSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

class DetalleVentaViewSet(viewsets.ModelViewSet):
    queryset = DetalleVenta.objects.all()
    serializer_class = DetalleVentaSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

class ProcesarVentaView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        usuario_id = request.data.get('usuarioId')
        fecha = request.data.get('fecha')
        total = request.data.get('total')
        detalles = request.data.get('detalles', [])
        
        try:
            usuario = Usuario.objects.get(IdUsuario=usuario_id)
            
            # Crear la Venta
            venta = Venta.objects.create(
                IdUsuario=usuario,
                Fecha=fecha,
                Total=total
            )
            
            for d in detalles:
                inv_id = d.get('inventarioId')
                precio = d.get('precioVentaUnitario')
                
                # Lock row to prevent race conditions (double sale of same inventory item)
                inventario = Inventario.objects.select_for_update().get(IdInventario=inv_id)
                if inventario.Estado != "Disponible":
                    raise ValueError(f"El ítem de inventario {inv_id} ya no está Disponible (Estado actual: {inventario.Estado}).")
                    
                DetalleVenta.objects.create(
                    IdVenta=venta,
                    IdInventario=inventario,
                    PrecioVentaUnitario=precio
                )
                
                inventario.Estado = "Vendido"
                inventario.save()
                
            return Response({"message": "Venta procesada exitosamente", "ventaId": venta.IdVenta}, status=status.HTTP_201_CREATED)
        except Usuario.DoesNotExist:
            return Response({"error": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except Inventario.DoesNotExist:
            return Response({"error": "Ítem de inventario no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as ve:
            return Response({"error": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Error interno: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DashboardStatsView(APIView):
    def get(self, request):
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)

        # 1. Total de Productos Activos (en Catálogo)
        total_products = Producto.objects.count()

        # 2. Ventas de los últimos 7 días
        ventas_semana = Venta.objects.filter(Fecha__gte=seven_days_ago)
        weekly_sales = ventas_semana.aggregate(total=Sum('Total'))['total'] or 0

        # 3. Proveedores Activos
        total_proveedores = Proveedor.objects.filter(Estado='Activo').count()

        # 4. Stock Bajo (Productos con < 10 items Disponibles)
        # Using reverse relations from Producto -> DetalleEntradaInventario -> Inventario
        low_stock_qs = Producto.objects.annotate(
            stock=Count(
                'detalleentradainventario__inventario', 
                filter=Q(detalleentradainventario__inventario__Estado='Disponible')
            )
        ).filter(stock__lt=10).order_by('stock')[:5]

        low_stock_items = [
            {
                "id": p.IdProducto,
                "name": p.Nombre,
                "stock": p.stock,
                "min": 10,
                "category": p.IdCategoria.Nombre if p.IdCategoria else "General"
            }
            for p in low_stock_qs
        ]

        # 5. Ventas recientes (Últimas 5) para la tabla del Dashboard
        recent_sales_qs = Venta.objects.order_by('-Fecha')[:5]
        recent_sales = [
            {
                "id": v.IdVenta,
                "time": v.Fecha.strftime("%I:%M %p"),
                "items": v.detalleventa_set.count(),
                "total": f"${v.Total}"
            }
            for v in recent_sales_qs
        ]

        # 6. Chart data (ventas diarias)
        sales_by_date = ventas_semana.annotate(date=TruncDate('Fecha')).values('date').annotate(
            total=Sum('Total')
        ).order_by('date')
        
        chart_data = [
            {
                "date": s['date'].strftime('%A')[:3], # Mon, Tue, etc.
                "total": float(s['total'])
            }
            for s in sales_by_date
        ]

        # Add mock chart data if not enough data yet for visualization context
        if len(chart_data) == 0:
            chart_data = [
                {"date": "Lun", "total": 0},
                {"date": "Mar", "total": 0},
                {"date": "Mie", "total": 0},
            ]

        return Response({
            "totalProducts": total_products,
            "weeklySales": float(weekly_sales),
            "totalProveedores": total_proveedores,
            "lowStockItems": low_stock_items,
            "recentSales": recent_sales,
            "chartData": chart_data
        })
