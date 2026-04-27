/**
 * @fileoverview Layout principal del dashboard — Estructura visual compartida.
 *
 * Implementa el layout de dos columnas (sidebar + contenido) que es la
 * estructura visual de todas las páginas protegidas del sistema.
 *
 * PATRÓN "LAYOUT ROUTE" DE REACT ROUTER:
 *   DashboardLayout no es una página; es un contenedor. El componente <Outlet />
 *   renderiza la página actual (Dashboard, Ventas, Reportes, etc.) dentro del
 *   área de contenido, mientras que el sidebar y el header permanecen fijos.
 *   Esto evita re-renderizar la navegación entera al cambiar de página.
 *
 * MENÚ DINÁMICO POR ROL:
 *   El sidebar muestra ítems diferentes según el rol del usuario autenticado.
 *   - commonItems: Visibles para TODOS (vendedor y admin).
 *   - adminItems: Solo visibles para 'admin'.
 *   La construcción `userRole === "admin" ? [...commonItems, ...adminItems] : commonItems`
 *   evalúa el rol una sola vez por render y construye el array de menú resultante.
 *
 * SIDEBAR RESPONSIVE:
 *   - En desktop (md+): El sidebar está fijo a la izquierda como un `<aside>` permanente.
 *   - En móvil: El sidebar está oculto por defecto. Un botón de menú (☰) lo muestra
 *     como un panel overlay con un backdrop semitransparente.
 *     El estado `isSidebarOpen` controla este toggle.
 */

import { useState } from "react";
import { Outlet, NavLink, Navigate } from "react-router";
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, Truck,
  TrendingDown, RefreshCcw, Settings, Menu, X, Store,
  User, Briefcase, Users, LogOut, BookOpen, BarChart3,
} from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "../contexts/AuthContext";

/**
 * Componente de layout principal del dashboard.
 *
 * Provee la estructura visual completa: sidebar de navegación, header con
 * información del usuario, y área de contenido donde se renderizan las páginas.
 *
 * Estado interno:
 * @state isSidebarOpen - Controla la visibilidad del sidebar en dispositivos móviles.
 *                        Solo relevante en pantallas pequeñas (< md breakpoint).
 */
export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { logout, userRole, userName } = useAuth();

  // ── Definición del menú según rol ─────────────────────────────────────────
  /**
   * Ítems de navegación comunes — Visibles para cualquier usuario autenticado.
   * Se limitan a las funciones operativas básicas que un vendedor necesita.
   */
  const commonItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: ShoppingCart, label: "Ventas", path: "/ventas" },
  ];

  /**
   * Ítems de navegación exclusivos para administradores.
   * Incluyen gestión de inventario, reportes y configuración del sistema.
   */
  const adminItems = [
    { icon: Package, label: "Productos", path: "/productos" },
    { icon: Truck, label: "Pedidos", path: "/pedidos" },
    { icon: TrendingDown, label: "Pérdidas", path: "/perdidas" },
    { icon: RefreshCcw, label: "Devoluciones", path: "/devoluciones" },
    { icon: BarChart3, label: "Reportes", path: "/reportes" },
    { icon: Users, label: "Usuarios", path: "/usuarios" },
    { icon: Settings, label: "Ajustes", path: "/ajustes" },
    { icon: BookOpen, label: "Guía Usuario", path: "/guia-usuario" },
  ];

  /**
   * Menú final calculado según el rol actual.
   * El spread operator (...) combina los arrays en orden: primero los comunes,
   * luego los exclusivos de admin.
   */
  const menuItems =
    userRole === "admin" ? [...commonItems, ...adminItems] : commonItems;

  /**
   * Subcomponente interno del contenido del sidebar.
   * Se extrae como componente separado para reutilizarlo en el sidebar
   * de desktop (permanente) y en el de móvil (overlay), evitando duplicar JSX.
   *
   * @param mobile - true: muestra botón de cierre (X). false: sidebar siempre visible.
   */
  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo y nombre del sistema */}
      <div className={`p-6 border-b ${mobile ? "flex items-center justify-between" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="size-10 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center shadow-lg">
            <Store className="size-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Bendición de Dios
            </h1>
            <p className="text-xs text-gray-500">Sistema de Ventas</p>
          </div>
        </div>
        {/* Botón de cierre solo en el sidebar móvil (overlay) */}
        {mobile && (
          <button onClick={() => setIsSidebarOpen(false)}>
            <X className="size-6" />
          </button>
        )}
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  // `end` en el Dashboard (path="/"): Sin este prop, el link "/" estaría
                  // activo en TODAS las rutas porque todas comienzan con "/".
                  // Con `end`, solo está activo cuando la ruta es exactamente "/".
                  end={item.path === "/"}
                  // Al hacer clic en móvil, cerrar el sidebar automáticamente
                  onClick={mobile ? () => setIsSidebarOpen(false) : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white font-medium shadow-md"
                        : "text-gray-700 hover:bg-gray-100"
                    }`
                  }
                >
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Botón de logout fijo en la parte inferior del sidebar */}
      <div className="p-4 border-t">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors font-medium"
        >
          <LogOut className="size-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sidebar Desktop (siempre visible en md+) ────────────────────── */}
      {/* `fixed`: Permanece en su posición aunque se haga scroll en el contenido. */}
      {/* `z-40`: Por encima del contenido pero debajo de modales (z-50+). */}
      <aside className="hidden md:flex md:flex-col fixed left-0 top-0 h-screen w-64 bg-white border-r shadow-sm z-40">
        <SidebarContent />
      </aside>

      {/* ── Sidebar Móvil (overlay sobre el contenido) ──────────────────── */}
      {/* El backdrop captura clicks fuera del sidebar para cerrarlo. */}
      {/* stopPropagation en el aside: Evita que clicks dentro del sidebar
          cierren el overlay (el evento no sube al backdrop). */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <aside
            className="fixed left-0 top-0 h-screen w-64 bg-white shadow-lg flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* ── Área de Contenido Principal ─────────────────────────────────── */}
      {/* md:ml-64: En desktop, empuja el contenido a la derecha del sidebar. */}
      <div className="md:ml-64 min-h-screen">

        {/* Header sticky: Permanece visible al hacer scroll */}
        <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between px-4 md:px-8 py-4">
            <div className="flex items-center gap-4">
              {/* Botón de menú hamburgesa — Solo visible en móvil */}
              <button
                className="md:hidden"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="size-6" />
              </button>
              <div>
                <h2 className="font-semibold text-lg text-slate-800">Panel de Control</h2>
                <p className="text-sm text-gray-500">Bienvenido de vuelta</p>
              </div>
            </div>

            {/* Info del usuario logueado: Nombre y rol del JWT decodificado */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 pl-3 border-l">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-800">
                    {userName || "Usuario"}
                  </p>
                  {/* El rol se muestra como badge (admin/vendedor) */}
                  <p className="text-xs font-semibold capitalize px-2 py-0.5 rounded-full inline-block mt-0.5 bg-slate-100 text-slate-600">
                    {userRole || ""}
                  </p>
                </div>
                {/* Avatar genérico — En una versión futura podría mostrar foto de perfil */}
                <div className="size-10 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center shadow-md">
                  <User className="size-5 text-white" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Área donde React Router renderiza la página actual (Outlet) */}
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
