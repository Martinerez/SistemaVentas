import { Outlet, Navigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

export function AdminRoute() {
  const { token, userRole } = useAuth();
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  if (userRole !== "admin") {
    // Toast only fires once thanks to React rendering
    toast.error("Acceso Denegado: Solo los administradores pueden acceder a esta sección.");
    return <Navigate to="/" replace />;
  }
  
  return <Outlet />;
}
