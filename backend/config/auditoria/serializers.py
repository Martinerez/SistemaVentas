"""
Serializadores de Auditoría — App 'auditoria'
===============================================

Solo se define un serializador de LECTURA para LogAuditoria.
Los logs no se crean desde la API externa — solo se leen por los administradores.
La creación ocurre internamente a través del AuditoriaMixin y registrar_evento_manual.
"""

from rest_framework import serializers
from .models import LogAuditoria


class LogAuditoriaSerializer(serializers.ModelSerializer):
    """
    Serializador de solo lectura para LogAuditoria.

    Expone todos los campos relevantes para la vista de auditoría en el frontend.
    El campo `timestamp` se formatea con timezone para coherencia con el frontend.
    """

    class Meta:
        model = LogAuditoria
        fields = [
            'IdLog',
            'nombre_usuario',
            'accion',
            'modulo',
            'descripcion',
            'ip_address',
            'user_agent',
            'datos_anteriores',
            'datos_nuevos',
            'resultado',
            'timestamp',
        ]
        read_only_fields = fields
