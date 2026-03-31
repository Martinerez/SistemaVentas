import uuid 
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager

class UsuarioManager(BaseUserManager):
    def create_user(self, Email, Password=None, **extra_fields):
        if not Email:
            raise ValueError('The Email field must be set')
        Email = self.normalize_email(Email)
        user = self.model(Email=Email, **extra_fields)
        user.set_password(Password)
        user.save(using=self._db)
        return user

class Usuario(AbstractBaseUser):
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
    # Password comes with AbstractBaseUser (password), but to match DBML strictly we use the original? 
    # Wait, Django's AbstractBaseUser defines exactly 'password'. Re-defining 'Password' might break Django auth.
    # To be safe but strictly follow schema, DBML has 'Password'.
    # Django will use 'password'. Better to let Django handle it or map it.
    Estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='Activo', null=False, blank=False)
    Rol = models.CharField(max_length=20, choices=ROL_CHOICES, default='vendedor', null=False, blank=False)

     #CAMPOS DE VERIFICACIÓN DE EMAIL
    EmailPendiente = models.EmailField(null=True, blank=True)
    TokenVerificacion = models.UUIDField(null=True, blank=True)

    
    USERNAME_FIELD = 'Email'
    REQUIRED_FIELDS = ['Nombre']

    objects = UsuarioManager()

    def __str__(self):
        return self.Nombre

    class Meta:
        db_table = 'Usuario'
