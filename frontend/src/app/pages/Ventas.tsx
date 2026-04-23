import {
  Plus, Search, ShoppingCart, Minus, Trash2, Loader2, Receipt,
  ChevronDown, ChevronRight, Ban, AlertTriangle, X
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { useState, useEffect } from "react";
import api from "../api/axiosInstance";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

// ─── Modal de confirmación de anulación ──────────────────────────────
function ConfirmAnularModal({
  ventaId,
  onConfirm,
  onCancel,
  isLoading,
}: {
  ventaId: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5 flex items-center gap-3">
          <div className="bg-white/20 rounded-full p-2">
            <AlertTriangle className="size-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Confirmar Anulación</h2>
            <p className="text-red-100 text-sm">Venta #{ventaId}</p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto text-white/70 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              <strong>¿Estás seguro?</strong> Esta acción devolverá los productos al
              stock y marcará la venta como <strong>inválida</strong>. No se puede
              deshacer.
            </p>
          </div>
          <p className="text-sm text-gray-500 text-center">
            Los ítems de inventario volverán al estado <em>Disponible</em>.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-gray-200"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Ban className="size-4" />
            )}
            {isLoading ? "Anulando..." : "Sí, anular venta"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila expandible del historial ───────────────────────────────────
function VentaRow({
  venta,
  isAdmin,
  onAnular,
}: {
  venta: any;
  isAdmin: boolean;
  onAnular: (venta: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detalles: any[] = venta.detalles ?? [];
  const isAnulada = venta.estado === "Anulada";

  return (
    <>
      {/* Fila principal */}
      <TableRow
        className={`cursor-pointer select-none transition-colors hover:bg-gray-50 ${
          isAnulada ? "opacity-60 bg-red-50/40" : ""
        }`}
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell className="w-10">
          <span className="text-gray-400">
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </span>
        </TableCell>
        <TableCell className="font-medium">#{venta.id}</TableCell>
        <TableCell>{new Date(venta.fecha).toLocaleString()}</TableCell>
        <TableCell>{venta.usuarioId}</TableCell>
        <TableCell>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              isAnulada
                ? "bg-red-100 text-red-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {isAnulada ? <Ban className="size-3" /> : null}
            {venta.estado ?? "Completada"}
          </span>
        </TableCell>
        <TableCell className="text-right font-bold text-green-700">
          C${Number(venta.total).toFixed(2)}
        </TableCell>
        <TableCell className="text-right">
          {isAdmin && !isAnulada && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:bg-red-50 hover:text-red-700 gap-1.5 font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                onAnular(venta);
              }}
            >
              <Ban className="size-4" />
              Anular
            </Button>
          )}
        </TableCell>
      </TableRow>

      {/* Fila expandida con detalles */}
      {expanded && (
        <TableRow className="bg-slate-50/80">
          <TableCell colSpan={7} className="p-0">
            <div className="px-8 py-4 border-t border-gray-100">
              {detalles.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  Sin detalles registrados.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-200">
                      <th className="pb-2 pr-4">Producto</th>
                      <th className="pb-2 pr-4 text-right">Precio unitario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map((d: any) => (
                      <tr
                        key={d.id}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="py-1.5 pr-4 font-medium text-slate-700">
                          {d.nombreProducto ?? `Inventario #${d.inventarioId}`}
                        </td>
                        <td className="py-1.5 text-right text-green-700 font-semibold">
                          C${Number(d.precioVentaUnitario).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────
export function Ventas() {
  const [activeTab, setActiveTab] = useState<"pos" | "historial">("pos");

  // Estados POS
  const [productos, setProductos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth
  const { userId, userRole } = useAuth();
  const isAdmin = userRole === "admin";

  // Historial
  const [ventas, setVentas] = useState<any[]>([]);

  // Modal de anulación
  const [ventaAAnular, setVentaAAnular] = useState<any | null>(null);
  const [isAnulando, setIsAnulando] = useState(false);

  useEffect(() => {
    setSearchTerm("");
    fetchInventoryForSale();
    if (activeTab === "historial") {
      fetchVentasHistory();
    }
  }, [activeTab]);

  const fetchInventoryForSale = async () => {
    try {
      const [invRes, detRes, prodRes] = await Promise.all([
        api.get("/inventario/inventarios/"),
        api.get("/inventario/detalles-entrada/"),
        api.get("/catalogo/productos/"),
      ]);

      const inventarios = Array.isArray(invRes.data.results ?? invRes.data)
        ? invRes.data.results ?? invRes.data
        : [];
      const detalles = Array.isArray(detRes.data.results ?? detRes.data)
        ? detRes.data.results ?? detRes.data
        : [];
      const prods = Array.isArray(prodRes.data.results ?? prodRes.data)
        ? prodRes.data.results ?? prodRes.data
        : [];

      const dispo = inventarios.filter(
        (i: any) => i.estado?.toString().toLowerCase() === "disponible"
      );

      const mappedDispo = dispo.map((inv: any) => {
        const dId =
          inv.detalle_entrada_id ||
          inv.detalleEntradaId ||
          inv.detalle_entrada ||
          inv.detalleEntrada;
        const d = detalles.find((det: any) => det.id === dId);
        return {
          inventarioId: inv.id,
          productoId: d?.producto_id || d?.productoId || d?.producto,
        };
      });

      const posProducts = prods
        .map((p: any) => {
          const stockItems = mappedDispo.filter(
            (m: any) => m.productoId === p.id
          );
          return {
            ...p,
            availableQty: stockItems.length,
            inventarioIds: stockItems.map((s: any) => s.inventarioId),
          };
        })
        .filter((p: any) => p.availableQty > 0);

      setProductos(posProducts);
    } catch (e) {
      console.error("Error en fetchInventoryForSale:", e);
      toast.error("Error al sincronizar el inventario.");
    }
  };

  const fetchVentasHistory = async () => {
    try {
      const { data } = await api.get("/ventas/ventas/");
      const arr = data.results ?? data;
      setVentas(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error(e);
    }
  };

  const addToCart = (product: any) => {
    if (!product) return;
    const existing = cart.find((c) => c.productoId === product.id);
    if (existing) {
      if (existing.quantity >= product.availableQty) {
        toast.warning("Stock máximo alcanzado en carrito.");
        return;
      }
      setCart(
        cart.map((c) =>
          c.productoId === product.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      );
    } else {
      if (product.availableQty <= 0) return;
      setCart([
        ...cart,
        {
          productoId: product.id,
          name: product.name || product.nombre,
          price: Number(product.salePrice || product.precio_venta || 0),
          quantity: 1,
          inventarioIds: product.inventarioIds,
        },
      ]);
    }
  };

  const decreaseQuantity = (productoId: number) => {
    const existing = cart.find((c) => c.productoId === productoId);
    if (existing && existing.quantity > 1) {
      setCart(
        cart.map((c) =>
          c.productoId === productoId ? { ...c, quantity: c.quantity - 1 } : c
        )
      );
    } else {
      removeFromCart(productoId);
    }
  };

  const removeFromCart = (productoId: number) => {
    setCart(cart.filter((c) => c.productoId !== productoId));
  };

  const totalCart = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const detalles = [];
      for (const item of cart) {
        const idsToSell = item.inventarioIds.slice(0, item.quantity);
        for (const invId of idsToSell) {
          detalles.push({
            inventarioId: invId,
            precioVentaUnitario: item.price,
          });
        }
      }
      await api.post("/ventas/procesar/", {
        usuarioId: userId,
        fecha: new Date().toISOString(),
        total: totalCart,
        detalles,
      });
      toast.success("Venta realizada con éxito");
      setCart([]);
      fetchInventoryForSale();
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.response?.data?.error || "Error al procesar la transacción."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Lógica de anulación ──────────────────────────────────────
  const handleAnularConfirm = async () => {
    if (!ventaAAnular) return;
    setIsAnulando(true);
    try {
      await api.post(
        `/ventas/${ventaAAnular.id}/anular/`
      );
      toast.success(`Venta #${ventaAAnular.id} anulada. Stock revertido.`);
      setVentaAAnular(null);
      fetchVentasHistory();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Error al anular la venta."
      );
    } finally {
      setIsAnulando(false);
    }
  };

  const filteredProducts = productos.filter((p) =>
    (p.name || p.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Modal de confirmación */}
      {ventaAAnular && (
        <ConfirmAnularModal
          ventaId={ventaAAnular.id}
          onConfirm={handleAnularConfirm}
          onCancel={() => setVentaAAnular(null)}
          isLoading={isAnulando}
        />
      )}

      {/* Cabecera + tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Terminal de Ventas
          </h1>
          <p className="text-gray-600">Gestión de salida de productos</p>
        </div>
        <div className="flex gap-4 border-b">
          <button
            className={`pb-2 px-4 text-sm font-semibold transition-colors ${
              activeTab === "pos"
                ? "border-b-2 border-green-600 text-green-700"
                : "text-gray-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("pos")}
          >
            Punto de Venta
          </button>
          <button
            className={`pb-2 px-4 text-sm font-semibold transition-colors ${
              activeTab === "historial"
                ? "border-b-2 border-green-600 text-green-700"
                : "text-gray-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("historial")}
          >
            Historial
          </button>
        </div>
      </div>

      {/* ─── TAB: POS ─── */}
      {activeTab === "pos" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4 border-0 shadow-sm sticky top-0 z-10">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre de producto..."
                  className="pl-10 h-11 bg-gray-50 border-gray-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredProducts.map((p) => (
                <Card
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="p-4 border-0 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group bg-gradient-to-br from-white to-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-lg text-slate-800">
                      C${Number(p.salePrice || p.precio_venta).toFixed(2)}
                    </span>
                    <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Stock: {p.availableQty}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-700 min-h-[40px] leading-tight group-hover:text-green-700 transition-colors">
                    {p.name || p.nombre}
                  </h3>
                </Card>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                  No hay productos con stock disponible para mostrar.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card className="flex flex-col h-[600px] border-0 shadow-xl overflow-hidden sticky top-4">
              <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-4 text-white">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Carrito de Compras
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                    <ShoppingCart className="size-16 mb-4" />
                    <p>Selecciona productos para vender</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.productoId}
                      className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-100"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-semibold text-sm text-slate-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-green-700 text-xs font-bold">
                          C${item.price.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg border p-1 border-gray-200 shadow-inner">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            decreaseQuantity(item.productoId);
                          }}
                          className="p-1 hover:bg-white rounded text-slate-600 hover:text-red-500 transition-colors"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(
                              productos.find((p) => p.id === item.productoId)
                            );
                          }}
                          className="p-1 hover:bg-white rounded text-slate-600 hover:text-green-600 transition-colors"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(item.productoId);
                        }}
                        className="ml-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between mb-4 text-2xl">
                  <span className="font-bold text-slate-800">Total</span>
                  <span className="font-black text-green-600">
                    C${totalCart.toFixed(2)}
                  </span>
                </div>
                <Button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || isSubmitting}
                  className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin size-6 mr-2" />
                  ) : (
                    <Receipt className="size-6 mr-2" />
                  )}
                  Cobrar ahora
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ─── TAB: HISTORIAL ─── */}
      {activeTab === "historial" && (
        <Card className="p-6 border-0 shadow-lg">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Factura</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cajero ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-gray-400"
                    >
                      No hay ventas registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  ventas.map((venta) => (
                    <VentaRow
                      key={venta.id}
                      venta={venta}
                      isAdmin={isAdmin}
                      onAnular={setVentaAAnular}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}