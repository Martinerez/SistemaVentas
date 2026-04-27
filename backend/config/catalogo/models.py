"""
Modelos del Catálogo — App 'catalogo'
=======================================

Define las entidades maestras del negocio: Categoría, Proveedor y Producto.
Estas entidades son la base de todo el sistema: sin un Producto no puede haber
Inventario, y sin Inventario no puede haber Venta.

JERARQUÍA DE DEPENDENCIAS:
    Categoria
        └── Producto (un producto pertenece a una categoría)
                └── DetalleEntradaInventario (un producto se compra en lotes)
                        └── Inventario (cada unidad física del lote)
                                └── DetalleVenta (cada unidad vendida)

RESTRICCIÓN on_delete=RESTRICT:
    Se usa RESTRICT en las claves foráneas para evitar borrar accidentalmente
    una Categoría que tiene Productos activos, o un Proveedor con historial de compras.
    El sistema obliga al usuario a gestionar los datos dependientes antes de borrar.

PorcentajeGanancia en Categoria:
    El precio de venta de un producto se calcula DINÁMICAMENTE en el serializer
    como: PrecioCompra × (1 + PorcentajeGanancia / 100).
    Al definir la ganancia a nivel de Categoría (no de Producto individual),
    el admin puede ajustar el margen de toda una línea de productos con una
    sola edición.
"""

from django.db import models
from django.core.validators import MinValueValidator


class Categoria(models.Model):
    """
    Categoría de producto que también define el margen de ganancia comercial.

    El PorcentajeGanancia aquí almacenado no es solo organizacional; es
    funcional: el serializer de Producto lo usa para calcular el precio de
    venta sugerido en tiempo real.

    Atributos:
        IdCategoria (AutoField): Clave primaria.
        Nombre (CharField): Nombre único de la categoría (ej: 'Bebidas', 'Lácteos').
        PorcentajeGanancia (DecimalField): Margen comercial en %. MinValueValidator(0)
            garantiza que no se pueda definir un margen negativo a nivel de BD.
        Estado (CharField): 'Activo'/'Inactivo'. Una categoría inactiva puede
            dejarse de ofrecer sin borrar su historial.
    """
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
        # MinValueValidator en el modelo: segunda línea de defensa después de la validación
        # del serializer. Garantiza integridad incluso si se insertan datos directamente en BD.
        validators=[MinValueValidator(0)]
    )
    Estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='Activo', null=False, blank=False)

    class Meta:
        db_table = 'Categoria'


class Proveedor(models.Model):
    """
    Proveedor de mercancía para la miscelánea.

    Los proveedores se vinculan a las EntradaInventario (pedidos de compra).
    El campo 'Contacto' es opcional porque algunos proveedores locales no tienen
    un dato de contacto formal.

    Atributos:
        IdProveedor (AutoField): Clave primaria.
        Nombre (CharField): Nombre comercial del proveedor.
        Contacto (CharField): Teléfono, email o nombre de contacto. Opcional.
        Estado (CharField): 'Activo'/'Inactivo'.
    """
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
    """
    Producto del catálogo de la miscelánea.

    IMPORTANTE — Inventario por Unidad Física:
        El sistema usa un modelo de "trazabilidad por unidad". Cada unidad
        física comprada crea un registro en la tabla Inventario con su propio
        estado (Disponible, Vendido, Perdido, Devuelto). El "stock" de un
        producto es el COUNT de sus registros en estado 'Disponible'.
        Esto permite saber exactamente qué unidades están disponibles,
        a diferencia de un sistema de stock agregado donde solo se mantiene
        un contador de cantidad.

    Atributos:
        IdProducto (AutoField): Clave primaria.
        IdCategoria (ForeignKey): Categoría a la que pertenece. RESTRICT evita
            borrar una categoría con productos existentes.
        Nombre (CharField): Nombre del producto (ej: 'Coca-Cola 600ml').
        Estado (CharField): 'Activo'/'Inactivo'.
    """
    ESTADO_CHOICES = (
        ('Activo', 'Activo'),
        ('Inactivo', 'Inactivo'),
    )
    IdProducto = models.AutoField(primary_key=True)
    # on_delete=RESTRICT: No se puede borrar una Categoría si tiene Productos.
    # Esto previene "huérfanos" en la BD y fuerza al admin a mover los productos
    # a otra categoría antes de eliminar la actual.
    IdCategoria = models.ForeignKey(
        Categoria,
        on_delete=models.RESTRICT,
        db_column='IdCategoria',
        null=False,
        blank=False
    )
    Nombre = models.CharField(max_length=255, null=False, blank=False)
    Estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='Activo', null=False, blank=False)

    class Meta:
        db_table = 'Producto'
