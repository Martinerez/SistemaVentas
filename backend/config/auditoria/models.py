"""
Modelo LogAuditoria — App 'auditoria'
=======================================

Define la tabla central del sistema de auditoría. Cada fila representa
una acción crítica (mutación) ejecutada por un usuario del sistema.

DECISIONES DE DISEÑO:

  1. FK con SET_NULL (no CASCADE):
     Si un usuario es eliminado, sus logs históricos deben conservarse.
     El campo `nombre_usuario` (snapshot del nombre en el momento de la acción)
     garantiza que el log sea legible incluso si el Usuario fue eliminado.

  2. JSONField para datos_anteriores / datos_nuevos:
     Permite almacenar el estado completo del objeto antes y después de la
     modificación sin definir columnas fijas. Esto es crucial porque cada
     módulo (Ventas, Productos, Usuarios) tiene estructuras distintas.

  3. ip_address GenericIPAddressField:
     Soporta tanto IPv4 como IPv6 de forma nativa. Django valida el formato
     automáticamente en la capa del modelo.

  4. ordering = ['-timestamp']:
     Los logs más recientes aparecen primero por defecto en todas las queries,
     sin necesidad de especificarlo en cada vista.

  5. Retención de 90 días:
     El comando de gestión `limpiar_logs` (en management/commands/) borra
     registros con timestamp > 90 días para prevenir el crecimiento ilimitado
     de la tabla.
"""

from django.db import models
from django.conf import settings


class LogAuditoria(models.Model):
    """
    Registro de una acción crítica realizada en el sistema.

    Solo se registran mutaciones (POST, PUT, PATCH, DELETE), nunca GETs.
    Esto equilibra la trazabilidad con el rendimiento de la BD.

    Attributes:
        IdLog (AutoField): Clave primaria autoincremental.
        usuario (FK → Usuario): Quién ejecutó la acción. NULL si fue eliminado.
        nombre_usuario (CharField): Snapshot del nombre al momento de la acción.
        accion (CharField): Tipo de operación realizada.
        modulo (CharField): Módulo del sistema afectado.
        descripcion (TextField): Descripción legible para humanos de la acción.
        ip_address (GenericIPAddressField): IP del cliente que hizo la petición.
        user_agent (TextField): Navegador/cliente HTTP del usuario.
        datos_anteriores (JSONField): Estado del objeto ANTES de la modificación.
        datos_nuevos (JSONField): Estado del objeto DESPUÉS de la modificación.
        resultado (CharField): Si la operación fue exitosa o falló.
        timestamp (DateTimeField): Fecha y hora exacta (UTC, timezone-aware).
    """

    # ── Tipos de acción registrables ──────────────────────────────────────────
    ACCION_CHOICES = (
        ('CREAR', 'Crear'),
        ('MODIFICAR', 'Modificar'),
        ('ELIMINAR', 'Eliminar'),
        ('LOGIN', 'Inicio de Sesión'),
        ('LOGOUT', 'Cierre de Sesión'),
        ('ERROR_ACCESO', 'Error de Acceso'),
        ('ANULAR', 'Anular'),
        ('PROCESAR', 'Procesar'),
    )

    # ── Módulos del sistema ───────────────────────────────────────────────────
    MODULO_CHOICES = (
        ('VENTAS', 'Ventas'),
        ('PRODUCTOS', 'Productos'),
        ('CATEGORIAS', 'Categorías'),
        ('PROVEEDORES', 'Proveedores'),
        ('INVENTARIO', 'Inventario'),
        ('PERDIDAS', 'Pérdidas'),
        ('DEVOLUCIONES', 'Devoluciones'),
        ('USUARIOS', 'Usuarios'),
        ('SISTEMA', 'Sistema'),
    )

    # ── Resultados posibles ───────────────────────────────────────────────────
    RESULTADO_CHOICES = (
        ('EXITOSO', 'Exitoso'),
        ('FALLIDO', 'Fallido'),
    )

    IdLog = models.AutoField(primary_key=True)

    # SET_NULL: El log sobrevive aunque el usuario sea eliminado
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs_auditoria',
        db_column='IdUsuario'
    )

    # Snapshot del nombre — legible incluso si el usuario se elimina
    nombre_usuario = models.CharField(max_length=255, blank=True, default='')

    accion = models.CharField(max_length=20, choices=ACCION_CHOICES)
    modulo = models.CharField(max_length=20, choices=MODULO_CHOICES)
    descripcion = models.TextField()

    # IP del cliente — GenericIPAddressField soporta IPv4 e IPv6
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    # Navegador/cliente HTTP — útil para detectar accesos automatizados
    user_agent = models.TextField(blank=True, default='')

    # Estado del objeto ANTES de la modificación (vacío para CREAR)
    datos_anteriores = models.JSONField(null=True, blank=True)
    # Estado del objeto DESPUÉS de la modificación (vacío para ELIMINAR)
    datos_nuevos = models.JSONField(null=True, blank=True)

    resultado = models.CharField(
        max_length=10,
        choices=RESULTADO_CHOICES,
        default='EXITOSO'
    )

    # auto_now_add=True: Se establece automáticamente al crear el registro,
    # nunca puede ser modificado posteriormente.
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'LogAuditoria'
        # Los logs más recientes primero — comportamiento esperado en auditoría
        ordering = ['-timestamp']
        verbose_name = 'Log de Auditoría'
        verbose_name_plural = 'Logs de Auditoría'

    def __str__(self):
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.nombre_usuario} — {self.accion} en {self.modulo}"
