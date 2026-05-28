"""
Vistas de Auditoría — App 'auditoria'
=======================================

Expone tres endpoints exclusivos para administradores:

  1. LogAuditoriaListView   → Historial filtrable de acciones del sistema.
  2. EstadoBDView           → Inspección interna de PostgreSQL (tablas, SPs, conexiones).
  3. SesionesActivasView    → Últimos inicios de sesión por usuario (últimas 24h).

SEGURIDAD:
    Todos los endpoints están protegidos por IsAdminRole.
    Un vendedor que intente acceder recibirá HTTP 403 Forbidden.

QUERIES DIRECTAS A pg_stat_* (EstadoBDView):
    Las vistas de sistema de PostgreSQL (pg_stat_user_tables, pg_proc,
    pg_stat_activity) son la fuente de verdad para el estado interno de la BD.
    No tienen equivalente en el ORM de Django, por lo que se usan queries
    SQL directas con connection.cursor(). Esto es intencional y seguro:
    las consultas son de solo lectura y no reciben parámetros del usuario.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.db import connection
from django.utils import timezone
from datetime import timedelta

from usuarios.permissions import IsAdminRole
from .models import LogAuditoria
from .serializers import LogAuditoriaSerializer


class AuditoriaPagination(PageNumberPagination):
    """
    Paginación específica para logs de auditoría.

    20 registros por página es el balance ideal para la UI de auditoría:
    suficientes para ser útil sin sobrecargar la vista o la red.
    El parámetro page_size_query_param permite al frontend pedir más si necesita.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 200


class LogAuditoriaListView(APIView):
    """
    Lista paginada de logs de auditoría con filtros múltiples.

    Endpoint: GET /api/auditoria/logs/

    Query Params opcionales:
        modulo       (str): Filtrar por módulo (VENTAS, PRODUCTOS, etc.)
        accion       (str): Filtrar por tipo de acción (CREAR, MODIFICAR, etc.)
        resultado    (str): Filtrar por resultado (EXITOSO, FALLIDO)
        usuario_nombre (str): Filtrar por nombre de usuario (búsqueda parcial)
        fecha_inicio (str): Desde esta fecha (YYYY-MM-DD), inclusive
        fecha_fin    (str): Hasta esta fecha (YYYY-MM-DD), inclusive
        page         (int): Número de página (default: 1)
        page_size    (int): Registros por página (default: 20, max: 200)
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        """
        Devuelve los logs de auditoría filtrados y paginados.

        Los filtros se aplican acumulativamente (AND lógico).
        Todos son opcionales — sin filtros, devuelve todos los logs del sistema.
        """
        queryset = LogAuditoria.objects.all()

        # ── Filtros opcionales ─────────────────────────────────────────────
        modulo = request.query_params.get('modulo')
        accion = request.query_params.get('accion')
        resultado = request.query_params.get('resultado')
        usuario_nombre = request.query_params.get('usuario_nombre')
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')

        if modulo:
            queryset = queryset.filter(modulo=modulo)
        if accion:
            queryset = queryset.filter(accion=accion)
        if resultado:
            queryset = queryset.filter(resultado=resultado)
        if usuario_nombre:
            # icontains: búsqueda case-insensitive por nombre parcial
            queryset = queryset.filter(nombre_usuario__icontains=usuario_nombre)
        if fecha_inicio:
            # __date: Compara solo la parte de fecha (ignorando la hora)
            queryset = queryset.filter(timestamp__date__gte=fecha_inicio)
        if fecha_fin:
            queryset = queryset.filter(timestamp__date__lte=fecha_fin)

        # ── Paginación ─────────────────────────────────────────────────────
        paginator = AuditoriaPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = LogAuditoriaSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class EstadoBDView(APIView):
    """
    Inspección del estado interno de PostgreSQL.

    Endpoint: GET /api/auditoria/estado-bd/

    Ejecuta queries de solo lectura contra las vistas de sistema de PostgreSQL
    para obtener información diagnóstica sin usar el ORM de Django.

    Datos devueltos:
        - version_pg: Versión de PostgreSQL.
        - tamano_bd: Tamaño total de la base de datos en formato legible.
        - tablas: Lista de tablas del proyecto con filas, tamaño y estado.
        - stored_procedures: Lista de funciones PL/pgSQL del proyecto.
        - conexiones_activas: Número de conexiones actuales a la BD.
        - conexiones_detalle: Lista detallada de las conexiones activas.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        """
        Ejecuta múltiples queries de diagnóstico a las vistas de sistema de PG.

        QUERIES USADAS:
          - pg_stat_user_tables: Estadísticas de uso de tablas del usuario.
          - pg_total_relation_size(): Tamaño en disco de cada tabla.
          - pg_size_pretty(): Formatea bytes a formato legible (MB, GB).
          - pg_proc + pg_namespace: Catálogo de funciones/SPs.
          - pg_stat_activity: Conexiones activas en tiempo real.
          - version(): Versión del servidor PostgreSQL.
          - pg_database_size(): Tamaño total de la BD.
        """
        datos = {}

        with connection.cursor() as cursor:

            # ── Versión y tamaño de la BD ──────────────────────────────────
            cursor.execute("SELECT version()")
            version_completa = cursor.fetchone()[0]
            # Extraer solo la versión corta (ej: "PostgreSQL 15.2")
            datos['version_pg'] = version_completa.split(',')[0] if version_completa else 'N/A'

            cursor.execute("SELECT pg_size_pretty(pg_database_size(current_database()))")
            datos['tamano_bd'] = cursor.fetchone()[0]

            # ── Conexiones activas ─────────────────────────────────────────
            cursor.execute("""
                SELECT count(*)
                FROM pg_stat_activity
                WHERE datname = current_database()
            """)
            datos['conexiones_activas'] = cursor.fetchone()[0]

            # ── Detalle de conexiones (excluyendo esta misma conexión) ─────
            cursor.execute("""
                SELECT
                    pid,
                    usename AS usuario,
                    application_name AS aplicacion,
                    client_addr AS ip_cliente,
                    state AS estado,
                    to_char(backend_start, 'YYYY-MM-DD HH24:MI:SS') AS inicio_conexion,
                    left(query, 100) AS ultima_query
                FROM pg_stat_activity
                WHERE datname = current_database()
                  AND pid <> pg_backend_pid()
                ORDER BY backend_start DESC
                LIMIT 20
            """)
            cols = [col[0] for col in cursor.description]
            datos['conexiones_detalle'] = [
                {k: (str(v) if v is not None else None) for k, v in zip(cols, row)}
                for row in cursor.fetchall()
            ]

            # ── Tablas del proyecto con estadísticas ───────────────────────
            cursor.execute("""
                SELECT
                    t.relname AS nombre_tabla,
                    s.n_live_tup AS filas_estimadas,
                    pg_size_pretty(pg_total_relation_size(t.oid)) AS tamano_total,
                    pg_size_pretty(pg_relation_size(t.oid)) AS tamano_datos,
                    to_char(s.last_vacuum, 'YYYY-MM-DD HH24:MI') AS ultimo_vacuum,
                    to_char(s.last_analyze, 'YYYY-MM-DD HH24:MI') AS ultimo_analyze,
                    s.n_dead_tup AS filas_muertas,
                    s.seq_scan AS escaneos_secuenciales,
                    s.idx_scan AS escaneos_por_indice
                FROM pg_class t
                JOIN pg_stat_user_tables s ON t.relname = s.relname
                WHERE t.relkind = 'r'
                  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                ORDER BY s.n_live_tup DESC
            """)
            cols = [col[0] for col in cursor.description]
            datos['tablas'] = [
                {k: (str(v) if v is not None else None) for k, v in zip(cols, row)}
                for row in cursor.fetchall()
            ]

            # ── Stored Procedures / Funciones PL/pgSQL del proyecto ────────
            cursor.execute("""
                SELECT
                    p.proname AS nombre_funcion,
                    n.nspname AS esquema,
                    pg_get_function_result(p.oid) AS tipo_retorno,
                    pg_get_function_arguments(p.oid) AS argumentos,
                    l.lanname AS lenguaje,
                    to_char(
                        to_timestamp(p.oid::text::bigint % 1000000000),
                        'YYYY-MM-DD'
                    ) AS fecha_aprox
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                JOIN pg_language l ON p.prolang = l.oid
                WHERE n.nspname = 'public'
                  AND l.lanname IN ('plpgsql', 'sql')
                ORDER BY p.proname
            """)
            cols = [col[0] for col in cursor.description]
            datos['stored_procedures'] = [
                {k: (str(v) if v is not None else None) for k, v in zip(cols, row)}
                for row in cursor.fetchall()
            ]

        return Response(datos)


class SesionesActivasView(APIView):
    """
    Resumen de los inicios de sesión recientes en las últimas 24 horas.

    Endpoint: GET /api/auditoria/sesiones/

    Consulta la tabla LogAuditoria filtrando logs de tipo 'LOGIN'
    de las últimas 24 horas, agrupados por usuario.

    Devuelve:
        - Lista de los últimos logins con: usuario, IP, hora, resultado.
        - Total de sesiones exitosas vs fallidas en las últimas 24h.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        """
        Devuelve el historial de sesiones recientes (últimas 24 horas).
        """
        hace_24h = timezone.now() - timedelta(hours=24)

        # Todos los intentos de login en las últimas 24h
        sesiones = LogAuditoria.objects.filter(
            accion='LOGIN',
            timestamp__gte=hace_24h
        ).order_by('-timestamp')

        # Estadísticas agregadas
        total_exitosas = sesiones.filter(resultado='EXITOSO').count()
        total_fallidas = sesiones.filter(resultado='FALLIDO').count()

        # Serializar los registros de sesiones
        data_sesiones = [
            {
                'nombre_usuario': s.nombre_usuario,
                'ip_address': s.ip_address,
                'user_agent': s.user_agent,
                'resultado': s.resultado,
                'timestamp': s.timestamp.isoformat(),
                'descripcion': s.descripcion,
            }
            for s in sesiones[:50]  # Limitar a los 50 más recientes
        ]

        return Response({
            'total_exitosas': total_exitosas,
            'total_fallidas': total_fallidas,
            'total_intentos': total_exitosas + total_fallidas,
            'periodo': 'Últimas 24 horas',
            'sesiones': data_sesiones,
        })
