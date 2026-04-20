from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EntradaInventarioViewSet,
    DetalleEntradaInventarioViewSet,
    InventarioViewSet,
    PerdidaViewSet,
    DetallePerdidaViewSet,
    SolicitudDevolucionViewSet,
    DetalleSolicitudDevolucionViewSet,
    ProcesarPerdidaView,
    ProcesarDevolucionView
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
    # 🔥 APIs personalizadas (lógica)
    path('procesar-perdida/', ProcesarPerdidaView.as_view(), name='procesar-perdida'),
    path('procesar-devolucion/', ProcesarDevolucionView.as_view(), name='procesar-devolucion'),

    # 🔹 CRUD automático
    path('', include(router.urls)),
]