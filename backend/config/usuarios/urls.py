"""
Enrutador de URLs — App 'usuarios'
=====================================

Registra el UsuarioViewSet y el endpoint especial de cambio de email.

ESTRUCTURA:
    /api/usuarios/usuarios/                      → CRUD de usuarios (DefaultRouter)
    /api/usuarios/cambiar-email-directo/<id>/    → Cambio directo de email por admin

POR QUÉ UN ENDPOINT SEPARADO PARA CAMBIO DE EMAIL:
    El flujo estándar de PATCH /api/usuarios/usuarios/<id>/ tiene validaciones
    de negocio (no puede ser igual al email actual) que pueden interferir en
    correcciones de emergencia. El endpoint `cambiar_email_directo` permite
    al admin corregir un email sin esas restricciones, con solo validación
    de formato básico (regex de email).

    Su acceso está igualmente protegido por IsAdminRole en la vista.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UsuarioViewSet, cambiar_email_directo

router = DefaultRouter()
# Prefijo 'usuarios': genera rutas como /api/usuarios/usuarios/ (doble)
# porque el include en config/urls.py ya añade 'usuarios/'.
# Para evitar /api/usuarios/usuarios/, considerar prefijo '' en el register.
router.register(r'usuarios', UsuarioViewSet)

urlpatterns = [
    # CRUD estándar (list, create, retrieve, update, destroy)
    path('', include(router.urls)),
    # Endpoint de emergencia para corrección de email por administrador
    # <int:user_id>: Captura el ID del usuario como entero en la URL.
    path('cambiar-email-directo/<int:user_id>/', cambiar_email_directo),
]