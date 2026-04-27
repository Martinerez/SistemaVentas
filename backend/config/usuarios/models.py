"""
Modelos de Usuario — App 'usuarios'
=====================================

Define el modelo de usuario personalizado del sistema. Se extiende
AbstractBaseUser en lugar de usar el User de Django directamente, porque
el negocio requiere:
  - Login con Email en lugar de username.
  - Un campo 'Rol' para el control de acceso basado en roles (RBAC).
  - Un campo 'Estado' para activar/desactivar cuentas sin borrarlas.

La relación entre modelos de este módulo y el resto del sistema:
  Usuario ──< Venta          (un usuario registra múltiples ventas)
  Usuario ──< EntradaInventario (un usuario registra múltiples compras)
  Usuario ──< Perdida        (un usuario registra múltiples pérdidas)
  Usuario ──< SolicitudDevolucion (un usuario gestiona devoluciones)
"""

import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


class UsuarioManager(BaseUserManager):
    """
    Manager personalizado para el modelo Usuario.

    Necesario porque se cambia el campo de autenticación estándar de Django
    de 'username' a 'Email'. Sin este manager, los métodos `create_user`
    y `create_superuser` no sabrían cuál es el campo de identificación.
    """

    def create_user(self, Email, Password=None, **extra_fields):
        """
        Crea y guarda un usuario estándar con email y contraseña.

        La contraseña se hashea automáticamente con `set_password()` usando
        el algoritmo PBKDF2 con SHA256 (estándar de Django). NUNCA se almacena
        en texto plano.

        Args:
            Email (str): Dirección de correo electrónico. Actúa como username.
            Password (str, optional): Contraseña en texto plano. Se hashea internamente.
            **extra_fields: Campos adicionales del modelo (Nombre, Rol, Estado, etc.).

        Returns:
            Usuario: Instancia del usuario creado y guardado en BD.

        Raises:
            ValueError: Si el Email no es proporcionado.
        """
        if not Email:
            raise ValueError('The Email field must be set')

        # normalize_email convierte el dominio a minúsculas (usuario@GMAIL.COM → usuario@gmail.com)
        # pero preserva la capitalización del nombre local (Usuario@gmail → Usuario@gmail).
        # Esto evita cuentas duplicadas por variantes de capitalización.
        Email = self.normalize_email(Email)
        user = self.model(Email=Email, **extra_fields)
        # set_password() aplica el hash seguro. Nunca usar user.Password = Password directamente.
        user.set_password(Password)
        user.save(using=self._db)
        return user

    def create_superuser(self, Email, Password=None, **extra_fields):
        """
        Crea un superusuario con acceso completo al panel de administración.

        Fuerza is_staff=True e is_superuser=True, que son los flags de Django
        para acceso al /admin/ y bypass de todos los permisos respectivamente.

        Args:
            Email (str): Correo del superusuario.
            Password (str): Contraseña en texto plano.
            **extra_fields: Campos adicionales.

        Returns:
            Usuario: Instancia del superusuario creado.

        Raises:
            ValueError: Si is_staff o is_superuser son explícitamente False.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(Email, Password, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    """
    Modelo central de autenticación y autorización del sistema.

    Extiende AbstractBaseUser para controlar completamente el campo de login,
    y PermissionsMixin para heredar la infraestructura de permisos de Django
    (grupos, permisos por objeto, etc.) que usa el panel /admin/.

    ROLES DE NEGOCIO:
        - 'admin':    Acceso total. Puede ver reportes, gestionar inventario,
                      anular ventas, gestionar usuarios y ver datos financieros.
        - 'vendedor': Acceso restringido. Solo puede registrar ventas y consultar
                      el catálogo/stock. No puede ver totales financieros en el Dashboard.

    ESTADOS:
        - 'Activo':   Puede iniciar sesión normalmente.
        - 'Inactivo': La cuenta existe en BD pero se le niega el login.
                      Se prefiere desactivar en lugar de borrar para preservar
                      el historial de ventas asociado al usuario.

    Atributos:
        IdUsuario (AutoField): Clave primaria autoincremental.
        Nombre (CharField): Nombre completo, requerido para mostrar en la UI.
        Email (EmailField): Campo único de login. Reemplaza al 'username' de Django.
        is_staff (BooleanField): Acceso al panel /admin/ de Django.
        is_superuser (BooleanField): Bypass de todos los permisos de Django.
        Estado (CharField): Estado de la cuenta ('Activo'/'Inactivo').
        Rol (CharField): Rol de negocio ('admin'/'vendedor').
        EmailPendiente (EmailField): Email nuevo pendiente de verificación (flujo de cambio de email).
        TokenVerificacion (UUIDField): Token UUID para el proceso de verificación de nuevo email.
    """

    ESTADO_CHOICES = (
        ('Activo', 'Activo'),
        ('Inactivo', 'Inactivo'),
    )
    ROL_CHOICES = (
        ('admin', 'Administrador'),
        ('vendedor', 'Vendedor'),
    )

    IdUsuario = models.AutoField(primary_key=True)
    Nombre = models.CharField(max_length=255, null=False, blank=False)
    # unique=True en Email garantiza a nivel de BD que no existan dos cuentas
    # con el mismo correo, como segunda línea de defensa después de la validación
    # en el serializer (validate_email).
    Email = models.EmailField(unique=True, null=False, blank=False)

    # Flags requeridos por PermissionsMixin para integración con el admin de Django.
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    Estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='Activo')
    Rol = models.CharField(max_length=20, choices=ROL_CHOICES, default='vendedor')

    # Campos para el flujo futuro de cambio de email con verificación:
    # 1. Admin solicita cambio → nuevo email va a EmailPendiente y se genera TokenVerificacion.
    # 2. Usuario hace clic en el link de verificación con el token.
    # 3. Sistema copia EmailPendiente → Email y limpia ambos campos.
    EmailPendiente = models.EmailField(null=True, blank=True)
    TokenVerificacion = models.UUIDField(null=True, blank=True)

    # USERNAME_FIELD: Le dice a Django que 'Email' es el campo de login.
    # Usado por authenticate() y el formulario de login del admin.
    USERNAME_FIELD = 'Email'
    # REQUIRED_FIELDS: Campos solicitados al crear superusuario por CLI.
    # Email se omite aquí porque ya está en USERNAME_FIELD.
    REQUIRED_FIELDS = ['Nombre']

    objects = UsuarioManager()

    def __str__(self):
        """Representación legible del usuario para el panel de admin."""
        return self.Nombre

    class Meta:
        # db_table: Nombre explícito de la tabla en PostgreSQL.
        # Sin esto, Django crearía la tabla como 'usuarios_usuario'.
        db_table = 'Usuario'
