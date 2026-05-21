"""
Token JWT Personalizado — App 'usuarios'
=========================================

Este módulo extiende el serializador de tokens estándar de simplejwt para
enriquecer el payload del JWT con datos adicionales del usuario.

POR QUÉ PERSONALIZAR EL TOKEN:
    El token JWT estándar solo contiene el ID del usuario (user_id).
    El frontend necesita conocer el ROL y el NOMBRE del usuario para:
      1. Renderizar el nombre en el header (DashboardLayout.tsx).
      2. Determinar qué items del menú mostrar (admin vs vendedor).
      3. Proteger rutas de admin en el frontend (AdminRoute.tsx).

    Sin estos claims adicionales, el frontend tendría que hacer una petición
    extra a /api/usuarios/me/ en cada inicio de sesión, aumentando la latencia.
    Al incluirlos en el token, el frontend puede leerlos instantáneamente con
    jwt-decode() sin necesidad de un round-trip al servidor.

SEGURIDAD:
    Los claims personalizados ('rol', 'nombre') son parte del payload del JWT,
    que puede ser leído por cualquiera que tenga el token (aunque no modificado
    sin la SECRET_KEY). Por eso, estos campos deben ser datos no sensibles.
    Nunca incluir contraseñas, números de tarjeta u otros secretos en el token.
"""

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.response import Response
from rest_framework import status


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Serializador JWT personalizado que añade claims de negocio al token.

    Hereda de TokenObtainPairSerializer para mantener toda la lógica de
    autenticación estándar (verificación de credenciales, generación de
    access y refresh token) y solo sobreescribe la construcción del payload.
    """

    @classmethod
    def get_token(cls, user):
        """
        Genera el token JWT y añade claims personalizados al payload.

        Se llama automáticamente después de que las credenciales del usuario
        son verificadas. Recibe el objeto usuario de la BD y devuelve el
        token enriquecido.

        Args:
            user (Usuario): Instancia del modelo Usuario autenticado.

        Returns:
            Token: Objeto de token de simplejwt con claims adicionales.
                   El payload resultante tendrá la forma:
                   {
                       "token_type": "access",
                       "exp": 1234567890,
                       "user_id": 1,
                       "rol": "admin",        ← CLAIM PERSONALIZADO
                       "nombre": "Juan López"  ← CLAIM PERSONALIZADO
                   }
        """
        # Llamar al método padre primero para obtener el token base con
        # los claims estándar (token_type, exp, iat, jti, user_id).
        token = super().get_token(user)

        # Añadir claims de negocio que el frontend leerá en AuthContext.tsx
        # con jwtDecode(token).rol y jwtDecode(token).nombre
        token['rol'] = user.Rol
        token['nombre'] = user.Nombre

        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Vista de obtención de tokens JWT que usa el serializador personalizado.

    Además de las funciones estándar de simplejwt, sobreescribe `post()`
    para registrar cada intento de login (exitoso o fallido) en el log
    de auditoría. Esto permite al administrador monitorear quién inicia
    sesión, desde qué IP y cuándo, sin instalar dependencias adicionales.

    Endpoints:
        POST /api/token/ → {email, password} → {access, refresh}
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        """
        Intenta autenticar al usuario y registra el resultado en auditoría.

        El import local de registrar_evento_manual evita importaciones
        circulares en el arranque de Django (auditoria → usuarios → auditoria).
        """
        # Import local para evitar circular import en bootstrap de Django
        from auditoria.mixins import registrar_evento_manual

        response = super().post(request, *args, **kwargs)

        if response.status_code == status.HTTP_200_OK:
            # Login exitoso: el serializer ya validó las credenciales
            # Intentamos obtener el nombre del usuario desde la BD
            email = request.data.get('Email') or request.data.get('username', '')
            nombre_usuario = email  # Fallback al email si no encontramos el nombre
            try:
                from usuarios.models import Usuario
                usuario = Usuario.objects.get(Email=email)
                nombre_usuario = usuario.Nombre
            except Exception:
                pass

            registrar_evento_manual(
                request=request,
                accion='LOGIN',
                modulo='SISTEMA',
                descripcion=f'Inicio de sesión exitoso: {nombre_usuario}',
                resultado='EXITOSO',
            )
        else:
            # Login fallido: credenciales incorrectas
            email = request.data.get('Email') or request.data.get('username', 'desconocido')
            registrar_evento_manual(
                request=request,
                accion='LOGIN',
                modulo='SISTEMA',
                descripcion=f'Intento de login fallido para: {email}',
                resultado='FALLIDO',
            )

        return response
