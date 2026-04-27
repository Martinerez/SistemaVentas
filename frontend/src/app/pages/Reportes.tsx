/**
 * @fileoverview Página de Reportes Gerenciales — "La Bendición de Dios"
 *
 * Página más compleja del sistema. Centraliza 11 tipos de reportes independientes
 * que se pueden consultar, imprimir en PDF y exportar a Excel.
 *
 * ARQUITECTURA DE ESTADO:
 *   Cada reporte tiene su propio par de estados:
 *   - `resultado*`:  Los datos recibidos de la API (array o objeto).
 *   - `loading*`:    Boolean que controla el spinner mientras se carga.
 *   Separar los estados por reporte permite que múltiples reportes muestren
 *   sus datos simultáneamente en la misma página sin interferirse.
 *
 * FLUJO GLOBAL DE FECHAS:
 *   Los estados `fechaInicio` y `fechaFin` son compartidos por la mayoría
 *   de reportes. Se ingresan UNA SOLA VEZ en la barra de "Rango de Fechas
 *   Global" y se reutilizan en cada petición. Esto evita que el usuario
 *   ingrese las mismas fechas repetidamente.
 *
 * TRANSFORMACIÓN DE DATOS — Reporte de Comparación:
 *   La función sp_comparar_ventas() devuelve UNA SOLA FILA con columnas:
 *     { ventas_a, productos_a, ventas_b, productos_b }
 *   El frontend transforma esa fila en MÚLTIPLES FILAS VISUALES para la tabla:
 *     Fila 1: { metrica: 'Ventas Totales',    periodo_a, periodo_b, diferencia }
 *     Fila 2: { metrica: 'Productos Vendidos', periodo_a, periodo_b, diferencia }
 *   La diferencia se calcula aquí (frontend) porque es trivial y evita
 *   modificar la función SQL almacenada.
 *
 * MODO IMPRESIÓN:
 *   El estado `imprimiendo` controla la visibilidad de elementos de UI.
 *   Al activarse, oculta filtros y controles, y muestra un header formal
 *   de documento. El CSS `@media print` ajusta colores para impresoras.
 */
import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { TrendingUp, CalendarDays, Users, Package, Loader2, FileSpreadsheet, Printer, CheckCircle2, Undo2 } from 'lucide-react';
import api from '../api/axiosInstance';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export function Reportes() {
  // ── Datos maestros cargados al montar (listas para los selects) ─────────────
  const [productosLista, setProductosLista] = useState<any[]>([]);
  const [proveedoresLista, setProveedoresLista] = useState<any[]>([]);

  // ── Rango de fechas GLOBAL compartido por la mayoría de reportes ────────────
  // Un solo par de fechas para evitar ingresarlas repetidamente
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // ── Estados específicos de cada reporte (datos + spinner) ───────────────────
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [productoSeleccionado, setProductoSeleccionado] = useState('');
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState('');

  /** Reporte Gerencial: { total_ventas, promedio_venta, producto_mas_vendido } */
  const [resultadoGerencial, setResultadoGerencial] = useState<any>(null);
  const [loadingGerencial, setLoadingGerencial] = useState(false);

  /** Pivot mensual: una fila con 12 columnas (ene..dic) para el producto seleccionado */
  const [datosPivot, setDatosPivot] = useState<any>(null);
  const [loadingPivot, setLoadingPivot] = useState(false);

  /** Lista de productos activos suministrados por un proveedor */
  const [productosProveedor, setProductosProveedor] = useState<any[]>([]);
  const [loadingProveedor, setLoadingProveedor] = useState(false);

  /** Lista de devoluciones en el rango de fechas */
  const [resultadoDevoluciones, setResultadoDevoluciones] = useState<any[]>([]);
  const [loadingDevoluciones, setLoadingDevoluciones] = useState(false);

  /** Estado para el modo de impresión PDF — oculta controles de UI */
  const [imprimiendo, setImprimiendo] = useState(false);

  // ── Reportes avanzados (sp_*) ────────────────────────────────────────────────
  /** Filtro de estado: '' = todas, 'Completada', 'Anulada' */
  const [estadoVentaFiltrada, setEstadoVentaFiltrada] = useState('');
  const [resultadoVentasFiltradas, setResultadoVentasFiltradas] = useState<any[]>([]);
  const [loadingVentasFiltradas, setLoadingVentasFiltradas] = useState(false);

  const [limiteTopProductos, setLimiteTopProductos] = useState('10');
  const [resultadoTopProductos, setResultadoTopProductos] = useState<any[]>([]);
  const [loadingTopProductos, setLoadingTopProductos] = useState(false);

  /** '' = todos los productos; un ID = filtrar por producto específico */
  const [productoGananciaId, setProductoGananciaId] = useState('');
  const [resultadoGananciaProducto, setResultadoGananciaProducto] = useState<any[]>([]);
  const [loadingGananciaProducto, setLoadingGananciaProducto] = useState(false);

  /**
   * Comparación de periodos: 4 fechas independientes (2 por periodo).
   * Son independientes del rango global porque comparan dos rangos distintos.
   */
  const [fechaInicioA, setFechaInicioA] = useState('');
  const [fechaFinA, setFechaFinA] = useState('');
  const [fechaInicioB, setFechaInicioB] = useState('');
  const [fechaFinB, setFechaFinB] = useState('');
  /**
   * resultadoComparacion: Array TRANSFORMADO en el frontend.
   * La API devuelve 1 objeto → aquí se convierte en 2+ filas para la tabla.
   * Ver ejecutarComparacion() para el detalle de la transformación.
   */
  const [resultadoComparacion, setResultadoComparacion] = useState<any[]>([]);
  const [loadingComparacion, setLoadingComparacion] = useState(false);

  const [proveedorComprasId, setProveedorComprasId] = useState('');
  const [resultadoComprasFiltradas, setResultadoComprasFiltradas] = useState<any[]>([]);
  const [loadingComprasFiltradas, setLoadingComprasFiltradas] = useState(false);

  const [diasSinMovimiento, setDiasSinMovimiento] = useState('30');
  const [resultadoSinMovimiento, setResultadoSinMovimiento] = useState<any[]>([]);
  const [loadingSinMovimiento, setLoadingSinMovimiento] = useState(false);

  const [resultadoPerdidas, setResultadoPerdidas] = useState<any[]>([]);
  const [loadingPerdidas, setLoadingPerdidas] = useState(false);

  /**
   * seleccionVista: Controla qué reporte(s) incluir en PDF/Excel.
   * 'todos' = todos los reportes generados; '1'..'11' = uno específico.
   */
  const [seleccionVista, setSeleccionVista] = useState<string>('todos');

  /**
   * Valida que ambas fechas estén presentes y que inicio <= fin.
   * Reutilizado por todos los reportes para evitar duplicar la lógica.
   *
   * @param inicio - Fecha de inicio en formato YYYY-MM-DD.
   * @param fin - Fecha de fin en formato YYYY-MM-DD.
   * @param label - Prefijo opcional para el mensaje de error (ej: 'Periodo A').
   * @returns true si las fechas son válidas, false si hay un error (muestra toast).
   */
  const validarFechas = (inicio: string, fin: string, label = ''): boolean => {
    const prefix = label ? `${label}: ` : '';
    if (!inicio || !fin) { toast.error(`${prefix}Selecciona ambas fechas`); return false; }
    if (new Date(inicio) > new Date(fin)) { toast.error(`${prefix}La fecha de inicio no puede ser mayor a la fecha final`); return false; }
    return true;
  };


  /**
   * Efecto de carga inicial de datos maestros.
   *
   * Carga productos y proveedores una sola vez al montar el componente.
   * Ambas peticiones se lanzan en PARALELO con Promise.all() para minimizar
   * el tiempo de espera (en lugar de hacerlas secuencialmente).
   *
   * AbortController: Cancela las peticiones en vuelo si el componente se
   * desmonta antes de que terminen (ej: el usuario navega a otra página).
   * Sin esto, el callback del .then() intentaría llamar a setState en un
   * componente ya desmontado, causando un memory leak.
   *
   * `?? prodRes.data ?? []`: La API puede devolver datos paginados
   * ({ results: [...] }) o directamente un array. El operador nullish coalescing
   * maneja ambos formatos de forma segura.
   */
  useEffect(() => {
    const controller = new AbortController();
    const cargarDatos = async () => {
      try {
        const [prodRes, provRes] = await Promise.all([
          api.get('/catalogo/productos/', { signal: controller.signal }),
          api.get('/catalogo/proveedores/', { signal: controller.signal })
        ]);
        setProductosLista(prodRes.data.results ?? prodRes.data ?? []);
        setProveedoresLista(provRes.data.results ?? provRes.data ?? []);
      } catch (e: any) {
        // CanceledError: Ignorar — es el resultado esperado del abort al desmontar.
        if (e.name !== 'CanceledError') toast.error("Error al cargar datos maestros");
      }
    };
    cargarDatos();
    // Función de limpieza: cancela las peticiones al desmontar
    return () => controller.abort();
  }, []); // [] = solo se ejecuta al montar, no en re-renders

  const ejecutarReporteGerencial = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingGerencial(true);
    try {
      const { data } = await api.get(`/ventas/reporte-gerencial/?inicio=${fechaInicio}&fin=${fechaFin}`);
      setResultadoGerencial(data);
      toast.success("Reporte generado con éxito");
    } catch (e) {
      toast.error("Error al conectar con el servidor");
    } finally { setLoadingGerencial(false); }
  };

  const ejecutarReportePivot = async () => {
    if (!productoSeleccionado) return toast.error("Elige un producto");
    setLoadingPivot(true);
    try {
      const { data } = await api.get(`/ventas/reporte-pivot/?anio=${anio}&productoId=${productoSeleccionado}`);
      const tieneVentas = [data.ene, data.feb, data.mar, data.abr, data.may, data.jun, data.jul, data.ago, data.sep, data.oct, data.nov, data.dic].some(v => Number(v) > 0);
      if (!tieneVentas) {
        setDatosPivot(null);
        toast.error("Este producto no tiene ventas registradas");
      } else {
        setDatosPivot(data);
        toast.success("Análisis mensual cargado");
      }
    } catch (e) {
      setDatosPivot(null);
      toast.error("No se encontraron ventas para este periodo");
    } finally { setLoadingPivot(false); }
  };

  const ejecutarReporteProveedor = async () => {
    if (!proveedorSeleccionado) return toast.error("Elige un proveedor");
    setLoadingProveedor(true);
    try {
      const { data } = await api.get(`/ventas/productos-proveedor/?proveedorId=${proveedorSeleccionado}`);
      if (data.length === 0) {
        setProductosProveedor([]);
        toast.error("Este proveedor no tiene productos registrados actualmente");
      } else {
        setProductosProveedor(data);
        toast.success("Lista de productos cargada");
      }
    } catch (e) {
      setProductosProveedor([]);
      toast.error("Error al obtener productos");
    } finally { setLoadingProveedor(false); }
  };

  const ejecutarReporteDevoluciones = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingDevoluciones(true);
    try {
      const { data } = await api.get(`/ventas/reporte-devoluciones/?inicio=${fechaInicio}&fin=${fechaFin}`);
      if (data.length === 0) {
        setResultadoDevoluciones([]);
        toast.error("No se encontraron devoluciones en este periodo");
      } else {
        setResultadoDevoluciones(data);
        toast.success("Reporte de devoluciones cargado");
      }
    } catch (e) {
      setResultadoDevoluciones([]);
      toast.error("Error al conectar con el servidor");
    } finally { setLoadingDevoluciones(false); }
  };


  const ejecutarReportePerdidas = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingPerdidas(true);
    try {
      const { data } = await api.get(`/ventas/reporte-perdidas/?inicio=${fechaInicio}&fin=${fechaFin}`);
      if (data.length === 0) {
        setResultadoPerdidas([]);
        toast.error("No se encontraron perdidas");
      } else {
        setResultadoPerdidas(data);
        toast.success("Reporte de pérdidas cargado");
      }
    } catch (e) {
      setResultadoPerdidas([]);
      toast.error("Error al obtener perdidas");
    } finally { setLoadingPerdidas(false); }
  };

  const ejecutarVentasFiltradas = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingVentasFiltradas(true);
    try {
      const { data } = await api.get(`/ventas/reporte-ventas-filtradas/?inicio=${fechaInicio}&fin=${fechaFin}&estado=${estadoVentaFiltrada}`);
      setResultadoVentasFiltradas(data);
      if (data.length > 0) toast.success("Ventas filtradas cargadas");
      else toast.error("Sin resultados para el rango seleccionado");
    } catch (e) { toast.error("Error al obtener ventas filtradas"); } finally { setLoadingVentasFiltradas(false); }
  };

  const ejecutarTopProductos = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingTopProductos(true);
    try {
      const { data } = await api.get(`/ventas/reporte-top-productos/?inicio=${fechaInicio}&fin=${fechaFin}&limite=${limiteTopProductos}`);
      setResultadoTopProductos(data);
      if (data.length > 0) toast.success("Top productos cargado");
      else toast.error("Sin resultados para el rango seleccionado");
    } catch (e) { toast.error("Error al obtener top productos"); } finally { setLoadingTopProductos(false); }
  };

  const ejecutarGananciaProducto = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingGananciaProducto(true);
    try {
      const { data } = await api.get(`/ventas/reporte-ganancia-producto/?inicio=${fechaInicio}&fin=${fechaFin}&productoId=${productoGananciaId}`);
      setResultadoGananciaProducto(data);
      if (data.length > 0) toast.success("Ganancias cargadas");
      else toast.error("Sin resultados para el rango seleccionado");
    } catch (e) { toast.error("Error al obtener ganancias"); } finally { setLoadingGananciaProducto(false); }
  };

  /**
   * Ejecuta el reporte de comparación de ventas entre dos periodos.
   *
   * TRANSFORMACIÓN CRÍTICA — De "Fila Única" a "Múltiples Filas Visuales":
   *
   * La función SQL sp_comparar_ventas() retorna UNA SOLA FILA:
   *   { ventas_a: 5000, productos_a: 80, ventas_b: 7500, productos_b: 120 }
   *
   * El frontend necesita MÚLTIPLES FILAS para la tabla comparativa:
   *   | Métrica          | Periodo A | Periodo B | Diferencia |
   *   |------------------|-----------|-----------|------------|
   *   | Ventas Totales   | C$5,000   | C$7,500   | +C$2,500   |
   *   | Productos Vendidos | 80      | 120       | +40        |
   *
   * Por eso se construye `tablaComparativa`: un array donde cada elemento
   * es una fila de la tabla, creado a partir de los campos de la fila única.
   *
   * La diferencia (periodo_b - periodo_a) se calcula aquí para:
   *   1. Colorear en verde (positivo) o rojo (negativo) en la tabla.
   *   2. Mostrar el signo '+' explícitamente si la diferencia es positiva.
   *   3. Evitar modificar la función SQL almacenada.
   *
   * `esMonto`: Flag que indica si el valor debe formatearse con 'C$'.
   *   true  = dinero (Ventas Totales)
   *   false = cantidad entera (Productos Vendidos)
   */
  const ejecutarComparacion = async () => {
    if (!validarFechas(fechaInicioA, fechaFinA, 'Periodo A')) return;
    if (!validarFechas(fechaInicioB, fechaFinB, 'Periodo B')) return;
    setLoadingComparacion(true);
    try {
      const res = await api.get(`/ventas/reporte-comparacion-ventas/?inicioA=${fechaInicioA}&finA=${fechaFinA}&inicioB=${fechaInicioB}&finB=${fechaFinB}`);

      if (!res.data || res.data.length === 0) {
        toast.error("Sin resultados para estos periodos");
        setResultadoComparacion([]);
        return;
      }

      // Extraer la única fila devuelta por la API
      const d = res.data[0];

      // Transformar: 1 fila de la API → N filas visuales de la tabla
      const tablaComparativa = [
        {
          metrica: 'Ventas Totales',
          periodo_a: Number(d.ventas_a || 0),
          periodo_b: Number(d.ventas_b || 0),
          // diferencia: positivo = mejora, negativo = caída
          diferencia: Number(d.ventas_b || 0) - Number(d.ventas_a || 0),
          esMonto: true, // Formatear como C$
        },
        {
          metrica: 'Productos Vendidos',
          periodo_a: Number(d.productos_a || 0),
          periodo_b: Number(d.productos_b || 0),
          diferencia: Number(d.productos_b || 0) - Number(d.productos_a || 0),
          esMonto: false, // Formatear como número entero
        },
      ];

      setResultadoComparacion(tablaComparativa);
      toast.success("Comparación cargada");
    } catch (e) { toast.error("Error al obtener comparación"); } finally { setLoadingComparacion(false); }
  };

  const ejecutarComprasFiltradas = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingComprasFiltradas(true);
    try {
      const { data } = await api.get(`/inventario/reporte-compras-filtradas/?inicio=${fechaInicio}&fin=${fechaFin}&proveedorId=${proveedorComprasId}`);
      setResultadoComprasFiltradas(data);
      if (data.length > 0) toast.success("Compras cargadas");
      else toast.error("Sin resultados para el rango seleccionado");
    } catch (e) { toast.error("Error al obtener compras"); } finally { setLoadingComprasFiltradas(false); }
  };

  const ejecutarSinMovimiento = async () => {
    setLoadingSinMovimiento(true);
    try {
      const { data } = await api.get(`/inventario/reporte-productos-sin-movimiento/?dias=${diasSinMovimiento}`);
      setResultadoSinMovimiento(data);
      if (data.length > 0) toast.success("Productos sin movimiento cargados");
      else toast.error("Sin resultados");
    } catch (e) { toast.error("Error"); } finally { setLoadingSinMovimiento(false); }
  };

  //DOCUMENTO DE EXCEL CON EXCELJS

  const exportarExcelEstetico = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reporte de Miscelánea');

    sheet.columns = [
      { header: 'CÓDIGO/REF', key: 'id', width: 20 },
      { header: 'DESCRIPCIÓN', key: 'desc', width: 40 },
      { header: 'VALOR/STOCK', key: 'val', width: 20 },
    ];

    // Título Principal
    sheet.mergeCells('A1:C1');
    const title = sheet.getCell('A1');
    title.value = 'MISCELÁNEA BENDICIÓN DE DIOS - REPORTE';
    title.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    title.alignment = { horizontal: 'center' };

    if ((seleccionVista === '1' || seleccionVista === 'todos') && resultadoGerencial) {
      sheet.addRow([]);
      sheet.addRow(['--- REPORTE DE VENTAS ---']).font = { bold: true };
      sheet.addRow(['Monto Total Vendido', '', `C$ ${Number(resultadoGerencial.total_ventas).toLocaleString()}`]);
      sheet.addRow(['Promedio de Ventas', '', `C$ ${Number(resultadoGerencial.promedio_venta).toLocaleString()}`]);
      sheet.addRow(['Producto Estrella', '', resultadoGerencial.producto_mas_vendido]);
    }

    if ((seleccionVista === '2' || seleccionVista === 'todos') && datosPivot) {
      sheet.addRow([]);
      sheet.addRow(['--- VENTAS MENSUALES ---']).font = { bold: true };
      sheet.addRow(['Producto:', datosPivot.producto, '']);
      const headerMeses = sheet.addRow(['MES', 'VENTAS', '']);
      headerMeses.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEE2E6' } });
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const valores = [datosPivot.ene, datosPivot.feb, datosPivot.mar, datosPivot.abr, datosPivot.may, datosPivot.jun, datosPivot.jul, datosPivot.ago, datosPivot.sep, datosPivot.oct, datosPivot.nov, datosPivot.dic];
      meses.forEach((m, i) => {
        sheet.addRow([m, `C$ ${Number(valores[i] || 0).toLocaleString()}`, '']);
      });
    }

    if ((seleccionVista === '3' || seleccionVista === 'todos') && productosProveedor.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['--- PRODUCTOS POR PROVEEDOR ---']).font = { bold: true };
      const header = sheet.addRow(['CÓDIGO', 'DESCRIPCIÓN', 'EXISTENCIA']);
      header.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEE2E6' } });
      productosProveedor.forEach(p => {
        sheet.addRow([p.id, p.producto, p.unidades_disponibles + ' UNIDADES']);
      });
    }

    if ((seleccionVista === '4' || seleccionVista === 'todos') && resultadoDevoluciones.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['--- REPORTE DE DEVOLUCIONES ---']).font = { bold: true };
      const headerDev = sheet.addRow(['ID SOLICITUD', 'PRODUCTO', 'CANTIDAD', 'MOTIVO', 'FECHA', 'ESTADO']);
      headerDev.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEE2E6' } });
      resultadoDevoluciones.forEach(d => {
        const d_fecha = new Date(d.fecha);
        // add timezone offset back if needed, assuming the server returns YYYY-MM-DD
        sheet.addRow([
          d.id_solicitud,
          d.producto,
          d.cantidad,
          d.motivo || 'N/A',
          d_fecha.toLocaleDateString('es-NI', { timeZone: 'UTC' }),
          d.estado
        ]);
      });
    }

    if ((seleccionVista === '5' || seleccionVista === 'todos') && resultadoPerdidas.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['--- REPORTE DE PÉRDIDAS ---']).font = { bold: true };
      const headerPerd = sheet.addRow(['ID', 'TIPO', 'FECHA', 'TOTAL']);
      headerPerd.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEE2E6' } });
      resultadoPerdidas.forEach(d => {
        sheet.addRow([d.id, d.tipo_perdida, new Date(d.fecha).toLocaleDateString('es-NI', { timeZone: 'UTC' }), `C$ ${Number(d.total).toLocaleString()}`]);
      });
    }

    if ((seleccionVista === '6' || seleccionVista === 'todos') && resultadoVentasFiltradas.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['--- VENTAS FILTRADAS ---']).font = { bold: true };
      const headerVF = sheet.addRow(['ID VENTA', 'FECHA', 'ESTADO', 'TOTAL']);
      headerVF.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEE2E6' } });
      resultadoVentasFiltradas.forEach(d => {
        sheet.addRow([d.id_venta, new Date(d.fecha).toLocaleDateString('es-NI'), d.estado, `C$ ${Number(d.total).toLocaleString()}`]);
      });
    }

    if ((seleccionVista === '7' || seleccionVista === 'todos') && resultadoTopProductos.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['--- TOP PRODUCTOS ---']).font = { bold: true };
      const headerTP = sheet.addRow(['PRODUCTO', 'CATEGORÍA', 'VENDIDOS', 'INGRESO BRUTO']);
      headerTP.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEE2E6' } });
      resultadoTopProductos.forEach(d => {
        sheet.addRow([d.nombre_producto, d.categoria, d.cantidad_vendida, `C$ ${Number(d.ingreso_bruto).toLocaleString()}`]);
      });
    }

    if ((seleccionVista === '8' || seleccionVista === 'todos') && resultadoGananciaProducto.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['--- GANANCIA POR PRODUCTO ---']).font = { bold: true };
      const headerGP = sheet.addRow(['PRODUCTO', 'TOTAL VENTAS', 'COSTO TOTAL', 'GANANCIA BRUTA']);
      headerGP.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEE2E6' } });
      resultadoGananciaProducto.forEach(d => {
        sheet.addRow([d.nombre_producto, `C$ ${Number(d.total_ventas).toLocaleString()}`, `C$ ${Number(d.costo_total).toLocaleString()}`, `C$ ${Number(d.ganancia_bruta).toLocaleString()}`]);
      });
    }

    if ((seleccionVista === '9' || seleccionVista === 'todos') && resultadoComparacion.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['--- COMPARACIÓN DE PERIODOS ---']).font = { bold: true };
      const headerComp = sheet.addRow(['MÉTRICA', 'PERIODO A', 'PERIODO B', 'DIFERENCIA']);
      headerComp.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEE2E6' } });
      resultadoComparacion.forEach(d => {
        sheet.addRow([d.metrica, `C$ ${Number(d.valor_a || 0).toLocaleString()}`, `C$ ${Number(d.valor_b || 0).toLocaleString()}`, d.diferencia]);
      });
    }

    if ((seleccionVista === '10' || seleccionVista === 'todos') && resultadoComprasFiltradas.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['--- COMPRAS FILTRADAS ---']).font = { bold: true };
      const headerCF = sheet.addRow(['ID COMPRA', 'FECHA', 'PROVEEDOR', 'TOTAL COMPRA']);
      headerCF.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEE2E6' } });
      resultadoComprasFiltradas.forEach(d => {
        sheet.addRow([d.id_entrada, new Date(d.fecha_ingreso).toLocaleDateString('es-NI'), d.nombre_proveedor, `C$ ${Number(d.total_compra).toLocaleString()}`]);
      });
    }

    if ((seleccionVista === '11' || seleccionVista === 'todos') && resultadoSinMovimiento.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['--- PRODUCTOS SIN MOVIMIENTO ---']).font = { bold: true };
      const headerSM = sheet.addRow(['PRODUCTO', 'CATEGORÍA', 'STOCK ACTUAL', 'DÍAS SIN VENDER']);
      headerSM.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEE2E6' } });
      resultadoSinMovimiento.forEach(d => {
        sheet.addRow([d.nombre_producto, d.categoria, `${d.stock_actual} unidades`, `${d.dias_sin_venta} días`]);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Reporte_Miscelanea_BendicionDeDios_${new Date().getTime()}.xlsx`);
  };

  /**
   * Determina si hay datos suficientes para generar el PDF/Excel.
   * Evalúa si el reporte seleccionado tiene datos cargados.
   * Impedir imprimir una página en blanco mejora la experiencia del usuario.
   */
  const puedeImprimir = () => {
    if (seleccionVista === 'todos') {
      return !!resultadoGerencial || !!datosPivot || productosProveedor.length > 0 || resultadoDevoluciones.length > 0 || resultadoPerdidas.length > 0 || resultadoVentasFiltradas.length > 0 || resultadoTopProductos.length > 0 || resultadoGananciaProducto.length > 0 || resultadoComparacion.length > 0 || resultadoComprasFiltradas.length > 0 || resultadoSinMovimiento.length > 0;
    }
    if (seleccionVista === '1') return !!resultadoGerencial;
    if (seleccionVista === '2') return !!datosPivot;
    if (seleccionVista === '3') return productosProveedor.length > 0;
    if (seleccionVista === '4') return resultadoDevoluciones.length > 0;
    if (seleccionVista === '5') return resultadoPerdidas.length > 0;
    if (seleccionVista === '6') return resultadoVentasFiltradas.length > 0;
    if (seleccionVista === '7') return resultadoTopProductos.length > 0;
    if (seleccionVista === '8') return resultadoGananciaProducto.length > 0;
    if (seleccionVista === '9') return resultadoComparacion.length > 0;
    if (seleccionVista === '10') return resultadoComprasFiltradas.length > 0;
    if (seleccionVista === '11') return resultadoSinMovimiento.length > 0;
    return false;
  };

  /**
   * Activa el modo impresión y lanza el diálogo de impresión del navegador.
   *
   * setTimeout(200ms): Da tiempo al React para re-renderizar con `imprimiendo=true`
   * (ocultando filtros y mostrando el header formal) ANTES de que window.print()
   * capture el estado visual de la página.
   * Sin este delay, la UI aún mostraría los controles en el PDF.
   */
  const handleImprimirPDF = () => {
    if (!puedeImprimir()) {
      toast.error("Debe generar el reporte antes, para generar el PDF.");
      return;
    }
    setImprimiendo(true);
    setTimeout(() => {
      window.print();
      setImprimiendo(false);
    }, 200);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4">
      {/* TÍTULO PRINCIPAL (PANTALLA) */}
      {!imprimiendo && (
        <div className="border-b pb-6 text-center">
          <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">Reportes de la Miscelánea</h1>
          <p className="text-xl text-slate-600 font-medium italic mt-1">"Bendición de Dios"</p>
        </div>
      )}

      {/* HEADER DE IMPRESIÓN */}
      {imprimiendo && (
        <div className="flex flex-col mb-10 border-b-4 border-slate-900 pb-6 print:break-after-avoid">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">MISCELÁNEA BENDICIÓN DE DIOS</h1>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest"></p>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-md border border-slate-300">
                Documento Oficial
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Emisión: {new Date().toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE FECHAS GLOBAL */}
      {!imprimiendo && (
        <Card className="p-4 bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2 text-slate-700 font-black text-sm uppercase tracking-wider">
              <CalendarDays size={20} className="text-blue-600" />
              Rango de Fechas Global
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Desde</label>
                <input type="date" className="p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hasta</label>
                <input type="date" className="p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
              </div>
              {fechaInicio && fechaFin && (
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-lg font-bold">
                  {fechaInicio.split('-').reverse().join('/')} → {fechaFin.split('-').reverse().join('/')}
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* PANEL DE SELECCIÓN (LA PREGUNTA) */}
      {!imprimiendo && (
        <Card className="p-4 bg-slate-800 text-white shadow-xl border-none">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-green-500" size={24} />
              <p className="font-bold text-sm uppercase tracking-wider">¿Qué desea incluir en el documento?</p>
            </div>
            <div className="flex flex-wrap gap-2">

              <select
                value={seleccionVista}
                onChange={(e: any) => setSeleccionVista(e.target.value)}
                className="bg-slate-700 text-white text-xs font-bold p-2 rounded-lg outline-none border border-slate-600 cursor-pointer"
              >
                <option value="todos">Mostrar Todo</option>
                <option value="1">Reporte de Ventas</option>
                <option value="2">Ventas Mensuales</option>
                <option value="3">Productos del Proveedor</option>
                <option value="4">Devoluciones</option>
                <option value="5">Pérdidas</option>
                <option value="6">Ventas Filtradas</option>
                <option value="7">Top Productos</option>
                <option value="8">Ganancia Producto</option>
                <option value="9">Comparación Periodos</option>
                <option value="10">Compras Filtradas</option>
                <option value="11">Sin Movimiento</option>
              </select>

              <Button onClick={handleImprimirPDF} className="bg-white text-slate-900 hover:bg-slate-200 font-black text-xs">
                <Printer size={16} className="mr-2" /> PDF
              </Button>
              <Button onClick={exportarExcelEstetico} className="bg-green-600 hover:bg-green-700 text-white font-black text-xs">
                <FileSpreadsheet size={16} className="mr-2" /> DOCUMENTO EXCEL
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* SECCIÓN DE FILTROS */}
      {!imprimiendo && (
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4 border-t-4 border-green-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-green-700"><TrendingUp size={24} /> <h3 className="truncate">Reporte de Ventas</h3></div>
            <p className="text-xs text-slate-400">Usa el rango de fechas global</p>
            <Button onClick={ejecutarReporteGerencial} className="w-full bg-green-700 hover:bg-green-800 text-white font-bold uppercase tracking-widest">{loadingGerencial ? <Loader2 className="animate-spin" /> : "Generar"}</Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-blue-700"><CalendarDays size={24} /> <h3 className="truncate">Ventas Mensuales</h3></div>
            <select className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500" value={productoSeleccionado} onChange={(e) => setProductoSeleccionado(e.target.value)}>
              <option value="">-- Seleccionar Producto --</option>
              {productosLista.map(p => <option key={p.id} value={p.id}>{p.Nombre || p.name}</option>)}
            </select>
            <Button onClick={ejecutarReportePivot} className="w-full bg-blue-700 text-white font-bold uppercase tracking-widest">{loadingPivot ? <Loader2 className="animate-spin" /> : "Analizar"}</Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-purple-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-purple-700"><Users size={24} /> <h3 className="truncate">Productos del Proveedor</h3></div>
            <select className="w-full p-2 border rounded text-sm outline-none focus:border-purple-500" value={proveedorSeleccionado} onChange={(e) => setProveedorSeleccionado(e.target.value)}>
              <option value="">-- Seleccionar Proveedor --</option>
              {proveedoresLista.map(prov => <option key={prov.id} value={prov.id}>{prov.Nombre || prov.name}</option>)}
            </select>
            <Button onClick={ejecutarReporteProveedor} className="w-full bg-purple-700 text-white font-bold uppercase tracking-widest">{loadingProveedor ? <Loader2 className="animate-spin" /> : "Listar"}</Button>
          </Card>


          <Card className="p-6 space-y-4 border-t-4 border-orange-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-orange-700"><Undo2 size={24} /> <h3 className="truncate">Devoluciones</h3></div>
            <p className="text-xs text-slate-400">Usa el rango de fechas global</p>
            <Button onClick={ejecutarReporteDevoluciones} className="w-full bg-orange-700 hover:bg-orange-800 text-white font-bold uppercase tracking-widest">{loadingDevoluciones ? <Loader2 className="animate-spin" /> : "Generar"}</Button>
          </Card>

          {/* PERDIDAS */}
          <Card className="p-6 space-y-4 border-t-4 border-red-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-red-700"><Undo2 size={24} /> <h3 className="truncate">Pérdidas</h3></div>
            <p className="text-xs text-slate-400">Usa el rango de fechas global</p>
            <Button onClick={ejecutarReportePerdidas} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold uppercase tracking-widest">{loadingPerdidas ? <Loader2 className="animate-spin" /> : "Generar"}</Button>
          </Card>

          {/* VENTAS FILTRADAS */}
          <Card className="p-6 space-y-4 border-t-4 border-green-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-green-700"><TrendingUp size={24} /> <h3 className="truncate">Ventas Filtradas</h3></div>
            <select className="w-full p-2 border rounded text-sm outline-none focus:border-green-500" value={estadoVentaFiltrada} onChange={(e) => setEstadoVentaFiltrada(e.target.value)}>
              <option value="">Todas</option>
              <option value="Completada">Completada</option>
              <option value="Anulada">Anulada</option>
            </select>
            <Button onClick={ejecutarVentasFiltradas} className="w-full bg-green-700 hover:bg-green-800 text-white font-bold uppercase tracking-widest">{loadingVentasFiltradas ? <Loader2 className="animate-spin" /> : "Generar"}</Button>
          </Card>

          {/* TOP PRODUCTOS */}
          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-blue-700"><Package size={24} /> <h3 className="truncate">Top Productos</h3></div>
            <input type="number" className="p-2 border rounded text-sm w-full outline-none focus:border-blue-500" placeholder="Límite (ej: 10)" value={limiteTopProductos} onChange={(e) => setLimiteTopProductos(e.target.value)} />
            <Button onClick={ejecutarTopProductos} className="w-full bg-blue-700 text-white font-bold uppercase tracking-widest">{loadingTopProductos ? <Loader2 className="animate-spin" /> : "Analizar"}</Button>
          </Card>

          {/* GANANCIA POR PRODUCTO */}
          <Card className="p-6 space-y-4 border-t-4 border-purple-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-purple-700"><TrendingUp size={24} /> <h3 className="truncate">Ganancia Producto</h3></div>
            <select className="w-full p-2 border rounded text-sm outline-none focus:border-purple-500" value={productoGananciaId} onChange={(e) => setProductoGananciaId(e.target.value)}>
              <option value="">Todos los productos</option>
              {productosLista.map(p => <option key={p.id} value={p.id}>{p.Nombre || p.name}</option>)}
            </select>
            <Button onClick={ejecutarGananciaProducto} className="w-full bg-purple-700 text-white font-bold uppercase tracking-widest">{loadingGananciaProducto ? <Loader2 className="animate-spin" /> : "Generar"}</Button>
          </Card>

          {/* COMPRAS FILTRADAS */}
          <Card className="p-6 space-y-4 border-t-4 border-teal-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-teal-700"><Package size={24} /> <h3 className="truncate">Compras Filtradas</h3></div>
            <select className="w-full p-2 border rounded text-sm outline-none focus:border-teal-500" value={proveedorComprasId} onChange={(e) => setProveedorComprasId(e.target.value)}>
              <option value="">Todos los proveedores</option>
              {proveedoresLista.map(p => <option key={p.id} value={p.id}>{p.Nombre || p.name}</option>)}
            </select>
            <Button onClick={ejecutarComprasFiltradas} className="w-full bg-teal-700 text-white font-bold uppercase tracking-widest">{loadingComprasFiltradas ? <Loader2 className="animate-spin" /> : "Generar"}</Button>
          </Card>

          {/* PRODUCTOS SIN MOVIMIENTO */}
          <Card className="p-6 space-y-4 border-t-4 border-gray-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-gray-700"><Package size={24} /> <h3 className="truncate">Sin Movimiento</h3></div>
            <input type="number" className="p-2 border rounded text-sm w-full outline-none focus:border-gray-500" placeholder="Días (ej: 30)" value={diasSinMovimiento} onChange={(e) => setDiasSinMovimiento(e.target.value)} />
            <Button onClick={ejecutarSinMovimiento} className="w-full bg-gray-700 text-white font-bold uppercase tracking-widest">{loadingSinMovimiento ? <Loader2 className="animate-spin" /> : "Analizar"}</Button>
          </Card>

          {/* COMPARACION VENTAS */}
          <Card className="p-6 space-y-4 border-t-4 border-indigo-600 shadow-lg bg-white lg:col-span-2">
            <div className="flex items-center gap-2 font-bold text-indigo-700"><TrendingUp size={24} /> <h3 className="truncate">Comparación Periodos</h3></div>
            <div className="grid grid-cols-4 gap-2">
              <input type="date" className="p-2 border rounded text-xs w-full outline-none" value={fechaInicioA} onChange={(e) => setFechaInicioA(e.target.value)} title="Inicio A" />
              <input type="date" className="p-2 border rounded text-xs w-full outline-none" value={fechaFinA} onChange={(e) => setFechaFinA(e.target.value)} title="Fin A" />
              <input type="date" className="p-2 border rounded text-xs w-full outline-none" value={fechaInicioB} onChange={(e) => setFechaInicioB(e.target.value)} title="Inicio B" />
              <input type="date" className="p-2 border rounded text-xs w-full outline-none" value={fechaFinB} onChange={(e) => setFechaFinB(e.target.value)} title="Fin B" />
            </div>
            <Button onClick={ejecutarComparacion} className="w-full bg-indigo-700 text-white font-bold uppercase tracking-widest">{loadingComparacion ? <Loader2 className="animate-spin" /> : "Comparar"}</Button>
          </Card>

        </div>
      )}

      {/* ÁREA DE RESULTADOS DINÁMICOS */}
      <div className={`mt-12 ${imprimiendo ? 'block space-y-8 pb-0' : 'flex flex-col gap-12 pb-32'}`}>
        {resultadoGerencial && (!imprimiendo || seleccionVista === '1' || seleccionVista === 'todos') && (
          <Card className={`p-6 border-l-8 border-green-500 bg-white ${imprimiendo ? 'border shadow-none block' : 'shadow-xl'} print:break-inside-avoid`}>
            <div className="flex flex-col md:flex-row md:items-end justify-between border-b pb-2 mb-4">
              <h4 className="font-black text-green-700 uppercase flex items-center gap-2 print:text-green-800"><TrendingUp size={22} /> Resumen de Desempeño</h4>
              <span className="text-xs font-bold text-slate-500 print:text-slate-600 uppercase tracking-widest mt-2 md:mt-0">
                Período: {fechaInicio.split('-').reverse().join('/')} al {fechaFin.split('-').reverse().join('/')}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm print:bg-white print:border-slate-200 print:shadow-none">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter print:text-slate-500">Monto Total Vendido</span>
                <p className="text-2xl font-black text-slate-800">C$ {Number(resultadoGerencial.total_ventas || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm print:bg-white print:border-slate-200 print:shadow-none">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter print:text-slate-500">Promedio de ventas</span>
                <p className="text-2xl font-black text-slate-800">C$ {Number(resultadoGerencial.promedio_venta || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm print:bg-white print:border-slate-200 print:shadow-none">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter print:text-slate-500">Producto Estrella</span>
                <p className="text-2xl font-black text-green-600 uppercase truncate print:text-green-700">{resultadoGerencial.producto_mas_vendido || 'N/A'}</p>
              </div>
            </div>
          </Card>
        )}

        {datosPivot && (!imprimiendo || seleccionVista === '2' || seleccionVista === 'todos') && (
          <Card className={`p-8 border-0 bg-white relative ${imprimiendo ? 'border border-slate-200 shadow-none p-6 block overflow-visible' : 'shadow-2xl overflow-hidden'} print:break-inside-avoid`}>
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
            <h4 className="font-black mb-6 flex items-center gap-2 text-blue-700 text-lg uppercase tracking-widest print:text-blue-800">
              <Package size={24} /> Análisis de Ventas: {datosPivot.producto}
            </h4>
            <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-inner print:shadow-none print:border-slate-300 print:overflow-visible">
              <table className="w-full text-center">
                <thead className="bg-slate-50 uppercase font-black text-[11px] text-slate-500 border-b print:bg-slate-100 print:text-slate-700">
                  <tr>{['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map(m => <th key={m} className="p-5 border-r last:border-r-0 print:p-3 print:border-slate-300">{m}</th>)}</tr>
                </thead>
                <tbody className="text-sm">
                  <tr>
                    {[datosPivot.ene, datosPivot.feb, datosPivot.mar, datosPivot.abr, datosPivot.may, datosPivot.jun, datosPivot.jul, datosPivot.ago, datosPivot.sep, datosPivot.oct, datosPivot.nov, datosPivot.dic].map((v, i) => (
                      <td key={i} className="p-6 font-black text-blue-600 border-r last:border-r-0 print:p-3 print:text-blue-800 print:border-slate-300">C${Number(v || 0).toLocaleString()}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {productosProveedor.length > 0 && (!imprimiendo || seleccionVista === '3' || seleccionVista === 'todos') && (
          <Card className={`p-8 border-0 bg-white relative ${imprimiendo ? 'border border-slate-200 shadow-none p-6 block overflow-visible' : 'shadow-2xl overflow-hidden'}`}>
            <div className="absolute top-0 left-0 w-full h-1.5 bg-purple-600 print:h-2"></div>
            <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6">
              <Users className="text-purple-600 print:text-purple-800" size={28} /> Productos abastecidos por el proveedor
            </h4>
            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 print:overflow-visible">
              <table className="w-full text-left print:border-collapse">
                <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                  <tr><th className="p-6 print:p-3">Cód.</th><th className="p-6 print:p-3">Descripción del Artículo</th><th className="p-6 print:p-3 text-center">Existencia Real</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                  {productosProveedor.map((p) => (
                    <tr key={p.id}>
                      <td className="p-6 print:p-3 font-mono text-slate-400 print:text-slate-600 text-xs">#{p.id}</td>
                      <td className="p-6 print:p-3 font-black text-slate-700 uppercase">{p.producto}</td>
                      <td className="p-6 print:p-3 text-center">
                        <span className={`inline-block w-36 py-2.5 rounded-xl font-black text-xs shadow-sm border print:shadow-none ${p.unidades_disponibles < 10 ? 'bg-red-50 text-red-600 border-red-100 print:bg-red-100 print:text-red-800' : 'bg-green-50 text-green-600 border-green-100 print:bg-green-100 print:text-green-800'}`}>
                          {p.unidades_disponibles} UNIDADES
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {resultadoDevoluciones.length > 0 && (!imprimiendo || seleccionVista === '4' || seleccionVista === 'todos') && (
          <Card className={`p-8 border-0 bg-white relative ${imprimiendo ? 'border border-slate-200 shadow-none p-6 block overflow-visible' : 'shadow-2xl overflow-hidden'}`}>
            <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-600 print:h-2"></div>
            <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6">
              <Undo2 className="text-orange-600 print:text-orange-800" size={28} /> Reporte de Devoluciones
            </h4>
            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 print:overflow-visible">
              <table className="w-full text-left print:border-collapse">
                <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                  <tr>
                    <th className="p-6 print:p-3">ID Sol.</th>
                    <th className="p-6 print:p-3">Producto</th>
                    <th className="p-6 print:p-3 text-center">Cantidad</th>
                    <th className="p-6 print:p-3">Motivo</th>
                    <th className="p-6 print:p-3">Fecha</th>
                    <th className="p-6 print:p-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                  {resultadoDevoluciones.map((d, index) => (
                    <tr key={index}>
                      <td className="p-6 print:p-3 font-mono text-slate-600 text-xs">#{d.id_solicitud}</td>
                      <td className="p-6 print:p-3 font-black text-slate-700 uppercase text-xs">{d.producto}</td>
                      <td className="p-6 print:p-3 text-center font-bold text-slate-700 text-xs">{d.cantidad}</td>
                      <td className="p-6 print:p-3 text-slate-500 text-xs">{d.motivo || 'N/A'}</td>
                      <td className="p-6 print:p-3 font-mono text-slate-600 text-xs">{new Date(d.fecha).toLocaleDateString('es-NI', { timeZone: 'UTC' })}</td>
                      <td className="p-6 print:p-3 font-black text-orange-600 uppercase text-xs">{d.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {resultadoPerdidas.length > 0 && (!imprimiendo || seleccionVista === '5' || seleccionVista === 'todos') && (
          <Card className={`p-8 border-0 bg-white relative ${imprimiendo ? 'border border-slate-200 shadow-none p-6 block overflow-visible' : 'shadow-2xl overflow-hidden'} print:break-inside-avoid`}>
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600 print:h-2"></div>
            <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6"><Undo2 className="text-red-600 print:text-red-800" size={28} /> Reporte de Pérdidas</h4>
            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 print:overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="p-6">ID</th><th className="p-6">Tipo</th><th className="p-6">Fecha</th><th className="p-6 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resultadoPerdidas.map((d, index) => (
                    <tr key={index}>
                      <td className="p-6 font-mono text-slate-600 text-xs">#{d.id}</td>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">{d.tipo_perdida}</td>
                      <td className="p-6 font-mono text-slate-600 text-xs">{new Date(d.fecha).toLocaleDateString('es-NI', { timeZone: 'UTC' })}</td>
                      <td className="p-6 font-black text-red-600 uppercase text-xs text-right">C$ {Number(d.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {resultadoVentasFiltradas.length > 0 && (!imprimiendo || seleccionVista === '6' || seleccionVista === 'todos') && (
          <Card className={`p-8 border-0 bg-white relative ${imprimiendo ? 'border border-slate-200 shadow-none p-6 block overflow-visible' : 'shadow-2xl overflow-hidden'} print:break-inside-avoid`}>
            <div className="absolute top-0 left-0 w-full h-1.5 bg-green-600 print:h-2"></div>
            <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6"><TrendingUp className="text-green-600 print:text-green-800" size={28} /> Ventas Filtradas</h4>
            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 print:overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="p-6">ID Venta</th><th className="p-6">Fecha</th><th className="p-6">Estado</th><th className="p-6 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resultadoVentasFiltradas.map((d, index) => (
                    <tr key={index}>
                      <td className="p-6 font-mono text-slate-600 text-xs">#{d.id_venta}</td>
                      <td className="p-6 font-mono text-slate-600 text-xs">{new Date(d.fecha).toLocaleDateString('es-NI')}</td>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">{d.estado}</td>
                      <td className="p-6 font-black text-green-600 uppercase text-xs text-right">C$ {Number(d.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {resultadoTopProductos.length > 0 && (!imprimiendo || seleccionVista === '7' || seleccionVista === 'todos') && (
          <Card className={`p-8 border-0 bg-white relative ${imprimiendo ? 'border border-slate-200 shadow-none p-6 block overflow-visible' : 'shadow-2xl overflow-hidden'} print:break-inside-avoid`}>
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
            <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6"><Package className="text-blue-600 print:text-blue-800" size={28} /> Top Productos</h4>
            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 print:overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="p-6">Producto</th><th className="p-6">Categoría</th><th className="p-6">Vendidos</th><th className="p-6 text-right">Ingreso Bruto</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resultadoTopProductos.map((d, index) => (
                    <tr key={index}>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">{d.nombre_producto}</td>
                      <td className="p-6 font-mono text-slate-600 text-xs">{d.categoria}</td>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">{d.cantidad_vendida}</td>
                      <td className="p-6 font-black text-blue-600 uppercase text-xs text-right">C$ {Number(d.ingreso_bruto).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {resultadoGananciaProducto.length > 0 && (!imprimiendo || seleccionVista === '8' || seleccionVista === 'todos') && (
          <Card className={`p-8 border-0 bg-white relative ${imprimiendo ? 'border border-slate-200 shadow-none p-6 block overflow-visible' : 'shadow-2xl overflow-hidden'} print:break-inside-avoid`}>
            <div className="absolute top-0 left-0 w-full h-1.5 bg-purple-600 print:h-2"></div>
            <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6"><TrendingUp className="text-purple-600 print:text-purple-800" size={28} /> Ganancia Por Producto</h4>
            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 print:overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="p-6">Producto</th><th className="p-6">Total Ventas</th><th className="p-6">Costo Total</th><th className="p-6 text-right">Ganancia Bruta</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resultadoGananciaProducto.map((d, index) => (
                    <tr key={index}>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">{d.nombre_producto}</td>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">C$ {Number(d.total_ventas).toLocaleString()}</td>
                      <td className="p-6 font-black text-red-600 uppercase text-xs">C$ {Number(d.costo_total).toLocaleString()}</td>
                      <td className="p-6 font-black text-purple-600 uppercase text-xs text-right">C$ {Number(d.ganancia_bruta).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {resultadoComparacion.length > 0 && (!imprimiendo || seleccionVista === '9' || seleccionVista === 'todos') && (
          <Card className={`p-8 border-0 bg-white relative ${imprimiendo ? 'border border-slate-200 shadow-none p-6 block overflow-visible' : 'shadow-2xl overflow-hidden'} print:break-inside-avoid`}>
            <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600 print:h-2"></div>
            <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6"><TrendingUp className="text-indigo-600 print:text-indigo-800" size={28} /> Comparación de Periodos</h4>
            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 print:overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="p-6">Métrica</th><th className="p-6">Periodo A</th><th className="p-6">Periodo B</th><th className="p-6 text-right">Diferencia</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resultadoComparacion.map((d, index) => (
                    <tr key={index}>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">{d.metrica}</td>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">
                        {d.esMonto ? `C$ ${d.periodo_a.toLocaleString()}` : d.periodo_a.toLocaleString()}
                      </td>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">
                        {d.esMonto ? `C$ ${d.periodo_b.toLocaleString()}` : d.periodo_b.toLocaleString()}
                      </td>
                      <td className={`p-6 font-black uppercase text-xs text-right ${d.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {d.diferencia >= 0 ? '+' : ''}{d.esMonto ? `C$ ${d.diferencia.toLocaleString()}` : d.diferencia.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {resultadoComprasFiltradas.length > 0 && (!imprimiendo || seleccionVista === '10' || seleccionVista === 'todos') && (
          <Card className={`p-8 border-0 bg-white relative ${imprimiendo ? 'border border-slate-200 shadow-none p-6 block overflow-visible' : 'shadow-2xl overflow-hidden'} print:break-inside-avoid`}>
            <div className="absolute top-0 left-0 w-full h-1.5 bg-teal-600 print:h-2"></div>
            <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6"><Package className="text-teal-600 print:text-teal-800" size={28} /> Compras Filtradas</h4>
            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 print:overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="p-6">ID Compra</th><th className="p-6">Fecha</th><th className="p-6">Proveedor</th><th className="p-6 text-right">Total Compra</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resultadoComprasFiltradas.map((d, index) => (
                    <tr key={index}>
                      <td className="p-6 font-mono text-slate-600 text-xs">#{d.id_entrada}</td>
                      <td className="p-6 font-mono text-slate-600 text-xs">{new Date(d.fecha_ingreso).toLocaleDateString('es-NI')}</td>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">{d.nombre_proveedor}</td>
                      <td className="p-6 font-black text-teal-600 uppercase text-xs text-right">C$ {Number(d.total_compra).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {resultadoSinMovimiento.length > 0 && (!imprimiendo || seleccionVista === '11' || seleccionVista === 'todos') && (
          <Card className={`p-8 border-0 bg-white relative ${imprimiendo ? 'border border-slate-200 shadow-none p-6 block overflow-visible' : 'shadow-2xl overflow-hidden'} print:break-inside-avoid`}>
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-600 print:h-2"></div>
            <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6"><Package className="text-gray-600 print:text-gray-800" size={28} /> Productos Sin Movimiento</h4>
            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 print:overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="p-6">Producto</th><th className="p-6">Categoría</th><th className="p-6">Stock Actual</th><th className="p-6 text-right">Días Sin Venta</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resultadoSinMovimiento.map((d, index) => (
                    <tr key={index}>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">{d.nombre_producto}</td>
                      <td className="p-6 font-mono text-slate-600 text-xs">{d.categoria}</td>
                      <td className="p-6 font-black text-slate-700 uppercase text-xs">{d.stock_actual} unidades</td>
                      <td className="p-6 font-black text-gray-600 uppercase text-xs text-right">{d.dias_sin_venta} días</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      </div>

      <style>{`
        @media print {
          @page { size: letter; margin: 1.5cm; }
          .no-print { display: none !important; }
          body { 
            background: #ffffff !important; 
            padding: 0 !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            color: #0f172a !important;
          }
          
          /* Mejoras visuales para impresión */
          h1, h2, h3, h4, th, p, span, td {
            color: #0f172a !important;
          }
          th {
            background-color: #f1f5f9 !important; /* bg-slate-100 */
            border-bottom: 2px solid #cbd5e1 !important; /* border-slate-300 */
          }
          td {
            border-bottom: 1px solid #e2e8f0 !important; /* border-slate-200 */
          }
          .print\\:bg-slate-100 { background-color: #f1f5f9 !important; }
          .print\\:bg-white { background-color: #ffffff !important; }
          .print\\:border-slate-300 { border-color: #cbd5e1 !important; }
          .print\\:text-slate-500 { color: #64748b !important; }
          .print\\:text-slate-700 { color: #334155 !important; }
          .print\\:text-slate-800 { color: #1e293b !important; }
          .print\\:text-slate-900 { color: #0f172a !important; }
          
          /* Evitar cortes indeseados */
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; }
          .print\\:break-inside-avoid { page-break-inside: avoid; }
          .print\\:break-after-avoid { page-break-after: avoid; }
          
          #sonner-toaster, [data-sonner-toaster] { display: none !important; }
          
          /* Estilo para los badges en impresión */
          .print\\:bg-red-100 { background-color: #fee2e2 !important; color: #991b1b !important; border-color: #fca5a5 !important; }
          .print\\:bg-green-100 { background-color: #dcfce3 !important; color: #166534 !important; border-color: #86efac !important; }
        }
      `}</style>
    </div>
  );
}