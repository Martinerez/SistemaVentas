/**
 * @fileoverview Página de Auditoría — Módulo exclusivo para administradores.
 *
 * Expone tres pestañas de monitoreo del sistema:
 *   1. Logs del Sistema    → Historial filtrable de todas las mutaciones.
 *   2. Salud de la BD      → Estado interno de PostgreSQL en tiempo real.
 *   3. Sesiones Recientes  → Últimos inicios de sesión (últimas 24h).
 *
 * ARQUITECTURA DE DATOS:
 *   - Los datos de cada pestaña se cargan de forma independiente (lazy loading).
 *   - Los filtros de "Logs del Sistema" manejan paginación del servidor.
 *   - "Salud de BD" hace una única petición al montar la pestaña.
 *   - "Sesiones" se actualiza al montar la pestaña.
 */

import { useState, useEffect, useCallback } from "react";
import api from "../api/axiosInstance";
import {
  ShieldCheck, Database, Users, RefreshCw, Filter, Download,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertTriangle, Activity,
  Clock, Globe, Monitor, Server, Table2, Code2,
  LogIn, Wifi,
} from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface LogAuditoria {
  IdLog: number;
  nombre_usuario: string;
  accion: string;
  modulo: string;
  descripcion: string;
  ip_address: string | null;
  user_agent: string;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  resultado: "EXITOSO" | "FALLIDO";
  timestamp: string;
}

interface PaginatedLogs {
  count: number;
  next: string | null;
  previous: string | null;
  results: LogAuditoria[];
}

interface TablaInfo {
  nombre_tabla: string;
  filas_estimadas: string;
  tamano_total: string;
  tamano_datos: string;
  ultimo_vacuum: string | null;
  ultimo_analyze: string | null;
  filas_muertas: string;
  escaneos_secuenciales: string;
  escaneos_por_indice: string;
}

interface SPInfo {
  nombre_funcion: string;
  esquema: string;
  tipo_retorno: string;
  argumentos: string;
  lenguaje: string;
}

interface ConexionInfo {
  pid: string;
  usuario: string;
  aplicacion: string;
  ip_cliente: string | null;
  estado: string | null;
  inicio_conexion: string;
  ultima_query: string | null;
}

interface EstadoBD {
  version_pg: string;
  tamano_bd: string;
  conexiones_activas: number;
  conexiones_detalle: ConexionInfo[];
  tablas: TablaInfo[];
  stored_procedures: SPInfo[];
}

interface SesionInfo {
  nombre_usuario: string;
  ip_address: string | null;
  user_agent: string;
  resultado: "EXITOSO" | "FALLIDO";
  timestamp: string;
  descripcion: string;
}

interface EstadoSesiones {
  total_exitosas: number;
  total_fallidas: number;
  total_intentos: number;
  periodo: string;
  sesiones: SesionInfo[];
}

// ── Constantes de UI ───────────────────────────────────────────────────────────

const ACCION_CHOICES = [
  { value: "", label: "Todas las acciones" },
  { value: "CREAR", label: "Crear" },
  { value: "MODIFICAR", label: "Modificar" },
  { value: "ELIMINAR", label: "Eliminar" },
  { value: "ANULAR", label: "Anular" },
  { value: "PROCESAR", label: "Procesar" },
  { value: "LOGIN", label: "Login" },
  { value: "ERROR_ACCESO", label: "Error de Acceso" },
];

const MODULO_CHOICES = [
  { value: "", label: "Todos los módulos" },
  { value: "VENTAS", label: "Ventas" },
  { value: "PRODUCTOS", label: "Productos" },
  { value: "CATEGORIAS", label: "Categorías" },
  { value: "PROVEEDORES", label: "Proveedores" },
  { value: "INVENTARIO", label: "Inventario" },
  { value: "PERDIDAS", label: "Pérdidas" },
  { value: "DEVOLUCIONES", label: "Devoluciones" },
  { value: "USUARIOS", label: "Usuarios" },
  { value: "SISTEMA", label: "Sistema" },
];

// ── Utilidades de UI ───────────────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("es-NI", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function accionBadge(accion: string) {
  const map: Record<string, string> = {
    CREAR: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    MODIFICAR: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    ELIMINAR: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    ANULAR: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    PROCESAR: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    LOGIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    LOGOUT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    ERROR_ACCESO: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return map[accion] || "bg-gray-100 text-gray-700";
}

function ResultadoBadge({ resultado }: { resultado: "EXITOSO" | "FALLIDO" }) {
  if (resultado === "EXITOSO") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="size-3" /> Exitoso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
      <XCircle className="size-3" /> Fallido
    </span>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function Auditoria() {
  const [tabActiva, setTabActiva] = useState<"logs" | "bd" | "sesiones">("logs");

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800 flex items-center justify-center shadow-lg">
          <ShieldCheck className="size-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auditoría del Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Monitoreo de actividad, salud de la base de datos y sesiones de usuarios.
          </p>
        </div>
      </div>

      {/* Selector de pestañas */}
      <div className="flex border-b border-border">
        {[
          { key: "logs" as const, label: "Logs del Sistema", icon: Activity },
          { key: "bd" as const, label: "Salud de la BD", icon: Database },
          { key: "sesiones" as const, label: "Sesiones Recientes", icon: Users },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            id={`tab-auditoria-${key}`}
            onClick={() => setTabActiva(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tabActiva === key
                ? "border-slate-700 dark:border-slate-300 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido de las pestañas */}
      {tabActiva === "logs" && <TabLogs />}
      {tabActiva === "bd" && <TabEstadoBD />}
      {tabActiva === "sesiones" && <TabSesiones />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PESTAÑA 1 — LOGS DEL SISTEMA
// ══════════════════════════════════════════════════════════════════════════════

function TabLogs() {
  const [datos, setDatos] = useState<PaginatedLogs | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const [expandido, setExpandido] = useState<number | null>(null);

  // Filtros
  const [filtros, setFiltros] = useState({
    modulo: "", accion: "", resultado: "", usuario_nombre: "",
    fecha_inicio: "", fecha_fin: "",
  });
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtros);

  const cargarLogs = useCallback(async (pagina: number, filtrosActivos: typeof filtros) => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagina));
      Object.entries(filtrosActivos).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await api.get<PaginatedLogs>(`/auditoria/logs/?${params}`);
      setDatos(res.data);
    } catch {
      setError("Error al cargar los logs. Verifica tu conexión.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarLogs(paginaActual, filtrosAplicados);
  }, [paginaActual, filtrosAplicados, cargarLogs]);

  function aplicarFiltros() {
    setPaginaActual(1);
    setFiltrosAplicados({ ...filtros });
  }

  function limpiarFiltros() {
    const vacios = { modulo: "", accion: "", resultado: "", usuario_nombre: "", fecha_inicio: "", fecha_fin: "" };
    setFiltros(vacios);
    setFiltrosAplicados(vacios);
    setPaginaActual(1);
  }

  const totalPaginas = datos ? Math.ceil(datos.count / 20) : 0;

  return (
    <div className="space-y-4">
      {/* Panel de filtros */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Filtros</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            id="filtro-modulo"
            value={filtros.modulo}
            onChange={e => setFiltros(f => ({ ...f, modulo: e.target.value }))}
            className="col-span-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          >
            {MODULO_CHOICES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            id="filtro-accion"
            value={filtros.accion}
            onChange={e => setFiltros(f => ({ ...f, accion: e.target.value }))}
            className="col-span-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          >
            {ACCION_CHOICES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            id="filtro-resultado"
            value={filtros.resultado}
            onChange={e => setFiltros(f => ({ ...f, resultado: e.target.value }))}
            className="col-span-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          >
            <option value="">Todos los resultados</option>
            <option value="EXITOSO">Exitoso</option>
            <option value="FALLIDO">Fallido</option>
          </select>
          <input
            id="filtro-usuario"
            type="text"
            placeholder="Nombre de usuario..."
            value={filtros.usuario_nombre}
            onChange={e => setFiltros(f => ({ ...f, usuario_nombre: e.target.value }))}
            className="col-span-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground"
          />
          <input
            id="filtro-fecha-inicio"
            type="date"
            value={filtros.fecha_inicio}
            onChange={e => setFiltros(f => ({ ...f, fecha_inicio: e.target.value }))}
            className="col-span-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          />
          <input
            id="filtro-fecha-fin"
            type="date"
            value={filtros.fecha_fin}
            onChange={e => setFiltros(f => ({ ...f, fecha_fin: e.target.value }))}
            className="col-span-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          />
        </div>
        <div className="flex gap-2 mt-3">
          <button
            id="btn-aplicar-filtros"
            onClick={aplicarFiltros}
            className="px-4 py-2 text-sm font-medium bg-slate-800 dark:bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Aplicar Filtros
          </button>
          <button
            id="btn-limpiar-filtros"
            onClick={limpiarFiltros}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Limpiar
          </button>
          <button
            id="btn-recargar-logs"
            onClick={() => cargarLogs(paginaActual, filtrosAplicados)}
            className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className={`size-4 ${cargando ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Resumen */}
      {datos && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{datos.count.toLocaleString()}</strong> registros encontrados
            {paginaActual > 1 && ` — Página ${paginaActual} de ${totalPaginas}`}
          </span>
        </div>
      )}

      {/* Tabla de logs */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {cargando && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <RefreshCw className="size-6 animate-spin mr-3" />
            <span>Cargando logs...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-16 text-red-500 gap-2">
            <AlertTriangle className="size-5" /> {error}
          </div>
        )}
        {!cargando && !error && datos && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Fecha y Hora</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Usuario</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Módulo</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Acción</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Descripción</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">IP</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Resultado</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {datos.results.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                      No hay registros que coincidan con los filtros aplicados.
                    </td>
                  </tr>
                )}
                {datos.results.map((log) => (
                  <>
                    <tr key={log.IdLog} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{log.IdLog}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-3 shrink-0" />
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{log.nombre_usuario || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {log.modulo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${accionBadge(log.accion)}`}>
                          {log.accion}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground max-w-xs truncate" title={log.descripcion}>
                        {log.descripcion}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {log.ip_address || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ResultadoBadge resultado={log.resultado} />
                      </td>
                      <td className="px-4 py-3">
                        {(log.datos_anteriores || log.datos_nuevos) && (
                          <button
                            onClick={() => setExpandido(expandido === log.IdLog ? null : log.IdLog)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Ver datos del cambio"
                          >
                            {expandido === log.IdLog
                              ? <ChevronUp className="size-4" />
                              : <ChevronDown className="size-4" />
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Fila expandible con diff de datos */}
                    {expandido === log.IdLog && (log.datos_anteriores || log.datos_nuevos) && (
                      <tr key={`exp-${log.IdLog}`} className="bg-muted/10">
                        <td colSpan={9} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {log.datos_anteriores && (
                              <div>
                                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1">
                                  <XCircle className="size-3" /> Datos Anteriores
                                </p>
                                <pre className="text-xs bg-background border border-border rounded-lg p-3 overflow-auto max-h-48 text-muted-foreground">
                                  {JSON.stringify(log.datos_anteriores, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.datos_nuevos && (
                              <div>
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                                  <CheckCircle2 className="size-3" /> Datos Nuevos
                                </p>
                                <pre className="text-xs bg-background border border-border rounded-lg p-3 overflow-auto max-h-48 text-muted-foreground">
                                  {JSON.stringify(log.datos_nuevos, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {datos && totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {paginaActual} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              id="btn-pagina-anterior"
              onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
              disabled={paginaActual === 1}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
            >
              <ChevronLeft className="size-4" /> Anterior
            </button>
            <button
              id="btn-pagina-siguiente"
              onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaActual === totalPaginas}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
            >
              Siguiente <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PESTAÑA 2 — SALUD DE LA BASE DE DATOS
// ══════════════════════════════════════════════════════════════════════════════

function TabEstadoBD() {
  const [datos, setDatos] = useState<EstadoBD | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seccionExpandida, setSeccionExpandida] = useState<"tablas" | "sp" | "conexiones" | null>("tablas");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await api.get<EstadoBD>("/auditoria/estado-bd/");
      setDatos(res.data);
    } catch {
      setError("Error al obtener el estado de la base de datos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <RefreshCw className="size-6 animate-spin mr-3" /> Analizando base de datos...
    </div>
  );
  if (error) return (
    <div className="flex items-center justify-center py-20 text-red-500 gap-2">
      <AlertTriangle className="size-5" /> {error}
    </div>
  );
  if (!datos) return null;

  return (
    <div className="space-y-4">
      {/* Tarjetas de métricas generales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Server className="size-5 text-blue-500" />}
          titulo="Motor"
          valor={datos.version_pg.replace("PostgreSQL ", "PG ")}
          color="blue"
        />
        <MetricCard
          icon={<Database className="size-5 text-purple-500" />}
          titulo="Tamaño BD"
          valor={datos.tamano_bd}
          color="purple"
        />
        <MetricCard
          icon={<Wifi className="size-5 text-emerald-500" />}
          titulo="Conexiones"
          valor={String(datos.conexiones_activas)}
          color="emerald"
        />
        <MetricCard
          icon={<Table2 className="size-5 text-amber-500" />}
          titulo="Tablas"
          valor={String(datos.tablas.length)}
          color="amber"
        />
      </div>

      {/* Botón de actualizar */}
      <div className="flex justify-end">
        <button
          id="btn-refrescar-bd"
          onClick={cargar}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className="size-4" /> Actualizar diagnóstico
        </button>
      </div>

      {/* Sección: Tablas */}
      <SeccionColapsable
        id="seccion-tablas"
        titulo={`Tablas del Proyecto (${datos.tablas.length})`}
        icon={<Table2 className="size-4" />}
        abierta={seccionExpandida === "tablas"}
        toggle={() => setSeccionExpandida(s => s === "tablas" ? null : "tablas")}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {["Tabla", "Filas (aprox.)", "Tamaño Total", "Tamaño Datos", "Filas Muertas", "Último Analyze"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {datos.tablas.map(t => {
                const filasMuertas = parseInt(t.filas_muertas || "0");
                const filasVivas = parseInt(t.filas_estimadas || "0");
                const saludOk = filasMuertas < filasVivas * 0.2;
                return (
                  <tr key={t.nombre_tabla} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">{t.nombre_tabla}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{parseInt(t.filas_estimadas || "0").toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{t.tamano_total}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{t.tamano_datos}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${saludOk
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                        {filasMuertas.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.ultimo_analyze || "Nunca"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SeccionColapsable>

      {/* Sección: Stored Procedures */}
      <SeccionColapsable
        id="seccion-sp"
        titulo={`Stored Procedures / Funciones PL/pgSQL (${datos.stored_procedures.length})`}
        icon={<Code2 className="size-4" />}
        abierta={seccionExpandida === "sp"}
        toggle={() => setSeccionExpandida(s => s === "sp" ? null : "sp")}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {["Función", "Tipo Retorno", "Lenguaje", "Argumentos"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {datos.stored_procedures.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-sm">No se encontraron funciones PL/pgSQL.</td></tr>
              )}
              {datos.stored_procedures.map((sp, i) => (
                <tr key={`${sp.nombre_funcion}-${i}`} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">
                    <span className="text-emerald-600 dark:text-emerald-400">fn </span>
                    {sp.nombre_funcion}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{sp.tipo_retorno}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-mono">
                      {sp.lenguaje}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono max-w-xs truncate" title={sp.argumentos}>
                    {sp.argumentos || "sin argumentos"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SeccionColapsable>

      {/* Sección: Conexiones activas */}
      <SeccionColapsable
        id="seccion-conexiones"
        titulo={`Conexiones Activas (${datos.conexiones_detalle.length})`}
        icon={<Wifi className="size-4" />}
        abierta={seccionExpandida === "conexiones"}
        toggle={() => setSeccionExpandida(s => s === "conexiones" ? null : "conexiones")}
      >
        {datos.conexiones_detalle.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No hay otras conexiones activas en este momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {["PID", "Usuario BD", "Aplicación", "IP Cliente", "Estado", "Desde", "Última Query"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {datos.conexiones_detalle.map(c => (
                  <tr key={c.pid} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{c.pid}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-foreground">{c.usuario}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.aplicacion || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{c.ip_cliente || "local"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.estado === "active"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        {c.estado || "idle"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.inicio_conexion}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono max-w-xs truncate" title={c.ultima_query || ""}>
                      {c.ultima_query || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SeccionColapsable>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PESTAÑA 3 — SESIONES RECIENTES
// ══════════════════════════════════════════════════════════════════════════════

function TabSesiones() {
  const [datos, setDatos] = useState<EstadoSesiones | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await api.get<EstadoSesiones>("/auditoria/sesiones/");
      setDatos(res.data);
    } catch {
      setError("Error al cargar las sesiones.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <RefreshCw className="size-6 animate-spin mr-3" /> Cargando sesiones...
    </div>
  );
  if (error) return (
    <div className="flex items-center justify-center py-20 text-red-500 gap-2">
      <AlertTriangle className="size-5" /> {error}
    </div>
  );
  if (!datos) return null;

  return (
    <div className="space-y-4">
      {/* Estadísticas de sesiones */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          icon={<LogIn className="size-5 text-purple-500" />}
          titulo="Total Intentos"
          valor={String(datos.total_intentos)}
          subtitulo={datos.periodo}
          color="purple"
        />
        <MetricCard
          icon={<CheckCircle2 className="size-5 text-emerald-500" />}
          titulo="Exitosos"
          valor={String(datos.total_exitosas)}
          color="emerald"
        />
        <MetricCard
          icon={<XCircle className="size-5 text-red-500" />}
          titulo="Fallidos"
          valor={String(datos.total_fallidas)}
          subtitulo={datos.total_fallidas > 5 ? "⚠ Revisar posibles ataques" : undefined}
          color="red"
        />
      </div>

      <div className="flex justify-end">
        <button
          id="btn-refrescar-sesiones"
          onClick={cargar}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className="size-4" /> Actualizar
        </button>
      </div>

      {/* Tabla de sesiones */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <h3 className="font-semibold text-sm text-foreground">Historial de Accesos — Últimas 24 horas</h3>
        </div>
        {datos.sesiones.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No hay registros de sesión en las últimas 24 horas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {["Usuario", "IP", "Navegador / Cliente", "Fecha y Hora", "Resultado"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {datos.sesiones.map((s, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span className="flex items-center gap-2">
                        <div className="size-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
                          <Users className="size-3.5 text-white" />
                        </div>
                        {s.nombre_usuario || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Globe className="size-3" />
                        {s.ip_address || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                      <span className="flex items-center gap-1.5" title={s.user_agent}>
                        <Monitor className="size-3 shrink-0" />
                        <span className="truncate">{s.user_agent ? s.user_agent.substring(0, 60) + (s.user_agent.length > 60 ? "..." : "") : "—"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3" />
                        {formatTimestamp(s.timestamp)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ResultadoBadge resultado={s.resultado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTES REUTILIZABLES
// ══════════════════════════════════════════════════════════════════════════════

interface MetricCardProps {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  subtitulo?: string;
  color: "blue" | "purple" | "emerald" | "amber" | "red";
}

function MetricCard({ icon, titulo, valor, subtitulo, color }: MetricCardProps) {
  const borderMap = {
    blue: "border-l-blue-500",
    purple: "border-l-purple-500",
    emerald: "border-l-emerald-500",
    amber: "border-l-amber-500",
    red: "border-l-red-500",
  };
  return (
    <div className={`bg-card border border-border border-l-4 ${borderMap[color]} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs text-muted-foreground font-medium">{titulo}</p>
          <p className="text-xl font-bold text-foreground">{valor}</p>
          {subtitulo && <p className="text-xs text-muted-foreground mt-0.5">{subtitulo}</p>}
        </div>
      </div>
    </div>
  );
}

interface SeccionColapsableProps {
  id: string;
  titulo: string;
  icon: React.ReactNode;
  abierta: boolean;
  toggle: () => void;
  children: React.ReactNode;
}

function SeccionColapsable({ id, titulo, icon, abierta, toggle, children }: SeccionColapsableProps) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <button
        id={id}
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5 font-semibold text-sm text-foreground">
          {icon}
          {titulo}
        </div>
        {abierta ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      {abierta && (
        <div className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}
