from django.db import models
from django.core.validators import MinValueValidator  # Importante para validar precios
from usuarios.models import Usuario
from inventario.models import Inventario

class Venta(models.Model):
    # Definimos los estados posibles para la trazabilidad de la miscelánea
    ESTADO_CHOICES = (
        ('Completada', 'Completada'),
        ('Anulada', 'Anulada'),
    )

    IdVenta = models.AutoField(primary_key=True)
    IdUsuario = models.ForeignKey(Usuario, on_delete=models.RESTRICT, db_column='IdUsuario')
    Fecha = models.DateTimeField(null=False, blank=False)
    
    # Agregamos MinValueValidator para asegurar que no existan ventas con total negativo
    Total = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        null=False, 
        blank=False,
        validators=[MinValueValidator(0)]
    )
    
    # Campo nuevo para la lógica de anulación
    Estado = models.CharField(
        max_length=15,
        choices=ESTADO_CHOICES,
        default='Completada'
    )

    class Meta:
        db_table = 'Venta'

class DetalleVenta(models.Model):
    IdDetalleVenta = models.AutoField(primary_key=True)
    IdVenta = models.ForeignKey(
        Venta, 
        on_delete=models.CASCADE, 
        db_column='IdVenta',
        related_name='detalles' # Facilita traer los productos en el historial
    )
    IdInventario = models.ForeignKey(Inventario, on_delete=models.RESTRICT, db_column='IdInventario')
    
    # También validamos que el precio unitario sea 0 o mayor
    PrecioVentaUnitario = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        null=False, 
        blank=False,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        db_table = 'DetalleVenta'