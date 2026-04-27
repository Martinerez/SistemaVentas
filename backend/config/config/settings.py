"""
Configuración Central del Proyecto Django — SistemaVentas "La Bendición de Dios"
================================================================================

Este archivo es el núcleo de configuración de Django. Centraliza todas las
decisiones arquitectónicas del backend: seguridad, base de datos, autenticación,
CORS y JWT.

PATRÓN DE SEGURIDAD (Variables de Entorno):
    Todas las configuraciones sensibles (SECRET_KEY, credenciales de BD) se leen
    desde variables de entorno usando `os.environ.get()`. Esto separa el código
    del secreto, siguiendo el principio de "12-Factor App" y evitando que las
    credenciales queden expuestas en el historial de Git.

    Si python-dotenv está instalado, se carga el archivo `.env` automáticamente
    en entornos de desarrollo. En producción, las variables se inyectan
    directamente en el servidor (ej: systemd, Docker, Heroku Config Vars).
"""

import os
from pathlib import Path
from datetime import timedelta

# ─── Carga del archivo .env en entornos de desarrollo ────────────────────────
# Se usa un bloque try/except para que la app no falle si python-dotenv no está
# instalado (por ejemplo, en un servidor de producción que inyecta variables
# directamente en el entorno del sistema operativo).
try:
    from dotenv import load_dotenv
    # Resuelve la ruta al .env de forma absoluta, sin depender del directorio
    # de trabajo actual (CWD). Path(__file__) siempre apunta a este archivo.
    load_dotenv(Path(__file__).resolve().parent.parent / '.env')
except ImportError:
    pass

# ─── Ruta Base del Proyecto ───────────────────────────────────────────────────
# BASE_DIR apunta a la carpeta que contiene manage.py.
# Se usa como raíz para construir rutas relativas de forma portable entre
# sistemas operativos (Windows usa \, Linux usa /).
BASE_DIR = Path(__file__).resolve().parent.parent


# ══════════════════════════════════════════════════════════════════════════════
# SEGURIDAD
# ══════════════════════════════════════════════════════════════════════════════

# SECRET_KEY: Clave criptográfica usada por Django para firmar cookies de
# sesión, tokens CSRF y hashes internos. Si se filtra, cualquier atacante puede
# impersonar a cualquier usuario del sistema. El valor de fallback
# 'change-me-in-production' es intencional: falla ruidosamente si el .env no
# existe, en lugar de pasar desapercibido con una clave vacía.
SECRET_KEY = os.environ.get('SECRET_KEY', 'change-me-in-production')

# DEBUG: Con True, Django muestra trazas de error completas (incluyendo
# variables locales y rutas de archivo) directamente en el navegador.
# En producción DEBE ser False para no exponer la arquitectura interna.
# Se usa .lower() para aceptar "true", "True", "TRUE", "1", "yes" de forma
# robusta, sin depender de la capitalización exacta del valor en el .env.
DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 'yes')

# ALLOWED_HOSTS: Lista de hosts/dominios que pueden recibir peticiones.
# Protege contra ataques de "Host Header Poisoning". En producción se añade
# el dominio real del servidor (ej: 'mi-tienda.com').
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')


# ══════════════════════════════════════════════════════════════════════════════
# APLICACIONES INSTALADAS
# ══════════════════════════════════════════════════════════════════════════════
# El orden importa: Django inicializa las apps en este orden.
# - Las apps nativas de Django (auth, contenttypes, etc.) van primero.
# - 'rest_framework' y 'corsheaders' son dependencias de terceros.
# - Las apps del proyecto (usuarios, catalogo, inventario, ventas) van al final.
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Django REST Framework: Provee las clases base para la API (APIView,
    # ModelViewSet, serializers, permisos, paginación).
    'rest_framework',
    # django-cors-headers: Permite al frontend React (puerto 5173) hacer
    # peticiones al backend Django (puerto 8000). Sin esto, el navegador
    # bloquea todas las respuestas del servidor por política CORS.
    'corsheaders',
    # Apps de dominio del negocio (en orden de dependencia):
    'usuarios',   # Gestión de usuarios y autenticación customizada
    'catalogo',   # Categorías, proveedores y productos
    'inventario', # Entradas, stock físico, pérdidas y devoluciones
    'ventas',     # Transacciones de venta y reportes gerenciales
    # Proveedor de JWT (JSON Web Tokens) para la autenticación stateless
    'rest_framework_simplejwt',
]

# ══════════════════════════════════════════════════════════════════════════════
# MIDDLEWARE (Cadena de procesamiento de peticiones/respuestas)
# ══════════════════════════════════════════════════════════════════════════════
# IMPORTANTE: 'CorsMiddleware' DEBE ser el primero de la lista para que
# pueda añadir los headers CORS antes de que cualquier otro middleware
# pueda responder o bloquear la petición preflight (OPTIONS).
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',       # CORS: debe ir PRIMERO
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',   # Protección CSRF
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# ══════════════════════════════════════════════════════════════════════════════
# BASE DE DATOS — PostgreSQL
# ══════════════════════════════════════════════════════════════════════════════
# Se elige PostgreSQL sobre SQLite/MySQL por dos razones críticas:
#   1. Los reportes gerenciales usan funciones PL/pgSQL avanzadas (RETURN QUERY,
#      casting explícito ::DATE, funciones de ventana) que son exclusivas de Postgres.
#   2. PostgreSQL tiene soporte de bloqueo por fila (SELECT FOR UPDATE) que se
#      usa en las transacciones atómicas de venta para evitar "double-spend"
#      (vender el mismo artículo de inventario dos veces simultáneamente).
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'bendicion_de_dios'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),  # Nunca hardcodear
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}


# ══════════════════════════════════════════════════════════════════════════════
# VALIDADORES DE CONTRASEÑA
# ══════════════════════════════════════════════════════════════════════════════
# Django valida las contraseñas en capas para equilibrar seguridad y usabilidad.
# - UserAttributeSimilarityValidator: Evita contraseñas similares al nombre/email.
# - MinimumLengthValidator: Mínimo 8 caracteres por defecto.
# - CommonPasswordValidator: Rechaza las 20,000 contraseñas más comunes.
# - NumericPasswordValidator: Evita contraseñas 100% numéricas (ej: "12345678").
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# ══════════════════════════════════════════════════════════════════════════════
# INTERNACIONALIZACIÓN
# ══════════════════════════════════════════════════════════════════════════════
LANGUAGE_CODE = 'en-us'

# TIME_ZONE: Se mantiene en UTC para que todas las fechas en la BD sean
# consistentes e independientes de la zona horaria del servidor.
# El frontend es responsable de convertir a la zona local (es-NI) para mostrar.
TIME_ZONE = 'UTC'

USE_I18N = True

# USE_TZ = True: Almacena todos los DateTimeFields como "aware" (con timezone).
# Esto previene bugs sutiles cuando el servidor cambia de horario o se migra.
USE_TZ = True

STATIC_URL = 'static/'


# ══════════════════════════════════════════════════════════════════════════════
# MODELO DE USUARIO PERSONALIZADO
# ══════════════════════════════════════════════════════════════════════════════
# AUTH_USER_MODEL reemplaza el modelo User por defecto de Django con el nuestro.
# Se debe definir ANTES de crear las migraciones. La razón de crear un modelo
# propio es usar 'Email' como campo de login (en lugar de 'username') y añadir
# campos de negocio como 'Rol' y 'Estado'.
AUTH_USER_MODEL = 'usuarios.Usuario'


# ══════════════════════════════════════════════════════════════════════════════
# CORS (Cross-Origin Resource Sharing)
# ══════════════════════════════════════════════════════════════════════════════
# Permite que el servidor de desarrollo de Vite (puerto 5173) haga peticiones
# al servidor Django (puerto 8000). En producción, esta lista debe actualizarse
# con el dominio real del frontend (ej: https://mi-tienda.com).
# No usar CORS_ALLOW_ALL_ORIGINS = True en producción.
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


# ══════════════════════════════════════════════════════════════════════════════
# DJANGO REST FRAMEWORK — Configuración Global de la API
# ══════════════════════════════════════════════════════════════════════════════
REST_FRAMEWORK = {
    # Paginación: Limita las respuestas a 50 registros por página.
    # Sin esto, una petición a /api/ventas/ventas/ devolvería TODOS los registros
    # de la BD, causando timeouts y consumo excesivo de memoria en producción.
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,

    # Autenticación: Se usa JWT (Stateless) en lugar de SessionAuthentication.
    # Con JWT, el servidor no necesita mantener sesiones en BD ni en memoria.
    # Cada token es auto-contenido y verificable con la SECRET_KEY.
    # Esto es ideal para APIs consumidas por SPAs (Single Page Applications).
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    )
}


# ══════════════════════════════════════════════════════════════════════════════
# JWT (JSON Web Tokens) — Tiempos de Vida
# ══════════════════════════════════════════════════════════════════════════════
SIMPLE_JWT = {
    # ACCESS_TOKEN_LIFETIME: El token de acceso expira en 1 día.
    # Es el token que se envía en cada petición como "Bearer <token>".
    # Un tiempo corto reduce la ventana de exposición si el token es robado.
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),

    # REFRESH_TOKEN_LIFETIME: El token de renovación dura 7 días.
    # Solo se usa para obtener un nuevo access token cuando el anterior expira.
    # El interceptor en axiosInstance.ts maneja este flujo silenciosamente.
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),

    # USER_ID_FIELD: Campo de la BD que se usa como identificador del usuario.
    # Se mapea al campo 'IdUsuario' de nuestro modelo Usuario en lugar del 'id'
    # estándar de Django, porque nuestro modelo usa PascalCase.
    'USER_ID_FIELD': 'IdUsuario',

    # USER_ID_CLAIM: Nombre del claim dentro del payload del token JWT.
    # Será decodificado en el frontend (AuthContext.tsx) como decoded.user_id
    'USER_ID_CLAIM': 'user_id',
}
