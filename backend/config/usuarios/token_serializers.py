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

    Esta clase solo existe para conectar la URL del token con el serializador
    correcto. Es registrada en config/urls.py como el endpoint de login:
        POST /api/token/ → {email, password} → {access, refresh}
    """
    serializer_class = CustomTokenObtainPairSerializer
