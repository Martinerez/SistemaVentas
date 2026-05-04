"""
Modelos de Inventario — App 'inventario'
=========================================

Este módulo es el corazón operativo del sistema. Modela el ciclo de vida
completo de la mercancía: desde que entra (EntradaInventario), hasta que
se convierte en una unidad física trazable (Inventario), y todos sus posibles
destinos: venta, pérdida o devolución.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODELO DE TRAZABILIDAD POR UNIDAD FÍSICA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
En lugar de mantener un contador de stock (ej: "quedan 50 Coca-Colas"),
el sistema crea un registro individual en la tabla Inventario por CADA
unidad física comprada. Cada registro tiene su propio Estado.

Esto permite:
  - Saber exactamente qué unidades están disponibles y cuáles fueron vendidas.
  - Vincular cada venta a la unidad específica que fue entregada al cliente.
  - Revertir una venta individual sin afectar otras unidades del mismo lote.
  - Calcular stock disponible con un simple COUNT(Estado='Disponible').

FLUJO DE ESTADOS DE Inventario:
    [compra]       → Disponible
    [venta]        → Vendido
    [anular venta] → Disponible  ← Revierte
    [pérdida]      → Perdido
    [devolución]   → Devuelto

SIGNAL post_save:
    Al guardar un DetalleEntradaInventario (una línea del pedido de compra),
    la signal crea automáticamente N registros en Inventario, donde N = Cantidad.
    Esto mantiene la sincronización sin requerir lógica extra en la vista.

JERARQUÍA DE MODELOS:
    EntradaInventario        ← Pedido/compra completa
        └── DetalleEntradaInventario  ← Línea del pedido (qué producto y cuánto)
                └── Inventario[]     ← Una fila por cada unidad física

    Perdida                  ← Registro de pérdida
        └── DetallePerdida   ← Unidades físicas que se perdieron

    SolicitudDevolucion              ← Solicitud de devolver mercancía al proveedor
        └── DetalleSolicitudDevolucion ← Unidades físicas a devolver
"""

from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from catalogo.models import Proveedor, Producto
from usuarios.models import Usuario
from django.db.models.signals import post_save
from django.dispatch import receiver


# ─── MODELOS DE ENTRADAS (COMPRAS) ────────────────────────────────────────────

class EntradaInventario(models.Model):
    """
    Registra una compra completa de mercancía a un proveedor.

    Es el encabezado del pedido. Los productos individuales comprados
    se detallan en DetalleEntradaInventario.

    Atributos:
        IdEntradaInventario (AutoField): Clave primaria.
        IdProveedor (ForeignKey): Proveedor que suministra la mercancía.
            RESTRICT: No se puede borrar un proveedor con historial de compras.
        IdUsuario (ForeignKey): Empleado que registró la entrada.
            RESTRICT: No se puede borrar un usuario con entradas registradas.
        FechaEntrada (DateTimeField): Fecha y hora en que llegó la mercancía.
        Total (DecimalField): Costo total de la compra.
            MinValueValidator(0): No pueden existir compras con costo negativo.
    """
    IdEntradaInventario = models.AutoField(primary_key=True)
    IdProveedor = models.ForeignKey(Proveedor, on_delete=models.RESTRICT, db_column='IdProveedor')
    IdUsuario = models.ForeignKey(Usuario, on_delete=models.RESTRICT, db_column='IdUsuario')
    FechaEntrada = models.DateTimeField(null=False, blank=False)
    Total = models.DecimalField(
        max_digits=12, decimal_places=2, null=False, blank=False,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        db_table = 'EntradaInventario'
        # ordering descendente: Las entradas más recientes aparecen primero en la API.
        ordering = ['-IdEntradaInventario']


class DetalleEntradaInventario(models.Model):
    """
    Línea de detalle de una compra: qué producto, cuántas unidades y a qué precio.

    Al guardarse (created=True), la signal `crear_items_inventario` crea
    automáticamente N registros en la tabla Inventario basados en Cantidad.

    Atributos:
        IdDetalleEntrada (AutoField): Clave primaria.
        IdEntradaInventario (ForeignKey): Compra a la que pertenece este detalle.
            CASCADE: Si se borra la entrada, se borran todos sus detalles.
        IdProducto (ForeignKey): Producto comprado.
            RESTRICT: No se puede borrar un producto con historial de compras.
        Cantidad (IntegerField): Número de unidades compradas.
            MinValueValidator(1): Mínimo 1 unidad por línea de detalle.
        PrecioCompraUnitario (DecimalField): Costo por unidad.
    """
    IdDetalleEntrada = models.AutoField(primary_key=True)
    IdEntradaInventario = models.ForeignKey(
        EntradaInventario,
        on_delete=models.CASCADE,  # Si se borra la compra, sus líneas también se borran
        db_column='IdEntradaInventario'
    )
    IdProducto = models.ForeignKey(Producto, on_delete=models.RESTRICT, db_column='IdProducto')
    Cantidad = models.IntegerField(null=False, blank=False, validators=[MinValueValidator(1)])
    PrecioCompraUnitario = models.DecimalField(
        max_digits=12, decimal_places=2, null=False, blank=False,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        db_table = 'DetalleEntradaInventario'
        ordering = ['-IdDetalleEntrada']


# ─── MODELO DE INVENTARIO FÍSICO ──────────────────────────────────────────────

class Inventario(models.Model):
    """
    Representa una UNIDAD FÍSICA individual de un producto en el almacén.

    Este modelo es la pieza central del sistema de trazabilidad. Cada fila
    corresponde a UNA unidad física (una botella, un paquete, una caja).
    El 'Estado' de esta fila cambia a lo largo del ciclo de vida del artículo.

    Atributos:
        IdInventario (AutoField): Clave primaria. Identificador único de la unidad.
        IdDetalleEntrada (ForeignKey): De qué lote de compra proviene esta unidad.
            related_name="inventarios": Permite acceder a todas las unidades de un
            detalle con `detalle.inventarios.all()`, usado en los serializers.
            RESTRICT: No se puede borrar un detalle si tiene unidades de inventario.
        Estado (CharField): Estado actual de la unidad física.
            - 'Disponible': En almacén, lista para venderse.
            - 'Vendido': Fue entregada a un cliente (ver DetalleVenta).
            - 'Perdido': Se dañó, venció o se extravió (ver DetallePerdida).
            - 'Devuelto': Se devolvió al proveedor (ver DetalleSolicitudDevolucion).
        FechaMovimiento (DateTimeField): Última fecha en que cambió de estado.
            Registro de auditoría del movimiento del artículo.
    """
    ESTADO_CHOICES = (
        ('Disponible', 'Disponible'),
        ('Vendido', 'Vendido'),
        ('Perdido', 'Perdido'),
        ('Devuelto', 'Devuelto'),
    )
    IdInventario = models.AutoField(primary_key=True)
    IdDetalleEntrada = models.ForeignKey(
        DetalleEntradaInventario,
        on_delete=models.RESTRICT,
        db_column='IdDetalleEntrada',
        related_name="inventarios"  # detalle.inventarios.all() → todas las unidades de ese lote
    )
    Estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='Disponible', null=False, blank=False)
    FechaMovimiento = models.DateTimeField(null=False, blank=False, default=timezone.now)

    class Meta:
        db_table = 'Inventario'
        ordering = ['-IdInventario']


# ─── MODELOS DE PÉRDIDAS ──────────────────────────────────────────────────────

class Perdida(models.Model):
    """
    Encabezado de un evento de pérdida de mercancía.

    Una pérdida ocurre cuando unidades físicas se dan de baja por razones
    distintas a una venta o devolución: productos vencidos, dañados, robados,
    o devoluciones rechazadas que no pueden reintegrarse al stock.

    Atributos:
        IdPerdida (AutoField): Clave primaria.
        IdUsuario (ForeignKey): Empleado que registró la pérdida. RESTRICT.
        TipoPerdida (CharField):
            - 'RechazoDevolucion': Unidades que el proveedor rechazó en una devolución.
            - 'Otra': Cualquier otra causa (vencimiento, daño, hurto).
        Fecha (DateTimeField): Cuándo ocurrió la pérdida.
        Total (DecimalField): Valor total en costo de las unidades perdidas.
    """
    TIPO_PERDIDA_CHOICES = (
        ('RechazoDevolucion', 'RechazoDevolucion'),
        ('Otra', 'Otra'),
    )
    IdPerdida = models.AutoField(primary_key=True)
    IdUsuario = models.ForeignKey(Usuario, on_delete=models.RESTRICT, db_column='IdUsuario')
    TipoPerdida = models.CharField(max_length=20, choices=TIPO_PERDIDA_CHOICES, null=False, blank=False)
    Fecha = models.DateTimeField(null=False, blank=False)
    Total = models.DecimalField(
        max_digits=12, decimal_places=2, null=False, blank=False,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        db_table = 'Perdida'
        ordering = ['-IdPerdida']


class DetallePerdida(models.Model):
    """
    Línea de detalle de una pérdida: qué unidad física específica se perdió.

    Vincula una Perdida con un registro específico de Inventario, marcando
    esa unidad como 'Perdido'. El precio se copia en el momento del registro
    para tener un historial inmutable del valor perdido.

    Atributos:
        IdDetallePerdida (AutoField): Clave primaria.
        IdPerdida (ForeignKey): Pérdida a la que pertenece. CASCADE.
        IdInventario (ForeignKey): Unidad física que se perdió. RESTRICT.
        PrecioCompraUnitario (DecimalField): Costo de la unidad perdida (valor contable).
    """
    IdDetallePerdida = models.AutoField(primary_key=True)
    IdPerdida = models.ForeignKey(Perdida, on_delete=models.CASCADE, db_column='IdPerdida')
    IdInventario = models.ForeignKey(Inventario, on_delete=models.RESTRICT, db_column='IdInventario')
    PrecioCompraUnitario = models.DecimalField(
        max_digits=12, decimal_places=2, null=False, blank=False,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        db_table = 'DetallePerdida'
        ordering = ['-IdDetallePerdida']


# ─── MODELOS DE DEVOLUCIONES ──────────────────────────────────────────────────

class SolicitudDevolucion(models.Model):
    """
    Solicitud de devolución de mercancía al proveedor.

    FLUJO DE ESTADOS:
        'Pendiente'            → Recién creada, esperando resolución.
        'Aceptada'             → El proveedor aceptará devolver el valor.
        'ParcialmenteAceptada' → El proveedor solo acepta algunas unidades.
        'Rechazada'            → El proveedor no acepta la devolución.

    La vista SolicitudDevolucionViewSet bloquea modificaciones a solicitudes
    que ya no estén en estado 'Pendiente', para garantizar la integridad del
    proceso de aprobación.

    Atributos:
        IdSolicitudDevolucion (AutoField): Clave primaria.
        IdEntradaInventario (ForeignKey): Compra de la que provienen los artículos.
        IdUsuario (ForeignKey): Empleado que gestiona la devolución.
        Estado (CharField): Estado del proceso de devolución.
        Observaciones (TextField): Notas sobre el motivo de la devolución.
        Fecha (DateTimeField): Cuándo se inició la solicitud.
    """
    ESTADO_CHOICES = (
        ('Pendiente', 'Pendiente'),
        ('Aceptada', 'Aceptada'),
        ('ParcialmenteAceptada', 'ParcialmenteAceptada'),
        ('Rechazada', 'Rechazada'),
    )
    IdSolicitudDevolucion = models.AutoField(primary_key=True)
    IdEntradaInventario = models.ForeignKey(
        EntradaInventario, on_delete=models.RESTRICT, db_column='IdEntradaInventario'
    )
    IdUsuario = models.ForeignKey(Usuario, on_delete=models.RESTRICT, db_column='IdUsuario')
    Estado = models.CharField(max_length=25, choices=ESTADO_CHOICES, default='Pendiente', null=False, blank=False)
    Observaciones = models.TextField(null=True, blank=True)
    Fecha = models.DateTimeField(null=False, blank=False)

    class Meta:
        db_table = 'SolicitudDevolucion'
        ordering = ['-IdSolicitudDevolucion']


class DetalleSolicitudDevolucion(models.Model):
    """
    Línea de detalle de una solicitud de devolución.

    Vincula una SolicitudDevolucion con la unidad física de Inventario que
    se desea devolver. El EstadoItem permite aprobar/rechazar artículos
    individualmente dentro de una misma solicitud (devolución parcial).

    Atributos:
        IdDetalleSolicitudDevolucion (AutoField): Clave primaria.
        IdSolicitudDevolucion (ForeignKey): Solicitud a la que pertenece. CASCADE.
        IdInventario (ForeignKey): Unidad física a devolver. RESTRICT.
        MotivoRechazo (TextField): Si el ítem fue rechazado, explicación del motivo.
        PrecioCompraUnitario (DecimalField): Valor de la unidad a devolver.
        EstadoItem (CharField): Estado de este ítem específico dentro de la solicitud.
    """
    ESTADO_ITEM_CHOICES = (
        ('Aceptado', 'Aceptado'),
        ('Rechazado', 'Rechazado'),
        ('Pendiente', 'Pendiente'),
    )
    IdDetalleSolicitudDevolucion = models.AutoField(primary_key=True)
    IdSolicitudDevolucion = models.ForeignKey(
        SolicitudDevolucion, on_delete=models.CASCADE, db_column='IdSolicitudDevolucion'
    )
    IdInventario = models.ForeignKey(Inventario, on_delete=models.RESTRICT, db_column='IdInventario')
    MotivoRechazo = models.TextField(null=True, blank=True)
    PrecioCompraUnitario = models.DecimalField(
        max_digits=12, decimal_places=2, null=False, blank=False,
        validators=[MinValueValidator(0)]
    )
    EstadoItem = models.CharField(
        max_length=15, choices=ESTADO_ITEM_CHOICES, default='Pendiente', null=False, blank=False
    )

    class Meta:
        db_table = 'DetalleSolicitudDevolucion'
        ordering = ['-IdDetalleSolicitudDevolucion']


# ─── SIGNAL: Creación Automática de Unidades de Inventario ────────────────────

@receiver(post_save, sender=DetalleEntradaInventario)
def crear_items_inventario(sender, instance, created, **kwargs):
    """
    Signal Django que crea registros de Inventario al guardar un DetalleEntradaInventario.

    POR QUÉ USAR UNA SIGNAL:
        La signal garantiza que la creación de unidades de inventario ocurra
        SIEMPRE que se guarde un DetalleEntradaInventario, independientemente
        de qué parte del código lo crea (la vista API, el panel de admin de
        Django, scripts de importación, etc.).

    POR QUÉ bulk_create():
        Se usa bulk_create para insertar todas las unidades en una sola operación
        SQL, lo cual es mucho más eficiente que un bucle de inserts individuales.

    Args:
        sender (Model): Clase que envió la signal (DetalleEntradaInventario).
        instance (DetalleEntradaInventario): Instancia recién guardada.
        created (bool): True solo en la primera creación.
    """
    if created:
        # Crear la lista de objetos en memoria
        inventarios = [
            Inventario(
                IdDetalleEntrada=instance,
                Estado='Disponible',
                FechaMovimiento=timezone.now()
            )
            for _ in range(instance.Cantidad)
        ]
        # Insertar todos de una vez
        Inventario.objects.bulk_create(inventarios)