from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EntradaInventarioViewSet, DetalleEntradaInventarioViewSet, InventarioViewSet,
    PerdidaViewSet, DetallePerdidaViewSet, SolicitudDevolucionViewSet, DetalleSolicitudDevolucionViewSet
)

router = DefaultRouter()
router.register(r'entradas', EntradaInventarioViewSet)
router.register(r'detalles-entrada', DetalleEntradaInventarioViewSet)
router.register(r'inventarios', InventarioViewSet)
router.register(r'perdidas', PerdidaViewSet)
router.register(r'detalles-perdida', DetallePerdidaViewSet)
router.register(r'solicitudes-devolucion', SolicitudDevolucionViewSet)
router.register(r'detalles-solicitud', DetalleSolicitudDevolucionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
