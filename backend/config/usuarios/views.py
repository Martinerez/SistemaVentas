"""
Vistas de Usuario — App 'usuarios'
=====================================

Expone los endpoints REST para gestión de cuentas de usuario.

DISEÑO DE SEGURIDAD:
    Todos los endpoints de este módulo están protegidos por IsAdminRole,
    ya que la gestión de cuentas (crear, editar, desactivar usuarios) es una
    operación administrativa sensible. Un vendedor no puede crear ni ver
    otras cuentas del sistema.

ENDPOINTS:
    GET    /api/usuarios/           → Listar todos los usuarios
    POST   /api/usuarios/           → Crear nuevo usuario
    GET    /api/usuarios/<id>/      → Detalle de un usuario
    PUT    /api/usuarios/<id>/      → Actualización completa
    PATCH  /api/usuarios/<id>/      → Actualización parcial (ej: solo cambiar estado)
    DELETE /api/usuarios/<id>/      → Eliminar usuario
    PATCH  /api/usuarios/<id>/cambiar-email/ → Cambio directo de email
"""

from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
import re
from rest_framework.response import Response

from .models import Usuario
from .serializers import UsuarioSerializer
from .permissions import IsAdminRole


class UsuarioViewSet(viewsets.ModelViewSet):
    """
    ViewSet completo para operaciones CRUD sobre el modelo Usuario.

    Usa ModelViewSet porque provee automáticamente los 5 endpoints estándar
    REST (list, create, retrieve, update, destroy) con una sola clase.
    Esto reduce el código boilerplate y mantiene la consistencia de la API.

    Todos los métodos requieren Rol == 'admin'. Un vendedor que intente
    acceder recibirá un HTTP 403 Forbidden.
    """
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    permission_classes = [IsAdminRole]


@api_view(['PATCH'])
@permission_classes([IsAdminRole])
def cambiar_email_directo(request, user_id):
    """
    Endpoint de emergencia para cambio directo de email por un administrador.

    POR QUÉ EXISTE ESTE ENDPOINT SEPARADO:
        El flujo normal de cambio de email (a través de UsuarioSerializer)
        incluye validaciones de "nuevo email ≠ email actual" que pueden
        interferir en casos de corrección de errores de escritura.
        Este endpoint permite al admin corregir un email incorrecto
        directamente, con solo validación de formato.

    Seguridad: Solo accesible para usuarios con Rol == 'admin'.
    Método HTTP: PATCH (actualización parcial, solo el campo email).

    Args:
        request: Objeto de petición DRF. request.data debe contener {'email': '...'}.
        user_id (int): ID del usuario cuyo email se modificará.

    Returns:
        Response: JSON con mensaje de confirmación y el nuevo email.
            - 200 OK: Cambio exitoso.
            - 400 Bad Request: Email no proporcionado o formato inválido.
            - 404 Not Found: Usuario con user_id no encontrado.
            - 500 Internal Server Error: Error inesperado del servidor.

    Raises:
        No lanza excepciones directamente; las captura y las devuelve como
        errores HTTP estructurados.
    """
    try:
        user = Usuario.objects.get(IdUsuario=user_id)
        nuevo_email = request.data.get('email')

        if not nuevo_email:
            return Response({"error": "Debe proporcionar un nuevo correo"}, status=400)

        # Validación de formato con regex básica.
        # Se usa una expresión regular simple en lugar de EmailValidator de Django
        # porque este endpoint es de uso administrativo rápido y no crítico.
        regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(regex, nuevo_email):
            return Response({"error": "Correo no válido"}, status=400)

        # Guardar directamente sin pasar por el serializer (sin validaciones extra)
        user.Email = nuevo_email
        user.save()

        return Response({"mensaje": "Correo actualizado correctamente", "email": user.Email})

    except Usuario.DoesNotExist:
        return Response({"error": "Usuario no encontrado"}, status=404)

    except Exception as e:
        # Captura genérica para errores inesperados (ej: violación de unicidad en BD)
        return Response({"error": str(e)}, status=500)