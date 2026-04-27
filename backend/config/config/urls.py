"""
Enrutador Principal de URLs — SistemaVentas "La Bendición de Dios"
===================================================================

Este archivo actúa como el "directorio telefónico" de toda la API.
Cada ruta aquí definida delega el enrutamiento detallado al archivo
`urls.py` de cada aplicación de dominio.

ESTRUCTURA DE LA API:
    /admin/                 → Panel de administración de Django (solo superusuarios)
    /api/token/             → Obtención de tokens JWT (login)
    /api/token/refresh/     → Renovación de access token con refresh token
    /api/usuarios/          → CRUD de usuarios del sistema
    /api/catalogo/          → Gestión de categorías, proveedores y productos
    /api/inventario/        → Control de entradas, stock, pérdidas y devoluciones
    /api/ventas/            → Procesamiento de ventas, reportes y estadísticas

DECISIÓN DE DISEÑO — JWT Personalizado:
    Se usa `CustomTokenObtainPairView` en lugar del `TokenObtainPairView` estándar
    de simplejwt. La versión personalizada enriquece el payload del token con
    claims adicionales (`rol`, `nombre`) que el frontend necesita para:
    1. Mostrar el nombre del usuario en la barra de navegación sin una llamada extra.
    2. Determinar qué elementos del menú mostrar según el rol (admin vs vendedor).
    3. Proteger rutas en el frontend (AdminRoute.tsx) sin depender del estado global.
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
# CustomTokenObtainPairView añade 'rol' y 'nombre' al payload del JWT,
# eliminando la necesidad de una petición adicional de /api/me/ al iniciar sesión.
from usuarios.token_serializers import CustomTokenObtainPairView

urlpatterns = [
    # Panel de admin de Django — Útil para gestión de emergencia y backoffice.
    # En producción, considerar cambiar la ruta para oscurecer su ubicación.
    path('admin/', admin.site.urls),

    # ── Autenticación JWT ────────────────────────────────────────────────────
    # POST /api/token/   → Recibe {email, password}, devuelve {access, refresh}
    # El frontend guarda ambos tokens en localStorage y los usa en cada petición.
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),

    # POST /api/token/refresh/ → Recibe {refresh}, devuelve {access} nuevo.
    # Esta ruta es consumida exclusivamente por el interceptor de axiosInstance.ts
    # cuando detecta un error 401 en cualquier otra petición autenticada.
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # ── Rutas de Dominio (delegadas a cada app) ───────────────────────────────
    # El prefijo 'api/' unifica todos los endpoints bajo un namespace claro,
    # facilitando la configuración del proxy de Vite en vite.config.ts.
    path('api/usuarios/', include('usuarios.urls')),
    path('api/catalogo/', include('catalogo.urls')),
    path('api/inventario/', include('inventario.urls')),
    path('api/ventas/', include('ventas.urls')),
]
