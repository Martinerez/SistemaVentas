from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from .models import EntradaInventario, DetalleEntradaInventario, Inventario, Perdida, DetallePerdida, SolicitudDevolucion, DetalleSolicitudDevolucion
from usuarios.models import Usuario
from usuarios.permissions import IsAdminRole
from .serializers import (
    EntradaInventarioSerializer, DetalleEntradaInventarioSerializer, InventarioSerializer,
    PerdidaSerializer, DetallePerdidaSerializer, SolicitudDevolucionSerializer, DetalleSolicitudDevolucionSerializer
)
from django.utils import timezone

class EntradaInventarioViewSet(viewsets.ModelViewSet):
    queryset = EntradaInventario.objects.all()
    serializer_class = EntradaInventarioSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

class DetalleEntradaInventarioViewSet(viewsets.ModelViewSet):
    queryset = DetalleEntradaInventario.objects.all()
    serializer_class = DetalleEntradaInventarioSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

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

class InventarioViewSet(viewsets.ModelViewSet):
    queryset = Inventario.objects.all()
    serializer_class = InventarioSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

class PerdidaViewSet(viewsets.ModelViewSet):
    queryset = Perdida.objects.all()
    serializer_class = PerdidaSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

class DetallePerdidaViewSet(viewsets.ModelViewSet):
    queryset = DetallePerdida.objects.all()
    serializer_class = DetallePerdidaSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

class SolicitudDevolucionViewSet(viewsets.ModelViewSet):
    queryset = SolicitudDevolucion.objects.all()
    serializer_class = SolicitudDevolucionSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

class DetalleSolicitudDevolucionViewSet(viewsets.ModelViewSet):
    queryset = DetalleSolicitudDevolucion.objects.all()
    serializer_class = DetalleSolicitudDevolucionSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]

class ProcesarPerdidaView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    @transaction.atomic
    def post(self, request):
        usuario_id = request.data.get('usuarioId')
        tipo_perdida = request.data.get('tipoPerdida', 'Otra')  # DB enums are 'RechazoDevolucion' or 'Otra'
        if tipo_perdida not in ['RechazoDevolucion', 'Otra']:
            tipo_perdida = 'Otra'
            
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
                if inventario.Estado != "Disponible":
                    raise ValueError(f"El ítem {inv_id} no está Disponible. Estado actual: {inventario.Estado}")
                    
                DetallePerdida.objects.create(
                    IdPerdida=perdida,
                    IdInventario=inventario,
                    PrecioCompraUnitario=precio
                )
                
                inventario.Estado = "Perdido"
                inventario.save()
                
            return Response({"message": "Pérdida procesada exitosamente", "perdidaId": perdida.IdPerdida}, status=status.HTTP_201_CREATED)
        except Usuario.DoesNotExist:
            return Response({"error": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except Inventario.DoesNotExist:
            return Response({"error": "Ítem de inventario no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as ve:
            return Response({"error": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Error interno: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ProcesarDevolucionView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        usuario_id = request.data.get('usuarioId')
        fecha = request.data.get('fechaSolicitud')
        observaciones = request.data.get('motivo', '')
        detalles = request.data.get('detalles', [])
        
        try:
            usuario = Usuario.objects.get(IdUsuario=usuario_id)

            if not detalles:
                raise ValueError("La devolución debe tener al menos un ítem.")
                
            first_inv_id = detalles[0].get('inventarioId')
            first_inv = Inventario.objects.select_related(
                'IdDetalleEntrada__IdEntradaInventario'
            ).get(IdInventario=first_inv_id)

            entrada_inventario = first_inv.IdDetalleEntrada.IdEntradaInventario
            
            # ✅ CREAR SOLICITUD
            devolucion = SolicitudDevolucion.objects.create(
                IdEntradaInventario=entrada_inventario,
                IdUsuario=usuario,
                Estado="Pendiente",
                Observaciones=observaciones,
                Fecha=fecha
            )
            
            # ✅ ESTE FOR DEBE ESTAR DENTRO
            for d in detalles:
                inv_id = d.get('inventarioId')
                precio = d.get('precioCompraUnitario', 0)

                inventario = Inventario.objects.select_for_update().get(
                    IdInventario=inv_id
                )

                if inventario.Estado not in ["Disponible", "Dañado"]:
                    raise ValueError(
                        f"El ítem {inv_id} no puede ser devuelto (Estado: {inventario.Estado})."
                    )

                DetalleSolicitudDevolucion.objects.create(
                    IdSolicitudDevolucion=devolucion,
                    IdInventario=inventario,
                    EstadoItem="Pendiente",
                    PrecioCompraUnitario=precio
                )
                
            return Response(
                {
                    "message": "Devolución procesada exitosamente",
                    "devolucionId": devolucion.IdSolicitudDevolucion
                },
                status=status.HTTP_201_CREATED
            )

        except Usuario.DoesNotExist:
            return Response({"error": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        except Inventario.DoesNotExist:
            return Response({"error": "Ítem de inventario no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        except ValueError as ve:
            return Response({"error": str(ve)}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({"error": f"Error interno: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
