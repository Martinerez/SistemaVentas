/**
 * @fileoverview Contexto de Autenticación — Estado global de la sesión de usuario.
 *
 * Implementa el patrón React Context para compartir el estado de autenticación
 * en toda la aplicación sin necesidad de prop-drilling (pasar props manualmente
 * por cada nivel del árbol de componentes).
 *
 * FLUJO DE AUTENTICACIÓN:
 *   1. El usuario ingresa credenciales en Login.tsx.
 *   2. Login.tsx llama a `login(access, refresh)`.
 *   3. AuthProvider guarda los tokens y decodifica el JWT para extraer:
 *      - userId (para asociar acciones al usuario actual)
 *      - userRole (para mostrar/ocultar elementos de UI y proteger rutas)
 *      - userName (para personalizar el saludo en el header)
 *   4. Cualquier componente de la app puede acceder a estos datos con `useAuth()`.
 *
 * PERSISTENCIA DE SESIÓN:
 *   Los tokens se almacenan en localStorage para sobrevivir recargas de página.
 *   El `useState` se inicializa directamente desde localStorage, por lo que
 *   si el usuario tiene una sesión activa, no necesita volver a iniciar sesión
 *   al recargar la página.
 *
 * SEGURIDAD — localStorage vs. cookies:
 *   localStorage es vulnerable a XSS (Cross-Site Scripting). Para mayor seguridad
 *   en producción, considerar httpOnly cookies. Sin embargo, para una SPA
 *   con buen control de dependencias y CSP, localStorage es aceptable.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";

/**
 * Forma del contexto de autenticación expuesto a los componentes.
 *
 * @property token - Access token JWT actual, o null si no hay sesión.
 * @property userId - ID del usuario extraído del JWT, o null.
 * @property userRole - Rol del usuario ('admin' | 'vendedor'), o null.
 * @property userName - Nombre completo del usuario, o null.
 * @property login - Función para iniciar sesión guardando los tokens.
 * @property logout - Función para cerrar sesión limpiando el estado y localStorage.
 */
interface AuthContextType {
  token: string | null;
  userId: number | null;
  userRole: string | null;
  userName: string | null;
  login: (access: string, refresh: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Proveedor del contexto de autenticación.
 *
 * Debe envolver toda la aplicación (en main.tsx o App.tsx) para que todos
 * los componentes hijos puedan acceder al estado de sesión con `useAuth()`.
 *
 * @param children - Árbol de componentes de la aplicación.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Inicializar desde localStorage permite restaurar la sesión después de recargar.
  // Si no hay token guardado, el estado inicial es null (sesión cerrada).
  const [token, setToken] = useState<string | null>(localStorage.getItem("accessToken"));
  const [userId, setUserId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  /**
   * Efecto de decodificación del JWT.
   *
   * Se ejecuta cada vez que `token` cambia (login, logout, renovación).
   * Extrae los claims personalizados ('user_id', 'rol', 'nombre') que el
   * backend añadió en CustomTokenObtainPairSerializer.get_token().
   *
   * POR QUÉ jwtDecode() Y NO UNA PETICIÓN AL SERVIDOR:
   *   jwtDecode() decodifica el payload del JWT localmente (Base64 decode).
   *   Es instantáneo y no requiere una petición HTTP. Los datos son confiables
   *   porque el token fue firmado por el servidor con la SECRET_KEY.
   *   Si el token fuera manipulado, la verificación en el backend fallaría.
   *
   * MANEJO DE ERRORES:
   *   Si el token está malformado o expirado, jwtDecode() lanza una excepción.
   *   En ese caso, se hace logout automático para limpiar el estado corrupto.
   */
  useEffect(() => {
    if (token) {
      try {
        // Decodificar el payload del JWT (sin verificar la firma — eso lo hace el servidor)
        const decoded: any = jwtDecode(token);
        // `??` (nullish coalescing): Si el claim no existe, usar null en lugar de undefined
        setUserId(decoded.user_id ?? null);
        setUserRole(decoded.rol ?? null);
        setUserName(decoded.nombre ?? null);
      } catch (e) {
        // Token inválido o malformado → limpiar sesión automáticamente
        logout();
      }
    } else {
      // Si token es null (logout), limpiar todos los datos derivados
      setUserId(null);
      setUserRole(null);
      setUserName(null);
    }
  }, [token]); // Solo re-ejecutar cuando el token cambie

  /**
   * Inicia la sesión del usuario guardando los tokens y actualizando el estado.
   *
   * El cambio de `token` con setToken() dispara el useEffect de decodificación
   * automáticamente, por lo que no es necesario llamar a jwtDecode() aquí.
   *
   * @param access - Access token JWT (vida corta: 1 día).
   * @param refresh - Refresh token JWT (vida larga: 7 días).
   */
  const login = (access: string, refresh: string) => {
    localStorage.setItem("accessToken", access);
    localStorage.setItem("refreshToken", refresh);
    setToken(access); // Dispara el useEffect automáticamente
  };

  /**
   * Cierra la sesión limpiando tokens de localStorage y redirigiendo al login.
   *
   * window.location.href es una redirección dura (no React Router) para
   * garantizar que todo el estado de la aplicación se resetee completamente,
   * incluyendo cualquier caché de consultas u otro estado global.
   */
  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setToken(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ token, userId, userRole, userName, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook personalizado para consumir el contexto de autenticación.
 *
 * Encapsula el uso de useContext(AuthContext) y añade una validación
 * en tiempo de desarrollo: si se usa fuera de AuthProvider, lanza un
 * error descriptivo en lugar de devolver `undefined` silenciosamente.
 *
 * Uso:
 * ```tsx
 * const { token, userRole, logout } = useAuth();
 * ```
 *
 * @returns El contexto de autenticación completo.
 * @throws Error si se usa fuera del árbol de AuthProvider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
