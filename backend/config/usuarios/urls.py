from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UsuarioViewSet, cambiar_email_directo

router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('cambiar-email-directo/<int:user_id>/', cambiar_email_directo),
]