import { createBrowserRouter } from "react-router";
import { DashboardLayout } from "./components/DashboardLayout";
import { Dashboard } from "./pages/Dashboard";
import { Productos } from "./pages/Productos";
import { Ventas } from "./pages/Ventas";
import { Pedidos } from "./pages/Pedidos";
import { Perdidas } from "./pages/Perdidas";
import { Devoluciones } from "./pages/Devoluciones";
import { Ajustes } from "./pages/Ajustes";

export const router = createBrowserRouter([
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
    ],
  },
]);
