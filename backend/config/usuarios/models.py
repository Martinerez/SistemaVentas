import uuid 
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

class UsuarioManager(BaseUserManager):
    def create_user(self, Email, Password=None, **extra_fields):
        if not Email:
            raise ValueError('The Email field must be set')

        Email = self.normalize_email(Email)
        user = self.model(Email=Email, **extra_fields)
        user.set_password(Password)
        user.save(using=self._db)
        return user

    def create_superuser(self, Email, Password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(Email, Password, **extra_fields)

class Usuario(AbstractBaseUser, PermissionsMixin):
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
    Email = models.EmailField(unique=True, null=False, blank=False)

    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    Estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='Activo')
    Rol = models.CharField(max_length=20, choices=ROL_CHOICES, default='vendedor')

    EmailPendiente = models.EmailField(null=True, blank=True)
    TokenVerificacion = models.UUIDField(null=True, blank=True)

    USERNAME_FIELD = 'Email'
    REQUIRED_FIELDS = ['Nombre']

    objects = UsuarioManager()

    def __str__(self):
        return self.Nombre

    class Meta:
        db_table = 'Usuario'
