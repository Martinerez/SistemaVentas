from rest_framework import serializers
from .models import EntradaInventario, DetalleEntradaInventario, Inventario, Perdida, DetallePerdida, SolicitudDevolucion, DetalleSolicitudDevolucion
from catalogo.models import Proveedor, Producto
from usuarios.models import Usuario

class EntradaInventarioSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdEntradaInventario', read_only=True)
    proveedorId = serializers.PrimaryKeyRelatedField(source='IdProveedor', queryset=Proveedor.objects.all())
    usuarioId = serializers.PrimaryKeyRelatedField(source='IdUsuario', queryset=Usuario.objects.all())
    fechaEntrada = serializers.DateTimeField(source='FechaEntrada')
    total = serializers.DecimalField(source='Total', max_digits=12, decimal_places=2)

    class Meta:
        model = EntradaInventario
        fields = ['id', 'proveedorId', 'usuarioId', 'fechaEntrada', 'total']

class DetalleEntradaInventarioSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdDetalleEntrada', read_only=True)
    entradaInventarioId = serializers.PrimaryKeyRelatedField(source='IdEntradaInventario', queryset=EntradaInventario.objects.all())
    productoId = serializers.PrimaryKeyRelatedField(source='IdProducto', queryset=Producto.objects.all())
    cantidad = serializers.IntegerField(source='Cantidad')
    precioCompraUnitario = serializers.DecimalField(source='PrecioCompraUnitario', max_digits=12, decimal_places=2)

    class Meta:
        model = DetalleEntradaInventario
        fields = ['id', 'entradaInventarioId', 'productoId', 'cantidad', 'precioCompraUnitario']

class InventarioSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdInventario', read_only=True)
    detalleEntradaId = serializers.PrimaryKeyRelatedField(source='IdDetalleEntrada', queryset=DetalleEntradaInventario.objects.all())
    estado = serializers.CharField(source='Estado')
    fechaMovimiento = serializers.DateTimeField(source='FechaMovimiento')

    class Meta:
        model = Inventario
        fields = ['id', 'detalleEntradaId', 'estado', 'fechaMovimiento']

class PerdidaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdPerdida', read_only=True)
    usuarioId = serializers.PrimaryKeyRelatedField(source='IdUsuario', queryset=Usuario.objects.all())
    tipoPerdida = serializers.CharField(source='TipoPerdida')
    fecha = serializers.DateTimeField(source='Fecha')
    total = serializers.DecimalField(source='Total', max_digits=12, decimal_places=2)

    class Meta:
        model = Perdida
        fields = ['id', 'usuarioId', 'tipoPerdida', 'fecha', 'total']

class DetallePerdidaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdDetallePerdida', read_only=True)
    perdidaId = serializers.PrimaryKeyRelatedField(source='IdPerdida', queryset=Perdida.objects.all())
    inventarioId = serializers.PrimaryKeyRelatedField(source='IdInventario', queryset=Inventario.objects.all())
    precioCompraUnitario = serializers.DecimalField(source='PrecioCompraUnitario', max_digits=12, decimal_places=2)

    class Meta:
        model = DetallePerdida
        fields = ['id', 'perdidaId', 'inventarioId', 'precioCompraUnitario']

class SolicitudDevolucionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdSolicitudDevolucion', read_only=True)
    entradaInventarioId = serializers.PrimaryKeyRelatedField(source='IdEntradaInventario', queryset=EntradaInventario.objects.all())
    usuarioId = serializers.PrimaryKeyRelatedField(source='IdUsuario', queryset=Usuario.objects.all())
    estado = serializers.CharField(source='Estado', required=False)
    observaciones = serializers.CharField(source='Observaciones', required=False, allow_null=True)
    fecha = serializers.DateTimeField(source='Fecha')

    class Meta:
        model = SolicitudDevolucion
        fields = ['id', 'entradaInventarioId', 'usuarioId', 'estado', 'observaciones', 'fecha']

class DetalleSolicitudDevolucionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdDetalleSolicitudDevolucion', read_only=True)
    solicitudDevolucionId = serializers.PrimaryKeyRelatedField(source='IdSolicitudDevolucion', queryset=SolicitudDevolucion.objects.all())
    inventarioId = serializers.PrimaryKeyRelatedField(source='IdInventario', queryset=Inventario.objects.all())
    motivoRechazo = serializers.CharField(source='MotivoRechazo', required=False, allow_null=True)
    precioCompraUnitario = serializers.DecimalField(source='PrecioCompraUnitario', max_digits=12, decimal_places=2)
    estadoItem = serializers.CharField(source='EstadoItem', required=False)

    class Meta:
        model = DetalleSolicitudDevolucion
        fields = ['id', 'solicitudDevolucionId', 'inventarioId', 'motivoRechazo', 'precioCompraUnitario', 'estadoItem']
