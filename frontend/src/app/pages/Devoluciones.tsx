import {
  Plus,
  Search,
  Check,
  Loader2,
  Calendar,
  CornerDownLeft,
  AlertCircle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "../components/ui/textarea";

export function Devoluciones() {
  const [devoluciones, setDevoluciones] = useState<any[]>([]);
  const [inventarioDisponible, setInventarioDisponible] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [detallesEntrada, setDetallesEntrada] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  //Form states
  const [motivo, setMotivo] = useState("");
  const [observaciones, setObservaciones] = useState(""); // Nuevo campo para la cabecera
  const [selectedInventarioId, setSelectedInventarioId] = useState<string>("");

  const { userId } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [devolucionesRes, invRes, prodRes, detRes] = await Promise.all([
        api.get("/inventario/solicitudes-devolucion/"), // Asegúrate de que las rutas sean correctas
        api.get("/inventario/inventarios/"),
        api.get("/catalogo/productos/"),
        api.get("/inventario/detalles-entrada/"),
      ]);
      const devoluciones = devolucionesRes.data.results ?? devolucionesRes.data;
      const inventario = invRes.data.results ?? invRes.data;
      const productos = prodRes.data.results ?? prodRes.data;
      const detalles = detRes.data.results ?? detRes.data;

      setDevoluciones(Array.isArray(devoluciones) ? devoluciones : []);
      setProductos(Array.isArray(productos) ? productos : []);
      setDetallesEntrada(Array.isArray(detalles) ? detalles : []);

      //FILTRO CORREGIDO: Solo mostramos items que están en el almacén (no vendidos)
      setInventarioDisponible(
        (Array.isArray(inventario) ? inventario : []).filter(
          (i: any) => i.estado === "Disponible" || i.estado === "Dañado",
        ),
      );
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar datos.");
    }
  };

  //Función auxiliar para obtener datos completos del ítem seleccionado
  const getItemDetails = (invId: number) => {
    const inv = inventarioDisponible.find(
      (i) => i.id === invId || i.IdInventario === invId,
    );
    if (!inv) return null;

    //Asumimos que el campo de llave foránea se llama DetalleEntrada_id
    const detId = inv.detalleEntradaId || inv.IdDetalleEntrada;
    const det = detallesEntrada.find(
      (d) => d.id === detId || d.IdDetalleEntrada === detId,
    );

    if (!det) return { inv, prod: null, det: null };

    const prodId = det.productoId || det.IdProducto;
    const prod = productos.find(
      (p) => p.id === prodId || p.IdProducto === prodId,
    );

    return { inv, prod, det };
  };

  const getProductNameByInventarioId = (invId: number) => {
    const data = getItemDetails(invId);
    return data?.prod
      ? data.prod.name || data.prod.Nombre
      : "Producto Desconocido";
  };

  const handleSave = async () => {
    if (!selectedInventarioId || !motivo) {
      toast.warning("Debes seleccionar un ítem y especificar un motivo.");
      return;
    }

    if (motivo.trim().length < 15) {
      toast.warning(
        "Por favor, detalla mejor el motivo de rechazo (mínimo 15 caracteres).",
      );
      return;
    }

    const invIdNum = parseInt(selectedInventarioId);
    const itemData = getItemDetails(invIdNum);

    if (!itemData || !itemData.det) {
      toast.error(
        "No se pudo encontrar la información de compra (entrada) de este producto.",
      );
      return;
    }

    //Necesitamos el IdEntradaInventario y el PrecioCompraUnitario
    const idEntrada =
      itemData.det.IdEntradaInventario || itemData.det.entradaInventarioId;
    const precioCompra =
      itemData.det.PrecioCompra || itemData.det.precioCompraUnitario || 0;

    if (!idEntrada) {
      toast.error(
        "El ítem seleccionado no está asociado a una entrada válida.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        IdEntradaInventario: idEntrada,
        usuarioId: userId,
        fechaSolicitud: new Date().toISOString().split("T")[0] + "T00:00:00Z",
        Estado: "Pendiente",
        Observaciones: observaciones, //Campo opcional de la cabecera
        detalles: [
          {
            inventarioId: invIdNum,
            MotivoRechazo: motivo, //El motivo va en el detalle
            PrecioCompraUnitario: precioCompra, //Requerido por el MR
            EstadoItem: "Pendiente",
          },
        ],
      };

      await api.post("/inventario/procesar-devolucion/", payload);
      toast.success("Solicitud de devolución enviada al proveedor.");
      setIsAddOpen(false);
      setSelectedInventarioId("");
      setMotivo("");
      setObservaciones("");
      fetchData();
    } catch (e: any) {
      console.log("ERROR COMPLETO:", e);
      console.log("DATA:", e.response?.data);
      console.log("STATUS:", e.response?.status);

      toast.error(
        e.response?.data?.error ||
          e.response?.data?.detail ||
          "Error desconocido",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = devoluciones.filter(
    (d) =>
      d.id?.toString().includes(searchTerm) ||
      d.IdSolicitudDevolucion?.toString().includes(searchTerm) ||
      (d.Observaciones &&
        d.Observaciones.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Devoluciones a Proveedores
          </h1>
          <p className="text-gray-600">
            Gestión de productos defectuosos sujetos a evaluación
          </p>
        </div>
        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white shadow-md"
        >
          <Plus className="size-4 mr-2" />
          Nueva Solicitud
        </Button>
      </div>

      <Card className="p-6 border-0 shadow-lg">
        <div className="mb-6 flex">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <Input
              placeholder="Buscar por ID o notas..."
              className="pl-10 h-11"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Solicitud</TableHead>
                <TableHead>Entrada Ref.</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado General</TableHead>
                <TableHead>Resp. Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map((d) => {
                  const idSol = d.id || d.IdSolicitudDevolucion;
                  const idEnt =
                    d.IdEntradaInventario || d.entradaInventarioId || "N/A";
                  const estado = d.Estado || d.estado || "Pendiente";

                  return (
                    <TableRow
                      key={idSol}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <TableCell className="font-medium text-slate-800">
                        #{idSol?.toString().padStart(4, "0")}
                      </TableCell>
                      <TableCell>Entrada #{idEnt}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="size-4" />
                          {new Date(d.fecha).toLocaleDateString("en-US")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 text-xs rounded-full font-semibold ${
                            estado === "Aprobada"
                              ? "bg-green-100 text-green-800"
                              : estado === "Rechazada"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {estado}
                        </span>
                      </TableCell>
                      <TableCell>
                        Usuario ID: {d.IdUsuario || d.usuarioId}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-gray-500"
                  >
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
              Solicitar Devolución
            </DialogTitle>
            <DialogDescription className="sr-only">
              Selecciona el ítem e indica el motivo de rechazo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-md mb-2">
              <div className="flex items-start">
                <AlertCircle className="size-5 text-amber-500 mr-2 mt-0.5" />
                <p className="text-xs text-amber-700">
                  El ítem debe estar en estado Disponible o Dañado. La solicitud
                  quedará como Pendiente para el proveedor.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ítem Físico (Inventario)</Label>
              <Select
                value={selectedInventarioId}
                onValueChange={setSelectedInventarioId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el ítem..." />
                </SelectTrigger>
                <SelectContent>
                  {inventarioDisponible.map((inv) => {
                    const id = inv.id || inv.IdInventario;
                    return (
                      <SelectItem key={id} value={id.toString()}>
                        Item #{id} - {getProductNameByInventarioId(id)}
                      </SelectItem>
                    );
                  })}
                  {inventarioDisponible.length === 0 && (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      No hay ítems disponibles para devolver.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Motivo de Rechazo (Detalle Ítem)</Label>
              <Textarea
                placeholder="Ej. El empaque vino roto desde la caja de origen..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <p className="text-xs text-slate-500 text-right">
                {motivo.length}/15 min.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Observaciones Generales (Opcional)</Label>
              <Input
                placeholder="Notas adicionales para la solicitud..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={
                  isSubmitting || !selectedInventarioId || motivo.length < 15
                }
                onClick={handleSave}
                className="bg-slate-800 hover:bg-slate-900 text-white"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin size-4 mr-2" />
                ) : (
                  <Check className="size-4 mr-2" />
                )}
                Crear Solicitud
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
