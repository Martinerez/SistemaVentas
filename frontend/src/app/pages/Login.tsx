/**
 * @fileoverview Página de Login — Autenticación de Usuarios
 *
 * Único punto de entrada pública del sistema. Autentica al usuario
 * contra el endpoint JWT del backend y almacena los tokens para la
 * sesión.
 *
 * FLUJO DE AUTENTICACIÓN:
 *   1. Usuario ingresa email y contraseña.
 *   2. `handleLogin` normaliza el email (lowercase + trim) para evitar
 *      errores por diferencias de capitalizón (ej: Admin@Mail.com vs admin@mail.com).
 *   3. POST /api/token/ → Django verifica credenciales con CustomTokenObtainPairView.
 *   4. Si son correctas: recibe { access, refresh } + claims personalizados (rol, nombre).
 *   5. `login(access, refresh)` del AuthContext guarda los tokens en localStorage
 *      y actualiza el estado global de la sesión.
 *   6. navigate("/") → Redirige al dashboard.
 *
 * NORMALIZACIÓN DEL EMAIL:
 *   `email.toLowerCase().trim()` antes de enviar al backend:
 *   - toLowerCase(): El campo Email del modelo Django es case-sensitive en la BD.
 *     Sin normalizar, 'Admin@mail.com' y 'admin@mail.com' fallarían.
 *   - trim(): Elimina espacios accidentales que los gestores de contraseñas
 *     a veces añaden al autocompletar.
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import api from "../api/axiosInstance";
import { useAuth } from "../contexts/AuthContext";
import { KeyRound, Mail, Loader2, Store } from "lucide-react";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  /**
   * Maneja el envío del formulario de login.
   *
   * e.preventDefault(): Evita la recarga de página por defecto del form HTML.
   * El error se muestra como toast usando el mensaje del backend si existe
   * (error.response?.data?.detail), o un mensaje genérico como fallback.
   * Esto da retroalimentación precisa sin exponer detalles internos del servidor.
   *
   * @param e - Evento de submit del formulario HTML.
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning("Por favor ingresa correo y contraseña");
      return;
    }

    setIsLoading(true);
    try {
      // Normalizar email: minusculas + sin espacios extremos
      const cleanEmail = email.toLowerCase().trim();
      const response = await api.post("/token/", {
        Email: cleanEmail,  // El backend espera campo 'Email' (PascalCase) por USERNAME_FIELD
        password: password
      });

      // Guardar tokens y actualizar estado global de sesión
      login(response.data.access, response.data.refresh);
      toast.success("¡Bienvenido al sistema!");
      navigate("/");
    } catch (error: any) {
        // Mostrar el mensaje de error del backend si existe, o uno genérico
        toast.error(error.response?.data?.detail || "Credenciales incorrectas o usuario no encontrado.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="mb-8 flex flex-col items-center">
        <div className="bg-green-600 p-4 rounded-full mb-4 shadow-lg text-white">
          <Store className="size-10" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Bendición de Dios</h1>
        <p className="text-slate-500 font-medium">Sistema de Ventas e Inventario</p>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-2xl text-center font-bold">Iniciar Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-slate-700">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                <Input 
                  type="email" 
                  placeholder="admin@bendiciondedios.com" 
                  className="pl-10 h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-slate-700">Contraseña</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-10 h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-lg mt-6 bg-green-600 hover:bg-green-700" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Acceder al Sistema"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
