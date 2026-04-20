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

class ReporteMensualPivotView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        anio = request.query_params.get('anio')
        producto_id = request.query_params.get('producto_id')

        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM reporte_mensual_producto_pivot(%s, %s)", [anio, producto_id])
            columns = [col[0] for col in cursor.description]
            row = cursor.fetchone()
            
        if row:
            return Response(dict(zip(columns, row)))
        return Response({"error": "Sin datos para este producto"}, status=status.HTTP_404_NOT_FOUND)