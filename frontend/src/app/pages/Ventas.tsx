import { Plus, Search, ShoppingCart, Minus, Trash2, Check, Loader2, Calendar, Receipt } from "lucide-react";
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

export function Ventas() {
  const [activeTab, setActiveTab] = useState<"pos" | "historial">("pos");
  
  // Pos states
  const [productos, setProductos] = useState<any[]>([]);
  const [availableStockRaw, setAvailableStockRaw] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { userId } = useAuth();
  // History states
  const [ventas, setVentas] = useState<any[]>([]);

  useEffect(() => {
    fetchInventoryForSale();
    if (activeTab === "historial") {
      fetchVentasHistory();
    }
  }, [activeTab]);

  const fetchInventoryForSale = async () => {
    try {
      const [invRes, detRes, prodRes] = await Promise.all([
        api.get("http://localhost:8000/api/inventario/inventarios/"),
        api.get("http://localhost:8000/api/inventario/detalles-entrada/"),
        api.get("http://localhost:8000/api/catalogo/productos/")
      ]);

      const inventarios = Array.isArray(invRes.data.results ?? invRes.data) ? (invRes.data.results ?? invRes.data) : [];
      const detalles   = Array.isArray(detRes.data.results ?? detRes.data) ? (detRes.data.results ?? detRes.data) : [];
      const prods      = Array.isArray(prodRes.data.results ?? prodRes.data) ? (prodRes.data.results ?? prodRes.data) : [];

      // Filter available raw inventory items
      const dispo = inventarios.filter((i: any) => i.estado === "Disponible");
      
      // Map them to their product and construct available stock arrays
      const mappedDispo = dispo.map((inv: any) => {
        const d = detalles.find((det: any) => det.id === inv.detalleEntradaId);
        return {
          inventarioId: inv.id,
          productoId: d?.productoId
        };
      });

      setAvailableStockRaw(mappedDispo);

      // Group into products for POS grid
      const posProducts = prods.map((p: any) => {
        const stockItems = mappedDispo.filter((m: any) => m.productoId === p.id);
        return {
          ...p,
          availableQty: stockItems.length,
          inventarioIds: stockItems.map((s: any) => s.inventarioId)
        };
      }).filter((p: any) => p.availableQty > 0);

      setProductos(posProducts);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar inventario para ventas.");
    }
  };

  const fetchVentasHistory = async () => {
    try {
      const { data } = await api.get("http://localhost:8000/api/ventas/ventas/");
      const arr = data.results ?? data;
      setVentas(Array.isArray(arr) ? arr : []);
    } catch (e) {
       console.error(e);
    }
  };

  const addToCart = (product: any) => {
    const existing = cart.find(c => c.productoId === product.id);
    if (existing) {
       if (existing.quantity >= product.availableQty) {
          toast.warning("No hay más stock disponible de este producto.");
          return;
       }
       setCart(cart.map(c => c.productoId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
       if (product.availableQty <= 0) return;
       setCart([...cart, {
          productoId: product.id,
          name: product.name,
          price: Number(product.salePrice),
          quantity: 1,
          inventarioIds: product.inventarioIds
       }]);
    }
  };

  const decreaseQuantity = (productoId: number) => {
    const existing = cart.find(c => c.productoId === productoId);
    if (existing && existing.quantity > 1) {
       setCart(cart.map(c => c.productoId === productoId ? { ...c, quantity: c.quantity - 1 } : c));
    } else {
       removeFromCart(productoId);
    }
  };

  const removeFromCart = (productoId: number) => {
    setCart(cart.filter(c => c.productoId !== productoId));
  };

  const totalCart = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

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
                 precioVentaUnitario: item.price
             });
         }
      }

      const ventaPayload = {
        usuarioId: userId,
        fecha: new Date().toISOString(),
        total: totalCart,
        detalles: detalles
      };

      await api.post("http://localhost:8000/api/ventas/procesar/", ventaPayload);

      toast.success("¡Venta finalizada exitosamente!");
      setCart([]);
      fetchInventoryForSale();
    } catch (error: any) {
       console.error(error);
       toast.error(error.response?.data?.error || "Hubo un error al procesar la venta.");
    } finally {
       setIsSubmitting(false);
    }
  };

  // Filter products by search
  const filteredProducts = productos.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Terminal de Ventas</h1>
          <p className="text-gray-600">Punto de venta y transacciones</p>
        </div>
        <div className="flex gap-4 border-b">
          <button
            className={`pb-2 px-4 text-sm font-semibold transition-colors C${activeTab === 'pos' ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('pos')}
          >
            Terminal POS
          </button>
          <button
            className={`pb-2 px-4 text-sm font-semibold transition-colors C${activeTab === 'historial' ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('historial')}
          >
            Historial de Ventas
          </button>
        </div>
      </div>

      {activeTab === 'pos' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main POS Product Grid */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4 border-0 shadow-sm sticky top-0 z-10">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                <Input 
                  placeholder="Buscar producto a vender..." 
                  className="pl-10 h-11 bg-gray-50 border-gray-200"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
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
                    <span className="font-bold text-lg text-slate-800">C${Number(p.salePrice).toFixed(2)}</span>
                    <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Stock: {p.availableQty}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-700 min-h-[40px] leading-tight group-hover:text-green-700 transition-colors">
                    {p.name}
                  </h3>
                </Card>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                  No se encontraron productos disponibles para venta.
                </div>
              )}
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <Card className="flex flex-col h-[600px] border-0 shadow-xl overflow-hidden sticky top-4">
              <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-4 text-white">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Orden Actual
                </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                    <ShoppingCart className="size-16 mb-4" />
                    <p>El carrito está vacío</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.productoId} className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                        <p className="text-green-700 text-xs font-bold">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg border p-1 border-gray-200 shadow-inner">
                        <button onClick={() => decreaseQuantity(item.productoId)} className="p-1 hover:bg-white rounded text-slate-600 hover:text-red-500 transition-colors">
                          <Minus className="size-4" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-slate-800">{item.quantity}</span>
                        <button onClick={() => addToCart({ id: item.productoId, availableQty: 9999 })} className="p-1 hover:bg-white rounded text-slate-600 hover:text-green-600 transition-colors">
                          <Plus className="size-4" />
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(item.productoId)} className="ml-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between mb-4">
                  <span className="text-gray-600 font-medium">Subtotal</span>
                  <span className="font-semibold">C${totalCart.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-6">
                  <span className="text-2xl font-bold text-slate-800">Total</span>
                  <span className="text-3xl font-black text-green-600">C${totalCart.toFixed(2)}</span>
                </div>
                <Button 
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || isSubmitting}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  {isSubmitting ? <Loader2 className="animate-spin size-6 mr-2" /> : <Receipt className="size-6 mr-2" />}
                  Finalizar Venta
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'historial' && (
        <Card className="p-6 border-0 shadow-lg">
          <div className="mb-6 flex">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
              <Input placeholder="Buscar por ID de venta..." className="pl-10 h-11" />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Ticket</TableHead>
                  <TableHead>Fecha / Hora</TableHead>
                  <TableHead>Usuario Cajero</TableHead>
                  <TableHead className="text-right">Total Pagado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.length > 0 ? (
                  ventas.map((venta) => (
                    <TableRow key={venta.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-slate-800">
                        #{venta.id.toString().padStart(5, '0')}
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                           <Calendar className="size-4 text-slate-500"/>
                           {new Date(venta.fecha).toLocaleString()}
                         </div>
                      </TableCell>
                      <TableCell>Responsable ID: {venta.usuarioId}</TableCell>
                      <TableCell className="text-right font-bold text-green-700 text-lg">
                        C${Number(venta.total).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-gray-500">
                      No hay ventas registradas aún.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
