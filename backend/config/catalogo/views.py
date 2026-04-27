"""
Vistas del Catálogo — App 'catalogo'
======================================

Expone los endpoints CRUD para las entidades maestras del negocio:
Categoría, Proveedor y Producto.

PERMISOS — IsAdminOrReadOnly (heredado de DRF DEFAULT_PERMISSION_CLASSES):
    Los ViewSets del catálogo no declaran permission_classes explícitamente,
    por lo que heredan la clase global definida en settings.py.
    Esto significa que:
    - Vendedores: Pueden consultar el catálogo (GET) para saber qué productos
      existen y a qué precio venderlos.
    - Admins: Pueden crear, editar y eliminar categorías, proveedores y productos.

    Para una seguridad más granular en el futuro, añadir:
        permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

PAGINACIÓN — Desactivada (pagination_class = None):
    El frontend carga todo el catálogo en memoria al inicio de cada sesión
    de venta (fetchInventoryForSale en Ventas.tsx). La paginación haría
    necesario manejar múltiples peticiones para tener el catálogo completo,
    lo que aumentaría la complejidad del cliente. Para catálogos pequeños
    (<500 productos), cargar todo de una vez es más simple y eficiente.

ENDPOINTS GENERADOS AUTOMÁTICAMENTE POR ModelViewSet:
    GET    /api/catalogo/categorias/          → listar categorías
    POST   /api/catalogo/categorias/          → crear categoría
    GET    /api/catalogo/categorias/<id>/     → detalle de categoría
    PUT    /api/catalogo/categorias/<id>/     → actualizar categoría
    PATCH  /api/catalogo/categorias/<id>/     → actualización parcial
    DELETE /api/catalogo/categorias/<id>/     → eliminar (RESTRICT si tiene productos)
    (ídem para proveedores/ y productos/)
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from usuarios.permissions import IsAdminOrReadOnly
from .models import Categoria, Proveedor, Producto
from .serializers import CategoriaSerializer, ProveedorSerializer, ProductoSerializer


class CategoriaViewSet(viewsets.ModelViewSet):
    """
    CRUD completo para el modelo Categoria.

    Las categorías definen el PorcentajeGanancia que se usa para calcular
    el precio de venta de todos los productos que pertenecen a ella.
    Cambiar el porcentaje afecta dinámicamente el precio de venta de todos
    sus productos en el siguiente request.
    """
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    # Sin paginación: el frontend carga todo el catálogo de categorías en la
    # página de Productos para poblar el select de "Categoría" del formulario.
    pagination_class = None


class ProveedorViewSet(viewsets.ModelViewSet):
    """
    CRUD completo para el modelo Proveedor.

    Los proveedores se vinculan a las EntradaInventario al registrar compras.
    Un proveedor con historial de compras no puede ser eliminado (RESTRICT en BD),
    solo desactivado cambiando su Estado a 'Inactivo'.
    """
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = None


class ProductoViewSet(viewsets.ModelViewSet):
    """
    CRUD completo para el modelo Producto.

    Los productos son el núcleo del catálogo. El serializer calcula en tiempo
    real el 'stock' (unidades disponibles) y 'salePrice' (precio de venta)
    para cada producto listado. Este cálculo dinámico garantiza que los datos
    mostrados en el POS (Ventas.tsx) siempre reflejen el estado actual del
    inventario sin necesidad de actualizar un campo almacenado.
    """
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = None
