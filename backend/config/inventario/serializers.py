"""
Serializadores del Inventario — App 'inventario'
==================================================

Convierten los modelos de inventario en JSON y viceversa.
Este módulo es el más complejo del sistema en términos de serialización,
porque implementa múltiples niveles de anidamiento:

    EntradaInventarioSerializer
        └── DetalleEntradaInventarioSerializer (anidado via detalleentradainventario_set)
                └── InventarioMiniSerializer   (anidado via related_name="inventarios")

PROPÓSITO DEL ANIDAMIENTO:
    Con una sola petición GET /api/inventario/entradas/<id>/, el frontend
    recibe la compra completa con sus líneas de detalle y el estado de cada
    unidad física de inventario. Esto permite al administrador ver exactamente
    cuántas unidades de cada producto de ese lote aún están 'Disponibles',
    cuáles se 'Vendieron', cuáles se 'Perdieron', etc.

NAVEGACIÓN DE RELACIONES FK INVERSAS:
    - `detalleentradainventario_set`: Nombre del reverse manager que Django
      crea automáticamente para acceder a los DetalleEntradaInventario de una
      EntradaInventario. Se usa como `source` en el campo anidado `detalles`.
    - `inventarios`: El related_name definido explícitamente en
      DetalleEntradaInventario.IdDetalleEntrada para acceder a los registros
      de Inventario desde un detalle. Permite `detalle.inventarios.all()`.
    - La doble navegación `IdInventario.IdDetalleEntrada.IdProducto.Nombre`
      en DetallePerdidaSerializer y DetalleSolicitudDevolucionSerializer
      atraviesa 3 relaciones FK para obtener el nombre del producto perdido/devuelto
      sin peticiones adicionales.
"""

from rest_framework import serializers
from .models import (
    EntradaInventario, DetalleEntradaInventario, Inventario,
    Perdida, DetallePerdida, SolicitudDevolucion, DetalleSolicitudDevolucion
)
from catalogo.models import Proveedor, Producto
from usuarios.models import Usuario
from django.utils import timezone


class InventarioMiniSerializer(serializers.ModelSerializer):
    """
    Serializador mínimo de Inventario para uso como campo anidado en detalles.

    Solo expone el ID y el Estado de cada unidad física. Se usa dentro de
    DetalleEntradaInventarioSerializer para mostrar el estado de cada unidad
    del lote sin incluir datos redundantes (la FK al detalle ya es conocida).
    """
    id = serializers.IntegerField(source='IdInventario', read_only=True)

    class Meta:
        model = Inventario
        fields = ["id", "Estado"]


class DetalleEntradaInventarioSerializer(serializers.ModelSerializer):
    """
    Serializador de una línea de detalle de una compra.

    Campos de solo lectura calculados:
    - `productoNombre`: Navega la FK IdProducto para mostrar el nombre sin
      petición adicional. Usa la notación de doble guión bajo de DRF:
      `source="IdProducto.Nombre"` → accede al atributo Nombre del objeto
      relacionado IdProducto.
    - `estadoItems`: Anidamiento de todas las unidades físicas de este lote.
      Usa related_name="inventarios" definido en Inventario.IdDetalleEntrada.
      `many=True`: Serializa la lista completa de unidades.
      `read_only=True`: Los estados solo cambian mediante otras operaciones
      (ventas, pérdidas, devoluciones), no directamente por este endpoint.
    """
    id = serializers.IntegerField(source='IdDetalleEntrada', read_only=True)
    entradaInventarioId = serializers.PrimaryKeyRelatedField(
        source='IdEntradaInventario', queryset=EntradaInventario.objects.all()
    )
    productoId = serializers.PrimaryKeyRelatedField(
        source='IdProducto', queryset=Producto.objects.all()
    )
    cantidad = serializers.IntegerField(source='Cantidad')
    precioCompraUnitario = serializers.DecimalField(
        source='PrecioCompraUnitario', max_digits=12, decimal_places=2
    )
    # Atajo read-only para el nombre del producto — evita un join en el frontend
    productoNombre = serializers.CharField(source="IdProducto.Nombre", read_only=True)
    # Anidamiento de las unidades físicas del lote — usa related_name="inventarios"
    estadoItems = InventarioMiniSerializer(
        source="inventarios",
        many=True,
        read_only=True
    )

    class Meta:
        model = DetalleEntradaInventario
        fields = [
            'id', 'entradaInventarioId', 'productoId', 'productoNombre',
            'cantidad', 'precioCompraUnitario', 'estadoItems'
        ]


class EntradaInventarioSerializer(serializers.ModelSerializer):
    """
    Serializador completo de una entrada de inventario (compra) con detalles.

    El campo `detalles` anida todos los DetalleEntradaInventario de esta
    compra usando el reverse manager automático de Django
    `detalleentradainventario_set`. El nombre del reverse manager se forma
    como `<nombre_modelo_en_minusculas>_set`.

    `proveedorNombre`: Atajo de solo lectura para mostrar el nombre del
    proveedor sin necesitar un join explícito en el frontend.
    """
    # Anidamiento completo de los detalles de la compra
    detalles = DetalleEntradaInventarioSerializer(
        source="detalleentradainventario_set",
        many=True,
        read_only=True
    )
    id = serializers.IntegerField(source='IdEntradaInventario', read_only=True)
    proveedorId = serializers.PrimaryKeyRelatedField(
        source='IdProveedor', queryset=Proveedor.objects.all()
    )
    usuarioId = serializers.PrimaryKeyRelatedField(
        source='IdUsuario', queryset=Usuario.objects.all()
    )
    fechaEntrada = serializers.DateTimeField(source='FechaEntrada')
    total = serializers.DecimalField(source='Total', max_digits=12, decimal_places=2)
    # Desnormalización controlada: nombre del proveedor para mostrar en tablas
    proveedorNombre = serializers.CharField(source="IdProveedor.Nombre", read_only=True)

    class Meta:
        model = EntradaInventario
        fields = ['id', 'proveedorId', 'usuarioId', 'fechaEntrada', 'total', 'proveedorNombre', 'detalles']


class InventarioSerializer(serializers.ModelSerializer):
    """
    Serializador estándar de un registro de inventario (unidad física).

    Usado por InventarioViewSet para consultas de estado y actualizaciones
    manuales de emergencia. Las actualizaciones normales (Vendido, Perdido,
    Devuelto) ocurren a través de vistas especializadas con transacciones atómicas.
    """
    id = serializers.IntegerField(source='IdInventario', read_only=True)
    detalleEntradaId = serializers.PrimaryKeyRelatedField(
        source='IdDetalleEntrada', queryset=DetalleEntradaInventario.objects.all()
    )
    estado = serializers.CharField(source='Estado')
    fechaMovimiento = serializers.DateTimeField(source='FechaMovimiento')

    class Meta:
        model = Inventario
        fields = ['id', 'detalleEntradaId', 'estado', 'fechaMovimiento']


class DetallePerdidaSerializer(serializers.ModelSerializer):
    """
    Serializador de una línea de detalle de pérdida.

    El campo `productoNombre` navega tres niveles de FK para obtener el
    nombre del producto de la unidad física que se perdió:
        IdInventario → IdDetalleEntrada → IdProducto → Nombre

    Esta navegación evita que el frontend haga 3 peticiones adicionales
    solo para mostrar el nombre en la tabla de pérdidas.
    """
    id = serializers.IntegerField(source='IdDetallePerdida', read_only=True)
    perdidaId = serializers.PrimaryKeyRelatedField(
        source='IdPerdida', queryset=Perdida.objects.all()
    )
    inventarioId = serializers.PrimaryKeyRelatedField(
        source='IdInventario', queryset=Inventario.objects.all()
    )
    precioCompraUnitario = serializers.DecimalField(
        source='PrecioCompraUnitario', max_digits=12, decimal_places=2
    )
    # Navegación de 3 niveles: Inventario → DetalleEntrada → Producto → Nombre
    # La notación con puntos en 'source' navega FK sucesivamente.
    productoNombre = serializers.CharField(
        source="IdInventario.IdDetalleEntrada.IdProducto.Nombre",
        read_only=True
    )

    class Meta:
        model = DetallePerdida
        fields = ['id', 'perdidaId', 'inventarioId', 'precioCompraUnitario', 'productoNombre']


class PerdidaSerializer(serializers.ModelSerializer):
    """
    Serializador completo de un evento de pérdida con sus detalles anidados.

    Campos de auditoría del usuario:
    - `usuarioNombre` y `usuarioRol`: Permiten al admin ver quién registró
      la pérdida y con qué rol, sin necesitar cruzar con la tabla de usuarios
      en el frontend.

    El campo `detalles` usa el reverse manager automático `detalleperdida_set`
    para incluir todas las unidades perdidas en el evento.
    """
    id = serializers.IntegerField(source='IdPerdida', read_only=True)
    usuarioId = serializers.PrimaryKeyRelatedField(
        source='IdUsuario', queryset=Usuario.objects.all()
    )
    # Campos de auditoría: quién y con qué rol registró la pérdida
    usuarioNombre = serializers.CharField(source="IdUsuario.Nombre", read_only=True)
    usuarioRol = serializers.CharField(source="IdUsuario.Rol", read_only=True)
    tipoPerdida = serializers.CharField(source='TipoPerdida')
    fecha = serializers.DateTimeField(source='Fecha')
    total = serializers.DecimalField(source='Total', max_digits=12, decimal_places=2)
    # `detalleperdida_set`: Reverse manager automático de Django para acceder
    # a los DetallePerdida desde una Perdida (nombre = modelo_en_minúsculas + _set).
    detalles = DetallePerdidaSerializer(
        source='detalleperdida_set',
        many=True,
        read_only=True
    )

    class Meta:
        model = Perdida
        fields = [
            'id', 'usuarioId', 'usuarioNombre', 'usuarioRol',
            'tipoPerdida', 'fecha', 'total', 'detalles'
        ]


class DetalleSolicitudDevolucionSerializer(serializers.ModelSerializer):
    """
    Serializador de una línea de detalle de una solicitud de devolución.

    Al igual que DetallePerdidaSerializer, navega 3 niveles de FK para obtener
    el nombre del producto de la unidad que se desea devolver.

    `motivoRechazo` y `estadoItem` son opcionales (allow_null=True) porque
    se rellenan más tarde cuando el proveedor responde a la solicitud, no
    al crearla inicialmente.
    """
    id = serializers.IntegerField(source='IdDetalleSolicitudDevolucion', read_only=True)
    solicitudDevolucionId = serializers.PrimaryKeyRelatedField(
        source='IdSolicitudDevolucion', queryset=SolicitudDevolucion.objects.all()
    )
    inventarioId = serializers.PrimaryKeyRelatedField(
        source='IdInventario', queryset=Inventario.objects.all()
    )
    # Opcional: solo se rellena cuando el proveedor rechaza este ítem específico
    motivoRechazo = serializers.CharField(
        source='MotivoRechazo', required=False, allow_null=True
    )
    precioCompraUnitario = serializers.DecimalField(
        source='PrecioCompraUnitario', max_digits=12, decimal_places=2
    )
    # required=False: Al crear la solicitud, todos los ítems nacen como 'Pendiente'.
    # El admin lo actualiza cuando el proveedor responde.
    estadoItem = serializers.CharField(source='EstadoItem', required=False)
    # Navegación 3 niveles: para mostrar nombre del producto en la tabla de devoluciones
    productoNombre = serializers.CharField(
        source="IdInventario.IdDetalleEntrada.IdProducto.Nombre",
        read_only=True
    )

    class Meta:
        model = DetalleSolicitudDevolucion
        fields = [
            'id', 'solicitudDevolucionId', 'inventarioId',
            'motivoRechazo', 'precioCompraUnitario', 'estadoItem', 'productoNombre'
        ]


class SolicitudDevolucionSerializer(serializers.ModelSerializer):
    """
    Serializador completo de una solicitud de devolución con sus ítems anidados.

    `estado` es required=False porque al crear una solicitud, el backend
    la inicializa siempre como 'Pendiente' (valor por defecto del modelo).
    El cliente no necesita enviarlo.

    `observaciones` es required=False y allow_null=True porque no siempre
    hay una razón textual adicional: la causa puede ser evidente (producto dañado).

    `detalles` usa el reverse manager `detallesolicituddevolucion_set` para
    incluir todos los ítems de la solicitud en la respuesta.
    """
    id = serializers.IntegerField(source='IdSolicitudDevolucion', read_only=True)
    entradaInventarioId = serializers.PrimaryKeyRelatedField(
        source='IdEntradaInventario', queryset=EntradaInventario.objects.all()
    )
    usuarioId = serializers.PrimaryKeyRelatedField(
        source='IdUsuario', queryset=Usuario.objects.all()
    )
    # required=False: El backend asigna 'Pendiente' por defecto (ver modelo)
    estado = serializers.CharField(source='Estado', required=False)
    observaciones = serializers.CharField(
        source='Observaciones', required=False, allow_null=True
    )
    fecha = serializers.DateTimeField(source='Fecha')
    usuarioNombre = serializers.CharField(source="IdUsuario.Nombre", read_only=True)
    # Anidamiento completo: todos los ítems de la solicitud en una sola respuesta
    detalles = DetalleSolicitudDevolucionSerializer(
        source='detallesolicituddevolucion_set',
        many=True,
        read_only=True
    )

    class Meta:
        model = SolicitudDevolucion
        fields = [
            'id', 'entradaInventarioId', 'usuarioId', 'usuarioNombre',
            'estado', 'observaciones', 'fecha', 'detalles'
        ]
