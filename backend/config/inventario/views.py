from rest_framework import viewsets
from .models import EntradaInventario, DetalleEntradaInventario, Inventario, Perdida, DetallePerdida, SolicitudDevolucion, DetalleSolicitudDevolucion
from .serializers import (
    EntradaInventarioSerializer, DetalleEntradaInventarioSerializer, InventarioSerializer,
    PerdidaSerializer, DetallePerdidaSerializer, SolicitudDevolucionSerializer, DetalleSolicitudDevolucionSerializer
)

class EntradaInventarioViewSet(viewsets.ModelViewSet):
    queryset = EntradaInventario.objects.all()
    serializer_class = EntradaInventarioSerializer

class DetalleEntradaInventarioViewSet(viewsets.ModelViewSet):
    queryset = DetalleEntradaInventario.objects.all()
    serializer_class = DetalleEntradaInventarioSerializer

class InventarioViewSet(viewsets.ModelViewSet):
    queryset = Inventario.objects.all()
    serializer_class = InventarioSerializer

class PerdidaViewSet(viewsets.ModelViewSet):
    queryset = Perdida.objects.all()
    serializer_class = PerdidaSerializer

class DetallePerdidaViewSet(viewsets.ModelViewSet):
    queryset = DetallePerdida.objects.all()
    serializer_class = DetallePerdidaSerializer

class SolicitudDevolucionViewSet(viewsets.ModelViewSet):
    queryset = SolicitudDevolucion.objects.all()
    serializer_class = SolicitudDevolucionSerializer

class DetalleSolicitudDevolucionViewSet(viewsets.ModelViewSet):
    queryset = DetalleSolicitudDevolucion.objects.all()
    serializer_class = DetalleSolicitudDevolucionSerializer
