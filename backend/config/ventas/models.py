"""
Modelos de Ventas — App 'ventas'
==================================

Define las entidades Venta y DetalleVenta que capturan cada transacción
comercial de la miscelánea.

MODELO DE VENTA POR UNIDAD FÍSICA:
    Cada línea de DetalleVenta no referencia un Producto, sino un registro
    específico de la tabla Inventario (una unidad física).

    Esto permite:
    - Conocer el costo exacto de la unidad vendida (via su lote de compra).
    - Calcular la ganancia real por venta (PrecioVenta - PrecioCompra).
    - Revertir una venta individualmente sin afectar otras unidades.

ESTADO DE VENTA:
    El campo 'Estado' permite anular ventas sin borrarlas, preservando el
    historial contable completo. Una venta anulada revierte el stock de las
    unidades involucradas al estado 'Disponible'.

RESTRICCIONES DE INTEGRIDAD:
    - MinValueValidator(0): Garantiza a nivel de modelo que no haya ventas
      ni precios negativos (segunda línea de defensa, la primera es el serializer).
    - on_delete=RESTRICT en IdUsuario: No se puede borrar un usuario que tiene
      ventas registradas. Se prefiere desactivar la cuenta (Estado='Inactivo').
    - related_name='detalles' en DetalleVenta.IdVenta: Permite acceder a todos
      los ítems de una venta con `venta.detalles.all()`, usado en el serializer
      anidado y en la vista de anulación.
"""

from django.db import models
from django.core.validators import MinValueValidator
from usuarios.models import Usuario
from inventario.models import Inventario


class Venta(models.Model):
    """
    Encabezado de una transacción de venta.

    Registra el total, la fecha, el usuario que realizó la venta y su estado
    (activa o anulada). Las unidades específicas vendidas se encuentran en
    DetalleVenta.

    Atributos:
        IdVenta (AutoField): Clave primaria.
        IdUsuario (ForeignKey → Usuario): Quien realizó la venta.
            RESTRICT: Preserva el historial aunque el usuario sea desactivado.
        Fecha (DateTimeField): Fecha y hora de la venta.
        Total (DecimalField): Suma de todos los precios de venta de los ítems.
            MinValueValidator(0): Ninguna venta puede tener total negativo.
        Estado (CharField): 'Completada' (activa) o 'Anulada' (revertida).
    """
    ESTADO_CHOICES = (
        ('Completada', 'Completada'),
        ('Anulada', 'Anulada'),
    )

    IdVenta = models.AutoField(primary_key=True)
    IdUsuario = models.ForeignKey(Usuario, on_delete=models.RESTRICT, db_column='IdUsuario')
    Fecha = models.DateTimeField(null=False, blank=False)
    Total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=False,
        blank=False,
        # Garantiza que no existan ventas con total negativo a nivel de BD,
        # incluso si se inserta directamente sin pasar por la API.
        validators=[MinValueValidator(0)]
    )
    # Estado de la venta: permite anular sin borrar, preservando el historial.
    # Default='Completada': Toda venta nueva se considera exitosa al crearse.
    Estado = models.CharField(
        max_length=15,
        choices=ESTADO_CHOICES,
        default='Completada'
    )

    class Meta:
        db_table = 'Venta'


class DetalleVenta(models.Model):
    """
    Línea de detalle de una venta: qué unidad física específica fue vendida y a qué precio.

    DECISIÓN DE DISEÑO — FK a Inventario, no a Producto:
        La referencia es a un registro de Inventario (una unidad específica)
        y no al modelo Producto. Esto permite:
        1. Saber exactamente CUÁL unidad se vendió (para trazabilidad).
        2. Conocer el PRECIO DE COMPRA de esa unidad (via IdDetalleEntrada).
        3. Calcular la GANANCIA REAL de cada transacción.

    Atributos:
        IdDetalleVenta (AutoField): Clave primaria.
        IdVenta (ForeignKey → Venta): Venta a la que pertenece. CASCADE.
            related_name='detalles': Permite `venta.detalles.all()` en vistas y serializers.
        IdInventario (ForeignKey → Inventario): Unidad física vendida.
            RESTRICT: No se puede borrar una unidad si tiene una venta asociada.
        PrecioVentaUnitario (DecimalField): Precio al que se vendió esta unidad.
            Se guarda en el detalle para tener un registro histórico inmutable,
            ya que el precio de venta puede cambiar en el futuro.
    """
    IdDetalleVenta = models.AutoField(primary_key=True)
    IdVenta = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        db_column='IdVenta',
        # related_name='detalles': Permite acceder a los ítems con venta.detalles.all()
        # Usado en VentaSerializer (detalles = DetalleVentaSerializer(many=True))
        # y en AnularVentaView para revertir el stock.
        related_name='detalles'
    )
    IdInventario = models.ForeignKey(Inventario, on_delete=models.RESTRICT, db_column='IdInventario')
    PrecioVentaUnitario = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=False,
        blank=False,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        db_table = 'DetalleVenta'