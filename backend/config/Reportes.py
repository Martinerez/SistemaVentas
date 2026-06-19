from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from usuarios.permissions import IsAdminRole

class ReporteGerencialView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        inicio = request.query_params.get('inicio')
        fin = request.query_params.get('fin')
        
        if not inicio or not fin:
            return Response({"error": "Faltan fechas"}, status=status.HTTP_400_BAD_REQUEST)

        # Limpieza automática por si el frontend envía formato ISO con la letra "T"
        if 'T' in inicio:
            inicio = inicio.split('T')[0]
        if 'T' in fin:
            fin = fin.split('T')[0]

        try:
            with connection.cursor() as cursor:
                # Llamamos a la función de PostgreSQL
                cursor.execute("SELECT * FROM reporte_gerencial(%s, %s)", [inicio, fin])
                row = cursor.fetchone()
                
            if row:
                return Response({
                    "total_ventas": row[0] or 0,
                    "promedio_venta": row[1] or 0,
                    "producto_mas_vendido": row[2] or "N/A"
                })
            return Response({"error": "No hay datos"}, status=status.HTTP_404_NOT_FOUND)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReporteMensualPivotView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        anio = request.query_params.get('anio')
        # Aceptamos tanto snake_case como camelCase para compatibilidad con el frontend
        producto_id = request.query_params.get('producto_id') or request.query_params.get('productoId')

        # Protegemos la BD: si falta un dato, devolvemos 400 antes de ejecutar SQL
        if not anio or not producto_id:
            return Response({"error": "Faltan parámetros (anio o producto_id)"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT * FROM reporte_mensual_producto_pivot(%s, %s)", [anio, producto_id])
                columns = [col[0] for col in cursor.description]
                row = cursor.fetchone()
                
            if row:
                return Response(dict(zip(columns, row)))
            return Response({"error": "Sin datos para este producto"}, status=status.HTTP_404_NOT_FOUND)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
