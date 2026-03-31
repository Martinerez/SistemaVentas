from rest_framework import serializers
from .models import Usuario

class UsuarioSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdUsuario', read_only=True)
    nombre = serializers.CharField(source='Nombre')
    email = serializers.EmailField(source='Email')
    password = serializers.CharField(source='Password', write_only=True, required=False)
    estado = serializers.CharField(source='Estado')
    rol = serializers.CharField(source='Rol', required=False)


    class Meta:
        model = Usuario
        fields = ['id', 'nombre', 'email', 'password', 'estado', 'rol']

    def create(self, validated_data):
        rol = validated_data.pop('Rol', 'vendedor')
        user = Usuario.objects.create_user(
            Email=validated_data['Email'],
            Password=validated_data.get('Password', ''),
            Nombre=validated_data.get('Nombre', ''),
            Estado=validated_data.get('Estado', 'Activo')
        )
        user.Rol = rol
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('Password', None)

        if password:
           if instance.check_password(password):
            raise serializers.ValidationError({
                "password": "La nueva contraseña no puede ser igual a la actual"
            })

           instance.set_password(password)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance
    
    def validate_email(self, value):
        #Limpiamos el correo que viene del frontend
        value = value.lower().strip()

        #VALIDACIÓN NUEVA: Si estamos actualizando, verificamos que no sea el mismo correo
        if self.instance and self.instance.Email:
            correo_actual = self.instance.Email.lower().strip()
            if correo_actual == value:
                raise serializers.ValidationError("El nuevo correo no puede ser igual al actual")

        #Validación de que no lo esté usando otra persona
        user_id = self.instance.IdUsuario if self.instance else None

        if Usuario.objects.filter(Email__iexact=value).exclude(IdUsuario=user_id).exists():
           raise serializers.ValidationError("Este correo ya está en uso")

        return value