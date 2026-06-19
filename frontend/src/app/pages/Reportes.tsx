/**
 * @fileoverview Página de Reportes Gerenciales — "La Bendición de Dios"
 *
 * Página más compleja del sistema. Centraliza 11 tipos de reportes independientes
 * que se pueden consultar, imprimir en PDF y exportar a Excel.
 *
 * ARQUITECTURA DE ESTADO:
 * Cada reporte tiene su propio par de estados:
 * - `resultado*`:  Los datos recibidos de la API (array o objeto).
 * - `loading*`:    Boolean que controla el spinner mientras se carga.
 * Separar los estados por reporte permite que múltiples reportes muestren
 * sus datos simultáneamente en la misma página sin interferirse.
 *
 * FLUJO GLOBAL DE FECHAS:
 * Los estados `fechaInicio` y `fechaFin` son compartidos por la mayoría
 * de reportes. Se ingresan UNA SOLA VEZ en la barra de "Rango de Fechas
 * Global" y se reutilizan en cada petición. Esto evita que el usuario
 * ingrese las mismas fechas repetidamente.
 *
 * TRANSFORMACIÓN DE DATOS — Reporte de Comparación:
 * La función sp_comparar_ventas() devuelve UNA SOLA FILA con columnas:
 * { ventas_a, productos_a, ventas_b, productos_b }
 * El frontend transforma esa fila en MÚLTIPLES FILAS VISUALES para la tabla:
 * Fila 1: { metrica: 'Ventas Totales',   periodo_a, periodo_b, diferencia }
 * Fila 2: { metrica: 'Productos Vendidos', periodo_a, periodo_b, diferencia }
 * La diferencia se calcula aquí (frontend) porque es trivial y evita
 * modificar la función SQL almacenada.
 *
 * MODO IMPRESIÓN Y ENFOQUE:
 * El estado `seleccionVista` controla qué reporte se está visualizando.
 * Al ser distinto de "menu", oculta los filtros y muestra solo el reporte activo.
 * El estado `imprimiendo` controla la visibilidad de elementos de UI.
 * Al activarse, oculta controles, y muestra un header formal de documento.
 */
import React, { useState, useEffect } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  TrendingUp,
  CalendarDays,
  Users,
  Package,
  Loader2,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  Undo2,
} from "lucide-react";
import api from "../api/axiosInstance";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export function Reportes() {
  // ── Datos maestros cargados al montar (listas para los selects) ─────────────
  const [productosLista, setProductosLista] = useState<any[]>([]);
  const [proveedoresLista, setProveedoresLista] = useState<any[]>([]);

  // ── Estados específicos de cada reporte (datos + spinner) ───────────────────
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState("");

  const [resultadoGerencial, setResultadoGerencial] = useState<any>(null);
  const [loadingGerencial, setLoadingGerencial] = useState(false);

  const [datosPivot, setDatosPivot] = useState<any>(null);
  const [loadingPivot, setLoadingPivot] = useState(false);

  const [productosProveedor, setProductosProveedor] = useState<any[]>([]);
  const [loadingProveedor, setLoadingProveedor] = useState(false);

  const [resultadoDevoluciones, setResultadoDevoluciones] = useState<any[]>([]);
  const [loadingDevoluciones, setLoadingDevoluciones] = useState(false);

  const [imprimiendo, setImprimiendo] = useState(false);

  // ── Reportes avanzados (sp_*) ────────────────────────────────────────────────
  const [estadoVentaFiltrada, setEstadoVentaFiltrada] = useState("");
  const [resultadoVentasFiltradas, setResultadoVentasFiltradas] = useState<
    any[]
  >([]);
  const [loadingVentasFiltradas, setLoadingVentasFiltradas] = useState(false);

  const [limiteTopProductos, setLimiteTopProductos] = useState("10");
  const [resultadoTopProductos, setResultadoTopProductos] = useState<any[]>([]);
  const [loadingTopProductos, setLoadingTopProductos] = useState(false);

  const [productoGananciaId, setProductoGananciaId] = useState("");
  const [resultadoGananciaProducto, setResultadoGananciaProducto] = useState<
    any[]
  >([]);
  const [loadingGananciaProducto, setLoadingGananciaProducto] = useState(false);

  // ── Rango de fechas GLOBAL compartido por la mayoría de reportes ────────────
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const [fechaInicioA, setFechaInicioA] = useState("");
  const [fechaFinA, setFechaFinA] = useState("");
  const [fechaInicioB, setFechaInicioB] = useState("");
  const [fechaFinB, setFechaFinB] = useState("");

  const [resultadoComparacion, setResultadoComparacion] = useState<any[]>([]);
  const [loadingComparacion, setLoadingComparacion] = useState(false);

  const [proveedorComprasId, setProveedorComprasId] = useState("");
  const [resultadoComprasFiltradas, setResultadoComprasFiltradas] = useState<
    any[]
  >([]);
  const [loadingComprasFiltradas, setLoadingComprasFiltradas] = useState(false);

  const [diasSinMovimiento, setDiasSinMovimiento] = useState("30");
  const [resultadoSinMovimiento, setResultadoSinMovimiento] = useState<any[]>(
    [],
  );
  const [loadingSinMovimiento, setLoadingSinMovimiento] = useState(false);

  const [resultadoPerdidas, setResultadoPerdidas] = useState<any[]>([]);
  const [loadingPerdidas, setLoadingPerdidas] = useState(false);

  const fechaFinCompleta = `${fechaFin} 23:59:59`;
  const fechaFinBCompleta = `${fechaFinB} 23:59:59`;
  const fechaFinACompleta = `${fechaFinA} 23:59:59`;

  /**
   * seleccionVista: Controla qué reporte(s) incluir en PDF/Excel y el Modo Enfoque.
   * 'menu' = Muestra cuadrícula de opciones; '1'..'11' = Muestra reporte específico.
   */
  const [seleccionVista, setSeleccionVista] = useState<string>("menu");

  const validarFechas = (inicio: string, fin: string, label = ""): boolean => {
    const prefix = label ? `${label}: ` : "";
    if (!inicio || !fin) {
      toast.error(`${prefix}Selecciona ambas fechas`);
      return false;
    }
    if (new Date(inicio) > new Date(fin)) {
      toast.error(
        `${prefix}La fecha de inicio no puede ser mayor a la fecha final`,
      );
      return false;
    }
    return true;
  };

  useEffect(() => {
    const controller = new AbortController();
    const cargarDatos = async () => {
      try {
        const [prodRes, provRes] = await Promise.all([
          api.get("/catalogo/productos/", { signal: controller.signal }),
          api.get("/catalogo/proveedores/", { signal: controller.signal }),
        ]);
        setProductosLista(prodRes.data.results ?? prodRes.data ?? []);
        setProveedoresLista(provRes.data.results ?? provRes.data ?? []);
      } catch (e: any) {
        if (e.name !== "CanceledError")
          toast.error("Error al cargar datos maestros");
      }
    };
    cargarDatos();
    return () => controller.abort();
  }, []);

  const ejecutarReporteGerencial = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingGerencial(true);
    try {
      const { data } = await api.get(
        `/ventas/reporte-gerencial/?inicio=${fechaInicio}&fin=${fechaFinCompleta}`,
      );
      setResultadoGerencial(data);
      toast.success("Reporte generado con éxito");
      setSeleccionVista("1");
    } catch (e) {
      toast.error("Error al conectar con el servidor");
    } finally {
      setLoadingGerencial(false);
    }
  };

  const ejecutarReportePivot = async () => {
    if (!productoSeleccionado) return toast.error("Elige un producto");
    setLoadingPivot(true);
    try {
      const { data } = await api.get(
        `/ventas/reporte-pivot/?anio=${anio}&productoId=${productoSeleccionado}`,
      );
      const tieneVentas = [
        data.ene,
        data.feb,
        data.mar,
        data.abr,
        data.may,
        data.jun,
        data.jul,
        data.ago,
        data.sep,
        data.oct,
        data.nov,
        data.dic,
      ].some((v) => Number(v) > 0);

      if (!tieneVentas) {
        setDatosPivot(null);
        toast.error("Este producto no tiene ventas registradas");
      } else {
        setDatosPivot(data);
        toast.success("Análisis mensual cargado");
        setSeleccionVista("2");
      }
    } catch (e) {
      setDatosPivot(null);
      toast.error("No se encontraron ventas para este periodo");
    } finally {
      setLoadingPivot(false);
    }
  };

  const ejecutarReporteProveedor = async () => {
    if (!proveedorSeleccionado) return toast.error("Elige un proveedor");
    setLoadingProveedor(true);
    try {
      const { data } = await api.get(
        `/ventas/productos-proveedor/?proveedorId=${proveedorSeleccionado}`,
      );
      if (data.length === 0) {
        setProductosProveedor([]);
        toast.error(
          "Este proveedor no tiene productos registrados actualmente",
        );
      } else {
        setProductosProveedor(data);
        toast.success("Lista de productos cargada");
        setSeleccionVista("3");
      }
    } catch (e) {
      setProductosProveedor([]);
      toast.error("Error al obtener productos");
    } finally {
      setLoadingProveedor(false);
    }
  };

  const ejecutarReporteDevoluciones = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingDevoluciones(true);
    try {
      const { data } = await api.get(
        `/ventas/reporte-devoluciones/?inicio=${fechaInicio}&fin=${fechaFinCompleta}`,
      );
      if (data.length === 0) {
        setResultadoDevoluciones([]);
        toast.error("No se encontraron devoluciones en este periodo");
      } else {
        setResultadoDevoluciones(data);
        toast.success("Reporte de devoluciones cargado");
        setSeleccionVista("4");
      }
    } catch (e) {
      setResultadoDevoluciones([]);
      toast.error("Error al conectar con el servidor");
    } finally {
      setLoadingDevoluciones(false);
    }
  };

  const ejecutarReportePerdidas = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingPerdidas(true);
    try {
      const { data } = await api.get(
        `/ventas/reporte-perdidas/?inicio=${fechaInicio}&fin=${fechaFinCompleta}`,
      );
      if (data.length === 0) {
        setResultadoPerdidas([]);
        toast.error("No se encontraron perdidas");
      } else {
        setResultadoPerdidas(data);
        toast.success("Reporte de pérdidas cargado");
        setSeleccionVista("5");
      }
    } catch (e) {
      setResultadoPerdidas([]);
      toast.error("Error al obtener perdidas");
    } finally {
      setLoadingPerdidas(false);
    }
  };

  const ejecutarVentasFiltradas = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingVentasFiltradas(true);
    try {
      const { data } = await api.get(
        `/ventas/reporte-ventas-filtradas/?inicio=${fechaInicio}&fin=${fechaFinCompleta}&estado=${estadoVentaFiltrada}`,
      );
      setResultadoVentasFiltradas(data);
      if (data.length > 0) {
        toast.success("Ventas filtradas cargadas");
        setSeleccionVista("6");
      } else {
        toast.error("Sin resultados para el rango seleccionado");
      }
    } catch (e) {
      toast.error("Error al obtener ventas filtradas");
    } finally {
      setLoadingVentasFiltradas(false);
    }
  };

  const ejecutarTopProductos = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingTopProductos(true);
    try {
      const { data } = await api.get(
        `/ventas/reporte-top-productos/?inicio=${fechaInicio}&fin=${fechaFinCompleta}&limite=${limiteTopProductos}`,
      );
      setResultadoTopProductos(data);
      if (data.length > 0) {
        toast.success("Top productos cargado");
        setSeleccionVista("7");
      } else {
        toast.error("Sin resultados para el rango seleccionado");
      }
    } catch (e) {
      toast.error("Error al obtener top productos");
    } finally {
      setLoadingTopProductos(false);
    }
  };

  const ejecutarGananciaProducto = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingGananciaProducto(true);
    try {
      const { data } = await api.get(
        `/ventas/reporte-ganancia-producto/?inicio=${fechaInicio}&fin=${fechaFinCompleta}&productoId=${productoGananciaId}`,
      );
      setResultadoGananciaProducto(data);
      if (data.length > 0) {
        toast.success("Ganancias cargadas");
        setSeleccionVista("8");
      } else {
        toast.error("Sin resultados para el rango seleccionado");
      }
    } catch (e) {
      toast.error("Error al obtener ganancias");
    } finally {
      setLoadingGananciaProducto(false);
    }
  };

  const ejecutarComparacion = async () => {
    if (!validarFechas(fechaInicioA, fechaFinA, "Periodo A")) return;
    if (!validarFechas(fechaInicioB, fechaFinB, "Periodo B")) return;
    setLoadingComparacion(true);
    try {
      const res = await api.get(
        `/ventas/reporte-comparacion-ventas/?inicioA=${fechaInicioA}&finA=${fechaFinACompleta}&inicioB=${fechaInicioB}&finB=${fechaFinBCompleta}`,
      );

      if (!res.data || res.data.length === 0) {
        toast.error("Sin resultados para estos periodos");
        setResultadoComparacion([]);
        return;
      }

      const d = res.data[0];
      const tablaComparativa = [
        {
          metrica: "Ventas Totales",
          periodo_a: Number(d.ventas_a || 0),
          periodo_b: Number(d.ventas_b || 0),
          diferencia: Number(d.ventas_b || 0) - Number(d.ventas_a || 0),
          esMonto: true,
        },
        {
          metrica: "Productos Vendidos",
          periodo_a: Number(d.productos_a || 0),
          periodo_b: Number(d.productos_b || 0),
          diferencia: Number(d.productos_b || 0) - Number(d.productos_a || 0),
          esMonto: false,
        },
      ];

      setResultadoComparacion(tablaComparativa);
      toast.success("Comparación cargada");
      setSeleccionVista("9");
    } catch (e) {
      toast.error("Error al obtener comparación");
    } finally {
      setLoadingComparacion(false);
    }
  };

  const ejecutarComprasFiltradas = async () => {
    if (!validarFechas(fechaInicio, fechaFin)) return;
    setLoadingComprasFiltradas(true);
    try {
      const { data } = await api.get(
        `/inventario/reporte-compras-filtradas/?inicio=${fechaInicio}&fin=${fechaFinCompleta}&proveedorId=${proveedorComprasId}`,
      );
      setResultadoComprasFiltradas(data);
      if (data.length > 0) {
        toast.success("Compras cargadas");
        setSeleccionVista("10");
      } else {
        toast.error("Sin resultados para el rango seleccionado");
      }
    } catch (e) {
      toast.error("Error al obtener compras");
    } finally {
      setLoadingComprasFiltradas(false);
    }
  };

  const ejecutarSinMovimiento = async () => {
    setLoadingSinMovimiento(true);
    try {
      const { data } = await api.get(
        `/inventario/reporte-productos-sin-movimiento/?dias=${diasSinMovimiento}`,
      );
      setResultadoSinMovimiento(data);
      if (data.length > 0) {
        toast.success("Productos sin movimiento cargados");
        setSeleccionVista("11");
      } else {
        toast.error("Sin resultados");
      }
    } catch (e) {
      toast.error("Error");
    } finally {
      setLoadingSinMovimiento(false);
    }
  };

  const exportarExcelEstetico = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Reporte de Miscelánea");

    sheet.columns = [
      { header: "CÓDIGO/REF", key: "id", width: 20 },
      { header: "DESCRIPCIÓN", key: "desc", width: 40 },
      { header: "VALOR/STOCK", key: "val", width: 20 },
    ];

    // Título Principal
    sheet.mergeCells("A1:C1");
    const title = sheet.getCell("A1");
    title.value = "MISCELÁNEA BENDICIÓN DE DIOS - REPORTE";
    title.font = { name: "Arial Black", size: 14, color: { argb: "FFFFFFFF" } };
    title.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
    title.alignment = { horizontal: "center" };

    if (
      (seleccionVista === "1" || seleccionVista === "todos") &&
      resultadoGerencial
    ) {
      sheet.addRow([]);
      sheet.addRow(["--- REPORTE DE VENTAS ---"]).font = { bold: true };
      sheet.addRow([
        "Monto Total Vendido",
        "",
        `C$ ${Number(resultadoGerencial.total_ventas).toLocaleString()}`,
      ]);
      sheet.addRow([
        "Promedio de Ventas",
        "",
        `C$ ${Number(resultadoGerencial.promedio_venta).toLocaleString()}`,
      ]);
      sheet.addRow([
        "Producto Estrella",
        "",
        resultadoGerencial.producto_mas_vendido,
      ]);
    }

    if ((seleccionVista === "2" || seleccionVista === "todos") && datosPivot) {
      sheet.addRow([]);
      sheet.addRow(["--- VENTAS MENSUALES ---"]).font = { bold: true };
      sheet.addRow(["Producto:", datosPivot.producto, ""]);
      const headerMeses = sheet.addRow(["MES", "VENTAS", ""]);
      headerMeses.eachCell(
        (c) =>
          (c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDEE2E6" },
          }),
      );
      const meses = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ];
      const valores = [
        datosPivot.ene,
        datosPivot.feb,
        datosPivot.mar,
        datosPivot.abr,
        datosPivot.may,
        datosPivot.jun,
        datosPivot.jul,
        datosPivot.ago,
        datosPivot.sep,
        datosPivot.oct,
        datosPivot.nov,
        datosPivot.dic,
      ];
      meses.forEach((m, i) => {
        sheet.addRow([m, `C$ ${Number(valores[i] || 0).toLocaleString()}`, ""]);
      });
    }

    if (
      (seleccionVista === "3" || seleccionVista === "todos") &&
      productosProveedor.length > 0
    ) {
      sheet.addRow([]);
      sheet.addRow(["--- PRODUCTOS POR PROVEEDOR ---"]).font = { bold: true };
      const header = sheet.addRow(["CÓDIGO", "DESCRIPCIÓN", "EXISTENCIA"]);
      header.eachCell(
        (c) =>
          (c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDEE2E6" },
          }),
      );
      productosProveedor.forEach((p) => {
        sheet.addRow([p.id, p.producto, p.unidades_disponibles + " UNIDADES"]);
      });
    }

    if (
      (seleccionVista === "4" || seleccionVista === "todos") &&
      resultadoDevoluciones.length > 0
    ) {
      sheet.addRow([]);
      sheet.addRow(["--- REPORTE DE DEVOLUCIONES ---"]).font = { bold: true };
      const headerDev = sheet.addRow([
        "ID SOLICITUD",
        "PRODUCTO",
        "CANTIDAD",
        "MOTIVO",
        "USUARIO",
        "FECHA",
        "ESTADO",
      ]);
      headerDev.eachCell(
        (c) =>
          (c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDEE2E6" },
          }),
      );
      resultadoDevoluciones.forEach((d) => {
        sheet.addRow([
          d.id_solicitud,
          d.producto,
          d.cantidad,
          d.motivo || "N/A",
          d.usuario || "N/A",
          new Date(d.fecha).toLocaleDateString("es-NI", { timeZone: "UTC" }),
          d.estado,
        ]);
      });
    }

    if (
      (seleccionVista === "5" || seleccionVista === "todos") &&
      resultadoPerdidas.length > 0
    ) {
      sheet.addRow([]);
      sheet.addRow(["--- REPORTE DE PÉRDIDAS ---"]).font = { bold: true };
      const headerPerd = sheet.addRow([
        "ID",
        "PRODUCTO",
        "CANTIDAD",
        "MOTIVO",
        "FECHA",
        "TOTAL",
      ]);
      headerPerd.eachCell(
        (c) =>
          (c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDEE2E6" },
          }),
      );
      resultadoPerdidas.forEach((d) => {
        sheet.addRow([
          d.id_perdida,
          d.producto,
          d.cantidad,
          d.motivo,
          new Date(d.fecha).toLocaleDateString("es-NI", { timeZone: "UTC" }),
          `C$ ${Number(d.total).toLocaleString()}`,
        ]);
      });
    }

    if (
      (seleccionVista === "6" || seleccionVista === "todos") &&
      resultadoVentasFiltradas.length > 0
    ) {
      sheet.addRow([]);
      sheet.addRow(["--- VENTAS FILTRADAS ---"]).font = { bold: true };
      const headerVF = sheet.addRow(["ID VENTA", "FECHA", "ESTADO", "TOTAL"]);
      headerVF.eachCell(
        (c) =>
          (c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDEE2E6" },
          }),
      );
      resultadoVentasFiltradas.forEach((d) => {
        sheet.addRow([
          d.id_venta,
          new Date(d.fecha).toLocaleDateString("es-NI"),
          d.estado,
          `C$ ${Number(d.total).toLocaleString()}`,
        ]);
      });
    }

    if (
      (seleccionVista === "7" || seleccionVista === "todos") &&
      resultadoTopProductos.length > 0
    ) {
      sheet.addRow([]);
      sheet.addRow(["--- TOP PRODUCTOS ---"]).font = { bold: true };
      const headerTP = sheet.addRow([
        "PRODUCTO",
        "CATEGORÍA",
        "VENDIDOS",
        "INGRESO BRUTO",
      ]);
      headerTP.eachCell(
        (c) =>
          (c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDEE2E6" },
          }),
      );
      resultadoTopProductos.forEach((d) => {
        sheet.addRow([
          d.nombre_producto,
          d.categoria,
          d.cantidad_vendida,
          `C$ ${Number(d.ingreso_bruto).toLocaleString()}`,
        ]);
      });
    }

    if (
      (seleccionVista === "8" || seleccionVista === "todos") &&
      resultadoGananciaProducto.length > 0
    ) {
      sheet.addRow([]);
      sheet.addRow(["--- GANANCIA POR PRODUCTO ---"]).font = { bold: true };
      const headerGP = sheet.addRow([
        "PRODUCTO",
        "TOTAL VENTAS",
        "COSTO TOTAL",
        "GANANCIA BRUTA",
      ]);
      headerGP.eachCell(
        (c) =>
          (c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDEE2E6" },
          }),
      );
      resultadoGananciaProducto.forEach((d) => {
        sheet.addRow([
          d.nombre_producto,
          `C$ ${Number(d.total_ventas).toLocaleString()}`,
          `C$ ${Number(d.costo_total).toLocaleString()}`,
          `C$ ${Number(d.ganancia_bruta).toLocaleString()}`,
        ]);
      });
    }

    if (
      (seleccionVista === "9" || seleccionVista === "todos") &&
      resultadoComparacion.length > 0
    ) {
      sheet.addRow([]);
      sheet.addRow(["--- COMPARACIÓN DE PERIODOS ---"]).font = { bold: true };
      const headerComp = sheet.addRow([
        "MÉTRICA",
        "PERIODO A",
        "PERIODO B",
        "DIFERENCIA",
      ]);
      headerComp.eachCell(
        (c) =>
          (c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDEE2E6" },
          }),
      );
      resultadoComparacion.forEach((d) => {
        sheet.addRow([
          d.metrica,
          `C$ ${Number(d.valor_a || 0).toLocaleString()}`,
          `C$ ${Number(d.valor_b || 0).toLocaleString()}`,
          d.diferencia,
        ]);
      });
    }

    if (
      (seleccionVista === "10" || seleccionVista === "todos") &&
      resultadoComprasFiltradas.length > 0
    ) {
      sheet.addRow([]);
      sheet.addRow(["--- COMPRAS FILTRADAS ---"]).font = { bold: true };
      const headerCF = sheet.addRow([
        "ID COMPRA",
        "FECHA",
        "PROVEEDOR",
        "TOTAL COMPRA",
      ]);
      headerCF.eachCell(
        (c) =>
          (c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDEE2E6" },
          }),
      );
      resultadoComprasFiltradas.forEach((d) => {
        sheet.addRow([
          d.id_entrada,
          new Date(d.fecha_ingreso).toLocaleDateString("es-NI"),
          d.nombre_proveedor,
          `C$ ${Number(d.total_compra).toLocaleString()}`,
        ]);
      });
    }

    if (
      (seleccionVista === "11" || seleccionVista === "todos") &&
      resultadoSinMovimiento.length > 0
    ) {
      sheet.addRow([]);
      sheet.addRow(["--- PRODUCTOS SIN MOVIMIENTO ---"]).font = { bold: true };
      const headerSM = sheet.addRow([
        "PRODUCTO",
        "CATEGORÍA",
        "STOCK ACTUAL",
        "DÍAS SIN VENDER",
      ]);
      headerSM.eachCell(
        (c) =>
          (c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDEE2E6" },
          }),
      );
      resultadoSinMovimiento.forEach((d) => {
        sheet.addRow([
          d.nombre_producto,
          d.categoria,
          `${d.stock_actual} unidades`,
          `${d.dias_sin_venta} días`,
        ]);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer]),
      `Reporte_Miscelanea_BendicionDeDios_${new Date().getTime()}.xlsx`,
    );
  };

  const puedeImprimir = () => {
    if (seleccionVista === "menu") return false;
    if (seleccionVista === "todos") {
      return (
        !!resultadoGerencial ||
        !!datosPivot ||
        productosProveedor.length > 0 ||
        resultadoDevoluciones.length > 0 ||
        resultadoPerdidas.length > 0 ||
        resultadoVentasFiltradas.length > 0 ||
        resultadoTopProductos.length > 0 ||
        resultadoGananciaProducto.length > 0 ||
        resultadoComparacion.length > 0 ||
        resultadoComprasFiltradas.length > 0 ||
        resultadoSinMovimiento.length > 0
      );
    }
    if (seleccionVista === "1") return !!resultadoGerencial;
    if (seleccionVista === "2") return !!datosPivot;
    if (seleccionVista === "3") return productosProveedor.length > 0;
    if (seleccionVista === "4") return resultadoDevoluciones.length > 0;
    if (seleccionVista === "5") return resultadoPerdidas.length > 0;
    if (seleccionVista === "6") return resultadoVentasFiltradas.length > 0;
    if (seleccionVista === "7") return resultadoTopProductos.length > 0;
    if (seleccionVista === "8") return resultadoGananciaProducto.length > 0;
    if (seleccionVista === "9") return resultadoComparacion.length > 0;
    if (seleccionVista === "10") return resultadoComprasFiltradas.length > 0;
    if (seleccionVista === "11") return resultadoSinMovimiento.length > 0;
    return false;
  };

  const handleImprimirPDF = () => {
    if (!puedeImprimir()) {
      toast.error("Debe generar el reporte antes, para generar el PDF.");
      return;
    }
    setImprimiendo(true);
    const wasDark = document.documentElement.classList.contains("dark");
    if (wasDark) {
      document.documentElement.classList.remove("dark");
    }
    setTimeout(() => {
      window.print();
      setImprimiendo(false);
      if (wasDark) {
        document.documentElement.classList.add("dark");
      }
    }, 200);
  };

  const getNombreReporteActivo = () => {
    switch (seleccionVista) {
      case "1": return "Reporte de Ventas (Resumen Gerencial)";
      case "2": return "Análisis Mensual de Ventas (Pivot)";
      case "3": return "Productos Abastecidos por Proveedor";
      case "4": return "Reporte Detallado de Devoluciones";
      case "5": return "Reporte General de Pérdidas de Inventario";
      case "6": return "Reporte de Ventas Filtradas por Estado";
      case "7": return "Top Productos Más Vendidos";
      case "8": return "Reporte de Margen de Ganancia por Producto";
      case "9": return "Comparación de Rendimiento de Períodos de Venta";
      case "10": return "Reporte de Compras y Entradas de Inventario";
      case "11": return "Productos Sin Movimiento en Inventario";
      case "todos": return "Reporte General Consolidado (Todos los Módulos)";
      default: return "Reportes Gerenciales y Operativos";
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4">
      {/* TÍTULO PRINCIPAL (PANTALLA) */}
      {!imprimiendo && (
        <div className="border-b pb-6 text-center">
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter">
            Reportes de la Miscelánea
          </h1>
          <p className="text-xl text-muted-foreground font-medium italic mt-1">
            "Bendición de Dios"
          </p>
        </div>
      )}

      {/* HEADER DE IMPRESIÓN */}
      {imprimiendo && (
        <div className="flex flex-col mb-8 pb-4 print:break-after-avoid" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
          {/* Membrete Centrado */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-serif font-black text-blue-900 uppercase tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
              MISCELÁNEA BENDICIÓN DE DIOS
            </h1>
            <p className="text-[10px] text-slate-500 tracking-widest uppercase mt-1">
              Managua, Nicaragua • Tel: +505 8888-8888 • Documentación de Inventario y Ventas
            </p>
            {/* Doble línea de acento elegante */}
            <div className="mt-3 border-t border-blue-900"></div>
            <div className="mt-0.5 border-t-2 border-blue-900"></div>
          </div>

          {/* Título Oficial del Reporte */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-black text-blue-800 uppercase tracking-wider">
              {getNombreReporteActivo()}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Estado: Documento Oficial de Control
            </p>
          </div>

          {/* Metadatos del Reporte */}
          <div className="print-meta-box">
            <div className="space-y-1">
              <p><strong>RANGO DE FECHAS:</strong> {fechaInicio && fechaFin ? `${fechaInicio.split("-").reverse().join("/")} al ${fechaFin.split("-").reverse().join("/")}` : "Histórico Completo"}</p>
              {seleccionVista === "9" && (
                <p><strong>PERIODOS COMPARATIVOS:</strong> A: {fechaInicioA} al {fechaFinA} | B: {fechaInicioB} al {fechaFinB}</p>
              )}
              <p><strong>MONEDA DE CONTROL:</strong> Córdoba Nicaragüense (C$)</p>
            </div>
            <div className="text-right space-y-1">
              <p><strong>FECHA DE EMISIÓN:</strong> {new Date().toLocaleDateString("es-NI", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              <p><strong>SOPORTE TÉCNICO:</strong> Sistema Automatizado de Ventas</p>
              <p><strong>VALIDACIÓN:</strong> Administrativa</p>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE ACCIONES DEL REPORTE ACTIVO (MODO ENFOQUE) */}
      {!imprimiendo && seleccionVista !== "menu" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
          <Button
            variant="outline"
            onClick={() => setSeleccionVista("menu")}
            className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
          >
            <Undo2 className="size-5 mr-2" />
            Volver a los reportes
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={handleImprimirPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md gap-2 flex items-center transition-all hover:scale-105 active:scale-95"
            >
              <Printer size={16} /> Imprimir PDF
            </Button>
            <Button
              onClick={exportarExcelEstetico}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md gap-2 flex items-center transition-all hover:scale-105 active:scale-95"
            >
              <FileSpreadsheet size={16} /> Exportar Excel
            </Button>
          </div>
        </div>
      )}

      {/* BARRA DE FECHAS GLOBAL */}
      {!imprimiendo && seleccionVista === "menu" && (
        <Card className="p-4 bg-card border border-border shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2 text-foreground font-black text-sm uppercase tracking-wider">
              <CalendarDays
                size={20}
                className="text-blue-600 dark:text-blue-400"
              />
              Rango de Fechas Global
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Desde
                </label>
                <input
                  type="date"
                  className="p-2 border border-border rounded-lg text-sm outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Hasta
                </label>
                <input
                  type="date"
                  className="p-2 border border-border rounded-lg text-sm outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
              </div>
              {fechaInicio && fechaFin && (
                <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800 px-3 py-1.5 rounded-lg font-bold">
                  {fechaInicio.split("-").reverse().join("/")} →{" "}
                  {fechaFin.split("-").reverse().join("/")}
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* SECCIÓN DE FILTROS */}
      {!imprimiendo && seleccionVista === "menu" && (
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-300">
          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-card">
            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
              <TrendingUp size={24} />{" "}
              <h3 className="truncate">Reporte de Ventas</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Usa el rango de fechas global
            </p>
            <Button
              onClick={ejecutarReporteGerencial}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingGerencial ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Generar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-card">
            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
              <CalendarDays size={24} />{" "}
              <h3 className="truncate">Ventas Mensuales</h3>
            </div>
            <select
              className="w-full p-2 border rounded text-sm outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500"
              value={productoSeleccionado}
              onChange={(e) => setProductoSeleccionado(e.target.value)}
            >
              <option value="">-- Seleccionar Producto --</option>
              {productosLista.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.Nombre || p.name}
                </option>
              ))}
            </select>
            <Button
              onClick={ejecutarReportePivot}
              className="w-full bg-blue-700 text-white font-bold uppercase tracking-widest"
            >
              {loadingPivot ? <Loader2 className="animate-spin" /> : "Analizar"}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-card">
            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
              <Users size={24} />{" "}
              <h3 className="truncate">Productos del Proveedor</h3>
            </div>
            <select
              className="w-full p-2 border rounded text-sm outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500"
              value={proveedorSeleccionado}
              onChange={(e) => setProveedorSeleccionado(e.target.value)}
            >
              <option value="">-- Seleccionar Proveedor --</option>
              {proveedoresLista.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.Nombre || prov.name}
                </option>
              ))}
            </select>
            <Button
              onClick={ejecutarReporteProveedor}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingProveedor ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Listar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-card">
            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
              <Undo2 size={24} /> <h3 className="truncate">Devoluciones</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Usa el rango de fechas global
            </p>
            <Button
              onClick={ejecutarReporteDevoluciones}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingDevoluciones ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Generar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-card">
            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
              <Undo2 size={24} /> <h3 className="truncate">Pérdidas</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Usa el rango de fechas global
            </p>
            <Button
              onClick={ejecutarReportePerdidas}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingPerdidas ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Generar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-card">
            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
              <TrendingUp size={24} />{" "}
              <h3 className="truncate">Ventas Filtradas</h3>
            </div>
            <select
              className="w-full p-2 border rounded text-sm outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500"
              value={estadoVentaFiltrada}
              onChange={(e) => setEstadoVentaFiltrada(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="Completada">Completada</option>
              <option value="Anulada">Anulada</option>
            </select>
            <Button
              onClick={ejecutarVentasFiltradas}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingVentasFiltradas ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Generar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-card">
            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
              <Package size={24} /> <h3 className="truncate">Top Productos</h3>
            </div>
            <input
              type="number"
              className="p-2 border rounded text-sm w-full outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500"
              placeholder="Límite (ej: 10)"
              value={limiteTopProductos}
              onChange={(e) => setLimiteTopProductos(e.target.value)}
            />
            <Button
              onClick={ejecutarTopProductos}
              className="w-full bg-blue-700 text-white font-bold uppercase tracking-widest"
            >
              {loadingTopProductos ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Analizar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-card">
            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
              <TrendingUp size={24} />{" "}
              <h3 className="truncate">Ganancia Producto</h3>
            </div>
            <select
              className="w-full p-2 border rounded text-sm outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500"
              value={productoGananciaId}
              onChange={(e) => setProductoGananciaId(e.target.value)}
            >
              <option value="">Todos los productos</option>
              {productosLista.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.Nombre || p.name}
                </option>
              ))}
            </select>
            <Button
              onClick={ejecutarGananciaProducto}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingGananciaProducto ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Generar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-card">
            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
              <Package size={24} />{" "}
              <h3 className="truncate">Compras Filtradas</h3>
            </div>
            <select
              className="w-full p-2 border rounded text-sm outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500"
              value={proveedorComprasId}
              onChange={(e) => setProveedorComprasId(e.target.value)}
            >
              <option value="">Todos los proveedores</option>
              {proveedoresLista.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.Nombre || p.name}
                </option>
              ))}
            </select>
            <Button
              onClick={ejecutarComprasFiltradas}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingComprasFiltradas ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Generar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-card">
            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
              <Package size={24} /> <h3 className="truncate">Sin Movimiento</h3>
            </div>
            <input
              type="number"
              className="p-2 border rounded text-sm w-full outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500"
              placeholder="Días (ej: 30)"
              value={diasSinMovimiento}
              onChange={(e) => setDiasSinMovimiento(e.target.value)}
            />
            <Button
              onClick={ejecutarSinMovimiento}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingSinMovimiento ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Analizar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-card lg:col-span-2">
            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
              <TrendingUp size={24} />{" "}
              <h3 className="truncate">Comparación Periodos</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <input
                type="date"
                className="p-2 border rounded text-xs w-full outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500"
                value={fechaInicioA}
                onChange={(e) => setFechaInicioA(e.target.value)}
                title="Inicio A"
              />
              <input
                type="date"
                className="p-2 border rounded text-xs w-full outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500"
                value={fechaFinA}
                onChange={(e) => setFechaFinA(e.target.value)}
                title="Fin A"
              />
              <input
                type="date"
                className="p-2 border rounded text-xs w-full outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500"
                value={fechaInicioB}
                onChange={(e) => setFechaInicioB(e.target.value)}
                title="Inicio B"
              />
              <input
                type="date"
                className="p-2 border rounded text-xs w-full outline-none dark:bg-slate-800 dark:text-white focus:border-blue-500"
                value={fechaFinB}
                onChange={(e) => setFechaFinB(e.target.value)}
                title="Fin B"
              />
            </div>
            <Button
              onClick={ejecutarComparacion}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingComparacion ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Comparar"
              )}
            </Button>
          </Card>
        </div>
      )}

      {/* ÁREA DE RESULTADOS DINÁMICOS */}
      <div
        className={`mt-12 ${imprimiendo ? "block space-y-8 pb-0" : "flex flex-col gap-12 pb-32 animate-in fade-in slide-in-from-bottom-8"}`}
      >
        {resultadoGerencial &&
          (seleccionVista === "1" || seleccionVista === "todos") && (
            <Card
              className={`p-6 border-l-8 border-blue-600 bg-card ${imprimiendo ? "border shadow-none block" : "shadow-xl"} print:break-inside-avoid`}
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between border-b pb-2 mb-4">
                <h4 className="font-black text-blue-700 dark:text-blue-400 uppercase flex items-center gap-2 print:text-blue-800">
                  <TrendingUp size={22} /> Resumen de Desempeño
                </h4>
                <span className="text-xs font-bold text-muted-foreground print:text-muted-foreground uppercase tracking-widest mt-2 md:mt-0">
                  Período: {fechaInicio.split("-").reverse().join("/")} al{" "}
                  {fechaFin.split("-").reverse().join("/")}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-muted rounded-xl border border-border shadow-sm print:bg-card print:border-border print:shadow-none">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-tighter print:text-muted-foreground">
                    Monto Total Vendido
                  </span>
                  <p className="text-2xl font-black text-foreground">
                    C${" "}
                    {Number(
                      resultadoGerencial.total_ventas || 0,
                    ).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-xl border border-border shadow-sm print:bg-card print:border-border print:shadow-none">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-tighter print:text-muted-foreground">
                    Promedio de ventas
                  </span>
                  <p className="text-2xl font-black text-foreground">
                    C${" "}
                    {Number(
                      resultadoGerencial.promedio_venta || 0,
                    ).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-xl border border-border shadow-sm print:bg-card print:border-border print:shadow-none">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-tighter print:text-muted-foreground">
                    Producto Estrella
                  </span>
                  <p className="text-2xl font-black text-green-600 dark:text-green-400 uppercase truncate print:text-green-700 dark:text-green-400">
                    {resultadoGerencial.producto_mas_vendido || "N/A"}
                  </p>
                </div>
              </div>
            </Card>
          )}

        {datosPivot &&
          (seleccionVista === "2" || seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-card relative ${imprimiendo ? "border border-border shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
              <h4 className="font-black mb-6 flex items-center gap-2 text-blue-700 dark:text-blue-400 text-lg uppercase tracking-widest print:text-blue-800">
                <Package size={24} /> Análisis de Ventas: {datosPivot.producto}
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-border shadow-inner print:shadow-none print:border-slate-300 dark:border-slate-600 print:overflow-visible">
                <table className="w-full text-center">
                  <thead className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 uppercase font-black text-[11px] text-blue-800 dark:text-blue-300 print:bg-blue-50 print:text-blue-900 print:border-blue-200">
                    <tr>
                      {[
                        "Ene",
                        "Feb",
                        "Mar",
                        "Abr",
                        "May",
                        "Jun",
                        "Jul",
                        "Ago",
                        "Sep",
                        "Oct",
                        "Nov",
                        "Dic",
                      ].map((m) => (
                        <th
                          key={m}
                          className="p-5 border-r last:border-r-0 print:p-3 print:border-slate-300 dark:border-slate-600"
                        >
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr>
                      {[
                        datosPivot.ene,
                        datosPivot.feb,
                        datosPivot.mar,
                        datosPivot.abr,
                        datosPivot.may,
                        datosPivot.jun,
                        datosPivot.jul,
                        datosPivot.ago,
                        datosPivot.sep,
                        datosPivot.oct,
                        datosPivot.nov,
                        datosPivot.dic,
                      ].map((v, i) => (
                        <td
                          key={i}
                          className="p-6 font-black text-blue-600 dark:text-blue-400 border-r last:border-r-0 print:p-3 print:text-blue-800 print:border-slate-300 dark:border-slate-600"
                        >
                          C${Number(v || 0).toLocaleString()}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        {productosProveedor.length > 0 &&
          (seleccionVista === "3" || seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-card relative ${imprimiendo ? "border border-border shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
              <h4 className="font-black text-xl flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-tighter mb-8 print:mb-6">
                <Users
                  className="text-blue-600 dark:text-blue-400 print:text-blue-800"
                  size={28}
                />{" "}
                Productos abastecidos por el proveedor
              </h4>
              <div className="overflow-x-auto border border-border rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 dark:border-slate-600 print:overflow-visible">
                <table className="w-full text-left print:border-collapse">
                  <thead className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-[12px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest print:bg-blue-50 print:text-blue-900 print:border-blue-200">
                    <tr>
                      <th className="p-6 print:p-3">Cód.</th>
                      <th className="p-6 print:p-3">
                        Descripción del Artículo
                      </th>
                      <th className="p-6 print:p-3 text-center">
                        Existencia Real
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                    {productosProveedor.map((p) => (
                      <tr key={p.id}>
                        <td className="p-6 print:p-3 font-mono text-slate-500 dark:text-slate-400 print:text-muted-foreground text-xs">
                          #{p.id}
                        </td>
                        <td className="p-6 print:p-3 font-black text-foreground uppercase">
                          {p.producto}
                        </td>
                        <td className="p-6 print:p-3 text-center">
                          <span
                            className={`inline-block w-36 py-2.5 rounded-xl font-black text-xs shadow-sm border print:shadow-none ${p.unidades_disponibles < 10 ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800 print:bg-red-100 print:text-red-800" : "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-100 dark:border-green-800 print:bg-green-100 print:text-green-800"}`}
                          >
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

        {resultadoDevoluciones.length > 0 &&
          (seleccionVista === "4" || seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-card relative ${imprimiendo ? "border border-border shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
              <h4 className="font-black text-xl flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-tighter mb-8 print:mb-6">
                <Undo2
                  className="text-blue-600 dark:text-blue-400 print:text-blue-800"
                  size={28}
                />{" "}
                Reporte de Devoluciones
              </h4>
              <div className="overflow-x-auto border border-border rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 dark:border-slate-600 print:overflow-visible">
                <table className="w-full text-left print:border-collapse">
                  <thead className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-[12px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest print:bg-blue-50 print:text-blue-900 print:border-blue-200">
                    <tr>
                      <th className="p-6 print:p-3">ID Sol.</th>
                      <th className="p-6 print:p-3">Producto</th>
                      <th className="p-6 print:p-3 text-center">Cantidad</th>
                      <th className="p-6 print:p-3">Motivo</th>
                      <th className="p-6 print:p-3">Usuario</th>
                      <th className="p-6 print:p-3">Fecha</th>
                      <th className="p-6 print:p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                    {resultadoDevoluciones.map((d, index) => (
                      <tr key={index}>
                        <td className="p-6 print:p-3 font-mono text-muted-foreground text-xs">
                          #{d.id_solicitud}
                        </td>
                        <td className="p-6 print:p-3 font-black text-foreground uppercase text-xs">
                          {d.producto}
                        </td>
                        <td className="p-6 print:p-3 text-center font-bold text-foreground text-xs">
                          {d.cantidad}
                        </td>
                        <td className="p-6 print:p-3 text-muted-foreground text-xs">
                          {d.motivo || "N/A"}
                        </td>
                        <td className="p-6 print:p-3 font-mono text-muted-foreground text-xs">
                          {d.usuario || "N/A"}
                        </td>
                        <td className="p-6 print:p-3 font-mono text-muted-foreground text-xs">
                          {new Date(d.fecha).toLocaleDateString("es-NI", {
                            timeZone: "UTC",
                          })}
                        </td>
                        <td className="p-6 print:p-3 font-black text-orange-600 dark:text-orange-400 uppercase text-xs">
                          {d.estado}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        {resultadoPerdidas.length > 0 &&
          (seleccionVista === "5" || seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-card relative ${imprimiendo ? "border border-border shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
              <h4 className="font-black text-xl flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-tighter mb-8 print:mb-6">
                <Undo2
                  className="text-blue-600 dark:text-blue-400 print:text-blue-800"
                  size={28}
                />{" "}
                Reporte de Pérdidas
              </h4>
              <div className="overflow-x-auto border border-border rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 dark:border-slate-600 print:overflow-visible">
                <table className="w-full text-left">
                  <thead className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-[12px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest print:bg-blue-50 print:text-blue-900 print:border-blue-200">
                    <tr>
                      <th className="p-6">ID</th>
                      <th className="p-6">Producto</th>
                      <th className="p-6">Cantidad</th>
                      <th className="p-6">Motivo</th>
                      <th className="p-6">Fecha</th>
                      <th className="p-6 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {resultadoPerdidas.map((d, index) => (
                      <tr key={index}>
                        <td className="p-6 font-mono text-muted-foreground text-xs">
                          #{d.id_perdida}
                        </td>
                        <td className="p-6 font-mono text-muted-foreground text-xs">
                          {d.producto}
                        </td>
                        <td className="p-6 font-mono text-muted-foreground text-xs">
                          {d.cantidad}
                        </td>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          {d.motivo}
                        </td>
                        <td className="p-6 font-mono text-muted-foreground text-xs">
                          {new Date(d.fecha).toLocaleDateString("es-NI", {
                            timeZone: "UTC",
                          })}
                        </td>
                        <td className="p-6 font-black text-red-600 dark:text-red-400 uppercase text-xs text-right">
                          C$ {Number(d.total).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        {resultadoVentasFiltradas.length > 0 &&
          (seleccionVista === "6" || seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-card relative ${imprimiendo ? "border border-border shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
              <h4 className="font-black text-xl flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-tighter mb-8 print:mb-6">
                <TrendingUp
                  className="text-blue-600 dark:text-blue-400 print:text-blue-800"
                  size={28}
                />{" "}
                Ventas Filtradas
              </h4>
              <div className="overflow-x-auto border border-border rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 dark:border-slate-600 print:overflow-visible">
                <table className="w-full text-left">
                  <thead className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-[12px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest print:bg-blue-50 print:text-blue-900 print:border-blue-200">
                    <tr>
                      <th className="p-6">ID Venta</th>
                      <th className="p-6">Fecha</th>
                      <th className="p-6">Estado</th>
                      <th className="p-6 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {resultadoVentasFiltradas.map((d, index) => (
                      <tr key={index}>
                        <td className="p-6 font-mono text-muted-foreground text-xs">
                          #{d.id_venta}
                        </td>
                        <td className="p-6 font-mono text-muted-foreground text-xs">
                          {new Date(d.fecha).toLocaleDateString("es-NI")}
                        </td>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          {d.estado}
                        </td>
                        <td className="p-6 font-black text-green-600 dark:text-green-400 uppercase text-xs text-right">
                          C$ {Number(d.total).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        {resultadoTopProductos.length > 0 &&
          (seleccionVista === "7" || seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-card relative ${imprimiendo ? "border border-border shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
              <h4 className="font-black text-xl flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-tighter mb-8 print:mb-6">
                <Package
                  className="text-blue-600 dark:text-blue-400 print:text-blue-800"
                  size={28}
                />{" "}
                Top Productos
              </h4>
              <div className="overflow-x-auto border border-border rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 dark:border-slate-600 print:overflow-visible">
                <table className="w-full text-left">
                  <thead className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-[12px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest print:bg-blue-50 print:text-blue-900 print:border-blue-200">
                    <tr>
                      <th className="p-6">Producto</th>
                      <th className="p-6">Categoría</th>
                      <th className="p-6">Vendidos</th>
                      <th className="p-6 text-right">Ingreso Bruto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {resultadoTopProductos.map((d, index) => (
                      <tr key={index}>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          {d.nombre_producto}
                        </td>
                        <td className="p-6 font-mono text-muted-foreground text-xs">
                          {d.categoria}
                        </td>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          {d.cantidad_vendida}
                        </td>
                        <td className="p-6 font-black text-blue-600 dark:text-blue-400 uppercase text-xs text-right">
                          C$ {Number(d.ingreso_bruto).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        {resultadoGananciaProducto.length > 0 &&
          (seleccionVista === "8" || seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-card relative ${imprimiendo ? "border border-border shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
              <h4 className="font-black text-xl flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-tighter mb-8 print:mb-6">
                <TrendingUp
                  className="text-blue-600 dark:text-blue-400 print:text-blue-800"
                  size={28}
                />{" "}
                Ganancia Por Producto
              </h4>
              <div className="overflow-x-auto border border-border rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 dark:border-slate-600 print:overflow-visible">
                <table className="w-full text-left">
                  <thead className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-[12px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest print:bg-blue-50 print:text-blue-900 print:border-blue-200">
                    <tr>
                      <th className="p-6">Producto</th>
                      <th className="p-6">Total Ventas</th>
                      <th className="p-6">Costo Total</th>
                      <th className="p-6 text-right">Ganancia Bruta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {resultadoGananciaProducto.map((d, index) => (
                      <tr key={index}>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          {d.nombre_producto}
                        </td>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          C$ {Number(d.total_ventas).toLocaleString()}
                        </td>
                        <td className="p-6 font-black text-red-600 dark:text-red-400 uppercase text-xs">
                          C$ {Number(d.costo_total).toLocaleString()}
                        </td>
                        <td className="p-6 font-black text-purple-600 dark:text-purple-400 uppercase text-xs text-right">
                          C$ {Number(d.ganancia_bruta).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        {resultadoComparacion.length > 0 &&
          (seleccionVista === "9" || seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-card relative ${imprimiendo ? "border border-border shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
              <h4 className="font-black text-xl flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-tighter mb-8 print:mb-6">
                <TrendingUp
                  className="text-blue-600 dark:text-blue-400 print:text-blue-800"
                  size={28}
                />{" "}
                Comparación de Periodos
              </h4>
              <div className="overflow-x-auto border border-border rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 dark:border-slate-600 print:overflow-visible">
                <table className="w-full text-left">
                  <thead className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-[12px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest print:bg-blue-50 print:text-blue-900 print:border-blue-200">
                    <tr>
                      <th className="p-6">Métrica</th>
                      <th className="p-6">Periodo A</th>
                      <th className="p-6">Periodo B</th>
                      <th className="p-6 text-right">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {resultadoComparacion.map((d, index) => (
                      <tr key={index}>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          {d.metrica}
                        </td>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          {d.esMonto
                            ? `C$ ${d.periodo_a.toLocaleString()}`
                            : d.periodo_a.toLocaleString()}
                        </td>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          {d.esMonto
                            ? `C$ ${d.periodo_b.toLocaleString()}`
                            : d.periodo_b.toLocaleString()}
                        </td>
                        <td
                          className={`p-6 font-black uppercase text-xs text-right ${d.diferencia >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                        >
                          {d.diferencia >= 0 ? "+" : ""}
                          {d.esMonto
                            ? `C$ ${d.diferencia.toLocaleString()}`
                            : d.diferencia.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        {resultadoComprasFiltradas.length > 0 &&
          (seleccionVista === "10" || seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-card relative ${imprimiendo ? "border border-border shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
              <h4 className="font-black text-xl flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-tighter mb-8 print:mb-6">
                <Package
                  className="text-blue-600 dark:text-blue-400 print:text-blue-800"
                  size={28}
                />{" "}
                Compras Filtradas
              </h4>
              <div className="overflow-x-auto border border-border rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 dark:border-slate-600 print:overflow-visible">
                <table className="w-full text-left">
                  <thead className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-[12px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest print:bg-blue-50 print:text-blue-900 print:border-blue-200">
                    <tr>
                      <th className="p-6">ID Compra</th>
                      <th className="p-6">Fecha</th>
                      <th className="p-6">Proveedor</th>
                      <th className="p-6 text-right">Total Compra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {resultadoComprasFiltradas.map((d, index) => (
                      <tr key={index}>
                        <td className="p-6 font-mono text-muted-foreground text-xs">
                          #{d.id_entrada}
                        </td>
                        <td className="p-6 font-mono text-muted-foreground text-xs">
                          {new Date(d.fecha_ingreso).toLocaleDateString(
                            "es-NI",
                          )}
                        </td>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          {d.nombre_proveedor}
                        </td>
                        <td className="p-6 font-black text-teal-600 dark:text-teal-400 uppercase text-xs text-right">
                          C$ {Number(d.total_compra).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        {resultadoSinMovimiento.length > 0 &&
          (seleccionVista === "11" || seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-card relative ${imprimiendo ? "border border-border shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
              <h4 className="font-black text-xl flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-tighter mb-8 print:mb-6">
                <Package
                  className="text-blue-600 dark:text-blue-400 print:text-blue-800"
                  size={28}
                />{" "}
                Productos Sin Movimiento
              </h4>
              <div className="overflow-x-auto border border-border rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 dark:border-slate-600 print:overflow-visible">
                <table className="w-full text-left">
                  <thead className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-[12px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest print:bg-blue-50 print:text-blue-900 print:border-blue-200">
                    <tr>
                      <th className="p-6">Producto</th>
                      <th className="p-6">Categoría</th>
                      <th className="p-6">Stock Actual</th>
                      <th className="p-6 text-right">Días Sin Venta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {resultadoSinMovimiento.map((d, index) => (
                      <tr key={index}>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          {d.nombre_producto}
                        </td>
                        <td className="p-6 font-mono text-muted-foreground text-xs">
                          {d.categoria}
                        </td>
                        <td className="p-6 font-black text-foreground uppercase text-xs">
                          {d.stock_actual} unidades
                        </td>
                        <td className="p-6 font-black text-muted-foreground uppercase text-xs text-right">
                          {d.dias_sin_venta} días
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        {/* FIRMAS DE VALIDACIÓN EN IMPRESIÓN */}
        {imprimiendo && (
          <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 gap-12 text-center text-xs print:break-inside-avoid">
            <div className="flex flex-col items-center">
              <div className="w-48 border-b border-slate-400 h-10"></div>
              <p className="mt-2 font-bold text-slate-700">Firma Autorizada</p>
              <p className="text-[10px] text-slate-400">Responsable de Inventario</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-48 border-b border-slate-400 h-10"></div>
              <p className="mt-2 font-bold text-slate-700">Sello de Control</p>
              <p className="text-[10px] text-slate-400">Administración General</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: letter; margin: 1.5cm; }
          .no-print { display: none !important; }
          
          /* Reset de cuerpo de impresión */
          body { 
            background: #ffffff !important; 
            padding: 0 !important; 
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            color: #1e293b !important;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          }
          
          /* Encabezados Azules */
          h1, h2, h3, h4, th, .text-blue-700, .text-blue-600 {
            color: #1e3a8a !important; /* Royal / Navy Blue */
          }
          
          /* Título de reporte con barra lateral de acento azul */
          h4 {
            font-size: 1.15rem !important;
            font-weight: 800 !important;
            border-left: 4px solid #2563eb !important;
            padding-left: 0.5rem !important;
            margin-top: 1.5rem !important;
            margin-bottom: 0.75rem !important;
            text-transform: uppercase !important;
          }

          /* Quitar el formato de "caja de captura de pantalla" (bordes y sombras) */
          div.bg-card, div.shadow-xl, div.shadow-2xl, div.border {
            background-color: transparent !important;
            border: none !important;
            border-left: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 0 1.5rem 0 !important;
            border-radius: 0 !important;
          }
          
          div.overflow-x-auto {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Quitar barras decorativas superiores de pantalla */
          .absolute.top-0.left-0 {
            display: none !important;
          }
          .border-l-8.border-blue-600 {
            border-left: none !important;
          }
          
          /* Caja de metadatos del reporte oficial */
          .print-meta-box {
            background-color: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 8px !important;
            padding: 0.75rem 1rem !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-top: 1rem !important;
            margin-bottom: 1.5rem !important;
          }

          /* Formato de tabla premium */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 0.5rem !important;
            margin-bottom: 1.5rem !important;
          }
          
          th {
            background-color: #eff6ff !important; /* Fondo azul muy sutil */
            color: #1e3a8a !important; /* Texto azul marino */
            border-bottom: 2px solid #bfdbfe !important;
            font-weight: 700 !important;
            font-size: 0.75rem !important;
            padding: 0.6rem 0.5rem !important;
            text-align: left !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
          }
          
          /* Centrar columnas específicas */
          th.text-center, td.text-center {
            text-align: center !important;
          }
          
          /* Alinear a la derecha columnas específicas */
          th.text-right, td.text-right {
            text-align: right !important;
          }

          td {
            border-bottom: 1px solid #e2e8f0 !important;
            padding: 0.5rem 0.5rem !important;
            font-size: 0.7rem !important;
            color: #334155 !important;
          }

          /* Filas alternadas (Zebra striping) en impresión */
          tbody tr:nth-child(even) td {
            background-color: #f8fafc !important;
          }

          /* Evitar cortes indeseados */
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          .print\\:break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
          .print\\:break-after-avoid { page-break-after: avoid; break-after-avoid; }

          #sonner-toaster, [data-sonner-toaster] { display: none !important; }

          /* Estilo para badges en impresión (Existencias, Estados) */
          .print\\:bg-red-100 { 
            background-color: #fee2e2 !important; 
            color: #991b1b !important; 
            border: 1px solid #fca5a5 !important; 
            border-radius: 4px !important;
            padding: 2px 6px !important;
          }
          .print\\:bg-green-100 { 
            background-color: #dcfce3 !important; 
            color: #166534 !important; 
            border: 1px solid #86efac !important; 
            border-radius: 4px !important;
            padding: 2px 6px !important;
          }
          
          /* Diseño de cuadrícula de resumen gerencial en impresión */
          .grid-cols-1.md\\:grid-cols-3 {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 1rem !important;
            margin-bottom: 1.5rem !important;
          }
          .grid-cols-1.md\\:grid-cols-3 > div {
            border: 1px solid #e2e8f0 !important;
            padding: 0.75rem !important;
            border-radius: 6px !important;
            background-color: #f8fafc !important;
          }
        }
      `}</style>
    </div>
  );
}
