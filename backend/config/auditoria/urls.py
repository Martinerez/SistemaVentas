"""
URLs de Auditoría — App 'auditoria'
=====================================

Define las rutas de la API de auditoría. Todos los endpoints
son de solo lectura (GET) y están restringidos a administradores.

Estructura:
    GET /api/auditoria/logs/        → Historial filtrable de acciones
    GET /api/auditoria/estado-bd/   → Inspección de PostgreSQL
    GET /api/auditoria/sesiones/    → Últimos inicios de sesión (24h)
"""

from django.urls import path
from .views import LogAuditoriaListView, EstadoBDView, SesionesActivasView

urlpatterns = [
    # Historial de acciones del sistema con filtros múltiples
    path('logs/', LogAuditoriaListView.as_view(), name='auditoria-logs'),

    # Estado interno de PostgreSQL: tablas, SPs, conexiones
    path('estado-bd/', EstadoBDView.as_view(), name='auditoria-estado-bd'),

    # Resumen de sesiones de las últimas 24 horas
    path('sesiones/', SesionesActivasView.as_view(), name='auditoria-sesiones'),
]
