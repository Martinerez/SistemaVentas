import { Plus, Search, Check, Loader2, Pencil, Trash2, ShieldCheck, User } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

export function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state — shared between add and edit
  const [formNombre, setFormNombre] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRol, setFormRol] = useState("vendedor");
  const [formEstado, setFormEstado] = useState("Activo");

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const { data } = await api.get("/usuarios/usuarios/");
      const arr = data.results ?? data;
      setUsuarios(Array.isArray(arr) ? arr : []);
    } catch (e) {
      toast.error("Error al cargar usuarios.");
    }
  };

  const resetForm = () => {
    setFormNombre(""); setFormEmail(""); setFormPassword("");
    setFormRol("vendedor"); setFormEstado("Activo");
  };

  const handleOpenAdd = () => { resetForm(); setIsAddOpen(true); };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setFormNombre(user.nombre || "");
    setFormEmail(user.email || "");
    setFormPassword("");
    setFormRol(user.rol || "vendedor");
    setFormEstado(user.estado || "Activo");
    setIsEditOpen(true);
  };

  const handleSaveAdd = async () => {
    if (!formNombre || !formEmail || !formPassword) {
      toast.warning("Nombre, email y contraseña son obligatorios.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/usuarios/usuarios/", {
        nombre: formNombre, email: formEmail,
        password: formPassword, rol: formRol, estado: formEstado,
      });
      toast.success("Usuario creado exitosamente.");
      setIsAddOpen(false);
      fetchUsuarios();
    } catch (e: any) {
      toast.error(e.response?.data?.email?.[0] || "Error al crear usuario.");
    } finally { setIsSubmitting(false); }
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setIsSubmitting(true);
    const payload: any = { nombre: formNombre, rol: formRol, estado: formEstado };
    if (formPassword) payload.password = formPassword;
    try {
      await api.patch(`/usuarios/usuarios/${editingUser.id}/`, payload);
      toast.success("Usuario actualizado.");
      setIsEditOpen(false);
      fetchUsuarios();
    } catch (e) { toast.error("Error al actualizar usuario."); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/usuarios/usuarios/${id}/`);
      toast.success("Usuario eliminado.");
      fetchUsuarios();
    } catch (e) { toast.error("Error al eliminar el usuario."); }
  };

  const filtered = usuarios.filter(u =>
    u.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Shared form fields rendered as plain JSX (NOT a nested component) ──────
  const roleSelector = (
    <div className="space-y-2">
      <Label>Rol</Label>
      <Select value={formRol} onValueChange={setFormRol}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Administrador</SelectItem>
          <SelectItem value="vendedor">Vendedor</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const estadoSelector = (
    <div className="space-y-2">
      <Label>Estado</Label>
      <Select value={formEstado} onValueChange={setFormEstado}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Activo">Activo</SelectItem>
          <SelectItem value="Inactivo">Inactivo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Usuarios</h1>
          <p className="text-gray-600">Administra el acceso al sistema</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950">
          <Plus className="size-4 mr-2" /> Agregar Usuario
        </Button>
      </div>

      <Card className="p-6 border-0 shadow-lg">
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
          <Input placeholder="Buscar por nombre o email..." className="pl-10 h-11" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? filtered.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="size-8 bg-slate-100 rounded-full flex items-center justify-center">
                        {u.rol === "admin" ? <ShieldCheck className="size-4 text-slate-700" /> : <User className="size-4 text-slate-500" />}
                      </div>
                      <span className="font-medium text-slate-800">{u.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{u.email}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold capitalize ${u.rol === 'admin' ? 'bg-slate-800 text-white' : 'bg-blue-100 text-blue-800'}`}>
                      {u.rol === "admin" ? "Administrador" : "Vendedor"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${u.estado === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {u.estado}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(u)}><Pencil className="size-4 text-slate-600" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id, u.nombre)}><Trash2 className="size-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-gray-500">No se encontraron usuarios.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ── Add Modal ──────────────────────────────────────────────────────── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Usuario</DialogTitle>
            <DialogDescription className="sr-only">Formulario para registrar un nuevo usuario en el sistema.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input value={formNombre} onChange={e => setFormNombre(e.target.value)} placeholder="Ej: Juan García" />
            </div>
            <div className="space-y-2">
              <Label>Correo Electrónico</Label>
              <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {roleSelector}
              {estadoSelector}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button disabled={isSubmitting} onClick={handleSaveAdd}>
                {isSubmitting ? <Loader2 className="animate-spin size-4 mr-2" /> : <Check className="size-4 mr-2" />}
                Crear Usuario
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription className="sr-only">Formulario para editar los datos del usuario seleccionado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input value={formNombre} onChange={e => setFormNombre(e.target.value)} placeholder="Ej: Juan García" />
            </div>
            <div className="space-y-2">
              <Label>Nueva Contraseña (dejar vacío para no cambiar)</Label>
              <Input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {roleSelector}
              {estadoSelector}
            </div>
            <div className="flex justify-end gap-3 pt-2">
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
