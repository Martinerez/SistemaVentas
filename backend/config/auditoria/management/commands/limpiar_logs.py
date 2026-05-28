"""
Comando de Gestión: limpiar_logs
==================================

Elimina los registros de auditoría más antiguos que el período de retención
configurado (90 días por defecto).

USO:
    python manage.py limpiar_logs
    python manage.py limpiar_logs --dias 30
    python manage.py limpiar_logs --dry-run

OPCIONES:
    --dias <N>    Número de días de retención (default: 90).
    --dry-run     Muestra cuántos registros se borrarían sin borrarlos.

AUTOMATIZACIÓN RECOMENDADA:
    Programar este comando como una tarea cron en el servidor de producción:
    # En crontab (ejecutar cada domingo a las 2:00 AM):
    0 2 * * 0 /ruta/al/venv/bin/python /ruta/al/proyecto/manage.py limpiar_logs

POR QUÉ DELETE() Y NO SOFT-DELETE:
    Los logs antiguos ya cumplieron su período de retención legal/operativa.
    Borrarlos físicamente libera espacio en disco y mejora el rendimiento
    de los índices de la tabla LogAuditoria.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from auditoria.models import LogAuditoria


class Command(BaseCommand):
    help = 'Elimina logs de auditoría más antiguos que el período de retención (default: 90 días)'

    def add_arguments(self, parser):
        """Define los argumentos opcionales del comando."""
        parser.add_argument(
            '--dias',
            type=int,
            default=90,
            help='Número de días de retención. Logs más antiguos serán eliminados. (default: 90)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Solo muestra cuántos registros se borrarían, sin eliminar nada.'
        )

    def handle(self, *args, **options):
        """
        Ejecuta la limpieza de logs expirados.

        El queryset usa __lt (less than) en timestamp para seleccionar
        todos los logs anteriores a la fecha de corte calculada.
        """
        dias = options['dias']
        dry_run = options['dry_run']

        # Calcular la fecha de corte: hoy - N días
        fecha_corte = timezone.now() - timedelta(days=dias)

        # Seleccionar los logs a eliminar
        logs_a_eliminar = LogAuditoria.objects.filter(timestamp__lt=fecha_corte)
        cantidad = logs_a_eliminar.count()

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'[DRY RUN] Se eliminarían {cantidad} logs anteriores a {fecha_corte.strftime("%Y-%m-%d")} '
                    f'(más de {dias} días de antigüedad). No se eliminó nada.'
                )
            )
            return

        if cantidad == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f'No hay logs para eliminar. Todos los registros tienen menos de {dias} días.'
                )
            )
            return

        # Confirmar la eliminación
        self.stdout.write(f'Eliminando {cantidad} logs anteriores a {fecha_corte.strftime("%Y-%m-%d")}...')
        logs_a_eliminar.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f'✓ Se eliminaron {cantidad} logs de auditoría con más de {dias} días de antigüedad.'
            )
        )
