from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VentaViewSet, DetalleVentaViewSet, DashboardStatsView, ProcesarVentaView

router = DefaultRouter()
router.register(r'ventas', VentaViewSet)
router.register(r'detalles-venta', DetalleVentaViewSet)

urlpatterns = [
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('procesar/', ProcesarVentaView.as_view(), name='procesar-venta'),
    path('', include(router.urls)),
]
