from rest_framework import serializers 
from .models import Categoria, Proveedor, Producto
from inventario.models import EntradaInventario, Inventario, DetalleEntradaInventario
from datetime import timedelta
from django.utils import timezone


class CategoriaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdCategoria', read_only=True)
    name = serializers.CharField(source='Nombre')
    profitPercentage = serializers.DecimalField(source='PorcentajeGanancia', max_digits=5, decimal_places=2)
    status = serializers.CharField(source='Estado', required=False)
    productCount = serializers.SerializerMethodField()

    class Meta:
        model = Categoria
        fields = ['id', 'name', 'profitPercentage', 'status', 'productCount']

    def get_productCount(self, obj):
        return obj.producto_set.count()


# 🔥 PROVEEDOR (TODO EN UNO)
class ProveedorSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdProveedor', read_only=True)
    name = serializers.CharField(source='Nombre')
    contact = serializers.CharField(source='Contacto', required=False, allow_null=True)
    status = serializers.CharField(source='Estado', required=False)

    pedidos_recientes = serializers.SerializerMethodField()
    activo = serializers.SerializerMethodField()

    class Meta:
        model = Proveedor
        fields = [
            'id',
            'name',
            'contact',
            'status',
            'pedidos_recientes',
            'activo'
        ]

    def get_pedidos_recientes(self, obj):
        hace_30_dias = timezone.now() - timedelta(days=30)

        return EntradaInventario.objects.filter(
            IdProveedor=obj,  # 🔥 CORREGIDO (antes estaba mal)
            FechaEntrada__gte=hace_30_dias
        ).count()

    def get_activo(self, obj):
        return EntradaInventario.objects.filter(
            IdProveedor=obj
        ).exists()


class ProductoSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdProducto', read_only=True)
    name = serializers.CharField(source='Nombre')
    categoryId = serializers.PrimaryKeyRelatedField(source='IdCategoria', queryset=Categoria.objects.all())
    status = serializers.CharField(source='Estado', required=False)
    stock = serializers.SerializerMethodField()
    salePrice = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = ['id', 'name', 'categoryId', 'status', 'stock', 'salePrice']

    def get_stock(self, obj):
        return Inventario.objects.filter(
            IdDetalleEntrada__IdProducto=obj,
            Estado='Disponible'
        ).count()

    def get_salePrice(self, obj):
        latest_detalle = DetalleEntradaInventario.objects.filter(
            IdProducto=obj
        ).order_by('-IdDetalleEntrada').first()

        base_price = float(latest_detalle.PrecioCompraUnitario) if latest_detalle else 0.0
        profit = float(obj.IdCategoria.PorcentajeGanancia)

        return round(base_price * (1 + (profit / 100)), 2)