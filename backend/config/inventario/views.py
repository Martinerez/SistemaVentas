from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.db import transaction
from django.utils import timezone
from .models import EntradaInventario, DetalleEntradaInventario, Inventario, Perdida, DetallePerdida, SolicitudDevolucion, DetalleSolicitudDevolucion
from usuarios.models import Usuario
from usuarios.permissions import IsAdminRole, IsAdminOrReadOnly
from .serializers import (
    EntradaInventarioSerializer, DetalleEntradaInventarioSerializer, InventarioSerializer,
    PerdidaSerializer, DetallePerdidaSerializer, SolicitudDevolucionSerializer, DetalleSolicitudDevolucionSerializer
)


class EntradaInventarioViewSet(viewsets.ModelViewSet):
    queryset = EntradaInventario.objects.all()
    serializer_class = EntradaInventarioSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None

    @action(detail=True, methods=["delete"])
    @transaction.atomic
    def delete_completo(self, request, pk=None):
        entrada = self.get_object()

        # 1. borrar inventarios
        Inventario.objects.filter(
            IdDetalleEntrada__IdEntradaInventario=entrada
        ).delete()

        # 2. borrar detalles
        DetalleEntradaInventario.objects.filter(
            IdEntradaInventario=entrada
        ).delete()

        # 3. borrar entrada
        entrada.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

class DetalleEntradaInventarioViewSet(viewsets.ModelViewSet):
    queryset = DetalleEntradaInventario.objects.all()
    serializer_class = DetalleEntradaInventarioSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    # =========================
    # FILTRO POR ENTRADA
    # =========================
    def get_queryset(self):
        entrada_id = self.request.query_params.get("entradaInventarioId")

        queryset = DetalleEntradaInventario.objects.all()

        if entrada_id:
            queryset = queryset.filter(IdEntradaInventario_id=entrada_id)

        return queryset

    # =========================
    # CREAR DETALLE + INVENTARIO
    # =========================
    @transaction.atomic
    def perform_create(self, serializer):
        detalle = serializer.save()

        inventarios = [
            Inventario(
                IdDetalleEntrada=detalle,
                Estado="Disponible",
                FechaMovimiento=timezone.now()
            )
            for _ in range(detalle.Cantidad)
        ]

        Inventario.objects.bulk_create(inventarios)

    pagination_class = None
    
class InventarioViewSet(viewsets.ModelViewSet):
    queryset = Inventario.objects.all()
    serializer_class = InventarioSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    pagination_class = None

class PerdidaViewSet(viewsets.ModelViewSet):
    queryset = Perdida.objects.all()
    serializer_class = PerdidaSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None

class DetallePerdidaViewSet(viewsets.ModelViewSet):
    queryset = DetallePerdida.objects.all()
    serializer_class = DetallePerdidaSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None

class SolicitudDevolucionViewSet(viewsets.ModelViewSet):
    queryset = SolicitudDevolucion.objects.all()
    serializer_class = SolicitudDevolucionSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.Estado != 'Pendiente':
            return Response({"error": "No se puede modificar una solicitud que ya no está pendiente."}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.Estado != 'Pendiente':
            return Response({"error": "No se puede modificar una solicitud que ya no está pendiente."}, status=status.HTTP_400_BAD_REQUEST)
        return super().partial_update(request, *args, **kwargs)

class DetalleSolicitudDevolucionViewSet(viewsets.ModelViewSet):
    queryset = DetalleSolicitudDevolucion.objects.all()
    serializer_class = DetalleSolicitudDevolucionSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None

# ─── VISTAS DE PROCESAMIENTO ───────────────────

class ProcesarPerdidaView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    
    @transaction.atomic
    def post(self, request):
        usuario_id = request.data.get('usuarioId')
        tipo_perdida = request.data.get('tipoPerdida', 'Otra')
        fecha = request.data.get('fecha')
        total = request.data.get('total')
        detalles = request.data.get('detalles', [])
        
        try:
            usuario = Usuario.objects.get(IdUsuario=usuario_id)
            perdida = Perdida.objects.create(
                IdUsuario=usuario,
                TipoPerdida=tipo_perdida,
                Fecha=fecha,
                Total=total
            )
            for d in detalles:
                inv_id = d.get('inventarioId')
                precio = d.get('precioCompraUnitario')
                inventario = Inventario.objects.select_for_update().get(IdInventario=inv_id)
                DetallePerdida.objects.create(
                    IdPerdida=perdida,
                    IdInventario=inventario,
                    PrecioCompraUnitario=precio
                )
                inventario.Estado = "Perdido"
                inventario.save()
            return Response({"message": "Pérdida procesada"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ProcesarDevolucionView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        usuario_id = request.data.get('usuarioId')
        fecha = request.data.get('fechaSolicitud')
        detalles = request.data.get('detalles', [])
        
        try:
            usuario = Usuario.objects.get(IdUsuario=usuario_id)
            entrada_id = request.data.get('IdEntradaInventario')
            entrada = EntradaInventario.objects.get(IdEntradaInventario=entrada_id)
            
            solicitud = SolicitudDevolucion.objects.create(
                IdEntradaInventario=entrada,
                IdUsuario=usuario,
                Estado=request.data.get('Estado', 'Pendiente'),
                Observaciones=request.data.get('Observaciones', ''),
                Fecha=fecha
            )
            for d in detalles:
                inv_id = d.get('inventarioId')
                precio = d.get('PrecioCompraUnitario')
                motivo = d.get('MotivoRechazo')
                inventario = Inventario.objects.get(IdInventario=inv_id)
                DetalleSolicitudDevolucion.objects.create(
                    IdSolicitudDevolucion=solicitud,
                    IdInventario=inventario,
                    MotivoRechazo=motivo,
                    PrecioCompraUnitario=precio,
                    EstadoItem=d.get('EstadoItem', 'Pendiente')
                )
                # Actualizar estado para que no salga más en el panel
                inventario.Estado = 'Devuelto'
                inventario.save()
            return Response({"message": "Solicitud de devolución procesada."}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class DevolverStockView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        solicitud_id = request.data.get('solicitud_id')
        try:
            solicitud = SolicitudDevolucion.objects.get(IdSolicitudDevolucion=solicitud_id)
            if solicitud.Estado != 'Aceptada':
                return Response({"error": "La solicitud debe estar Aceptada para devolver stock."}, status=status.HTTP_400_BAD_REQUEST)
            
            detalles = DetalleSolicitudDevolucion.objects.filter(IdSolicitudDevolucion=solicitud)
            for det in detalles:
                inventario = det.IdInventario
                inventario.Estado = 'Disponible'
                inventario.save()
                
                det.EstadoItem = 'Aceptado'
                det.save()
            return Response({"message": "Stock devuelto exitosamente."}, status=status.HTTP_200_OK)
        except SolicitudDevolucion.DoesNotExist:
            return Response({"error": "Solicitud no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

