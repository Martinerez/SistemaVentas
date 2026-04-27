"""
Enrutador de URLs — App 'inventario'
=======================================

Combina dos tipos de enrutamiento:
  1. DefaultRouter: Para operaciones CRUD estándar de los ViewSets.
  2. path() manual: Para vistas APIView con lógica transaccional personalizada.

SEPARACIÓN DE RESPONSABILIDADES:
    Los ViewSets (DefaultRouter) manejan operaciones simples de datos.
    Las vistas APIView manuales manejan operaciones de negocio complejas que
    requieren @transaction.atomic y múltiples cambios de estado coordinados.

ENDPOINTS CRUD (DefaultRouter):
    /api/inventario/entradas/               → EntradaInventarioViewSet
    /api/inventario/detalles-entrada/       → DetalleEntradaInventarioViewSet
    /api/inventario/inventarios/            → InventarioViewSet
    /api/inventario/perdidas/               → PerdidaViewSet
    /api/inventario/detalles-perdida/       → DetallePerdidaViewSet
    /api/inventario/solicitudes-devolucion/ → SolicitudDevolucionViewSet
    /api/inventario/detalles-solicitud/     → DetalleSolicitudDevolucionViewSet

ENDPOINTS TRANSACCIONALES (APIView):
    POST /api/inventario/procesar-perdida/              → ProcesarPerdidaView
    POST /api/inventario/procesar-devolucion/           → ProcesarDevolucionView
    POST /api/inventario/devolver-stock/                → DevolverStockView

ENDPOINTS DE REPORTES SQL (APIView):
    GET /api/inventario/reporte-compras-filtradas/          → sp_compras_filtradas()
    GET /api/inventario/reporte-productos-sin-movimiento/   → sp_productos_sin_movimiento()

ORDEN EN urlpatterns:
    Las rutas de APIView se declaran ANTES de include(router.urls).
    Esto evita que el router capture accidentalmente las URLs personalizadas
    si existiera alguna colisión de prefijos.
"""

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
    # ── Endpoints transaccionales (lógica de negocio compleja) ──────────────
    # Se declaran antes del router para garantizar prioridad si hay conflictos de ruta.
    path('procesar-perdida/', ProcesarPerdidaView.as_view(), name='procesar-perdida'),
    path('procesar-devolucion/', ProcesarDevolucionView.as_view(), name='procesar-devolucion'),
    path('devolver-stock/', DevolverStockView.as_view(), name='devolver-stock'),

    # ── Reportes de inventario (delegan a funciones PostgreSQL sp_) ─────────
    path('reporte-compras-filtradas/', ReporteComprasFiltradasView.as_view(), name='reporte-compras-filtradas'),
    path('reporte-productos-sin-movimiento/', ReporteProductosSinMovimientoView.as_view(), name='reporte-productos-sin-movimiento'),

    # ── CRUD automático (ViewSets) ───────────────────────────────────────────
    path('', include(router.urls)),
]