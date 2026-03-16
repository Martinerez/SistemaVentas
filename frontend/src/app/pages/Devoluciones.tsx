import { Plus, Search, ClipboardList, Check, Loader2, Calendar, CornerDownLeft } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

export function Devoluciones() {
  const [devoluciones, setDevoluciones] = useState<any[]>([]);
  const [inventarioVendido, setInventarioVendido] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [detallesEntrada, setDetallesEntrada] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [motivo, setMotivo] = useState("");
  const [selectedInventarioId, setSelectedInventarioId] = useState<string>("");
  
  const { userId } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [devolucionesRes, invRes, prodRes, detRes] = await Promise.all([
        api.get("http://localhost:8000/api/inventario/solicitudes-devolucion/"),
        api.get("http://localhost:8000/api/inventario/inventarios/"),
        api.get("http://localhost:8000/api/catalogo/productos/"),
        api.get("http://localhost:8000/api/inventario/detalles-entrada/")
      ]);
      const devoluciones = devolucionesRes.data.results ?? devolucionesRes.data;
      const inventario   = invRes.data.results ?? invRes.data;
      const productos    = prodRes.data.results ?? prodRes.data;
      const detalles     = detRes.data.results ?? detRes.data;
      setDevoluciones(Array.isArray(devoluciones) ? devoluciones : []);
      setProductos(Array.isArray(productos) ? productos : []);
      setDetallesEntrada(Array.isArray(detalles) ? detalles : []);
      // Solo podemos devolver items que fueron vendidos
      setInventarioVendido((Array.isArray(inventario) ? inventario : []).filter((i: any) => i.estado === "Vendido"));
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar datos.");
    }
  };

  const getProductNameByInventarioId = (invId: number) => {
    const inv = inventarioVendido.find(i => i.id === invId);
    if (!inv) return "Desconocido";
    const det = detallesEntrada.find(d => d.id === inv.detalleEntradaId);
    if (!det) return "Desconocido";
    const prod = productos.find(p => p.id === det.productoId);
    return prod ? prod.name : "Desconocido";
  };

  const handleSave = async () => {
    if (!selectedInventarioId || !motivo) {
      toast.warning("Debes seleccionar un ítem y especificar un motivo.");
      return;
    }
    setIsSubmitting(true);
    try {
      const invIdNum = parseInt(selectedInventarioId);

      const payload = {
        usuarioId: userId,
        fechaSolicitud: new Date().toISOString(),
        motivo: motivo,
        detalles: [
          {
             inventarioId: invIdNum,
             precioCompraUnitario: 0 // Optional, handled on backend if 0
          }
        ]
      };
      
      await api.post("http://localhost:8000/api/inventario/procesar-devolucion/", payload);

      toast.success("Devolución procesada exitosamente.");
      setIsAddOpen(false);
      setSelectedInventarioId("");
      setMotivo("");
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || "Ocurrió un error al procesar la devolución.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = devoluciones.filter(d => d.id.toString().includes(searchTerm) || d.motivo.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Devoluciones</h1>
          <p className="text-gray-600">Recepción de productos devueltos por clientes</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white shadow-md">
          <Plus className="size-4 mr-2" />
          Nueva Devolución
        </Button>
      </div>

      <Card className="p-6 border-0 shadow-lg">
        <div className="mb-6 flex">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <Input 
              placeholder="Buscar por ID o motivo..." 
              className="pl-10 h-11"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Solicitud</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Resp. Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map((d) => (
                  <TableRow key={d.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium text-slate-800">
                      #{d.id.toString().padStart(4, "0")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="size-4" />
                        {new Date(d.fechaSolicitud).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={d.motivo}>
                      {d.motivo}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
                        d.estado === 'Aprobada' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {d.estado}
                      </span>
                    </TableCell>
                    <TableCell>Admin (ID {d.usuarioId})</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No se encontraron registros de devoluciones.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <CornerDownLeft className="size-5" />
              Procesar Devolución
            </DialogTitle>
            <DialogDescription className="sr-only">Selecciona el ítem vendido a devolver e indica el motivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Ítem Vendido a Devolver</Label>
              <Select value={selectedInventarioId} onValueChange={setSelectedInventarioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el ítem del ticket..." />
                </SelectTrigger>
                <SelectContent>
                  {inventarioVendido.map(inv => (
                    <SelectItem key={inv.id} value={inv.id.toString()}>
                      Item Vendido #{inv.id} - {getProductNameByInventarioId(inv.id)}
                    </SelectItem>
                  ))}
                  {inventarioVendido.length === 0 && (
                    <div className="p-2 text-sm text-gray-500 text-center">No hay ítems vendidos registrados.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Motivo Detallado</Label>
              <Textarea 
                placeholder="Ej. El cliente devolvió el pan porque estaba aplastado..."
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button disabled={isSubmitting || !selectedInventarioId || !motivo} onClick={handleSave} className="bg-slate-800 hover:bg-slate-900 text-white">
                {isSubmitting ? <Loader2 className="animate-spin size-4 mr-2" /> : <Check className="size-4 mr-2" />}
                Ingresar Devolución
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
