from rest_framework import serializers
from .models import Venta, DetalleVenta
from usuarios.models import Usuario
from inventario.models import Inventario


class DetalleVentaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdDetalleVenta', read_only=True)
    ventaId = serializers.PrimaryKeyRelatedField(source='IdVenta', queryset=Venta.objects.all())
    inventarioId = serializers.PrimaryKeyRelatedField(source='IdInventario', queryset=Inventario.objects.all())
    precioVentaUnitario = serializers.DecimalField(source='PrecioVentaUnitario', max_digits=12, decimal_places=2)
    # Campos enriquecidos para el historial expandible del frontend
    nombreProducto = serializers.SerializerMethodField()

    class Meta:
        model = DetalleVenta
        fields = ['id', 'ventaId', 'inventarioId', 'precioVentaUnitario', 'nombreProducto']

    def get_nombreProducto(self, obj):
        """Navega Inventario → DetalleEntrada → Producto para obtener el nombre."""
        try:
            return obj.IdInventario.IdDetalleEntrada.IdProducto.Nombre
        except AttributeError:
            return 'Producto desconocido'


class VentaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdVenta', read_only=True)
    usuarioId = serializers.PrimaryKeyRelatedField(source='IdUsuario', queryset=Usuario.objects.all())
    fecha = serializers.DateTimeField(source='Fecha')
    total = serializers.DecimalField(source='Total', max_digits=12, decimal_places=2)
    estado = serializers.CharField(source='Estado', read_only=True)
    # Campo anidado que usa related_name='detalles' definido en DetalleVenta.IdVenta
    detalles = DetalleVentaSerializer(many=True, read_only=True)

    class Meta:
        model = Venta
        fields = ['id', 'usuarioId', 'fecha', 'total', 'estado', 'detalles']
