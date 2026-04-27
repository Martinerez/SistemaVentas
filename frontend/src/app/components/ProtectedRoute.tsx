/**
 * @fileoverview Guardias de Ruta — ProtectedRoute y AdminRoute.
 *
 * Implementan la protección de rutas en el frontend para dos niveles:
 *   1. ProtectedRoute: Requiere que el usuario esté autenticado (cualquier rol).
 *   2. AdminRoute: Requiere además que el usuario tenga rol 'admin'.
 *
 * PATRÓN "ROUTE GUARD" EN REACT ROUTER:
 *   En lugar de duplicar la lógica de autorización en cada página, estos
 *   componentes envuelven grupos de rutas en routes.tsx. Si la condición
 *   no se cumple, redirigen. Si se cumple, renderizan el <Outlet /> que
 *   corresponde a la ruta hija solicitada.
 *
 * IMPORTANTE — Seguridad Frontend vs. Backend:
 *   Estas protecciones son de CONVENIENCIA DE UX, no de seguridad real.
 *   Un usuario malintencionado podría saltarlas modificando localStorage.
 *   La seguridad REAL vive en el backend: las vistas de Django verifican
 *   el token JWT y el rol en cada petición con IsAdminRole/CanProcessSale.
 *   El frontend solo previene que usuarios normales accedan a rutas
 *   que no les corresponden de forma accidental.
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ProtectedRoute.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { Outlet, Navigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

/**
 * Componente guardia para rutas que requieren autenticación básica.
 *
 * Verifica si existe un access token en el contexto de autenticación.
 * Si no hay token → redirige al login (replace evita que el login quede
 * en el historial del navegador, impidiendo que el botón "atrás" vuelva ahí).
 * Si hay token → renderiza la ruta solicitada via <Outlet />.
 *
 * Usado en routes.tsx para proteger el grupo completo de rutas del dashboard.
 */
export function ProtectedRoute() {
  const { token } = useAuth();

  if (!token) {
    // `replace` reemplaza la entrada actual del historial en lugar de añadir una nueva.
    // Así el usuario no puede presionar "atrás" para volver a la ruta protegida
    // después de ser redirigido al login.
    return <Navigate to="/login" replace />;
  }

  // <Outlet /> renderiza el componente de la ruta hija que coincide con la URL actual.
  return <Outlet />;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AdminRoute.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Componente guardia para rutas exclusivas de administradores.
 *
 * Añade una segunda capa de verificación sobre ProtectedRoute:
 *   1. Si no hay token → login (misma lógica que ProtectedRoute).
 *   2. Si hay token pero el rol no es 'admin' → Dashboard principal con toast de error.
 *   3. Si hay token Y rol es 'admin' → renderiza la ruta solicitada.
 *
 * DECISIÓN DE UX — Redirigir al Dashboard (/) en lugar de mostrar 403:
 *   Redirigir al home es más amigable que mostrar una página de error en blanco.
 *   El toast.error() informa al usuario la razón sin bloquear su experiencia.
 *
 * Usado en routes.tsx para proteger rutas como /reportes, /usuarios, /pedidos.
 */
export function AdminRoute() {
  const { token, userRole } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (userRole !== "admin") {
    // Mostrar notificación de acceso denegado antes de redirigir
    toast.error("Acceso Denegado: Solo los administradores pueden acceder a esta sección.");
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
