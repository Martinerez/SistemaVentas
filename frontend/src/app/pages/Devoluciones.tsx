import {
  Plus,
  Search,
  Check,
  Loader2,
  Calendar,
  CornerDownLeft,
  AlertCircle,
  Eye,
  XCircle,
  CheckCircle2
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

  // Detalles modal states
  const [selectedDevolucion, setSelectedDevolucion] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUpdatingState, setIsUpdatingState] = useState(false);

  //Form states
  const [motivo, setMotivo] = useState("");
  const [observaciones, setObservaciones] = useState(""); // Nuevo campo para la cabecera
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("");
  const [cantidadADevolver, setCantidadADevolver] = useState<number>(1);

  const { userId } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [devolucionesRes, invRes, prodRes, detRes] = await Promise.all([
        api.get("/inventario/solicitudes-devolucion/"),
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

  // Agrupa productos por producto y entrada de inventario
  const getAvailableGroups = () => {
    const groups: Record<string, any> = {};
    inventarioDisponible.forEach((inv) => {
      const data = getItemDetails(inv.id || inv.IdInventario);
      if (!data || !data.prod || !data.det) return;

      const prodId = data.prod.id || data.prod.IdProducto;
      const entradaId = data.det.IdEntradaInventario || data.det.entradaInventarioId;
      const key = `${prodId}-${entradaId}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          prodId,
          entradaId,
          nombre: data.prod.name || data.prod.Nombre,
          precioCompra: data.det.PrecioCompra || data.det.precioCompraUnitario || 0,
          items: []
        };
      }
      groups[key].items.push(inv);
    });
    return Object.values(groups);
  };

  const handleSave = async () => {
    if (!selectedGroupKey || !motivo) {
      toast.warning("Debes seleccionar un ítem y especificar un motivo.");
      return;
    }

    if (motivo.trim().length < 15) {
      toast.warning(
        "Por favor, detalla mejor el motivo de rechazo (mínimo 15 caracteres).",
      );
      return;
    }

    const availableGroups = getAvailableGroups();
    const group = availableGroups.find(g => g.key === selectedGroupKey);

    if (!group) {
      toast.error("El grupo de productos seleccionado no es válido.");
      return;
    }

    if (group.items.length < cantidadADevolver || cantidadADevolver < 1) {
      toast.error("Cantidad inválida o superior al stock disponible.");
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsToReturn = group.items.slice(0, cantidadADevolver);

      const detalles = itemsToReturn.map((inv: any) => ({
        inventarioId: inv.id || inv.IdInventario,
        MotivoRechazo: motivo,
        PrecioCompraUnitario: group.precioCompra,
        EstadoItem: "Pendiente",
      }));

      const payload = {
        IdEntradaInventario: group.entradaId,
        usuarioId: userId,
        fechaSolicitud: new Date().toISOString().split("T")[0] + "T00:00:00Z",
        Estado: "Pendiente",
        Observaciones: observaciones,
        detalles: detalles,
      };

      await api.post("/inventario/procesar-devolucion/", payload);
      toast.success("Solicitud de devolución enviada al proveedor.");
      setIsAddOpen(false);
      setSelectedGroupKey("");
      setCantidadADevolver(1);
      setMotivo("");
      setObservaciones("");
      fetchData();
    } catch (e: any) {
      console.log("ERROR COMPLETO:", e);
      toast.error(
        e.response?.data?.error ||
        e.response?.data?.detail ||
        "Error desconocido",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetails = (devolucion: any) => {
    setSelectedDevolucion(devolucion);
    setIsDetailOpen(true);
  };

  const handleChangeState = async (nuevoEstado: string) => {
    if (!selectedDevolucion) return;
    setIsUpdatingState(true);
    try {
      const id = selectedDevolucion.id || selectedDevolucion.IdSolicitudDevolucion;

      // 1. PATCH request para actualizar estado
      await api.patch(`/inventario/solicitudes-devolucion/${id}/`, {
        estado: nuevoEstado,
      });

      // 2. Si es 'Aceptada', POST para devolver el stock
      if (nuevoEstado === "Aceptada") {
        await api.post(`/inventario/devolver-stock/`, {
          solicitud_id: id,
        });
        toast.success("Solicitud aprobada y stock devuelto exitosamente.");
      } else {
        toast.success(`Solicitud ${nuevoEstado.toLowerCase()} exitosamente.`);
      }

      setIsDetailOpen(false);
      setSelectedDevolucion(null);
      fetchData(); // Recargar datos para ver los cambios
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Error al actualizar el estado");
    } finally {
      setIsUpdatingState(false);
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
            Gestión de productos defectuosos sujetos a devolución
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
              placeholder="Buscar por ID..."
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
                <TableHead>Producto</TableHead>
                <TableHead>Cant.</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map((d) => {
                  const idSol = d.id || d.IdSolicitudDevolucion;
                  const estado = d.Estado || d.estado || "Pendiente";
                  const primerDetalle = d.detalles?.[0];

                  return (
                    <TableRow
                      key={idSol}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(d)}
                    >
                      <TableCell className="font-medium text-slate-800">
                        #{idSol?.toString().padStart(4, "0")}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={primerDetalle?.productoNombre}>
                        {primerDetalle?.productoNombre || "N/A"}
                      </TableCell>
                      <TableCell>
                        {d.detalles?.length || 0}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={primerDetalle?.motivoRechazo}>
                        {primerDetalle?.motivoRechazo || "Sin motivo"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="size-4" />
                          {new Date(d.fecha || d.Fecha).toLocaleDateString("es-ES")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 text-xs rounded-full font-semibold ${estado === "Aceptada" || estado === "Aprobada"
                            ? "bg-green-100 text-green-800"
                            : estado === "Rechazada"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {estado === "Aceptada" ? "Aprobada" : estado}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium">
                        {d.usuarioNombre || `ID: ${d.usuarioId || d.IdUsuario}`}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
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

      {/* MODAL DETALLE DEVOLUCION */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Eye className="size-5" />
              Detalle de Devolución
            </DialogTitle>
            <DialogDescription>
              Información de la solicitud #{selectedDevolucion?.id || selectedDevolucion?.IdSolicitudDevolucion}
            </DialogDescription>
          </DialogHeader>
          {selectedDevolucion && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-slate-600 block">Producto:</span>
                  <span className="text-slate-800">{selectedDevolucion.detalles?.[0]?.productoNombre || "N/A"}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-600 block">Cantidad:</span>
                  <span className="text-slate-800">{selectedDevolucion.detalles?.length || 0}</span>
                </div>
                <div className="col-span-2">
                  <span className="font-semibold text-slate-600 block">Motivo de solicitud:</span>
                  <p className="text-slate-800 bg-slate-50 p-2 rounded border mt-1">
                    {selectedDevolucion.detalles?.[0]?.motivoRechazo || "Sin motivo registrado"}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-600 block">Fecha de Solicitud:</span>
                  <span className="text-slate-800">
                    {new Date(selectedDevolucion.fecha || selectedDevolucion.Fecha).toLocaleString("es-ES")}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-600 block">Estado Actual:</span>
                  <span className={`px-2 py-1 mt-1 inline-block text-xs rounded-full font-semibold ${(selectedDevolucion.estado || selectedDevolucion.Estado) === "Aceptada" || (selectedDevolucion.estado || selectedDevolucion.Estado) === "Aprobada"
                    ? "bg-green-100 text-green-800"
                    : (selectedDevolucion.estado || selectedDevolucion.Estado) === "Rechazada"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                    }`}>
                    {(selectedDevolucion.estado || selectedDevolucion.Estado) === "Aceptada" ? "Aprobada" : (selectedDevolucion.estado || selectedDevolucion.Estado) || "Pendiente"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-600 block">Registrado por:</span>
                  <span className="text-slate-800">{selectedDevolucion.usuarioNombre || "N/A"}</span>
                </div>
              </div>

              {(selectedDevolucion.estado || selectedDevolucion.Estado) === "Pendiente" ? (
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => handleChangeState("Rechazada")}
                    disabled={isUpdatingState}
                  >
                    {isUpdatingState ? <Loader2 className="animate-spin size-4 mr-2" /> : <XCircle className="size-4 mr-2" />}
                    Rechazar
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleChangeState("Aceptada")}
                    disabled={isUpdatingState}
                  >
                    {isUpdatingState ? <Loader2 className="animate-spin size-4 mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
                    Aprobar devolución
                  </Button>
                </div>
              ) : (
                <div className="bg-slate-50 border p-3 rounded-md mt-6 text-center text-sm text-slate-500">
                  Esta devolución ya fue procesada y no puede ser modificada.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <CornerDownLeft className="size-5" />
              Solicitar Devolución
            </DialogTitle>
            <DialogDescription className="sr-only">
              Selecciona el producto, indica la cantidad y el motivo de rechazo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-md mb-2">
              <div className="flex items-start">
                <AlertCircle className="size-5 text-amber-500 mr-2 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Los productos aquí listados son los que aún tienen stock en inventario. La solicitud
                  quedará como Pendiente para el proveedor y el stock se retendrá.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Producto</Label>
              <Select
                value={selectedGroupKey}
                onValueChange={(val) => {
                  setSelectedGroupKey(val);
                  setCantidadADevolver(1); // Resetear cantidad al cambiar de producto
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un producto..." />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableGroups().map((group: any) => (
                    <SelectItem key={group.key} value={group.key}>
                      {group.nombre} - Compra #{group.entradaId} ({group.items.length} disp.)
                    </SelectItem>
                  ))}
                  {getAvailableGroups().length === 0 && (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      No hay productos disponibles para devolver.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedGroupKey && (
              <div className="space-y-2">
                <Label>Cantidad a Devolver</Label>
                <Input
                  type="number"
                  min={1}
                  max={getAvailableGroups().find(g => g.key === selectedGroupKey)?.items.length || 1}
                  value={cantidadADevolver}
                  onChange={(e) => setCantidadADevolver(parseInt(e.target.value))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo de solicitud</Label>
              <Textarea
                placeholder="Ej. El producto venía vencido..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <p className="text-xs text-slate-500 text-right">
                {motivo.length}/15 min.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Observaciones Generales (Detalles)</Label>
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
                  isSubmitting || !selectedGroupKey || motivo.length < 15 || cantidadADevolver < 1
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