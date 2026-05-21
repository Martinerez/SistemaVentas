"""
Mixin de Auditoría — App 'auditoria'
======================================

Define AuditoriaMixin: una clase Mixin que se hereda junto con vistas DRF
(ModelViewSet o APIView) para registrar automáticamente las mutaciones.

PRINCIPIO DE DISEÑO — Solo mutaciones (no GETs):
    El mixin solo intercepta métodos HTTP de escritura:
      - POST   → Acción 'CREAR' o 'PROCESAR'
      - PUT    → Acción 'MODIFICAR'
      - PATCH  → Acción 'MODIFICAR'
      - DELETE → Acción 'ELIMINAR'

    Los métodos GET (lectura) no se registran para no saturar la BD
    con millones de consultas sin valor de auditoría.

USO EN ModelViewSet (herencia múltiple):
    class ProductoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
        MODULO_AUDITORIA = 'PRODUCTOS'
        ...

USO EN APIView con registro manual:
    class ProcesarVentaView(APIView):
        def post(self, request):
            ...
            self.registrar_evento(request, 'PROCESAR', 'VENTAS', 'Venta #42 procesada')

EXTRACCIÓN DE IP:
    Se usa HTTP_X_FORWARDED_FOR con fallback a REMOTE_ADDR para soportar
    correctamente setups detrás de proxies inversos (nginx, Apache).
    En un entorno sin proxy, REMOTE_ADDR contiene la IP real del cliente.
"""

from auditoria.models import LogAuditoria


def _get_client_ip(request):
    """
    Extrae la IP real del cliente de la petición HTTP.

    En setups con proxy inverso (nginx → Django), la IP real viene en el
    header X-Forwarded-For. Sin proxy, REMOTE_ADDR contiene la IP directa.

    Args:
        request: Objeto HttpRequest de Django.

    Returns:
        str | None: Dirección IP del cliente, o None si no se puede determinar.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # X-Forwarded-For puede contener una cadena de IPs separadas por coma
        # (proxy1, proxy2, cliente_real). La primera es la del cliente original.
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _get_user_agent(request):
    """
    Obtiene el User-Agent del cliente (navegador/app HTTP).

    Args:
        request: Objeto HttpRequest de Django.

    Returns:
        str: String del User-Agent, o cadena vacía si no está presente.
    """
    return request.META.get('HTTP_USER_AGENT', '')


def _serializer_to_dict(serializer_data):
    """
    Convierte datos de un serializer a un dict serializable para JSON.

    Convierte tipos no-JSON (Decimal, datetime, UUID) a sus representaciones
    en string para que JSONField los acepte sin errores de serialización.

    Args:
        serializer_data: Diccionario de datos de un DRF serializer.

    Returns:
        dict: Datos listos para almacenar en JSONField.
    """
    if not serializer_data:
        return None
    result = {}
    for key, value in serializer_data.items():
        # Convertir tipos no-JSON-serializables a string
        if hasattr(value, 'isoformat'):  # datetime, date
            result[key] = value.isoformat()
        else:
            try:
                import json
                json.dumps(value)  # Test de serializabilidad
                result[key] = value
            except (TypeError, ValueError):
                result[key] = str(value)
    return result


class AuditoriaMixin:
    """
    Mixin para vistas DRF que registra automáticamente las mutaciones.

    ATRIBUTO DE CLASE REQUERIDO:
        MODULO_AUDITORIA (str): Nombre del módulo para los logs.
        Debe ser uno de los valores definidos en LogAuditoria.MODULO_CHOICES.
        Ejemplo: MODULO_AUDITORIA = 'PRODUCTOS'

    MÉTODOS SOBREESCRITOS (para ModelViewSet):
        - perform_create(): Registra después de una creación exitosa.
        - perform_update(): Registra antes Y después de una modificación.
        - perform_destroy(): Registra antes de una eliminación.

    MÉTODO UTILITARIO (para APIView):
        - registrar_evento(): Registro manual para vistas con lógica personalizada.
    """

    # Subclases deben definir este atributo
    MODULO_AUDITORIA = 'SISTEMA'

    # ── Hooks de ModelViewSet ─────────────────────────────────────────────────

    def perform_create(self, serializer):
        """
        Hook post-creación: guarda la instancia y luego registra el log.

        Se llama automáticamente cuando ModelViewSet procesa un POST exitoso.
        El registro ocurre DESPUÉS del save() para garantizar que el objeto
        fue creado exitosamente antes de auditarlo.

        Args:
            serializer: Serializer de DRF con los datos validados.
        """
        # Primero ejecutar la creación estándar de DRF
        instance = serializer.save()

        # Capturar datos del objeto recién creado para el log
        datos_nuevos = _serializer_to_dict(dict(serializer.data))

        self._crear_log(
            request=self.request,
            accion='CREAR',
            descripcion=f'Se creó un nuevo registro en {self.MODULO_AUDITORIA}: {instance}',
            datos_anteriores=None,
            datos_nuevos=datos_nuevos,
        )

    def perform_update(self, serializer):
        """
        Hook de actualización: captura el estado anterior, guarda y registra.

        Para una auditoría útil, se captura el estado del objeto ANTES de
        la modificación. Esto permite ver exactamente qué cambió (diff).

        Args:
            serializer: Serializer de DRF con los datos validados.
        """
        # Capturar estado ANTERIOR antes de que se sobreescriba
        instance = serializer.instance
        datos_anteriores = {}
        if instance:
            # Serializar el estado actual del objeto a un dict legible
            for field in instance._meta.fields:
                val = getattr(instance, field.name, None)
                if hasattr(val, 'isoformat'):
                    datos_anteriores[field.name] = val.isoformat()
                else:
                    datos_anteriores[field.name] = str(val) if val is not None else None

        # Ejecutar la actualización estándar de DRF
        serializer.save()

        datos_nuevos = _serializer_to_dict(dict(serializer.data))

        self._crear_log(
            request=self.request,
            accion='MODIFICAR',
            descripcion=f'Se modificó un registro en {self.MODULO_AUDITORIA}: {instance}',
            datos_anteriores=datos_anteriores,
            datos_nuevos=datos_nuevos,
        )

    def perform_destroy(self, instance):
        """
        Hook pre-eliminación: captura el estado del objeto antes de borrarlo.

        El registro se hace ANTES del delete() porque después ya no existe
        el objeto para obtener sus datos.

        Args:
            instance: Instancia del modelo a eliminar.
        """
        # Serializar el estado del objeto ANTES de eliminarlo
        datos_anteriores = {}
        for field in instance._meta.fields:
            val = getattr(instance, field.name, None)
            if hasattr(val, 'isoformat'):
                datos_anteriores[field.name] = val.isoformat()
            else:
                datos_anteriores[field.name] = str(val) if val is not None else None

        descripcion = f'Se eliminó un registro de {self.MODULO_AUDITORIA}: {instance}'

        # Ejecutar la eliminación estándar de DRF
        instance.delete()

        self._crear_log(
            request=self.request,
            accion='ELIMINAR',
            descripcion=descripcion,
            datos_anteriores=datos_anteriores,
            datos_nuevos=None,
        )

    # ── Método utilitario para APIView ────────────────────────────────────────

    def registrar_evento(self, request, accion, modulo, descripcion,
                         resultado='EXITOSO', datos_anteriores=None, datos_nuevos=None):
        """
        Registra un evento de auditoría de forma manual.

        Útil para vistas con lógica personalizada (APIView) que no pasan
        por perform_create/perform_update/perform_destroy del ModelViewSet.

        Ejemplo de uso en AnularVentaView:
            self.registrar_evento(
                request, 'ANULAR', 'VENTAS',
                f'Venta #{pk} anulada por el administrador.',
                datos_anteriores={'estado': 'Completada'},
                datos_nuevos={'estado': 'Anulada'}
            )

        Args:
            request: Objeto HttpRequest con info del usuario y cliente.
            accion (str): Tipo de acción (debe estar en ACCION_CHOICES).
            modulo (str): Módulo afectado (debe estar en MODULO_CHOICES).
            descripcion (str): Texto legible describiendo la acción.
            resultado (str): 'EXITOSO' o 'FALLIDO'.
            datos_anteriores (dict, optional): Estado antes de la acción.
            datos_nuevos (dict, optional): Estado después de la acción.
        """
        self._crear_log(
            request=request,
            accion=accion,
            descripcion=descripcion,
            datos_anteriores=datos_anteriores,
            datos_nuevos=datos_nuevos,
            resultado=resultado,
            modulo_override=modulo,
        )

    # ── Método interno de creación de log ─────────────────────────────────────

    def _crear_log(self, request, accion, descripcion,
                   datos_anteriores=None, datos_nuevos=None,
                   resultado='EXITOSO', modulo_override=None):
        """
        Crea el registro de auditoría en la BD.

        Se usa try/except para que un fallo al auditar NUNCA interrumpa
        la operación principal del usuario. La auditoría es best-effort.

        Args:
            request: HttpRequest con info del usuario.
            accion (str): Tipo de acción auditada.
            descripcion (str): Descripción legible.
            datos_anteriores (dict, optional): Estado previo.
            datos_nuevos (dict, optional): Estado posterior.
            resultado (str): 'EXITOSO' o 'FALLIDO'.
            modulo_override (str, optional): Sobreescribe MODULO_AUDITORIA.
        """
        try:
            usuario = request.user if request.user.is_authenticated else None
            nombre_usuario = getattr(usuario, 'Nombre', '') if usuario else 'Sistema'

            LogAuditoria.objects.create(
                usuario=usuario,
                nombre_usuario=nombre_usuario,
                accion=accion,
                modulo=modulo_override or self.MODULO_AUDITORIA,
                descripcion=descripcion,
                ip_address=_get_client_ip(request),
                user_agent=_get_user_agent(request),
                datos_anteriores=datos_anteriores,
                datos_nuevos=datos_nuevos,
                resultado=resultado,
            )
        except Exception as e:
            # NUNCA propagar el error de auditoría al usuario.
            # Loggear en consola para diagnóstico sin romper el flujo.
            import logging
            logger = logging.getLogger('auditoria')
            logger.error(f'Error al registrar log de auditoría: {e}')


def registrar_evento_manual(request, accion, modulo, descripcion,
                             resultado='EXITOSO', datos_anteriores=None, datos_nuevos=None):
    """
    Función standalone para registrar eventos desde vistas que no heredan AuditoriaMixin.

    Útil para la vista de login (CustomTokenObtainPairView) que extiende una
    clase de simplejwt y no puede heredar AuditoriaMixin fácilmente.

    Args:
        request: Objeto HttpRequest.
        accion (str): Tipo de acción.
        modulo (str): Módulo del sistema.
        descripcion (str): Descripción legible.
        resultado (str): 'EXITOSO' o 'FALLIDO'.
        datos_anteriores (dict, optional): Estado previo.
        datos_nuevos (dict, optional): Estado posterior.
    """
    try:
        usuario = request.user if hasattr(request, 'user') and request.user.is_authenticated else None
        nombre_usuario = getattr(usuario, 'Nombre', '') if usuario else 'Anónimo'

        LogAuditoria.objects.create(
            usuario=usuario,
            nombre_usuario=nombre_usuario,
            accion=accion,
            modulo=modulo,
            descripcion=descripcion,
            ip_address=_get_client_ip(request),
            user_agent=_get_user_agent(request),
            datos_anteriores=datos_anteriores,
            datos_nuevos=datos_nuevos,
            resultado=resultado,
        )
    except Exception as e:
        import logging
        logger = logging.getLogger('auditoria')
        logger.error(f'Error en registrar_evento_manual: {e}')
