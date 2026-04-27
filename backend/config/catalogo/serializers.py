"""
Serializadores del Catálogo — App 'catalogo'
=============================================

Convierten los modelos Categoria, Proveedor y Producto en JSON para la API,
y viceversa. Incluyen campos calculados (SerializerMethodField) que agregan
información de negocio en tiempo real sin denormalizar la base de datos.

CAMPOS CALCULADOS vs. CAMPOS ALMACENADOS:
    Los campos 'stock', 'salePrice', 'productCount' y 'pedidos_recientes'
    se calculan en cada petición en lugar de almacenarse en la BD porque:
    - Stock: Cambia constantemente con cada venta, pérdida o devolución.
      Almacenarlo requeriría sincronización compleja o triggers en BD.
    - salePrice: Depende del PrecioCompra más reciente Y del PorcentajeGanancia
      actual de la categoría. Si se almacenara y la categoría cambia su %, todos
      los precios quedarían desactualizados.
    - pedidos_recientes: Dato de monitoreo, no de negocio crítico.

    El costo: Una petición extra a la BD por cada instancia serializada.
    Para listas grandes, considerar selectionar_related() o prefetch_related().
"""

from rest_framework import serializers
from .models import Categoria, Proveedor, Producto
from inventario.models import EntradaInventario, Inventario, DetalleEntradaInventario
from datetime import timedelta
from django.utils import timezone


class CategoriaSerializer(serializers.ModelSerializer):
    """
    Serializador de Categoría con conteo de productos asociados.

    El campo 'productCount' permite al frontend mostrar cuántos productos
    tiene cada categoría sin necesitar una petición separada.
    """

    id = serializers.IntegerField(source='IdCategoria', read_only=True)
    name = serializers.CharField(source='Nombre')
    profitPercentage = serializers.DecimalField(source='PorcentajeGanancia', max_digits=5, decimal_places=2)
    status = serializers.CharField(source='Estado', required=False)
    # SerializerMethodField: Campo de solo lectura calculado por get_productCount()
    productCount = serializers.SerializerMethodField()

    class Meta:
        model = Categoria
        fields = ['id', 'name', 'profitPercentage', 'status', 'productCount']

    def get_productCount(self, obj):
        """
        Cuenta los productos asociados a esta categoría.

        Usa el reverse relationship automático de Django (producto_set).
        COUNT en BD es más eficiente que traer todos los productos y hacer len().

        Args:
            obj (Categoria): Instancia de la categoría siendo serializada.

        Returns:
            int: Número de productos en esta categoría.
        """
        return obj.producto_set.count()


class ProveedorSerializer(serializers.ModelSerializer):
    """
    Serializador de Proveedor con métricas de actividad comercial.

    Incluye dos campos calculados de monitoreo que el frontend usa en el
    panel de gestión de proveedores para mostrar su actividad reciente.
    """

    id = serializers.IntegerField(source='IdProveedor', read_only=True)
    name = serializers.CharField(source='Nombre')
    contact = serializers.CharField(source='Contacto', required=False, allow_null=True)
    status = serializers.CharField(source='Estado', required=False)
    # Pedidos en los últimos 30 días: Indicador de frecuencia de compra
    pedidos_recientes = serializers.SerializerMethodField()
    # Si el proveedor tiene alguna entrada de inventario (históricamente activo)
    activo = serializers.SerializerMethodField()

    class Meta:
        model = Proveedor
        fields = ['id', 'name', 'contact', 'status', 'pedidos_recientes', 'activo']

    def get_pedidos_recientes(self, obj):
        """
        Cuenta las entradas de inventario de este proveedor en los últimos 30 días.

        Se usa timezone.now() en lugar de datetime.now() para respetar la
        configuración USE_TZ = True del settings y evitar comparaciones
        entre fechas naive y aware.

        Args:
            obj (Proveedor): Instancia del proveedor siendo serializado.

        Returns:
            int: Número de pedidos en los últimos 30 días.
        """
        hace_30_dias = timezone.now() - timedelta(days=30)
        return EntradaInventario.objects.filter(
            IdProveedor=obj,
            FechaEntrada__gte=hace_30_dias
        ).count()

    def get_activo(self, obj):
        """
        Determina si el proveedor ha tenido al menos una entrada de inventario.

        Se usa .exists() en lugar de .count() > 0 porque es más eficiente:
        .exists() detiene la búsqueda en la BD al encontrar el primer registro.

        Args:
            obj (Proveedor): Instancia del proveedor.

        Returns:
            bool: True si el proveedor tiene historial de compras.
        """
        return EntradaInventario.objects.filter(IdProveedor=obj).exists()


class ProductoSerializer(serializers.ModelSerializer):
    """
    Serializador de Producto con stock en tiempo real y precio de venta calculado.

    CÁLCULO DE PRECIO DE VENTA (salePrice):
        El precio de venta NO se almacena en la BD para evitar inconsistencias.
        Se calcula como:
            salePrice = PrecioCompraUnitario × (1 + PorcentajeGanancia / 100)

        Donde:
        - PrecioCompraUnitario: El último precio de compra registrado para este
          producto (DetalleEntradaInventario más reciente).
        - PorcentajeGanancia: El margen definido en la Categoría del producto.

        Si el producto nunca fue comprado, salePrice = 0.0 (precio base cero).
    """

    id = serializers.IntegerField(source='IdProducto', read_only=True)
    name = serializers.CharField(source='Nombre')
    # PrimaryKeyRelatedField: Acepta un ID entero de Categoria en el POST/PUT
    # y lo convierte automáticamente en la instancia del objeto de la BD.
    categoryId = serializers.PrimaryKeyRelatedField(source='IdCategoria', queryset=Categoria.objects.all())
    status = serializers.CharField(source='Estado', required=False)
    stock = serializers.SerializerMethodField()
    salePrice = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = ['id', 'name', 'categoryId', 'status', 'stock', 'salePrice']

    def get_stock(self, obj):
        """
        Calcula el stock disponible contando unidades físicas en estado 'Disponible'.

        La doble navegación de FK (IdDetalleEntrada__IdProducto) en el filtro
        permite buscar en la tabla de inventario todos los registros cuya cadena
        de relaciones lleva hasta este producto, sin necesidad de JOINs manuales.

        Args:
            obj (Producto): Instancia del producto.

        Returns:
            int: Número de unidades físicas con Estado == 'Disponible'.
        """
        return Inventario.objects.filter(
            IdDetalleEntrada__IdProducto=obj,
            Estado='Disponible'
        ).count()

    def get_salePrice(self, obj):
        """
        Calcula el precio de venta sugerido basado en el último precio de compra
        y el porcentaje de ganancia de la categoría del producto.

        Args:
            obj (Producto): Instancia del producto.

        Returns:
            float: Precio de venta redondeado a 2 decimales, o 0.0 si no hay compras.
        """
        # Obtener el detalle de compra más reciente para este producto.
        # order_by('-IdDetalleEntrada') ordena descendentemente: el ID más alto
        # es el registro más nuevo (ya que AutoField es secuencial).
        latest_detalle = DetalleEntradaInventario.objects.filter(
            IdProducto=obj
        ).order_by('-IdDetalleEntrada').first()

        base_price = float(latest_detalle.PrecioCompraUnitario) if latest_detalle else 0.0
        profit = float(obj.IdCategoria.PorcentajeGanancia)

        # Fórmula: precio_base × (1 + margen_decimal)
        # Ejemplo: C$10 de costo con 30% de ganancia → C$10 × 1.30 = C$13
        return round(base_price * (1 + (profit / 100)), 2)