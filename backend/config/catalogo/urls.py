"""
Enrutador de URLs — App 'catalogo'
=====================================

Registra los tres ViewSets del catálogo en el DefaultRouter de DRF.

POR QUÉ DefaultRouter Y NO path() MANUAL:
    DefaultRouter genera automáticamente los 6 endpoints estándar REST
    (list, create, retrieve, update, partial_update, destroy) para cada
    ViewSet registrado, más una raíz de API navegable en /api/catalogo/.
    Esto elimina ~20 líneas de path() por ViewSet.

ENDPOINTS GENERADOS:
    /api/catalogo/categorias/          GET(list), POST(create)
    /api/catalogo/categorias/<pk>/     GET(retrieve), PUT, PATCH, DELETE
    /api/catalogo/proveedores/         GET(list), POST(create)
    /api/catalogo/proveedores/<pk>/    GET(retrieve), PUT, PATCH, DELETE
    /api/catalogo/productos/           GET(list), POST(create)
    /api/catalogo/productos/<pk>/      GET(retrieve), PUT, PATCH, DELETE
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaViewSet, ProveedorViewSet, ProductoViewSet

# DefaultRouter: Genera automáticamente todos los endpoints REST estándar.
# El prefijo (ej: 'categorias') se añade al basename automáticamente para
# nombrar las rutas (ej: 'categoria-list', 'categoria-detail').
router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet)
router.register(r'proveedores', ProveedorViewSet)
router.register(r'productos', ProductoViewSet)

urlpatterns = [
    # include(router.urls): Añade todos los endpoints del router al patrón de URL.
    # El prefijo '/api/catalogo/' se define en config/urls.py.
    path('', include(router.urls)),
]
