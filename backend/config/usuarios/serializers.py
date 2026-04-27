"""
Serializadores de Usuario — App 'usuarios'
===========================================

Los serializadores actúan como el "contrato de datos" entre la BD y la API.
Realizan dos tareas críticas:
  1. SERIALIZACIÓN: Convierten instancias del modelo Django en JSON para la respuesta.
  2. DESERIALIZACIÓN: Validan y convierten JSON entrante en datos listos para guardarse.

CONVENCIÓN DE NOMBRES (camelCase ↔ PascalCase):
    Los campos del modelo usan PascalCase (Nombre, Email, Estado) siguiendo la
    convención de la BD PostgreSQL del proyecto. Los campos de la API usan
    camelCase (nombre, email, estado) siguiendo la convención de JavaScript/React.
    El serializer mapea automáticamente entre ambas convenciones con el parámetro
    `source`.
"""

from rest_framework import serializers
from .models import Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    """
    Serializador completo para el modelo Usuario.

    Maneja la creación segura de usuarios (con hash de contraseña),
    la actualización parcial (PATCH) con validación de cambio de contraseña,
    y la validación de email único con normalización.

    Campos de solo escritura:
        - password: Se marca como write_only=True para que NUNCA aparezca
          en las respuestas JSON. Esto evita exponer hashes de contraseña.

    Campos de solo lectura:
        - id: Generado por la BD, el cliente no puede dictarlo.
    """

    id = serializers.IntegerField(source='IdUsuario', read_only=True)
    nombre = serializers.CharField(source='Nombre')
    email = serializers.EmailField(source='Email')
    # write_only=True: El campo se acepta en POST/PATCH pero NUNCA se incluye
    # en la respuesta. required=False permite el PATCH sin enviar contraseña.
    password = serializers.CharField(source='Password', write_only=True, required=False)
    estado = serializers.CharField(source='Estado')
    rol = serializers.CharField(source='Rol', required=False)

    class Meta:
        model = Usuario
        fields = ['id', 'nombre', 'email', 'password', 'estado', 'rol']

    def create(self, validated_data):
        """
        Crea un nuevo usuario aplicando hash a la contraseña correctamente.

        POR QUÉ SOBRESCRIBIR create():
            El método create() por defecto de ModelSerializer haría
            `Usuario.objects.create(**data)`, que asignaría la contraseña
            como texto plano. Debemos usar create_user() del manager
            personalizado para que se aplique el hash PBKDF2 automáticamente.

        Args:
            validated_data (dict): Datos ya validados por el serializer.

        Returns:
            Usuario: Nueva instancia guardada en BD.
        """
        # Extraer el Rol antes de crear el usuario, ya que create_user()
        # no lo acepta como argumento posicional. Valor por defecto: 'vendedor'.
        rol = validated_data.pop('Rol', 'vendedor')
        user = Usuario.objects.create_user(
            Email=validated_data['Email'],
            Password=validated_data.get('Password', ''),
            Nombre=validated_data.get('Nombre', ''),
            Estado=validated_data.get('Estado', 'Activo')
        )
        # Asignar el Rol después de la creación y guardar de nuevo.
        user.Rol = rol
        user.save()
        return user

    def update(self, instance, validated_data):
        """
        Actualiza un usuario existente con validación de cambio de contraseña.

        LÓGICA DE SEGURIDAD DE CONTRASEÑA:
            1. Si no se envía `password` en el PATCH, se ignora completamente
               (el usuario conserva su contraseña actual).
            2. Si se envía una nueva contraseña, se valida que NO sea idéntica
               a la contraseña actual para forzar un cambio real.
            3. Se usa set_password() para hashear correctamente la nueva contraseña.

        Args:
            instance (Usuario): Instancia del usuario a actualizar.
            validated_data (dict): Datos ya validados por el serializer.

        Returns:
            Usuario: Instancia actualizada y guardada.

        Raises:
            serializers.ValidationError: Si la nueva contraseña es igual a la actual.
        """
        # `pop` extrae y elimina 'Password' del diccionario. Si no existe, devuelve None.
        # Esto significa: si el cliente no envió password en el PATCH, no lo tocamos.
        password = validated_data.pop('Password', None)

        if password:
            # check_password() compara la contraseña en texto plano con el hash almacenado.
            # Si son iguales, el cambio no tiene sentido → devolver error descriptivo.
            if instance.check_password(password):
                raise serializers.ValidationError({
                    "password": "La nueva contraseña no puede ser igual a la actual"
                })
            # Hashear y guardar la nueva contraseña
            instance.set_password(password)

        # Actualizar los demás campos dinámicamente
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

    def validate_email(self, value):
        """
        Validación de campo: Normaliza el email y verifica unicidad.

        Se llama automáticamente por DRF cuando el campo 'email' es enviado.

        LÓGICA:
            1. Normaliza el email (minúsculas + strip) para evitar duplicados
               por diferencias de capitalización (usuario@gmail.com vs Usuario@GMAIL.com).
            2. Al actualizar (PATCH), verifica que el nuevo email no sea
               idéntico al actual (cambio trivial).
            3. Verifica que ningún otro usuario ya use ese email.

        Args:
            value (str): Email enviado por el cliente.

        Returns:
            str: Email normalizado y validado.

        Raises:
            serializers.ValidationError: Si el email ya está en uso o es igual al actual.
        """
        # Normalización: elimina espacios y convierte a minúsculas
        value = value.lower().strip()

        # Verificación solo en modo UPDATE (self.instance existe en PATCH/PUT)
        if self.instance and self.instance.Email:
            correo_actual = self.instance.Email.lower().strip()
            if correo_actual == value:
                raise serializers.ValidationError("El nuevo correo no puede ser igual al actual")

        # Obtener el ID del usuario actual para excluirlo de la búsqueda de duplicados.
        # Sin esto, el propio usuario aparecería como "en uso" al intentar guardar
        # otros campos sin cambiar el email.
        user_id = self.instance.IdUsuario if self.instance else None

        # __iexact: Búsqueda case-insensitive en la BD (postgres: ILIKE)
        if Usuario.objects.filter(Email__iexact=value).exclude(IdUsuario=user_id).exists():
            raise serializers.ValidationError("Este correo ya está en uso")

        return value