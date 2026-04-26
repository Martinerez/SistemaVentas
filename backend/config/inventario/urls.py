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
    ProcesarDevolucionView,
    DevolverStockView,
    ReporteComprasFiltradasView,
    ReporteProductosSinMovimientoView,
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
    # 🔥 APIs personalizadas (lógica transaccional)
    path('procesar-perdida/', ProcesarPerdidaView.as_view(), name='procesar-perdida'),
    path('procesar-devolucion/', ProcesarDevolucionView.as_view(), name='procesar-devolucion'),
    path('devolver-stock/', DevolverStockView.as_view(), name='devolver-stock'),

    # --- Reportes de inventario (funciones sp_) ---
    path('reporte-compras-filtradas/', ReporteComprasFiltradasView.as_view(), name='reporte-compras-filtradas'),
    path('reporte-productos-sin-movimiento/', ReporteProductosSinMovimientoView.as_view(), name='reporte-productos-sin-movimiento'),

    # 🔹 CRUD automático (ViewSets)
    path('', include(router.urls)),
]