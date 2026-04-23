from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
import re
from rest_framework.response import Response

from .models import Usuario
from .serializers import UsuarioSerializer
from .permissions import IsAdminRole


# ViewSet para usuarios
class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    permission_classes = [IsAdminRole]


# Cambiar email directo — protegido: solo admins pueden modificar emails de usuarios
@api_view(['PATCH'])
@permission_classes([IsAdminRole])
def cambiar_email_directo(request, user_id):
    try:
        user = Usuario.objects.get(IdUsuario=user_id)
        nuevo_email = request.data.get('email')

        if not nuevo_email:
            return Response({"error": "Debe proporcionar un nuevo correo"}, status=400)

        # Validación simple de formato
        regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(regex, nuevo_email):
            return Response({"error": "Correo no válido"}, status=400)

        # Guardar directamente
        user.Email = nuevo_email
        user.save()

        return Response({"mensaje": "Correo actualizado correctamente", "email": user.Email})

    except Usuario.DoesNotExist:
        return Response({"error": "Usuario no encontrado"}, status=404)

    except Exception as e:
        return Response({"error": str(e)}, status=500)