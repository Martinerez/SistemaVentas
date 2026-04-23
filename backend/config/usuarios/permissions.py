from rest_framework import permissions


class IsAdminRole(permissions.BasePermission):
    """
    Permite acceso completo únicamente a usuarios con Rol == 'admin'.
    Siempre exige autenticación.
    """
    def has_permission(self, request, view):
        return (
            request.user is not None
            and request.user.is_authenticated
            and getattr(request.user, 'Rol', None) == 'admin'
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Admins tienen acceso total (lectura + escritura).
    Vendedores (Rol == 'vendedor') solo tienen acceso de lectura (SAFE_METHODS).
    Cualquier otro usuario autenticado sin rol reconocido es denegado.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        rol = getattr(request.user, 'Rol', None)

        if rol == 'admin':
            return True

        if rol == 'vendedor' and request.method in permissions.SAFE_METHODS:
            return True

        return False


class CanProcessSale(permissions.BasePermission):
    """
    Permiso granular para el endpoint de facturación.
    Permite cualquier método a 'admin' y 'vendedor'.
    Deniega el acceso a cualquier otro rol o usuario no autenticado.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return getattr(request.user, 'Rol', None) in ('admin', 'vendedor')
