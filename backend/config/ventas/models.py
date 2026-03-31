from django.db import models
from usuarios.models import Usuario
from inventario.models import Inventario

class Venta(models.Model):
    IdVenta = models.AutoField(primary_key=True)
    IdUsuario = models.ForeignKey(Usuario, on_delete=models.RESTRICT, db_column='IdUsuario')
    Fecha = models.DateTimeField(null=False, blank=False)
    Total = models.DecimalField(max_digits=12, decimal_places=2, null=False, blank=False)

    class Meta:
        db_table = 'Venta'

class DetalleVenta(models.Model):
    IdDetalleVenta = models.AutoField(primary_key=True)
    IdVenta = models.ForeignKey(Venta, on_delete=models.CASCADE, db_column='IdVenta')
    IdInventario = models.ForeignKey(Inventario, on_delete=models.RESTRICT, db_column='IdInventario')
    PrecioVentaUnitario = models.DecimalField(max_digits=12, decimal_places=2, null=False, blank=False)

    class Meta:
        db_table = 'DetalleVenta'
