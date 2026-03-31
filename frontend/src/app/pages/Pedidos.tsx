import { Plus, Search, Package, PlusCircle, Calendar, DollarSign, Loader2, Check } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { useState, useEffect } from "react";
import api from "../api/axiosInstance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

export function Pedidos() {
  const [entradas, setEntradas] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [isAddMode, setIsAddMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"entradas" | "inventario">("entradas");
  
  // States for new Entry
  const [selectedProveedor, setSelectedProveedor] = useState("");
  // Usually this comes from Auth context
  const { userId } = useAuth();
  const [detalles, setDetalles] = useState<any[]>([{ productoId: "", cantidad: 1, precioCompraUnitario: 0 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEntradas();
    fetchInventario();
    fetchProveedores();
    fetchProductos();
  }, []);

  const fetchInventario = async () => {
    try {
      const { data } = await api.get("http://localhost:8000/api/inventario/inventarios/");
      const arr = data.results ?? data;
      setInventario(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error("Error al cargar inventario:", e);
    }
  };

  const fetchEntradas = async () => {
    try {
      const { data } = await api.get("http://localhost:8000/api/inventario/entradas/");
      const arr = data.results ?? data;
      setEntradas(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar entradas de inventario.");
    }
  };

  const fetchProveedores = async () => {
    try {
      const { data } = await api.get("http://localhost:8000/api/catalogo/proveedores/");
      const arr = data.results ?? data;
      setProveedores(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProductos = async () => {
    try {
      const { data } = await api.get("http://localhost:8000/api/catalogo/productos/");
      const arr = data.results ?? data;
      setProductos(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddDetalle = () => {
    setDetalles([...detalles, { productoId: "", cantidad: 1, precioCompraUnitario: 0 }]);
  };

  const handleDetalleChange = (index: number, field: string, value: any) => {
    const newDetalles = [...detalles];
    newDetalles[index][field] = value;
    setDetalles(newDetalles);
  };

  const handleRemoveDetalle = (index: number) => {
    const newDetalles = detalles.filter((_, i) => i !== index);
    setDetalles(newDetalles);
  };

  const calcTotal = () => {
    return detalles.reduce((sum, item) => sum + (Number(item.cantidad) * Number(item.precioCompraUnitario)), 0);
  };

  const handleSubmit = async () => {
    if (!selectedProveedor || detalles.length === 0 || detalles.some(d => !d.productoId || d.cantidad <= 0 || d.precioCompraUnitario <= 0)) {
       toast.error("Por favor completa todos los campos correctamente.");
       return;
    }

    setIsSubmitting(true);
    try {
      const total = calcTotal();
      const entradaPayload = {
        proveedorId: Number(selectedProveedor),
        usuarioId: userId,
        fechaEntrada: new Date().toISOString(),
        total: total
      };

      const { data: entradaRegistrada } = await api.post("http://localhost:8000/api/inventario/entradas/", entradaPayload);
      
      // Post all details
      for (const d of detalles) {
        const detallePayload = {
          entradaInventarioId: entradaRegistrada.id,
          productoId: Number(d.productoId),
          cantidad: Number(d.cantidad),
          precioCompraUnitario: Number(d.precioCompraUnitario)
        };
        const { data: detReq } = await api.post("http://localhost:8000/api/inventario/detalles-entrada/", detallePayload);

        // According to DBML, we also need to generate Inventario records. 
        // 1 DetalleEntrada -> N records in Inventario depending on quantity
        // However, to avoid overloading API right now we create 1 Inventario representing the batch or multiple depending on logic.
        // Assuming 1 Inventario record per unit is required by DBML, or maybe 1 per batch. Let's do 1 per Detalle for now to represent the batch
        // Correct approach depends on business logic, but DBML says Inventario is related to IdDetalleEntrada
        const inventarioPayload = {
          detalleEntradaId: detReq.id,
          estado: 'Disponible',
          fechaMovimiento: new Date().toISOString()
        };
        await api.post("http://localhost:8000/api/inventario/inventarios/", inventarioPayload);
      }

      toast.success("Entrada de inventario registrada con éxito");
      setIsAddMode(false);
      setDetalles([{ productoId: "", cantidad: 1, precioCompraUnitario: 0 }]);
      setSelectedProveedor("");
      fetchEntradas();
      fetchInventario();
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar la entrada de inventario.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventario y Entradas</h1>
          <p className="text-gray-600">Registra compras y monitorea los ítems en inventario</p>
        </div>
        {!isAddMode && (
          <Button onClick={() => setIsAddMode(true)} className="bg-gradient-to-r from-blue-800 to-slate-900 hover:from-blue-900 hover:to-slate-950">
            <Plus className="size-4 mr-2" />
            Nueva Entrada
          </Button>
        )}
      </div>

      {!isAddMode && (
        <div className="flex gap-4 border-b">
          <button
            className={`pb-2 px-4 text-sm font-semibold transition-colors ${activeTab === 'entradas' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-gray-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('entradas')}
          >
            Historial de Entradas
          </button>
          <button
            className={`pb-2 px-4 text-sm font-semibold transition-colors ${activeTab === 'inventario' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-gray-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('inventario')}
          >
            Existencias (Items)
          </button>
        </div>
      )}

      {isAddMode ? (
        <Card className="p-6 border-0 shadow-lg">
           <h2 className="text-xl font-bold text-slate-800 mb-6">Registrar Nueva Entrada</h2>
           
           <div className="space-y-6">
             <div className="max-w-md">
                <Label className="text-slate-800 font-semibold">Proveedor</Label>
                <Select value={selectedProveedor} onValueChange={setSelectedProveedor}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Seleccionar Proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>

             <div className="border border-slate-200 rounded-lg p-4">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-700">Productos a Ingresar</h3>
                  <Button variant="outline" size="sm" onClick={handleAddDetalle}>
                    <PlusCircle className="size-4 mr-2"/>
                    Añadir Fila
                  </Button>
               </div>

               {detalles.map((det, index) => (
                 <div key={index} className="flex gap-4 items-end mb-4 bg-slate-50 p-3 rounded-md">
                    <div className="flex-1">
                      <Label className="text-xs">Producto</Label>
                      <Select value={det.productoId} onValueChange={(v) => handleDetalleChange(index, "productoId", v)}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {productos.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Cantidad</Label>
                      <Input type="number" min="1" value={det.cantidad} onChange={(e) => handleDetalleChange(index, "cantidad", e.target.value)} />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">Costo Unit. ($)</Label>
                      <Input type="number" min="0" step="0.01" value={det.precioCompraUnitario} onChange={(e) => handleDetalleChange(index, "precioCompraUnitario", e.target.value)} />
                    </div>
                    <div className="w-24 pb-2 text-sm font-semibold text-slate-700">
                       Subt: ${(Number(det.cantidad) * Number(det.precioCompraUnitario)).toFixed(2)}
                    </div>
                    {detalles.length > 1 && (
                      <Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600 px-2" onClick={() => handleRemoveDetalle(index)}>
                        X
                      </Button>
                    )}
                 </div>
               ))}
             </div>

             <div className="flex items-center justify-between border-t pt-4">
                <div className="text-xl font-bold text-slate-800">
                   Total: ${calcTotal().toFixed(2)}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setIsAddMode(false)}>Cancelar</Button>
                  <Button disabled={isSubmitting} onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
                    {isSubmitting ? <Loader2 className="animate-spin size-4 mr-2"/> : <Check className="size-4 mr-2" />}
                    Confirmar Entrada
                  </Button>
                </div>
             </div>
           </div>
        </Card>
      ) : (
        <Card className="p-6 border-0 shadow-lg">
          {activeTab === 'entradas' ? (
            <>
              <div className="mb-6 flex">
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                  <Input placeholder="Buscar por ID de entrada..." className="pl-10 h-11" />
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Entrada</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead className="text-right">Total ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entradas.length > 0 ? (
                      entradas.map((entrada) => (
                        <TableRow key={entrada.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium text-slate-800">
                            #{entrada.id}
                          </TableCell>
                          <TableCell>
                             <div className="flex items-center gap-2">
                               <Calendar className="size-4 text-slate-500"/>
                               {new Date(entrada.fechaEntrada).toLocaleDateString()}
                             </div>
                          </TableCell>
                          <TableCell>{proveedores.find(p => p.id === entrada.proveedorId)?.name || "N/A"}</TableCell>
                          <TableCell>Usuario {entrada.usuarioId}</TableCell>
                          <TableCell className="text-right font-bold text-green-700">
                            ${Number(entrada.total).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          No hay entradas registradas.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 flex">
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                  <Input placeholder="Buscar ítem en inventario..." className="pl-10 h-11" />
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Ítem</TableHead>
                      <TableHead>ID Detalle Entrada</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha Registro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventario.length > 0 ? (
                      inventario.map((item) => (
                        <TableRow key={item.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium text-slate-800">
                            #{item.id}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            Detalle #{item.detalleEntradaId}
                          </TableCell>
                          <TableCell>
                             <span className={`px-2 py-1 text-xs rounded-full font-semibold ${item.estado === 'Disponible' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                               {item.estado}
                             </span>
                          </TableCell>
                          <TableCell>
                             <div className="flex items-center gap-2 text-slate-600 font-medium">
                               <Calendar className="size-4 text-slate-500"/>
                               {new Date(item.fechaMovimiento).toLocaleDateString()}
                             </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          No hay ítems en el inventario.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

