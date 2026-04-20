import { createBrowserRouter, Route } from "react-router";
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
export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    Component: ProtectedRoute,
    children: [
      {
        path: "/",
        Component: DashboardLayout,
        children: [
          { index: true, Component: Dashboard },
          { path: "productos", Component: Productos },
          { path: "ventas", Component: Ventas },
          { path: "pedidos", Component: Pedidos },
          { path: "perdidas", Component: Perdidas },
          { path: "devoluciones", Component: Devoluciones },
          { path: "ajustes", Component: Ajustes },
          { path: "guia-usuario", Component: GuiaUsuario },
          // ── Admin-only routes ──────────────────────────────
          {
            path: "usuarios",
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
