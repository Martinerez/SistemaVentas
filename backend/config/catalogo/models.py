from django.db import models
from django.core.validators import MinValueValidator


class Categoria(models.Model):
    ESTADO_CHOICES = (
        ('Activo', 'Activo'),
        ('Inactivo', 'Inactivo'),
    )
    IdCategoria = models.AutoField(primary_key=True)
    Nombre = models.CharField(max_length=255, unique=True, null=False, blank=False)
    PorcentajeGanancia = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=False,
        blank=False,
        validators=[MinValueValidator(0)]
    )
    Estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='Activo', null=False, blank=False)

    class Meta:
        db_table = 'Categoria'

class Proveedor(models.Model):
    ESTADO_CHOICES = (
        ('Activo', 'Activo'),
        ('Inactivo', 'Inactivo'),
    )
    IdProveedor = models.AutoField(primary_key=True)
    Nombre = models.CharField(max_length=255, null=False, blank=False)
    Contacto = models.CharField(max_length=255, null=True, blank=True)
    Estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='Activo', null=False, blank=False)

    class Meta:
        db_table = 'Proveedor'

class Producto(models.Model):
    ESTADO_CHOICES = (
        ('Activo', 'Activo'),
        ('Inactivo', 'Inactivo'),
    )
    IdProducto = models.AutoField(primary_key=True)
    IdCategoria = models.ForeignKey(Categoria, on_delete=models.RESTRICT, db_column='IdCategoria', null=False, blank=False)
    Nombre = models.CharField(max_length=255, null=False, blank=False)
    Estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='Activo', null=False, blank=False)

    class Meta:
        db_table = 'Producto'
