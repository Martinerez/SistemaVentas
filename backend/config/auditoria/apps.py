"""
Configuración de la App 'auditoria' — SistemaVentas "La Bendición de Dios"
============================================================================

Registra la aplicación de auditoría en el ecosistema Django.
Esta app centraliza el registro de todas las acciones críticas del sistema
(mutaciones POST/PUT/PATCH/DELETE) y expone herramientas de inspección de la BD.
"""

from django.apps import AppConfig


class AuditoriaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'auditoria'
    verbose_name = 'Auditoría del Sistema'
