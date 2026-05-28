"""
Administración de Auditoría — App 'auditoria'
===============================================

Registra el modelo LogAuditoria en el panel de administración de Django
para que los superusuarios puedan consultarlo directamente desde /admin/.

La configuración es de solo lectura: los logs no deben ser modificados
manualmente desde el admin, solo consultados.
"""

from django.contrib import admin
from .models import LogAuditoria


@admin.register(LogAuditoria)
class LogAuditoriaAdmin(admin.ModelAdmin):
    """Configuración del panel admin para LogAuditoria."""

    list_display = ('IdLog', 'nombre_usuario', 'accion', 'modulo', 'resultado', 'ip_address', 'timestamp')
    list_filter = ('accion', 'modulo', 'resultado', 'timestamp')
    search_fields = ('nombre_usuario', 'descripcion', 'ip_address')
    readonly_fields = ('IdLog', 'usuario', 'nombre_usuario', 'accion', 'modulo',
                       'descripcion', 'ip_address', 'user_agent',
                       'datos_anteriores', 'datos_nuevos', 'resultado', 'timestamp')
    ordering = ('-timestamp',)

    def has_add_permission(self, request):
        """Los logs no se crean manualmente desde el admin."""
        return False

    def has_change_permission(self, request, obj=None):
        """Los logs son inmutables."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Solo superusuarios pueden borrar logs (para purga manual)."""
        return request.user.is_superuser
