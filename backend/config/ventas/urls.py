"""
Enrutador de URLs — App 'ventas'
==================================

Define todos los endpoints de ventas, procesamiento transaccional, dashboard
y reportes gerenciales.

CATEGORÍAS DE ENDPOINTS:

1. CRUD Estándar (DefaultRouter):
   /api/ventas/ventas/         → VentaViewSet  (historial de ventas)
   /api/ventas/detalles/       → DetalleVentaViewSet

2. Transaccionales (APIView con @transaction.atomic):
   POST /api/ventas/procesar/            → ProcesarVentaView
   POST /api/ventas/<pk>/anular/         → AnularVentaView

3. Dashboard:
   GET  /api/ventas/dashboard/stats/     → DashboardStatsView

4. Reportes Simples (funciones SQL sin prefijo sp_):
   GET  /api/ventas/reporte-gerencial/         → reporte_gerencial()
   GET  /api/ventas/reporte-pivot/             → reporte_mensual_producto_pivot()
   GET  /api/ventas/productos-proveedor/       → reporte_productos_por_proveedor()
   GET  /api/ventas/reporte-devoluciones/      → devoluciones_por_fecha()
   GET  /api/ventas/reporte-perdidas/          → perdidas_por_fecha()

5. Reportes Avanzados (funciones SQL prefijadas sp_):
   GET  /api/ventas/reporte-ventas-filtradas/      → sp_ventas_filtradas()
   GET  /api/ventas/reporte-top-productos/         → sp_top_productos()
   GET  /api/ventas/reporte-ganancia-producto/     → sp_ganancia_producto()
   GET  /api/ventas/reporte-comparacion-ventas/    → sp_comparar_ventas()

NOTA SOBRE <int:pk>/anular/:
    Este patrón captura el ID de la venta directamente desde la URL.
    Es más RESTful que enviar el ID en el body del POST, porque la URL
    identifica el recurso (/ventas/5/anular/ = "anular la venta 5").
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ReportePerdidasView,
    VentaViewSet,
    DetalleVentaViewSet,
    DashboardStatsView,
    ProcesarVentaView,
    AnularVentaView,
    ReporteGerencialView,
    ReportePivotVentasView,
    ProductosPorProveedorView,
    ReporteDevolucionesView,
    ReporteVentasFiltradasView,
    ReporteTopProductosView,
    ReporteGananciaProductoView,
    ReporteComparacionVentasView,
)

router = DefaultRouter()
router.register(r'ventas', VentaViewSet)
router.register(r'detalles', DetalleVentaViewSet)

urlpatterns = [
    # ── CRUD estándar ───────────────────────────────────────────────────────
    path('', include(router.urls)),

    # ── Operaciones transaccionales de venta ────────────────────────────────
    path('procesar/', ProcesarVentaView.as_view(), name='procesar-venta'),
    # <int:pk>: Captura el ID de la venta en la URL para AnularVentaView.post(request, pk)
    path('<int:pk>/anular/', AnularVentaView.as_view(), name='anular-venta'),

    # ── Dashboard ────────────────────────────────────────────────────────────
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),

    # ── Reportes simples (funciones PL/pgSQL sin prefijo sp_) ───────────────
    path('reporte-gerencial/', ReporteGerencialView.as_view(), name='reporte-gerencial'),
    path('reporte-pivot/', ReportePivotVentasView.as_view(), name='reporte-pivot'),
    path('productos-proveedor/', ProductosPorProveedorView.as_view(), name='reporte-productos-proveedor'),
    path('reporte-devoluciones/', ReporteDevolucionesView.as_view(), name='reporte-devoluciones'),
    path('reporte-perdidas/', ReportePerdidasView.as_view(), name='reporte-perdidas'),

    # ── Reportes avanzados (stored procedures sp_) ───────────────────────────
    path('reporte-ventas-filtradas/', ReporteVentasFiltradasView.as_view(), name='reporte-ventas-filtradas'),
    path('reporte-top-productos/', ReporteTopProductosView.as_view(), name='reporte-top-productos'),
    path('reporte-ganancia-producto/', ReporteGananciaProductoView.as_view(), name='reporte-ganancia-producto'),
    path('reporte-comparacion-ventas/', ReporteComparacionVentasView.as_view(), name='reporte-comparacion-ventas'),
]