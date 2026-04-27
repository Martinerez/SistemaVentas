/**
 * @fileoverview Árbol de rutas de la SPA — routes.tsx
 *
 * Define la estructura completa de navegación usando createBrowserRouter
 * de React Router v7. Implementa un árbol de rutas anidado con guardias
 * de autenticación y autorización.
 *
 * ARQUITECTURA DE RUTAS ANIDADAS:
 * ```
 * /login                     → Login (pública)
 * /                          → ProtectedRoute (guardia: ¿hay token?)
 *   /                        → DashboardLayout (layout compartido: sidebar + header)
 *     /                      → Dashboard (index: ruta por defecto del layout)
 *     /ventas                → Ventas (accesible por todos los roles)
 *     /productos             → Productos (accesible por todos los roles)
 *     /pedidos               → Pedidos
 *     /perdidas              → Perdidas
 *     /devoluciones          → Devoluciones
 *     /ajustes               → Ajustes
 *     /guia-usuario          → GuiaUsuario
 *     /usuarios              → AdminRoute (guardia: ¿rol === 'admin'?)
 *       /                    → GestionUsuarios (index de AdminRoute)
 *     /reportes              → AdminRoute (guardia: ¿rol === 'admin'?)
 *       /                    → Reportes (index de AdminRoute)
 * ```
 *
 * POR QUÉ DOS CAPAS DE GUARDIAS (ProtectedRoute + AdminRoute):
 *   - ProtectedRoute: Verifica que existe un token JWT (cualquier rol).
 *     Protege TODO el dashboard de usuarios no autenticados.
 *   - AdminRoute: Adicionalmente verifica que el rol sea 'admin'.
 *     Anidado dentro de ProtectedRoute, por lo que un usuario sin token
 *     nunca llega a AdminRoute (ya fue redirigido al login).
 *
 * RUTAS SIN GUARDIA EXTRA (vendedor puede acceder):
 *   /ventas, /productos, /pedidos, /perdidas, /devoluciones, /ajustes, /guia-usuario
 *   Estas rutas están dentro de ProtectedRoute (requieren token) pero NO
 *   dentro de AdminRoute. Un vendedor autenticado puede visitarlas.
 *   La lógica de negocio en el backend (IsAdminOrReadOnly, IsAdminRole) limita
 *   qué operaciones puede hacer en cada una.
 *
 * index: true:
 *   Marca la ruta hija que se renderiza cuando el padre no tiene ruta adicional.
 *   { index: true, Component: Dashboard } → "/" renderiza Dashboard.
 *   { index: true, Component: GestionUsuarios } → "/usuarios" renderiza GestionUsuarios.
 *
 * Component vs component:
 *   React Router v7 usa `Component` (mayúscula) en el objeto de configuración
 *   de rutas (no JSX). Equivale a `element={<Dashboard />}` en versiones anteriores.
 */

import { createBrowserRouter } from "react-router";
import { DashboardLayout } from "./components/DashboardLayout";
import { Dashboard } from "./pages/Dashboard";
import { Productos } from "./pages/Productos";
import { Ventas } from "./pages/Ventas";
import { Pedidos } from "./pages/Pedidos";
import { Perdidas } from "./pages/Perdidas";
import { Devoluciones } from "./pages/Devoluciones";
import { Ajustes } from "./pages/Ajustes";
import { Login } from "./pages/Login";
import { GestionUsuarios } from "./pages/GestionUsuarios";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { GuiaUsuario } from "./pages/GuiaUsuario";
import { Reportes } from "./pages/Reportes";

/**
 * Objeto router exportado para ser consumido por <RouterProvider> en App.tsx.
 * createBrowserRouter: Usa la History API del navegador (URL reales sin #).
 */
export const router = createBrowserRouter([
  // ── Ruta pública (sin autenticación) ──────────────────────────────────────
  {
    path: "/login",
    Component: Login,
  },

  // ── Rutas protegidas (requieren token JWT) ────────────────────────────────
  {
    path: "/",
    // ProtectedRoute: Capa 1 — Verifica que exista un token JWT activo.
    // Si no hay token, redirige a /login antes de renderizar el layout.
    Component: ProtectedRoute,
    children: [
      {
        path: "/",
        // DashboardLayout: Sidebar + Header compartido por todas las páginas.
        // <Outlet /> dentro del layout renderiza la página hija activa.
        Component: DashboardLayout,
        children: [
          // Ruta índice del layout — Carga Dashboard cuando la URL es exactamente "/"
          { index: true, Component: Dashboard },

          // ── Rutas accesibles para todos los roles (vendedor y admin) ───────
          { path: "productos", Component: Productos },
          { path: "ventas", Component: Ventas },
          { path: "pedidos", Component: Pedidos },
          { path: "perdidas", Component: Perdidas },
          { path: "devoluciones", Component: Devoluciones },
          { path: "ajustes", Component: Ajustes },
          { path: "guia-usuario", Component: GuiaUsuario },

          // ── Rutas exclusivas de admin (Capa 2 de protección) ───────────────
          {
            path: "usuarios",
            // AdminRoute: Verifica que el rol sea 'admin'. Si no, redirige a /
            Component: AdminRoute,
            children: [{ index: true, Component: GestionUsuarios }],
          },
          {
            path: "reportes",
            Component: AdminRoute,
            children: [{ index: true, Component: Reportes }],
          },
        ],
      },
    ],
  },
]);
