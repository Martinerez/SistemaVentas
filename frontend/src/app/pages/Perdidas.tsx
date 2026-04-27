import {
  Plus,
  Search,
  TrendingDown,
  ClipboardList,
  Check,
  Loader2,
  Calendar,
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

import { Filter, Edit, Trash2, Package, Eye, Pencil } from "lucide-react";

export function Perdidas() {
  const [perdidas, setPerdidas] = useState<any[]>([]);
  const [inventarioDisponible, setInventarioDisponible] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [detallesEntrada, setDetallesEntrada] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [tipoPerdida, setTipoPerdida] = useState("Vencimiento");
  const [selectedInventarioId, setSelectedInventarioId] = useState<string>("");

  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPerdida, setSelectedPerdida] = useState<any>(null);

  const { userId } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [perdidasRes, invRes, prodRes, detRes] = await Promise.all([
        api.get("/inventario/perdidas/"),
        api.get("/inventario/inventarios/"),
        api.get("/catalogo/productos/"),
        api.get("/inventario/detalles-entrada/"),
      ]);
      const perdidas = perdidasRes.data.results ?? perdidasRes.data;
      const inventario = invRes.data.results ?? invRes.data;
      const productos = prodRes.data.results ?? prodRes.data;
      const detalles = detRes.data.results ?? detRes.data;
      setPerdidas(Array.isArray(perdidas) ? perdidas : []);
      setProductos(Array.isArray(productos) ? productos : []);
      setDetallesEntrada(Array.isArray(detalles) ? detalles : []);
      setInventarioDisponible(
        (Array.isArray(inventario) ? inventario : []).filter(
          (i: any) => i.estado === "Disponible",
        ),
      );
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar datos.");
    }
  };

  const getProductNameByInventarioId = (invId: number) => {
    const inv = inventarioDisponible.find((i) => i.id === invId);
    if (!inv) return "Desconocido";
    const det = detallesEntrada.find((d) => d.id === inv.detalleEntradaId);
    if (!det) return "Desconocido";
    const prod = productos.find((p) => p.id === det.productoId);
    return prod ? prod.name : "Desconocido";
  };

  const getProductPriceByInventarioId = (invId: number) => {
    const inv = inventarioDisponible.find((i) => i.id === invId);
    if (!inv) return 0;
    const det = detallesEntrada.find((d) => d.id === inv.detalleEntradaId);
    return det ? Number(det.precioCompraUnitario) : 0;
  };

  const handleSave = async () => {
    if (!selectedInventarioId) {
      toast.warning("Debes seleccionar un ítem del inventario.");
      return;
    }
    setIsSubmitting(true);
    try {
      const invIdNum = parseInt(selectedInventarioId);
      const precioPerdido = getProductPriceByInventarioId(invIdNum);

      const payload = {
        usuarioId: userId,
        tipoPerdida: tipoPerdida,
        fecha: new Date().toISOString(),
        total: precioPerdido,
        detalles: [
          {
            inventarioId: invIdNum,
            precioCompraUnitario: precioPerdido,
          },
        ],
      };

      await api.post("/inventario/procesar-perdida/", payload);

      toast.success("Pérdida registrada exitosamente.");
      setIsAddOpen(false);
      setSelectedInventarioId("");
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(
        e.response?.data?.error || "Ocurrió un error al reportar la pérdida.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = perdidas.filter(
    (p) =>
      p.id.toString().includes(searchTerm) ||
      p.tipoPerdida.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Control de Pérdidas
          </h1>
          <p className="text-gray-600">
            Registro de mermas, productos vencidos o dañados
          </p>
        </div>
        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white shadow-md"
        >
          <Plus className="size-4 mr-2" />
          Reportar Pérdida
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
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Registro</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Motivo / Tipo</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead className="text-right">Pérdida (C$)</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="hover:bg-red-50 transition-colors"
                  >
                    <TableCell className="font-medium text-slate-800">
                      #{p.id.toString().padStart(4, "0")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="size-4" />
                        {new Date(p.fecha).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 text-xs rounded-full font-semibold bg-red-100 text-red-800">
                        {p.tipoPerdida}
                      </span>
                    </TableCell>
                    <TableCell>
                      {p.usuarioNombre} ({p.usuarioRol})
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      -C${Number(p.total).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPerdida(p);
                            setIsViewOpen(true);
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-gray-500"
                  >
                    No se encontraron registros de pérdidas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      {/* Modal view detalle perdida */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              Detalle de Pérdida #{selectedPerdida?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/*  LISTA DE DETALLES */}
            {selectedPerdida?.detalles?.length > 0 ? (
              selectedPerdida.detalles.map((d: any, index: number) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  {/* Producto */}
                  <div>
                    <Label className="font-semibold text-slate-800">
                      Producto
                    </Label>
                    <p className="text-gray-700">{d.productoNombre}</p>
                  </div>

                  {/* Cantidad */}
                  <div>
                    <Label className="font-semibold text-slate-800">
                      Cantidad
                    </Label>
                    <p className="text-gray-700">1</p>
                  </div>

                  {/* Precio */}
                  <div>
                    <Label className="font-semibold text-slate-800">
                      Precio Unitario
                    </Label>
                    <p className="text-gray-700">
                      C${Number(d.precioCompraUnitario).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">
                No hay detalles para esta pérdida.
              </p>
            )}

            {/*  TOTAL ABAJO */}
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-semibold text-slate-800">
                Total Perdido:
              </span>
              <span className="font-bold text-red-600 text-lg">
                -C${Number(selectedPerdida?.total || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <TrendingDown className="size-5" />
              Reportar Nueva Pérdida
            </DialogTitle>
            <DialogDescription className="sr-only">
              Selecciona el ítem del inventario afectado y el tipo de pérdida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Ítem de Inventario (Disponible)</Label>
              <Select
                value={selectedInventarioId}
                onValueChange={setSelectedInventarioId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el ítem dañado..." />
                </SelectTrigger>
                <SelectContent>
                  {inventarioDisponible.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id.toString()}>
                      Item #{inv.id} - {getProductNameByInventarioId(inv.id)}
                    </SelectItem>
                  ))}
                  {inventarioDisponible.length === 0 && (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      No hay ítems disponibles.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Motivo de la Pérdida</Label>
              <Select value={tipoPerdida} onValueChange={setTipoPerdida}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vencimiento">Vencimiento</SelectItem>
                  <SelectItem value="Dañado">Dañado / Roto</SelectItem>
                  <SelectItem value="Robo">Robo o Extravío</SelectItem>
                  <SelectItem value="Uso Interno">Uso Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedInventarioId && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center text-sm">
                <span className="text-red-800 font-medium">
                  Costo de Merma:
                </span>
                <span className="text-red-700 font-bold">
                  C$
                  {getProductPriceByInventarioId(
                    parseInt(selectedInventarioId),
                  ).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={isSubmitting || !selectedInventarioId}
                onClick={handleSave}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin size-4 mr-2" />
                ) : (
                  <Check className="size-4 mr-2" />
                )}
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
