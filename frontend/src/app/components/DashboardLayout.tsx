import { useState } from "react";
import { Outlet, NavLink } from "react-router";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Warehouse,
  ShoppingCart,
  Truck,
  TrendingDown,
  RefreshCcw,
  Settings,
  Menu,
  X,
  Store,
  Bell,
  User,
} from "lucide-react";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Package, label: "Productos", path: "/productos" },
  { icon: Truck, label: "Pedidos", path: "/pedidos" },
  { icon: ShoppingCart, label: "Ventas", path: "/ventas" },
  { icon: TrendingDown, label: "Pérdidas", path: "/perdidas" },
  { icon: RefreshCcw, label: "Devoluciones", path: "/devoluciones" },
  { icon: Settings, label: "Ajustes", path: "/ajustes" },
];

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col fixed left-0 top-0 h-screen w-64 bg-white border-r shadow-sm z-40">
        <div className="p-6 border-b">
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

        <div className="p-4 border-t">
          <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-lg p-4 border border-slate-200">
            <p className="text-sm font-medium text-gray-900 mb-1">
              ¿Necesitas ayuda?
            </p>
            <p className="text-xs text-gray-600 mb-3">
              Consulta nuestra guía de usuario
            </p>
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900"
            >
              Ver guía
            </Button>
          </div>
        </div>
      </aside>

      {/* Sidebar Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <aside
            className="fixed left-0 top-0 h-screen w-64 bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b flex items-center justify-between">
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
              <button onClick={() => setIsSidebarOpen(false)}>
                <X className="size-6" />
              </button>
            </div>

            <nav className="p-4 overflow-y-auto h-[calc(100vh-100px)]">
              <ul className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.path === "/"}
                        onClick={() => setIsSidebarOpen(false)}
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
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="size-5 text-gray-600" />
                <span className="absolute top-1 right-1 size-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="flex items-center gap-3 pl-3 border-l">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-800">Admin</p>
                  <p className="text-xs text-gray-500">admin@miscelanea.com</p>
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
