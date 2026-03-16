import {
  Package,
  DollarSign,
  TrendingDown,
  Truck,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card } from "../components/ui/card";

const stats = [
  {
    icon: Package,
    label: "Total de Productos",
    value: "1,234",
    change: "+12%",
    trend: "up",
    color: "slate",
  },
  {
    icon: DollarSign,
    label: "Ventas Semanales",
    value: "$45,678",
    change: "+23%",
    trend: "up",
    color: "green",
  },
  {
    icon: TrendingDown,
    label: "Pérdidas del Mes",
    value: "$1,234",
    change: "-5%",
    trend: "down",
    color: "red",
  },
  {
    icon: Truck,
    label: "Proveedores Activos",
    value: "24",
    change: "+2",
    trend: "up",
    color: "blue",
  },
];

const lowStockProducts = [
  { id: 1, name: "Coca-Cola 600ml", stock: 5, min: 20, category: "Bebidas" },
  { id: 2, name: "Pan Bimbo Blanco", stock: 8, min: 30, category: "Panadería" },
  { id: 3, name: "Sabritas Original", stock: 12, min: 25, category: "Botanas" },
  { id: 4, name: "Papel Higiénico", stock: 3, min: 15, category: "Limpieza" },
  { id: 5, name: "Leche Lala 1L", stock: 6, min: 20, category: "Lácteos" },
];

const recentSales = [
  { id: 1, time: "10:30 AM", items: 5, total: "$156.50" },
  { id: 2, time: "10:15 AM", items: 3, total: "$89.20" },
  { id: 3, time: "09:45 AM", items: 8, total: "$234.75" },
  { id: 4, time: "09:20 AM", items: 2, total: "$45.00" },
  { id: 5, time: "08:55 AM", items: 6, total: "$178.90" },
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const colorClasses = {
            slate: "from-slate-600 to-slate-800",
            green: "from-green-500 to-green-700",
            red: "from-red-500 to-red-700",
            blue: "from-blue-800 to-slate-900",
          }[stat.color];

          return (
            <Card key={index} className="p-6 hover:shadow-xl transition-all duration-300 border-0 shadow-md">
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`size-12 bg-gradient-to-br ${colorClasses} rounded-xl flex items-center justify-center shadow-lg`}
                >
                  <Icon className="size-6 text-white" />
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-semibold ${
                    stat.trend === "up" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {stat.trend === "up" ? (
                    <ArrowUpRight className="size-4" />
                  ) : (
                    <ArrowDownRight className="size-4" />
                  )}
                  <span>{stat.change}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Productos con Stock Bajo */}
        <Card className="p-6 border-0 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center shadow-md">
                <AlertTriangle className="size-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">Productos con Stock Bajo</h3>
                <p className="text-sm text-gray-500">
                  Requieren reabastecimiento
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full text-sm font-semibold shadow-sm">
              {lowStockProducts.length}
            </span>
          </div>

          <div className="space-y-3">
            {lowStockProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all duration-200 border border-gray-200"
              >
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-800">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">
                    {product.stock} unidades
                  </p>
                  <p className="text-xs text-gray-500">
                    Mín: {product.min}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Ventas Recientes */}
        <Card className="p-6 border-0 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center shadow-md">
                <ShoppingCart className="size-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">Ventas Recientes</h3>
                <p className="text-sm text-gray-500">Últimas transacciones</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all duration-200 border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center shadow-md">
                    <TrendingUp className="size-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-800">
                      Venta #{sale.id.toString().padStart(4, "0")}
                    </p>
                    <p className="text-xs text-gray-500">{sale.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-slate-800">{sale.total}</p>
                  <p className="text-xs text-gray-500">{sale.items} items</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6 border-0 shadow-lg">
        <h3 className="font-bold text-lg mb-4 text-slate-800">Acciones Rápidas</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-xl hover:shadow-lg hover:border-slate-300 transition-all duration-200 text-left group">
            <div className="size-12 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md">
              <Package className="size-6 text-white" />
            </div>
            <p className="font-semibold text-sm text-slate-800">Agregar Producto</p>
            <p className="text-xs text-gray-600">Nuevo producto al inventario</p>
          </button>
          <button className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl hover:shadow-lg hover:border-green-300 transition-all duration-200 text-left group">
            <div className="size-12 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md">
              <ShoppingCart className="size-6 text-white" />
            </div>
            <p className="font-semibold text-sm text-slate-800">Nueva Venta</p>
            <p className="text-xs text-gray-600">Registrar venta</p>
          </button>
          <button className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl hover:shadow-lg hover:border-blue-300 transition-all duration-200 text-left group">
            <div className="size-12 bg-gradient-to-br from-blue-800 to-slate-900 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md">
              <Truck className="size-6 text-white" />
            </div>
            <p className="font-semibold text-sm text-slate-800">Nuevo Proveedor</p>
            <p className="text-xs text-gray-600">Agregar proveedor</p>
          </button>
          <button className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl hover:shadow-lg hover:border-red-300 transition-all duration-200 text-left group">
            <div className="size-12 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md">
              <TrendingDown className="size-6 text-white" />
            </div>
            <p className="font-semibold text-sm text-slate-800">Reportar Pérdida</p>
            <p className="text-xs text-gray-600">Registrar pérdida o merma</p>
          </button>
        </div>
      </Card>
    </div>
  );
}