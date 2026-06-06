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
    - salePrice: Depende del PrecioCompra Y del PorcentajeGanancia
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
from django.db.models import Avg


class CategoriaSerializer(serializers.ModelSerializer):
    """
    Serializador de Categoría con conteo de productos asociados.

    El campo 'productCount' permite al frontend mostrar cuántos productos
    tiene cada categoría sin necesitar una petición separada.
    """

    id = serializers.IntegerField(source='IdCategoria', read_only=True)
    # validators=[]: Desactiva el UniqueValidator que DRF inyecta automáticamente
    # al detectar unique=True en Categoria.Nombre. Sin esto, DRF dispara su propio
    # error en inglés ANTES de que llegue a nuestro validate_name(), haciendo que
    # nuestro mensaje en español y la lógica de __iexact nunca se ejecuten.
    # La unicidad la controlamos nosotros en validate_name() con __iexact.
    name = serializers.CharField(source='Nombre', validators=[])
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

    def validate_name(self, value):
        """
        Normaliza y verifica la unicidad del nombre de la categoría.

        Pasos:
          1. Limpia espacios en blanco al inicio y final del string.
          2. Busca en BD una categoría con el mismo nombre, ignorando
             diferencias de mayúsculas/minúsculas (__iexact).
          3. En actualizaciones (PUT/PATCH), excluye la propia instancia
             de la búsqueda para no generar un falso positivo al guardar
             sin cambiar el nombre.

        DRF ejecuta este método automáticamente antes de .is_valid() porque
        el campo se llama 'name' (validate_<field_name>).

        Args:
            value (str): Valor del campo 'name' recibido desde el request.

        Returns:
            str: Nombre limpio y validado.

        Raises:
            serializers.ValidationError: Si ya existe otra categoría con ese nombre.
        """
        # Paso 1 — Normalizar espacios para evitar duplicados como "Lácteos " vs "Lácteos"
        nombre_limpio = value.strip()

        # Paso 2 — Construir el queryset base de búsqueda por nombre exacto (case-insensitive)
        qs = Categoria.objects.filter(Nombre__iexact=nombre_limpio)

        # Paso 3 — Excluir la instancia actual en operaciones de actualización.
        # self.instance es None en POST (creación) y la instancia existente en PUT/PATCH.
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                f'Ya existe una categoría con el nombre "{nombre_limpio}". '
                f'Los nombres de categoría deben ser únicos.'
            )

        return nombre_limpio


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
    activo = serializers.SerializerMethodField()
    # Si el proveedor tiene productos asignados en el catálogo
    tiene_productos = serializers.SerializerMethodField()

    class Meta:
        model = Proveedor
        fields = ['id', 'name', 'contact', 'status', 'pedidos_recientes', 'activo', 'tiene_productos']

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
        return EntradaInventario.objects.filter(IdProveedor=obj).exists()

    def get_tiene_productos(self, obj):
        """
        Determina si el proveedor tiene al menos un producto asignado en el catálogo.
        """
        return Producto.objects.filter(IdProveedor=obj).exists()


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
    # NUEVO: Campos para proveedor y presentación (Proveedor obligatorio)
    proveedorId = serializers.PrimaryKeyRelatedField(source='IdProveedor', queryset=Proveedor.objects.all(), required=True, allow_null=False)
    presentacion = serializers.CharField(source='Presentacion', required=False, allow_null=True, allow_blank=True)
    status = serializers.CharField(source='Estado', required=False)
    imagen = serializers.CharField(source='Imagen', required=False, allow_null=True, allow_blank=True)
    stock = serializers.SerializerMethodField()
    salePrice = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = ['id', 'name', 'categoryId', 'status', 'stock', 'salePrice', 'proveedorId', 'presentacion', 'imagen']

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
        Calcula el precio de venta usando el promedio de compra
        y el porcentaje de ganancia de la categoría.

        """
        promedio = DetalleEntradaInventario.objects.filter(
            IdProducto=obj
        ).aggregate(
            promedio=Avg('PrecioCompraUnitario')
        )['promedio']

        # Si no hay compras, usar 0
        base_price = float(promedio) if promedio else 0.0

        # Porcentaje de ganancia de la categoría
        profit = float(obj.IdCategoria.PorcentajeGanancia)

        # Precio final
        return int(round(base_price * (1 + (profit / 100))))
    
    