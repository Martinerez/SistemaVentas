import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attach Bearer token to every outgoing request automatically
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

// ─── Response Interceptor ─────────────────────────────────────────────────────
// If the server returns 401, the token has expired or is invalid.
// Clean up localStorage and redirect to the login screen.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
