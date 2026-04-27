"""
Permisos Personalizados — App 'usuarios'
=========================================

Este módulo implementa el sistema de Control de Acceso Basado en Roles (RBAC)
del sistema. Django REST Framework permite definir permisos granulares
sobrescribiendo la clase BasePermission.

POR QUÉ PERMISOS PERSONALIZADOS:
    Los permisos estándar de DRF (IsAuthenticated, IsAdminUser) solo verifican
    si un usuario está autenticado o es un superusuario de Django. No tienen
    concepto de "rol de negocio" (admin vs vendedor). Estos permisos personalizados
    leen el campo 'Rol' de nuestro modelo Usuario para tomar decisiones más
    granulares y específicas del dominio de la miscelánea.

JERARQUÍA DE PERMISOS:
    IsAdminRole       → Solo administradores (reportes, anular ventas, gestión de usuarios)
    IsAdminOrReadOnly → Admins: todo. Vendedores: solo lectura (GET, HEAD, OPTIONS).
    CanProcessSale    → Admins y Vendedores: pueden registrar ventas.
"""

from rest_framework import permissions


class IsAdminRole(permissions.BasePermission):
    """
    Permiso que restringe el acceso exclusivamente a usuarios con Rol == 'admin'.

    Uso típico:
        - Reportes gerenciales (datos financieros sensibles).
        - Gestión de usuarios (crear, editar, eliminar cuentas).
        - Anulación de ventas (operación irreversible de alto impacto).
        - Gestión de entradas de inventario y pérdidas.

    El uso de `getattr(request.user, 'Rol', None)` es una práctica defensiva:
    si por algún motivo el objeto `request.user` no tiene el atributo 'Rol'
    (ej: usuario anónimo, o usuario del admin de Django sin ese campo),
    devuelve None en lugar de lanzar un AttributeError.
    """

    def has_permission(self, request, view):
        """
        Evalúa si el usuario actual tiene permiso de acceso.

        Returns:
            bool: True si el usuario está autenticado Y su Rol es 'admin'.
        """
        return (
            request.user is not None
            and request.user.is_authenticated
            and getattr(request.user, 'Rol', None) == 'admin'
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permiso mixto para endpoints donde vendedores solo consultan, pero no modifican.

    Lógica de negocio:
        - Un vendedor necesita VER el catálogo de productos para registrar una venta.
        - Pero NO debe poder CREAR ni MODIFICAR productos (solo un admin puede).
        - Esta clase implementa ese contrato de forma declarativa.

    SAFE_METHODS en DRF son: GET, HEAD, OPTIONS.
    Todos los demás (POST, PUT, PATCH, DELETE) son considerados "de escritura".

    Cualquier usuario autenticado sin un rol reconocido ('admin' o 'vendedor')
    es denegado. Esto aplica el principio de "deny by default".
    """

    def has_permission(self, request, view):
        """
        Evalúa si el usuario puede acceder al recurso.

        Returns:
            bool: True si es admin (acceso total) o vendedor con método seguro.
        """
        if not request.user or not request.user.is_authenticated:
            return False

        rol = getattr(request.user, 'Rol', None)

        if rol == 'admin':
            return True  # Acceso total a todos los métodos HTTP

        # Los vendedores solo pueden hacer peticiones de solo lectura
        if rol == 'vendedor' and request.method in permissions.SAFE_METHODS:
            return True

        # Cualquier otro caso (rol desconocido, método de escritura para vendedor)
        return False


class CanProcessSale(permissions.BasePermission):
    """
    Permiso granular para el endpoint de facturación (POST /api/ventas/procesar/).

    Permite el acceso a AMBOS roles porque el negocio requiere que los
    vendedores puedan registrar ventas directamente, no solo los administradores.

    A diferencia de IsAdminOrReadOnly, este permiso NO distingue entre métodos
    seguros y de escritura: si tienes el rol correcto, puedes hacer cualquier
    petición al endpoint protegido.
    """

    def has_permission(self, request, view):
        """
        Evalúa si el usuario puede procesar ventas.

        Returns:
            bool: True si el usuario está autenticado y es 'admin' o 'vendedor'.
        """
        if not request.user or not request.user.is_authenticated:
            return False

        # Uso de `in` para verificar pertenencia al conjunto de roles autorizados.
        # Es más limpio y extensible que dos comparaciones == separadas.
        return getattr(request.user, 'Rol', None) in ('admin', 'vendedor')
