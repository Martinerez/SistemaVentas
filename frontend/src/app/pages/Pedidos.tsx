import { useEffect, useState } from "react";
import api from "../api/axiosInstance";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Search, Store, Phone, Plus, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { useAuth } from "../contexts/AuthContext";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

/* =========================
   TIPOS (con serializer nuevo)
========================= */

interface Proveedor {
  id: number;
  name: string;
  contact: string | null;
  status: string;

  // NUEVO serializer
  pedidos_recientes: number;
  activo: boolean;
}

/* =========================
   COMPONENTE
========================= */

export function Pedidos() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const [modalProveedor, setModalProveedor] = useState(false);
  const [modalPedido, setModalPedido] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  const [nuevoProveedor, setNuevoProveedor] = useState({
    name: "",
    contact: "",
  });

  const [entradas, setEntradas] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);

  const [isAddMode, setIsAddMode] = useState(false);

  const { userId } = useAuth();

  const [selectedProveedor, setSelectedProveedor] = useState("");

  // FORM PRODUCTO (CORRECTO)
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [totalPagado, setTotalPagado] = useState("");

  const [productosPedido, setProductosPedido] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* =========================
     FETCH
  ========================= */

  const fetchEntradas = async () => {
    const { data } = await api.get(
      "http://localhost:8000/api/inventario/entradas/",
    );
    setEntradas(data.results ?? data);
  };

  const fetchInventario = async () => {
    const { data } = await api.get(
      "http://localhost:8000/api/inventario/inventarios/",
    );
    setInventario(data.results ?? data);
  };

  const fetchProveedores = async () => {
    try {
      const res = await api.get(
        "http://localhost:8000/api/catalogo/proveedores/",
      );

      const data = res.data.results ?? res.data;
      setProveedores(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar proveedores");
    }
  };

  const fetchProductos = async () => {
    const { data } = await api.get(
      "http://localhost:8000/api/catalogo/productos/",
    );
    setProductos(data.results ?? data);
  };

  useEffect(() => {
    fetchEntradas();
    fetchInventario();
    fetchProveedores();
    fetchProductos();
  }, []);

  /* =========================
     FILTRO
  ========================= */

  const proveedoresFiltrados = proveedores.filter((p) => {
    const t = busqueda.toLowerCase();

    return (
      p.name.toLowerCase().includes(t) ||
      (p.contact ?? "").toLowerCase().includes(t)
    );
  });

  /* =========================
     AGREGAR PROVEEDOR
  ========================= */

  const agregarProveedor = async () => {
    if (!nuevoProveedor.name) {
      toast.error("Nombre requerido");
      return;
    }

    try {
      await api.post(
        "http://localhost:8000/api/catalogo/proveedores/",
        nuevoProveedor,
      );

      toast.success("Proveedor agregado");

      setNuevoProveedor({ name: "", contact: "" });
      setModalProveedor(false);
      setModalPedido(false);

      setSuccessMessage(true);
      setTimeout(() => setSuccessMessage(false), 2500);

      fetchProveedores();
    } catch (e) {
      toast.error("Error al crear proveedor");
    }
  };

  // AGREGAR PRODUCTO
  const agregarProducto = () => {
    if (!productoId || !cantidad || !totalPagado) return;

    const producto = productos.find((p) => p.id.toString() === productoId);
    if (!producto) return;

    const nuevo = {
      id: Date.now(),
      productoId,
      nombre: producto.name,
      cantidad: Number(cantidad),
      totalPagado: Number(totalPagado),
      precioUnitario: Number(totalPagado) / Number(cantidad),
    };

    setProductosPedido([...productosPedido, nuevo]);

    // limpiar inputs
    setProductoId("");
    setCantidad("");
    setTotalPagado("");
  };

  // ELIMINAR PRODUCTO (NUEVO)
  const eliminarProductoPedido = (index: number) => {
    const updated = productosPedido.filter((_, i) => i !== index);
    setProductosPedido(updated);
  };

  const calcTotal = () =>
    productosPedido.reduce((sum, p) => sum + p.totalPagado, 0);

  const handleSubmit = async () => {
    if (!selectedProveedor || productosPedido.length === 0) {
      toast.error("Completa los campos");
      return;
    }

    try {
      const total = calcTotal();

      const { data: entrada } = await api.post(
        "http://localhost:8000/api/inventario/entradas/",
        {
          proveedorId: Number(selectedProveedor),
          usuarioId: userId,
          fechaEntrada: new Date().toISOString(),
          total,
        },
      );

      for (const p of productosPedido) {
        const { data: det } = await api.post(
          "http://localhost:8000/api/inventario/detalles-entrada/",
          {
            entradaInventarioId: entrada.id,
            productoId: Number(p.productoId),
            cantidad: p.cantidad,
            precioCompraUnitario: p.precioUnitario,
          },
        );
      }

      toast.success("Pedido creado");
      setProductosPedido([]);
      setIsAddMode(false);
    } catch (e) {
      toast.error("Error al guardar");
    }
  };

  /* =========================
     UI
  ========================= */

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Proveedores</h1>
          <p className="text-gray-500">
            Gestión de proveedores y actividad reciente
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => setModalProveedor(true)}
            className="bg-gradient-to-r from-blue-800 to-slate-900"
          >
            <Plus className="size-4 mr-2" />
            Agregar Proveedor
          </Button>

          <Button
            onClick={() => setModalPedido(true)}
            className="bg-gradient-to-r from-green-500 to-green-700"
          >
            <Plus className="size-4 mr-2" />
            Nuevo Pedido
          </Button>
        </div>
      </div>

      {/* SUCCESS */}
      {successMessage && (
        <Card className="p-4 bg-green-50 border border-green-200">
          <div className="flex items-center gap-2">
            <Check className="text-green-600" />
            <p className="text-green-700 font-medium">
              Proveedor creado correctamente
            </p>
          </div>
        </Card>
      )}

      {/* SEARCH */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400 size-5" />
          <Input
            placeholder="Buscar proveedor..."
            className="pl-10"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </Card>

      {/* LISTA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {proveedoresFiltrados.map((p) => (
          <Card key={p.id} className="p-4 space-y-2 hover:shadow-md transition">
            {/* HEADER CARD */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Store className="text-slate-700" />
                <p className="font-bold text-slate-800">{p.name}</p>
              </div>

              {/* 🔥 ACTIVO INDICADOR */}
              <span
                className={`size-3 rounded-full ${
                  p.activo ? "bg-green-500" : "bg-gray-300"
                }`}
              />
            </div>

            {/* CONTACTO */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Phone className="size-3.5" />
              {p.contact ?? "Sin contacto"}
            </div>

            {/* PEDIDOS RECIENTES */}
            <p className="text-xs text-gray-600">
              Pedidos recientes (30 días):{" "}
              <span className="font-semibold">{p.pedidos_recientes}</span>
            </p>
          </Card>
        ))}
      </div>

      {/* =========================
          MODAL PROVEEDOR
      ========================= */}

      <Dialog open={modalProveedor} onOpenChange={setModalProveedor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Proveedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del proveedor</Label>
              <Input
                id="nombre"
                value={nuevoProveedor.name}
                onChange={(e) =>
                  setNuevoProveedor({
                    ...nuevoProveedor,
                    name: e.target.value,
                  })
                }
                placeholder="Ej: Distribuidora ABC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contacto">Número de contacto</Label>
              <Input
                id="contacto"
                value={nuevoProveedor.contact}
                onChange={(e) =>
                  setNuevoProveedor({
                    ...nuevoProveedor,
                    contact: e.target.value,
                  })
                }
                placeholder="Ej: 8888-9999"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalProveedor(false)}>
              Cancelar
            </Button>
            <Button onClick={agregarProveedor}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================
          MODAL PEDIDO
      ========================= */}

      <Dialog open={modalPedido} onOpenChange={setModalPedido}>
        <DialogContent className="w-[90vw] max-w-5xl h-[85vh] overflow-y-auto flex flex-col">
          <DialogHeader>
            <DialogTitle>Nuevo pedido</DialogTitle>
          </DialogHeader>

          {/* CONTENEDOR PRINCIPAL (igual estilo que tu Card exitoso) */}
          <Card className="p-6 space-y-6 w-full">
            {/* ========================= PROVEEDOR ========================= */}
            <Select
              value={selectedProveedor}
              onValueChange={setSelectedProveedor}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Proveedor" />
              </SelectTrigger>

              <SelectContent>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* ========================= PRODUCTOS ========================= */}
            <div className="border border-slate-200 rounded-lg p-4 space-y-4">
              <h3 className="font-bold">Agregar productos</h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={productoId} onValueChange={setProductoId}>
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="Producto" />
                  </SelectTrigger>

                  <SelectContent>
                    {productos.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  placeholder="Cantidad"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="h-11"
                />

                <Input
                  type="number"
                  placeholder="Total pagado"
                  value={totalPagado}
                  onChange={(e) => setTotalPagado(e.target.value)}
                  className="h-11"
                />

                <Input
                  disabled
                  className="h-11 bg-gray-50"
                  value={
                    cantidad && totalPagado
                      ? `C$${(Number(totalPagado) / Number(cantidad)).toFixed(2)}`
                      : "C$0.00"
                  }
                />
              </div>

              <Button onClick={agregarProducto}>
                <Plus className="size-4 mr-2" />
                Agregar al pedido
              </Button>
            </div>

            {/* ========================= LISTA ========================= */}
            {productosPedido.length > 0 && (
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-bold">Productos del pedido</h3>

                {productosPedido.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center bg-slate-50 p-3 rounded"
                  >
                    <div>
                      <p className="font-semibold">{p.nombre}</p>
                      <p className="text-sm text-gray-500">
                        Cant: {p.cantidad}
                      </p>
                    </div>

                    <div className="text-right">
                      <p>C${p.totalPagado}</p>
                      <p className="text-xs text-gray-500">
                        C${p.precioUnitario} unit
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      onClick={() => eliminarProductoPedido(i)}
                    >
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* ========================= TOTAL ========================= */}
            <div className="flex justify-between border-t pt-4">
              <p className="font-bold">Total: ${calcTotal().toFixed(2)}</p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setModalPedido(false);
                    setProductosPedido([]);
                    setProductoId("");
                    setCantidad("");
                    setTotalPagado("");
                    setSelectedProveedor("");
                  }}
                >
                  Cancelar
                </Button>

                <Button onClick={handleSubmit}>
                  <Check className="size-4 mr-2" />
                  Guardar pedido
                </Button>
              </div>
            </div>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
}
