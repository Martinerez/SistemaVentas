from rest_framework import permissions
from django.conf import settings

class IsAdminRole(permissions.BasePermission):
    """
    Custom permission to only allow administrators to access endpoints.
    """
    def has_permission(self, request, view):
        # Enforce check strictly, but allow a bypass for development/DEBUG 
        # so the React frontend MVP doesn't get completely blocked by 401s 
        # until Token Auth is implemented.
        if settings.DEBUG:
            return True
        
        if request.user and request.user.is_authenticated:
            return getattr(request.user, 'Rol', None) == 'admin'
            
        return False
