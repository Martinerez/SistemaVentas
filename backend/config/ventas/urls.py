from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VentaViewSet, 
    DetalleVentaViewSet, 
    DashboardStatsView, 
    ProcesarVentaView,
    ReporteGerencialView,
    ReportePivotVentasView,
    ProductosPorProveedorView
)

router = DefaultRouter()
router.register(r'ventas', VentaViewSet)
router.register(r'detalles', DetalleVentaViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('procesar/', ProcesarVentaView.as_view(), name='procesar-venta'),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('reporte-gerencial/', ReporteGerencialView.as_view(), name='reporte-gerencial'),
    path('reporte-pivot/', ReportePivotVentasView.as_view(), name='reporte-pivot'),
    path('productos-proveedor/', ProductosPorProveedorView.as_view(), name='reporte-productos-proveedor'),
]