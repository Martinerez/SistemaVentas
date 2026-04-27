/**
 * @fileoverview Instancia global de Axios con interceptores JWT.
 *
 * Este módulo es el único punto de contacto entre el frontend y el backend.
 * Toda petición HTTP del sistema pasa por esta instancia, garantizando que:
 *   1. El token de autenticación se adjunte automáticamente a cada petición.
 *   2. Las sesiones expiradas se renueven silenciosamente sin expulsar al usuario.
 *
 * ARQUITECTURA DE AUTENTICACIÓN JWT:
 *   - Access Token (1 día):  Se envía en cada petición como `Authorization: Bearer <token>`.
 *   - Refresh Token (7 días): Se guarda en localStorage. Solo se usa cuando el
 *     access token expira (respuesta 401 del servidor).
 *
 * PROXY DE VITE:
 *   `baseURL: "/api"` funciona junto con la configuración del proxy en vite.config.ts,
 *   que redirige `/api/*` → `http://localhost:8000/api/*`. Esto evita hardcodear
 *   la URL del servidor, haciendo el código portable entre entornos.
 */

import axios from "axios";

/**
 * Instancia de Axios preconfigurada para toda la aplicación.
 * Usar siempre esta instancia en lugar de `axios` directamente para
 * beneficiarse de los interceptores de autenticación automáticos.
 */
const api = axios.create({
  baseURL: "/api",
});

// ─── REQUEST INTERCEPTOR ─────────────────────────────────────────────────────
/**
 * Interceptor de peticiones salientes.
 *
 * Se ejecuta ANTES de que cada petición sea enviada al servidor.
 * Lee el access token del localStorage e inyecta el header `Authorization`
 * en el formato Bearer que Django REST Framework espera.
 *
 * POR QUÉ INTERCEPTOR Y NO HEADER ESTÁTICO:
 *   El token puede cambiar durante la sesión (cuando se renueva via refresh).
 *   Leerlo del localStorage en cada petición garantiza que siempre se use
 *   el token más reciente, sin necesidad de reinicializar la instancia de Axios.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      // Formato estándar OAuth 2.0 Bearer Token
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── RESPONSE INTERCEPTOR (Renovación Silenciosa de Sesión) ──────────────────
/**
 * Interceptor de respuestas entrantes — Manejo de sesiones expiradas.
 *
 * Se ejecuta DESPUÉS de que el servidor responde. Si detecta un error 401
 * (Unauthorized), intenta renovar el access token silenciosamente usando el
 * refresh token antes de forzar un logout.
 *
 * FLUJO COMPLETO DE RENOVACIÓN:
 *   1. Petición original → Servidor devuelve 401 (access token expirado)
 *   2. Interceptor detecta el 401.
 *   3. Interceptor hace POST /api/token/refresh/ con el refresh token.
 *   4. Si el servidor devuelve un nuevo access token:
 *      a. Se guarda en localStorage.
 *      b. Se reintenta la petición original con el nuevo token.
 *      c. El usuario nunca se entera de que hubo un problema.
 *   5. Si el refresh token también está expirado o es inválido:
 *      a. Se limpian ambos tokens del localStorage.
 *      b. Se redirige al usuario al login.
 *
 * PROTECCIONES ANTI-BUCLE INFINITO:
 *   Se usan 3 condiciones de guarda para evitar que el interceptor se llame
 *   a sí mismo recursivamente:
 *   - `error.response?.status === 401`: Solo actúa en errores de autenticación.
 *   - `!originalRequest._retry`: Marca la petición para no reintentar dos veces.
 *   - `originalRequest.url !== "/token/refresh/"`: Si el PROPIO refresh falla
 *     con 401, no se reintenta de nuevo (evita bucle infinito).
 */
api.interceptors.response.use(
  // Si la respuesta es exitosa (2xx), la pasa sin modificar
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/token/refresh/"
    ) {
      // Marcar esta petición como "ya reintentada" para evitar el bucle
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token disponible");

        // IMPORTANTE: Usar `axios` limpio (no la instancia `api`) para que esta
        // petición NO sea interceptada por este mismo interceptor de respuesta.
        // Si usáramos `api.post(...)`, un 401 del refresh endpoint volvería a
        // disparar este código creando un bucle infinito.
        const { data } = await axios.post("/api/token/refresh/", {
          refresh: refreshToken,
        });

        // Guardar el nuevo access token para peticiones futuras
        localStorage.setItem("accessToken", data.access);
        // Actualizar el header de la petición ORIGINAL que falló
        originalRequest.headers["Authorization"] = `Bearer ${data.access}`;

        // Reintentar la petición original con el token renovado.
        // `api(originalRequest)` ejecuta la petición con toda su configuración
        // original (método, URL, body, etc.) pero con el header actualizado.
        return api(originalRequest);
      } catch (refreshError) {
        // El refresh token expiró o fue invalidado (ej: el admin desactivó la cuenta).
        // No hay forma de continuar: limpiar sesión y redirigir al login.
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    // Para cualquier otro error (400, 403, 404, 500), propagarlo sin modificar
    return Promise.reject(error);
  }
);

export default api;
