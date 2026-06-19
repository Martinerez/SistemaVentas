import os
import django

# 1. Configurar el entorno de Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# IMPORTANTE: Importamos transaction además de connection
from django.db import connection, transaction

# 2. Pega AQUÍ tu código SQL
SCRIPT_SQL = """
CREATE OR REPLACE FUNCTION actualizar_stock_producto()
RETURNS TRIGGER AS $$
BEGIN
    -- Aquí va el código de tu función de ejemplo
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE realizar_auditoria_venta(venta_id INT)
AS $$
BEGIN
    -- Aquí va el código de tu procedimiento de ejemplo
END;
$$ LANGUAGE plpgsql;
"""

def ejecutar_script():
    try:
        print("Conectando a la base de datos...")
        
        # 3. Envolvemos la ejecución en una transacción atómica
        with transaction.atomic():
            with connection.cursor() as cursor:
                print("Inyectando funciones y procedimientos almacenados...")
                cursor.execute(SCRIPT_SQL)
                
        # Si llega aquí sin errores, el commit se hace automáticamente
        print("¡Éxito rotundo! Toda la lógica nativa ya está operativa en la nube. ")
        
    except Exception as e:
        print(f"Hubo un error al inyectar el SQL: {e}")

if __name__ == '__main__':
    ejecutar_script()