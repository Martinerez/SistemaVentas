import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useState } from "react";
import api from "../api/axiosInstance";
import { toast } from "sonner";
import { Loader2, Save, UserCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function Ajustes() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { userId } = useAuth();

  const handlePasswordChange = async () => {
    if (!password || !confirmPassword) {
      toast.warning("Por favor completa los campos de contraseña.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.patch(`http://localhost:8000/api/usuarios/usuarios/${userId}/`, {
        password: password
      });
      toast.success("Contraseña actualizada exitosamente.");
      setPassword("");
      setConfirmPassword("");
    } catch (e) {
      console.error(e);
      toast.error("Ocurrió un error al actualizar la contraseña.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ajustes del Sistema</h1>
        <p className="text-gray-600">Configuración global y perfil de administrador</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 border-0 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
              <UserCircle className="size-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-800">Seguridad de la Cuenta</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva Contraseña</Label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Contraseña</Label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button 
              onClick={handlePasswordChange}
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white mt-4"
            >
              {isSubmitting ? <Loader2 className="animate-spin size-4 mr-2" /> : <Save className="size-4 mr-2" />}
              Actualizar Contraseña
            </Button>
          </div>
        </Card>

        <Card className="p-6 border-0 shadow-lg">
          <h3 className="font-bold text-lg mb-4 text-slate-800">Información del Negocio</h3>
          <div className="space-y-4">
            <div>
              <Label>Nombre de la Tienda</Label>
              <Input defaultValue="Bendición de Dios" readOnly className="bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input defaultValue="Calle Principal #123" readOnly className="bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input defaultValue="+52 123 456 7890" readOnly className="bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
            <div className="pt-2 text-sm text-gray-500">
              * Para modificar los datos fiscales contacta a soporte técnico.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
