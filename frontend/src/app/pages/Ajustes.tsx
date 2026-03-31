import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useState, useEffect } from "react";
import api from "../api/axiosInstance";
import { toast } from "sonner";
import { Loader2, Save, Eye, EyeOff, Mail } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function Ajustes() {
  const { userId } = useAuth();

  //PASSWORD
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  //EMAIL
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

  //VALIDACIÓN PASSWORD
  const validatePassword = (pwd: string) => {
    const errors: string[] = [];

    if (pwd.length < 8) errors.push("Mínimo 8 caracteres");
    if (!/[A-Z]/.test(pwd)) errors.push("Una mayúscula");
    if (!/[a-z]/.test(pwd)) errors.push("Una minúscula");
    if (!/[0-9]/.test(pwd)) errors.push("Un número");
    if (!/[^A-Za-z0-9]/.test(pwd)) errors.push("Un carácter especial");

    return errors;
  };


const getErrorMessage = (error: any): string => {
  const data = error.response?.data;

  if (!data) return "Error inesperado";

  // Caso: { email: ["mensaje"] }
  const firstKey = Object.keys(data)[0];

  if (Array.isArray(data[firstKey])) {
    return data[firstKey][0];
  }

  // Caso: { email: "mensaje" }
  if (typeof data[firstKey] === "string") {
    return data[firstKey];
  }

  // Caso: { detail: "mensaje" }
  if (data.detail) {
    return data.detail;
  }

  return "Error al procesar la solicitud";
};


  useEffect(() => {
    setPasswordErrors(password ? validatePassword(password) : []);
  }, [password]);

  //VALIDACIÓN EMAIL
  const validateEmail = (mail: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(mail);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);

    if (!validateEmail(value)) {
      setEmailError("Correo no válido");
    } else {
      setEmailError("");
    }
  };

  //CAMBIAR CONTRASEÑA
  const handlePasswordChange = async () => {
    if (!password || !confirmPassword) {
      toast.warning("Completa todos los campos.");
      return;
    }

    if (passwordErrors.length > 0) {
      toast.error("La contraseña no cumple los requisitos.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmittingPassword(true);

    try {
      await api.patch(`/usuarios/usuarios/${userId}/`, {
        password: password,
      });

      toast.success("Contraseña actualizada correctamente");

      setPassword("");
      setConfirmPassword("");

    } catch (error: any) {
  console.error(error);
  toast.error(getErrorMessage(error));
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  //CAMBIO DIRECTO DE EMAIL (SIN VERIFICACIÓN)
  const handleEmailUpdate = async () => {
    if (!email) {
      toast.warning("Ingresa un correo.");
      return;
    }

    if (!validateEmail(email)) {
      toast.error("Correo inválido.");
      return;
    }

    setIsSubmittingEmail(true);

    try {
      // PATCH directo al usuario para actualizar el email
      await api.patch(`/usuarios/usuarios/${userId}/`, {
        email: email, 
      });

      toast.success("Correo actualizado correctamente");

      setEmail("");

    } 
    catch (error: any) {
  console.error(error);
  toast.error(getErrorMessage(error));

    } finally {
      setIsSubmittingEmail(false);
    }
    
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
       Ajustes
      </h1>

      <div className="grid md:grid-cols-2 gap-6">

        {/*PASSWORD */}
        <Card className="p-6 rounded-2xl shadow-md dark:bg-slate-900 dark:border dark:border-slate-800">
          <h3 className="font-bold text-lg mb-4">Cambio de contraseña</h3>

          <div className="space-y-4">

            <div>
              <Label>Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {passwordErrors.length > 0 && (
                <ul className="text-red-500 text-sm mt-1">
                  {passwordErrors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <Label>Confirmar Contraseña</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              {confirmPassword && password !== confirmPassword && (
                <p className="text-red-500 text-sm mt-1">
                  Las contraseñas no coinciden
                </p>
              )}
            </div>

            <Button
              onClick={handlePasswordChange}
              disabled={
                isSubmittingPassword ||
                !password ||
                !confirmPassword ||
                passwordErrors.length > 0 ||
                password !== confirmPassword
              }
              className="w-full"
            >
              {isSubmittingPassword ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                <Save className="mr-2" />
              )}
              Actualizar contraseña
            </Button>
          </div>
        </Card>

        {/*EMAIL */}
        <Card className="p-6 rounded-2xl shadow-md dark:bg-slate-900 dark:border dark:border-slate-800">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Mail size={18} /> Actualización/Cambio de correo electrónico
          </h3>

          <div className="space-y-4">

            <div>
              <Label>Nuevo correo</Label>
              <Input
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="correo@ejemplo.com"
                className={emailError ? "border-red-500" : ""}
              />

              {emailError && (
                <p className="text-red-500 text-sm mt-1">{emailError}</p>
              )}
            </div>

            <Button
              onClick={handleEmailUpdate}
              disabled={isSubmittingEmail || !email || !!emailError}
              className="w-full"
            >
              {isSubmittingEmail ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                <Save className="mr-2" />
              )}
              Cambiar correo
            </Button>

            
          </div>
        </Card>

      </div>
    </div>
  );
}