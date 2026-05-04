/**
 * @fileoverview Página de Dashboard — Panel de Control General
 *
 * Primera pantalla que ve el usuario al iniciar sesión. Muestra un
 * resumen ejecutivo del estado del negocio: métricas clave, gráfico
 * de tendencia de ventas, alertas de stock bajo y ventas recientes.
 *
 * FILTRO DE PRIVACIDAD POR ROL:
 *   El backend (DashboardStatsView) devuelve `weeklySales` y `weeklyLosses`
 *   como `null` para usuarios con rol 'vendedor'. En el frontend, la constante
 *   `isAdmin` controla qué tarjetas de stats se muestran:
 *   - Admin: Ve las 4 tarjetas (incluyendo Ventas Semanales y Pérdidas).
 *   - Vendedor: Solo ve Total de Productos y Proveedores Activos.
 *   El filtro `stats.filter(stat => isAdmin || !stat.adminOnly)` aplica esta
 *   lógica declarativamente en lugar de condiciones if/else dispersas.
 *
 * GRÁFICO DE LÍNEA (Recharts):
 *   Muestra las ventas diarias de los últimos 7 días.
 *   Los datos vienen pre-agregados del backend (TruncDate + Sum en Django)
 *   para evitar enviar miles de registros individuales al frontend.
 */
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
  Loader2,
} from "lucide-react";
import { Card } from "../components/ui/card";
import { useState, useEffect } from "react";
import api from "../api/axiosInstance";
import { useAuth } from "../contexts/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/**
 * Componente de la página de Dashboard.
 *
 * @state loading - Controla el spinner inicial mientras se carga la API.
 * @state statsData - Datos de métricas recibidos de /api/ventas/dashboard/stats/.
 */
export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<any>(null);
  const { userRole } = useAuth();
  // isAdmin: constante derivada del contexto, usada para filtrar tarjetas y features
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  /**
   * Carga las estadísticas del dashboard al montar el componente.
   * El endpoint /api/ventas/dashboard/stats/ agrega todos los datos necesarios
   * en una sola petición, evitando múltiples llamadas a la API.
   */
  const fetchDashboardStats = async () => {
    try {
      const { data } = await api.get("/ventas/dashboard/stats/");
      setStatsData(data);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !statsData) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="size-12 animate-spin text-green-600" />
        <p className="text-gray-500 font-medium">
          Calculando métricas del negocio...
        </p>
      </div>
    );
  }

  const {
    totalProducts,
    totalProveedores,
    lowStockItems,
    recentSales,
    chartData,
  } = statsData;

  /**
   * Definición de las tarjetas de métricas.
   * `adminOnly: true` marca las tarjetas que contienen datos financieros
   * sensibles, filtradas según el rol en `visibleStats`.
   * El valor de weeklySales usa `!= null` (no `!== null`) para capturar
   * tanto null como undefined, ya que el backend puede devolver cualquiera.
   */
  const stats = [
    {
      icon: Package,
      label: "Total de Productos",
      value: totalProducts,
      change: "Items en Catálogo",
      trend: "up",
      color: "slate",
      adminOnly: false,
    },
    {
      icon: DollarSign,
      label: "Ventas Semanales",
      // null-safety: si el backend retorna null para vendedor, mostramos guión
      value: statsData?.weeklySales != null ? `C$ ${Number(statsData.weeklySales).toFixed(2)}` : '—',
      change: "Últimos 7 días",
      trend: "up",
      color: "green",
      adminOnly: true,
    },
    {
      icon: TrendingDown,
      label: "Pérdidas del Mes",
      value: statsData?.weeklyLosses != null ? `C$ ${Number(statsData.weeklyLosses).toFixed(2)}` : '—',
      change: "Últimos 7 días",
      trend: "down",
      color: "red",
      adminOnly: true,
    },
    {
      icon: Truck,
      label: "Proveedores Activos",
      value: totalProveedores,
      change: "Alianzas",
      trend: "up",
      color: "blue",
      adminOnly: false,
    },
  ];

  // Los vendedores no ven las cards con datos financieros sensibles
  const visibleStats = stats.filter(stat => isAdmin || !stat.adminOnly);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Panel de Control General
        </h1>
        <p className="text-gray-600">
          Resumen y estado del negocio al día de hoy
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {visibleStats.map((stat, index) => {
          const Icon = stat.icon;
          const colorClasses = {
            slate: "from-slate-600 to-slate-800",
            green: "from-green-500 to-green-700",
            red: "from-red-400 to-red-600",
            blue: "from-blue-700 to-blue-900",
          }[stat.color];

          return (
            <Card
              key={index}
              className="p-6 hover:shadow-xl transition-all duration-300 border-0 shadow-md"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`size-12 bg-gradient-to-br ${colorClasses} rounded-xl flex items-center justify-center shadow-lg`}
                >
                  <Icon className="size-6 text-white" />
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-semibold ${stat.trend === "up" ? "text-green-600" : "text-red-400"
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

      {/* Chart Section */}
      <Card className="p-6 border-0 shadow-lg">
        <div className="mb-6">
          <h3 className="font-bold text-lg text-slate-800">
            Tendencia de Ventas
          </h3>
          <p className="text-sm text-gray-500">
            Ingresos generados en la última semana
          </p>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E5E7EB"
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280", fontSize: 12 }}
                dy={10}
                tickFormatter={(value) => {
                  const dayMap: { [key: string]: string } = {
                    Mon: "Lun", Tue: "Mar", Wed: "Mié", Thu: "Jue", 
                    Fri: "Vie", Sat: "Sáb", Sun: "Dom", Hoy: "Hoy"
                  };
                  return dayMap[value] || value;
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280", fontSize: 12 }}
                dx={-10}
                tickFormatter={(value) => `C$ ${value}`}
              />
              <Tooltip
                labelFormatter={(value) => {
                  const dayMap: { [key: string]: string } = {
                    Mon: "Lunes", Tue: "Martes", Wed: "Miércoles", Thu: "Jueves",
                    Fri: "Viernes", Sat: "Sábado", Sun: "Domingo", Hoy: "Hoy"
                  };
                  return dayMap[value] || value;
                }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                  padding: "12px",
                }}
                cursor={{ fill: "#f1f5f9", radius: 8 }}
                formatter={(value: any) => [`C$ ${Number(value).toLocaleString()}`, "Ventas"]}
              />
              <Bar
                dataKey="total"
                radius={[6, 6, 0, 0]}
                barSize={40}
                name="Ventas (C$)"
              >
                {chartData.map((entry: any, index: number) => {
                  // Paleta de colores vibrantes y profesionales
                  const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#f43f5e"];
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={colors[index % colors.length]}
                      fillOpacity={0.8}
                      className="hover:fill-opacity-100 transition-all duration-300"
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Productos con Stock Bajo */}
        <Card className="p-6 border-0 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center shadow-md">
                <AlertTriangle className="size-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">
                  Productos con Stock Bajo
                </h3>
                <p className="text-sm text-gray-500">
                  Requieren reabastecimiento urgente
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full text-sm font-semibold shadow-sm">
              {lowStockItems.length}
            </span>
          </div>

          <div className="space-y-3">
            {lowStockItems.length > 0 ? (
              lowStockItems.map((product: any) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-white rounded-xl hover:shadow-md transition-all duration-200 border border-red-100"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-slate-800">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">
                      {product.stock} unidades
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 border border-dashed rounded-xl">
                No hay productos con stock bajo
              </div>
            )}
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
                <h3 className="font-bold text-lg text-slate-800">
                  Ventas Recientes
                </h3>
                <p className="text-sm text-gray-500">
                  Últimas transacciones completadas
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {recentSales.length > 0 ? (
              recentSales.map((sale: any) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-white rounded-xl hover:shadow-md transition-all duration-200 border border-green-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md text-white font-bold text-sm">
                      #{sale.id}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-800">
                        Ticket Venta
                      </p>
                      <p className="text-xs text-gray-500">{sale.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-green-700">
                      {`C$ ${Number(String(sale.total).replace(/[^0-9.-]+/g, "")).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </p>
                    <p className="text-xs text-gray-500">{sale.items} items</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 border border-dashed rounded-xl">
                Aún no hay ventas registradas.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
