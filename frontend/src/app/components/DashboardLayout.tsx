import { useState } from "react";
import { Outlet, NavLink, Navigate } from "react-router";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Truck,
  TrendingDown,
  RefreshCcw,
  Settings,
  Menu,
  X,
  Store,
  User,
  Briefcase,
  Users,
  LogOut,
  BookOpen,
} from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "../contexts/AuthContext";

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { logout, userRole, userName } = useAuth();

  // Menu items available to all roles
  const commonItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: ShoppingCart, label: "Ventas", path: "/ventas" },
  ];

  // Menu items only for admin
  const adminItems = [
    { icon: Package, label: "Productos", path: "/productos" },
    { icon: Briefcase, label: "Proveedores", path: "/proveedores" },
    { icon: Truck, label: "Pedidos", path: "/pedidos" },
    { icon: TrendingDown, label: "Pérdidas", path: "/perdidas" },
    { icon: RefreshCcw, label: "Devoluciones", path: "/devoluciones" },
    { icon: Users, label: "Usuarios", path: "/usuarios" },
    { icon: Settings, label: "Ajustes", path: "/ajustes" },
   { icon: BookOpen, label: "Guía Usuario", path: "/guia-usuario" },
  ];

  const menuItems = userRole === "admin" ? [...commonItems, ...adminItems] : commonItems;

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
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
        {mobile && (
          <button onClick={() => setIsSidebarOpen(false)}>
            <X className="size-6" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === "/"}
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

      {/* Logout button at bottom of sidebar */}
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
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col fixed left-0 top-0 h-screen w-64 bg-white border-r shadow-sm z-40">
        <SidebarContent />
      </aside>

      {/* Sidebar Mobile */}
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

      {/* Main Content */}
      <div className="md:ml-64 min-h-screen">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between px-4 md:px-8 py-4">
            <div className="flex items-center gap-4">
              <button
                className="md:hidden"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="size-6" />
              </button>
              <div>
                <h2 className="font-semibold text-lg text-slate-800">
                  Panel de Control
                </h2>
                <p className="text-sm text-gray-500">Bienvenido de vuelta</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 pl-3 border-l">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-800">{userName || "Usuario"}</p>
                  <p className="text-xs font-semibold capitalize px-2 py-0.5 rounded-full inline-block mt-0.5 bg-slate-100 text-slate-600">{userRole || ""}</p>
                </div>
                <div className="size-10 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center shadow-md">
                  <User className="size-5 text-white" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
