from django.db import models
from catalogo.models import Proveedor, Producto
from usuarios.models import Usuario

class EntradaInventario(models.Model):
    IdEntradaInventario = models.AutoField(primary_key=True)
    IdProveedor = models.ForeignKey(Proveedor, on_delete=models.RESTRICT, db_column='IdProveedor')
    IdUsuario = models.ForeignKey(Usuario, on_delete=models.RESTRICT, db_column='IdUsuario')
    FechaEntrada = models.DateTimeField(null=False, blank=False)
    Total = models.DecimalField(max_digits=12, decimal_places=2, null=False, blank=False)

    class Meta:
        db_table = 'EntradaInventario'

class DetalleEntradaInventario(models.Model):
    IdDetalleEntrada = models.AutoField(primary_key=True)
    IdEntradaInventario = models.ForeignKey(EntradaInventario, on_delete=models.CASCADE, db_column='IdEntradaInventario')
    IdProducto = models.ForeignKey(Producto, on_delete=models.RESTRICT, db_column='IdProducto')
    Cantidad = models.IntegerField(null=False, blank=False)
    PrecioCompraUnitario = models.DecimalField(max_digits=12, decimal_places=2, null=False, blank=False)

    class Meta:
        db_table = 'DetalleEntradaInventario'

class Inventario(models.Model):
    ESTADO_CHOICES = (
        ('Disponible', 'Disponible'),
        ('Vendido', 'Vendido'),
        ('Perdido', 'Perdido'),
        ('Devuelto', 'Devuelto'),
    )
    IdInventario = models.AutoField(primary_key=True)
    IdDetalleEntrada = models.ForeignKey(DetalleEntradaInventario, on_delete=models.RESTRICT, db_column='IdDetalleEntrada',related_name="inventarios")
    Estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='Disponible', null=False, blank=False)
    FechaMovimiento = models.DateTimeField(null=False, blank=False)

    class Meta:
        db_table = 'Inventario'

class Perdida(models.Model):
    TIPO_PERDIDA_CHOICES = (
        ('RechazoDevolucion', 'RechazoDevolucion'),
        ('Otra', 'Otra'),
    )
    IdPerdida = models.AutoField(primary_key=True)
    IdUsuario = models.ForeignKey(Usuario, on_delete=models.RESTRICT, db_column='IdUsuario')
    TipoPerdida = models.CharField(max_length=20, choices=TIPO_PERDIDA_CHOICES, null=False, blank=False)
    Fecha = models.DateTimeField(null=False, blank=False)
    Total = models.DecimalField(max_digits=12, decimal_places=2, null=False, blank=False)

    class Meta:
        db_table = 'Perdida'

class DetallePerdida(models.Model):
    IdDetallePerdida = models.AutoField(primary_key=True)
    IdPerdida = models.ForeignKey(Perdida, on_delete=models.CASCADE, db_column='IdPerdida')
    IdInventario = models.ForeignKey(Inventario, on_delete=models.RESTRICT, db_column='IdInventario')
    PrecioCompraUnitario = models.DecimalField(max_digits=12, decimal_places=2, null=False, blank=False)

    class Meta:
        db_table = 'DetallePerdida'

class SolicitudDevolucion(models.Model):
    ESTADO_CHOICES = (
        ('Pendiente', 'Pendiente'),
        ('Aceptada', 'Aceptada'),
        ('ParcialmenteAceptada', 'ParcialmenteAceptada'),
        ('Rechazada', 'Rechazada'),
    )
    IdSolicitudDevolucion = models.AutoField(primary_key=True)
    IdEntradaInventario = models.ForeignKey(EntradaInventario, on_delete=models.RESTRICT, db_column='IdEntradaInventario')
    IdUsuario = models.ForeignKey(Usuario, on_delete=models.RESTRICT, db_column='IdUsuario')
    Estado = models.CharField(max_length=25, choices=ESTADO_CHOICES, default='Pendiente', null=False, blank=False)
    Observaciones = models.TextField(null=True, blank=True)
    Fecha = models.DateTimeField(null=False, blank=False)

    class Meta:
        db_table = 'SolicitudDevolucion'

class DetalleSolicitudDevolucion(models.Model):
    ESTADO_ITEM_CHOICES = (
        ('Aceptado', 'Aceptado'),
        ('Rechazado', 'Rechazado'),
        ('Pendiente', 'Pendiente'),
    )
    IdDetalleSolicitudDevolucion = models.AutoField(primary_key=True)
    IdSolicitudDevolucion = models.ForeignKey(SolicitudDevolucion, on_delete=models.CASCADE, db_column='IdSolicitudDevolucion')
    IdInventario = models.ForeignKey(Inventario, on_delete=models.RESTRICT, db_column='IdInventario')
    MotivoRechazo = models.TextField(null=True, blank=True)
    PrecioCompraUnitario = models.DecimalField(max_digits=12, decimal_places=2, null=False, blank=False)
    EstadoItem = models.CharField(max_length=15, choices=ESTADO_ITEM_CHOICES, default='Pendiente', null=False, blank=False)

    class Meta:
        db_table = 'DetalleSolicitudDevolucion'
