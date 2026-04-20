# DESCRIPCIÓN DEL SISTEMA DE VENTAS

Sistema web para la gestión de ventas e inventario de una miscelánea, que permite registrar productos, controlar stock, administrar pedidos y generar información para la toma de decisiones.

# PASOS PARA CONFIGURAR DEL ENTORNO

    1. Clonar el repositorio
    git clone URL

    2. Ingresar al proyecto
    cd sistema_project

    3. Crear entorno virtual dentro del proyecto
    python -m venv venv

    4. Activar entorno virtual (Windows)
    venv\Scripts\activate

    5. Instalar dependencias
    pip install -r requirements.txt

# CONFIGURACIÓN DE LA BASE DE DATOS

    6. Verificar configuración en el archivo:
    backend/config/settings.py

    Revisar la sección DATABASES y confirmar el nombre de la base de datos:
    'NAME': 'bendicion_de_dios'

    Nota: Los valores de USER y PASSWORD deben configurarse según las credenciales locales de PostgreSQL de cada desarrollador.

    7. Si se utiliza PostgreSQL, crear la base de datos manualmente:
    CREATE DATABASE bendicion_de_dios;

    8. Aplicar migraciones (Realizar estos pasos para actualizar la BD si es necesario)
    python manage.py makemigrations
    python manage.py migrate

    9. (Opcional) Crear usuario administrador
    python manage.py createsuperuser

# EJECUCIÓN DEL BACKEND

    12. Iniciar el servidor primero entra a:
    cd backend/config
    13. luego:
    python manage.py runserver

# CONFIGURACION DEL FRONTEND (abrir nueva terminal)

    10. Primero entra a:
    cd frontend
    11. Instala las dependencias
    npm install

# EJECUCION DEL FRONTEND

    14. Iniciar el servidor primero entra a:
    cd frontend
    15. luego:
    npm run dev
