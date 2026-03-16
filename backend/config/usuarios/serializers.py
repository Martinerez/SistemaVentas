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
        if 'Password' in validated_data:
            password = validated_data.pop('Password')
            instance.set_password(password)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance
