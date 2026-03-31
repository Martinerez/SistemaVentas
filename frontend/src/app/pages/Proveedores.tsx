import { Plus, Search, Truck, Pencil, Trash2, Check, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { useState, useEffect } from "react";
import api from "../api/axiosInstance";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export function Proveedores() {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<any>(null);

  // Form State
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [estado, setEstado] = useState("Activo");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    try {
      const response = await api.get("http://localhost:8000/api/catalogo/proveedores/");
      const data = response.data.results ?? response.data;
      setProveedores(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching proveedores:", error);
      toast.error("Error al cargar proveedores.");
    }
  };

  const handleOpenAdd = () => {
    setNombre("");
    setContacto("");
    setEstado("Activo");
    setIsAddOpen(true);
  };

  const handleOpenEdit = (proveedor: any) => {
    setEditingProveedor(proveedor);
    setNombre(proveedor.nombre);
    setContacto(proveedor.contacto || "");
    setEstado(proveedor.estado || "Activo");
    setIsEditOpen(true);
  };

  const handleSaveAdd = async () => {
    if (!nombre.trim()) {
      toast.error("El nombre es requerido.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("http://localhost:8000/api/catalogo/proveedores/", {
        nombre,
        contacto,
        estado
      });
      toast.success("Proveedor agregado con éxito.");
      setIsAddOpen(false);
      fetchProveedores();
    } catch (error) {
      console.error("Error adding proveedor:", error);
      toast.error("Error al agregar proveedor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!nombre.trim() || !editingProveedor) {
      toast.error("El nombre es requerido.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.patch(`http://localhost:8000/api/catalogo/proveedores/${editingProveedor.id}/`, {
        nombre,
        contacto,
        estado
      });
      toast.success("Proveedor actualizado con éxito.");
      setIsEditOpen(false);
      setEditingProveedor(null);
      fetchProveedores();
    } catch (error) {
      console.error("Error editing proveedor:", error);
      toast.error("Error al actualizar proveedor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar este proveedor?")) {
      try {
        await api.delete(`http://localhost:8000/api/catalogo/proveedores/${id}/`);
        toast.success("Proveedor eliminado con éxito.");
        fetchProveedores();
      } catch (error) {
        console.error("Error deleting proveedor:", error);
        toast.error("Error al eliminar proveedor. Es posible que tenga dependencias.");
      }
    }
  };

  const filteredProveedores = proveedores.filter(p => 
    p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.contacto?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Proveedores</h1>
          <p className="text-gray-600">Gestión de proveedores del negocio</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-gradient-to-r from-blue-800 to-slate-900 hover:from-blue-900 hover:to-slate-950">
          <Plus className="size-4 mr-2" />
          Agregar Proveedor
        </Button>
      </div>

      <Card className="p-6 border-0 shadow-lg">
        <div className="mb-6 flex">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <Input 
              placeholder="Buscar proveedor..." 
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
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProveedores.length > 0 ? (
                filteredProveedores.map((proveedor) => (
                  <TableRow key={proveedor.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-slate-800">
                      #{proveedor.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-semibold text-slate-700">
                        <Truck className="size-4 text-blue-600"/>
                        {proveedor.nombre}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{proveedor.contacto || "N/A"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full font-semibold ${proveedor.estado === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {proveedor.estado || "Activo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(proveedor)}>
                        <Pencil className="size-4 text-slate-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(proveedor.id)}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No se encontraron proveedores.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Agregar Modales de Formulario */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Agregar Proveedor</DialogTitle>
            <DialogDescription className="sr-only">Rellena los datos para registrar un nuevo proveedor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nombre del Proveedor</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Distribuidora SA" />
            </div>
            <div className="space-y-2">
              <Label>Información de Contacto</Label>
              <Input value={contacto} onChange={e => setContacto(e.target.value)} placeholder="Ej: Juan Pérez / 555-1234" />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button disabled={isSubmitting} onClick={handleSaveAdd}>
                {isSubmitting ? <Loader2 className="animate-spin size-4 mr-2" /> : <Check className="size-4 mr-2" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Proveedor</DialogTitle>
            <DialogDescription className="sr-only">Modifica los datos del proveedor seleccionado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nombre del Proveedor</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Distribuidora SA" />
            </div>
            <div className="space-y-2">
              <Label>Información de Contacto</Label>
              <Input value={contacto} onChange={e => setContacto(e.target.value)} placeholder="Ej: Juan Pérez / 555-1234" />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
              <Button disabled={isSubmitting} onClick={handleSaveEdit}>
                {isSubmitting ? <Loader2 className="animate-spin size-4 mr-2" /> : <Check className="size-4 mr-2" />}
                Actualizar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
