import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Adjunta el Bearer token a cada petición saliente automáticamente.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor (SEC-005) ──────────────────────────────────────────
// Si el servidor devuelve 401, intenta renovar el access token silenciosamente
// usando el refreshToken antes de forzar un logout. Esto evita expulsar al
// usuario mientras revisa reportes de larga duración.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Condiciones de seguridad para evitar bucles infinitos:
    // 1. Que sea un 401.
    // 2. Que no sea un reintento ya marcado (_retry).
    // 3. Que no sea la propia petición de refresh fallando.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/token/refresh/"
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token disponible");

        // Usar axios limpio (no la instancia `api`) para que esta petición
        // no sea interceptada de nuevo por este mismo middleware.
        const { data } = await axios.post("/api/token/refresh/", {
          refresh: refreshToken,
        });

        localStorage.setItem("accessToken", data.access);
        originalRequest.headers["Authorization"] = `Bearer ${data.access}`;

        // Reintentar la petición original con el nuevo token.
        return api(originalRequest);
      } catch (refreshError) {
        // El refresh token también expiró o es inválido: cerrar sesión.
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
