"""
Serializadores de Ventas — App 'ventas'
=========================================

Convierten las instancias de Venta y DetalleVenta en JSON y viceversa.

SERIALIZACIÓN ANIDADA:
    VentaSerializer incluye DetalleVentaSerializer de forma anidada.
    Esto permite devolver una venta completa con todos sus ítems en una sola
    respuesta JSON, eliminando la necesidad de N+1 peticiones al frontend.

    Ejemplo de respuesta:
        {
            "id": 1,
            "usuarioId": 2,
            "fecha": "2026-04-20T14:30:00Z",
            "total": "150.00",
            "estado": "Completada",
            "detalles": [
                {
                    "id": 1,
                    "ventaId": 1,
                    "inventarioId": 42,
                    "precioVentaUnitario": "75.00",
                    "nombreProducto": "Coca-Cola 600ml"
                },
                ...
            ]
        }

NAVEGACIÓN DE RELACIONES (get_nombreProducto):
    Para mostrar el nombre del producto en el historial de ventas,
    se navega la cadena de FKs:
        DetalleVenta.IdInventario
            → Inventario.IdDetalleEntrada
                → DetalleEntradaInventario.IdProducto
                    → Producto.Nombre

    Esta navegación es O(1) en SQL gracias a los índices de FK, pero
    para listas grandes de ventas puede generar N+1 queries. En ese caso,
    optimizar con select_related() en el queryset del ViewSet.
"""

from rest_framework import serializers
from .models import Venta, DetalleVenta
from usuarios.models import Usuario
from inventario.models import Inventario


class DetalleVentaSerializer(serializers.ModelSerializer):
    """
    Serializador de una línea de detalle de venta.

    Incluye el campo calculado 'nombreProducto' para que el frontend pueda
    mostrar el nombre del artículo vendido en el historial expandible,
    sin necesitar una consulta adicional por cada ítem.
    """
    id = serializers.IntegerField(source='IdDetalleVenta', read_only=True)
    ventaId = serializers.PrimaryKeyRelatedField(source='IdVenta', queryset=Venta.objects.all())
    inventarioId = serializers.PrimaryKeyRelatedField(source='IdInventario', queryset=Inventario.objects.all())
    precioVentaUnitario = serializers.DecimalField(source='PrecioVentaUnitario', max_digits=12, decimal_places=2)
    # Campo calculado: Navega Inventario → DetalleEntrada → Producto para obtener el nombre.
    # Solo lectura (read_only implícito en SerializerMethodField).
    nombreProducto = serializers.SerializerMethodField()

    class Meta:
        model = DetalleVenta
        fields = ['id', 'ventaId', 'inventarioId', 'precioVentaUnitario', 'nombreProducto']

    def get_nombreProducto(self, obj):
        """
        Obtiene el nombre del producto navegando la cadena de relaciones FK.

        Ruta de navegación:
            obj (DetalleVenta)
            → obj.IdInventario (Inventario)
            → .IdDetalleEntrada (DetalleEntradaInventario)
            → .IdProducto (Producto)
            → .Nombre (str)

        El bloque try/except captura AttributeError en caso de que alguna
        relación en la cadena sea None (datos inconsistentes en BD),
        devolviendo un valor seguro en lugar de lanzar un error 500.

        Args:
            obj (DetalleVenta): Instancia del detalle siendo serializado.

        Returns:
            str: Nombre del producto, o 'Producto desconocido' si hay error.
        """
        try:
            return obj.IdInventario.IdDetalleEntrada.IdProducto.Nombre
        except AttributeError:
            return 'Producto desconocido'


class VentaSerializer(serializers.ModelSerializer):
    """
    Serializador completo de una venta con sus detalles anidados.

    El campo 'detalles' usa el related_name='detalles' definido en
    DetalleVenta.IdVenta para acceder a todos los ítems de la venta.

    'estado' es read_only porque el estado de una venta solo cambia
    a través de operaciones específicas (AnularVentaView), no mediante
    una actualización directa del campo.
    """
    id = serializers.IntegerField(source='IdVenta', read_only=True)
    usuarioId = serializers.PrimaryKeyRelatedField(source='IdUsuario', queryset=Usuario.objects.all())
    fecha = serializers.DateTimeField(source='Fecha')
    total = serializers.DecimalField(source='Total', max_digits=12, decimal_places=2)
    # read_only: El estado solo lo cambia la lógica de negocio de AnularVentaView.
    # El cliente no puede enviar un estado arbitrario en POST/PATCH.
    estado = serializers.CharField(source='Estado', read_only=True)
    # Serialización anidada: Usa related_name='detalles' definido en DetalleVenta.IdVenta.
    # many=True: Serializa una lista de objetos DetalleVenta.
    # read_only=True: Los detalles se crean en ProcesarVentaView, no aquí.
    detalles = DetalleVentaSerializer(many=True, read_only=True)

    class Meta:
        model = Venta
        fields = ['id', 'usuarioId', 'fecha', 'total', 'estado', 'detalles']
