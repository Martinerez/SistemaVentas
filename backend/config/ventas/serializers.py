from rest_framework import serializers
from .models import Venta, DetalleVenta
from usuarios.models import Usuario
from inventario.models import Inventario

class VentaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdVenta', read_only=True)
    usuarioId = serializers.PrimaryKeyRelatedField(source='IdUsuario', queryset=Usuario.objects.all())
    fecha = serializers.DateTimeField(source='Fecha')
    total = serializers.DecimalField(source='Total', max_digits=12, decimal_places=2)

    class Meta:
        model = Venta
        fields = ['id', 'usuarioId', 'fecha', 'total']

class DetalleVentaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdDetalleVenta', read_only=True)
    ventaId = serializers.PrimaryKeyRelatedField(source='IdVenta', queryset=Venta.objects.all())
    inventarioId = serializers.PrimaryKeyRelatedField(source='IdInventario', queryset=Inventario.objects.all())
    precioVentaUnitario = serializers.DecimalField(source='PrecioVentaUnitario', max_digits=12, decimal_places=2)

    class Meta:
        model = DetalleVenta
        fields = ['id', 'ventaId', 'inventarioId', 'precioVentaUnitario']
