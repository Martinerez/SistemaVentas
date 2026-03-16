from rest_framework import serializers
from .models import Usuario

class UsuarioSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='IdUsuario', read_only=True)
    nombre = serializers.CharField(source='Nombre')
    email = serializers.EmailField(source='Email')
    password = serializers.CharField(source='Password', write_only=True)
    estado = serializers.CharField(source='Estado')

    class Meta:
        model = Usuario
        fields = ['id', 'nombre', 'email', 'password', 'estado']

    def create(self, validated_data):
        user = Usuario.objects.create_user(
            Email=validated_data['Email'],
            Password=validated_data['Password'],
            Nombre=validated_data.get('Nombre', ''),
            Estado=validated_data.get('Estado', 'Activo')
        )
        return user
