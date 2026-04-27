/**
 * @fileoverview Componente raíz de la aplicación — App.tsx
 *
 * Es el componente de más alto nivel del árbol de React. Compone los tres
 * proveedores globales que toda la aplicación necesita:
 *
 * 1. <Toaster> (Sonner):
 *    Sistema de notificaciones (toasts) globales. Se coloca FUERA de AuthProvider
 *    para que funcione incluso si AuthProvider lanza un error durante el render.
 *    `richColors`: Aplica colores semánticos (verde=éxito, rojo=error, etc.).
 *    `position="top-right"`: Las notificaciones aparecen en la esquina superior
 *    derecha, convención estándar de UX en aplicaciones de escritorio.
 *
 * 2. <AuthProvider>:
 *    Provee el contexto de autenticación (token, rol, nombre, login, logout)
 *    a todos los componentes descendientes. Debe envolver a RouterProvider
 *    para que los guardias de ruta (ProtectedRoute, AdminRoute) puedan acceder
 *    al estado de sesión con useAuth().
 *
 * 3. <RouterProvider router={router}>:
 *    Activa el enrutamiento de React Router v7. Recibe el objeto `router`
 *    creado en routes.tsx que define toda la estructura de rutas de la app.
 *    Debe estar DENTRO de AuthProvider para que las páginas y layouts accedan
 *    al contexto de autenticación.
 *
 * ORDEN DE COMPOSICIÓN (de afuera hacia adentro):
 *   Fragment (<>)
 *     └── Toaster (notificaciones globales — independiente de la sesión)
 *     └── AuthProvider (contexto de sesión)
 *           └── RouterProvider (páginas y navegación)
 */

import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./contexts/AuthContext";
import { Toaster } from "sonner";

/**
 * Componente raíz de la SPA (Single Page Application).
 *
 * No contiene lógica de negocio ni estado propio. Su única responsabilidad
 * es componer los proveedores globales en el orden correcto.
 */
export default function App() {
  return (
    <>
      {/* Toaster fuera de AuthProvider: funciona aunque la sesión falle */}
      <Toaster position="top-right" richColors />
      <AuthProvider>
        {/* RouterProvider dentro de AuthProvider: las rutas acceden a useAuth() */}
        <RouterProvider router={router} />
      </AuthProvider>
    </>
  );
}