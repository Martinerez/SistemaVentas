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
  TrendingDown,
} from "lucide-react";
import api from "../api/axiosInstance";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export function Reportes() {
  const [productosLista, setProductosLista] = useState<any[]>([]);
  const [proveedoresLista, setProveedoresLista] = useState<any[]>([]);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState("");
  const [resultadoGerencial, setResultadoGerencial] = useState<any>(null);
  const [datosPivot, setDatosPivot] = useState<any>(null);
  const [productosProveedor, setProductosProveedor] = useState<any[]>([]);
  const [resultadoDevoluciones, setResultadoDevoluciones] = useState<any[]>([]);
  const [fechaInicioDev, setFechaInicioDev] = useState("");
  const [fechaFinDev, setFechaFinDev] = useState("");
  const [loadingGerencial, setLoadingGerencial] = useState(false);
  const [loadingPivot, setLoadingPivot] = useState(false);
  const [loadingProveedor, setLoadingProveedor] = useState(false);
  const [loadingDevoluciones, setLoadingDevoluciones] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [resultadoPerdidas, setResultadoPerdidas] = useState<any[]>([]);
  const [fechaInicioPer, setFechaInicioPer] = useState("");
  const [fechaFinPer, setFechaFinPer] = useState("");
  const [loadingPerdidas, setLoadingPerdidas] = useState(false);

  // Estado para la elección del usuario --La pregunta de los 3 reportes
  const [seleccionVista, setSeleccionVista] = useState<
    "1" | "2" | "3" | "4" | "5" | "todos"
  >("todos");

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [prodRes, provRes] = await Promise.all([
          api.get("/catalogo/productos/"),
          api.get("/catalogo/proveedores/"),
        ]);
        setProductosLista(prodRes.data.results ?? prodRes.data ?? []);
        setProveedoresLista(provRes.data.results ?? provRes.data ?? []);
      } catch (e) {
        toast.error("Error al cargar datos maestros");
      }
    };
    cargarDatos();
  }, []);

  const ejecutarReporteGerencial = async () => {
    if (!fechaInicio || !fechaFin)
      return toast.error("Selecciona ambas fechas");
    if (new Date(fechaInicio) > new Date(fechaFin)) {
      return toast.error(
        "La fecha de inicio no puede ser mayor a la fecha final",
      );
    }
    setLoadingGerencial(true);
    try {
      const { data } = await api.get(
        `/ventas/reporte-gerencial/?inicio=${fechaInicio}&fin=${fechaFin}`,
      );
      setResultadoGerencial(data);
      toast.success("Reporte generado con éxito");
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
      }
    } catch (e) {
      setProductosProveedor([]);
      toast.error("Error al obtener productos");
    } finally {
      setLoadingProveedor(false);
    }
  };

  const ejecutarReporteDevoluciones = async () => {
    if (!fechaInicioDev || !fechaFinDev)
      return toast.error("Selecciona ambas fechas");
    if (new Date(fechaInicioDev) > new Date(fechaFinDev)) {
      return toast.error(
        "La fecha de inicio no puede ser mayor a la fecha final",
      );
    }
    setLoadingDevoluciones(true);
    try {
      const { data } = await api.get(
        `/ventas/reporte-devoluciones/?inicio=${fechaInicioDev}&fin=${fechaFinDev}`,
      );
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
    } finally {
      setLoadingDevoluciones(false);
    }
  };

  {
    /* Funcion para reporte de pérdidas */
  }
  const ejecutarReportePerdidas = async () => {
    if (!fechaInicioPer || !fechaFinPer)
      return toast.error("Selecciona ambas fechas");

    setLoadingPerdidas(true);
    try {
      const { data } = await api.get(
        `/ventas/reporte-perdidas/?inicio=${fechaInicioPer}&fin=${fechaFinPer}`,
      );

      if (data.length === 0) {
        setResultadoPerdidas([]);
        toast.error("No se encontraron pérdidas");
      } else {
        setResultadoPerdidas(data);
        toast.success("Reporte de pérdidas cargado");
      }
    } catch {
      setResultadoPerdidas([]);
      toast.error("Error al conectar");
    } finally {
      setLoadingPerdidas(false);
    }
  };

  //DOCUMENTO DE EXCEL CON EXCELJS
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
        const d_fecha = new Date(d.fecha);
        // add timezone offset back if needed, assuming the server returns YYYY-MM-DD
        sheet.addRow([
          d.id_solicitud,
          d.producto,
          d.cantidad,
          d.motivo || "N/A",
          d_fecha.toLocaleDateString("es-NI", { timeZone: "UTC" }),
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
      const headerDev = sheet.addRow([
        "N° PÉRDIDA",
        "PRODUCTO",
        "CANTIDAD",
        "MOTIVO",
        "TOTAL PERDIDO",
        "FECHA",
      ]);
      headerDev.eachCell(
        (c) =>
          (c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDEE2E6" },
          }),
      );
      resultadoPerdidas.forEach((d) => {
        const d_fecha = new Date(d.fecha);
        // add timezone offset back if needed, assuming the server returns YYYY-MM-DD
        sheet.addRow([
          d.id_perdida,
          d.producto,
          d.cantidad,
          d.motivo || "N/A",
          d.total,
          d_fecha.toLocaleDateString("es-NI", { timeZone: "UTC" }),
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
    if (seleccionVista === "todos") {
      return (
        !!resultadoGerencial ||
        !!datosPivot ||
        productosProveedor.length > 0 ||
        resultadoDevoluciones.length > 0
      );
    }
    if (seleccionVista === "1") return !!resultadoGerencial;
    if (seleccionVista === "2") return !!datosPivot;
    if (seleccionVista === "3") return productosProveedor.length > 0;
    if (seleccionVista === "4") return resultadoDevoluciones.length > 0;
    if (seleccionVista === "5") return resultadoPerdidas.length > 0;
    return false;
  };

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
          <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">
            Reportes de la Miscelánea
          </h1>
          <p className="text-xl text-slate-600 font-medium italic mt-1">
            "Bendición de Dios"
          </p>
        </div>
      )}

      {/* HEADER DE IMPRESIÓN */}
      {imprimiendo && (
        <div className="flex flex-col mb-10 border-b-4 border-slate-900 pb-6 print:break-after-avoid">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">
                MISCELÁNEA BENDICIÓN DE DIOS
              </h1>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest"></p>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-md border border-slate-300">
                Documento Oficial
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Emisión:{" "}
                {new Date().toLocaleDateString("es-NI", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* PANEL DE SELECCIÓN (LA PREGUNTA) */}
      {!imprimiendo && (
        <Card className="p-4 bg-slate-800 text-white shadow-xl border-none">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-green-500" size={24} />
              <p className="font-bold text-sm uppercase tracking-wider">
                ¿Qué desea incluir en el documento?
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={seleccionVista}
                onChange={(e: any) => setSeleccionVista(e.target.value)}
                className="bg-slate-700 text-white text-xs font-bold p-2 rounded-lg outline-none border border-slate-600 cursor-pointer"
              >
                <option value="todos">Incluir todos los reportes</option>
                <option value="1">Solo Reporte De Ventas</option>
                <option value="2">Solo Ventas Mensuales</option>
                <option value="3">Solo Lista de Proveedor</option>
                <option value="4">Solo Devoluciones</option>
                <option value="5">Solo Pérdidas</option>
              </select>
              <Button
                onClick={handleImprimirPDF}
                className="bg-white text-slate-900 hover:bg-slate-200 font-black text-xs"
              >
                <Printer size={16} className="mr-2" /> PDF
              </Button>
              <Button
                onClick={exportarExcelEstetico}
                className="bg-green-600 hover:bg-green-700 text-white font-black text-xs"
              >
                <FileSpreadsheet size={16} className="mr-2" /> DOCUMENTO EXCEL
              </Button>
            </div>
          </div>
        </Card>
      )}
      <div className="border-b pb-6 text-center">
        <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">
          Reportes Generales
        </h2>
      </div>
      {/* SECCIÓN DE FILTROS */}
      {!imprimiendo && (
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4 border-t-4 border-green-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-green-700">
              <TrendingUp size={24} />{" "}
              <h3 className="truncate">Reporte de Ventas</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="p-2 border rounded text-sm w-full outline-none focus:border-green-500"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
              <input
                type="date"
                className="p-2 border rounded text-sm w-full outline-none focus:border-green-500"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
            <Button
              onClick={ejecutarReporteGerencial}
              className="w-full bg-green-700 hover:bg-green-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingGerencial ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Generar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-blue-700">
              <CalendarDays size={24} />{" "}
              <h3 className="truncate">Ventas Mensuales</h3>
            </div>
            <select
              className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500"
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

          <Card className="p-6 space-y-4 border-t-4 border-purple-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-purple-700">
              <Users size={24} />{" "}
              <h3 className="truncate">Productos del Proveedor</h3>
            </div>
            <select
              className="w-full p-2 border rounded text-sm outline-none focus:border-purple-500"
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
              className="w-full bg-purple-700 text-white font-bold uppercase tracking-widest"
            >
              {loadingProveedor ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Listar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-orange-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-orange-700">
              <Undo2 size={24} /> <h3 className="truncate">Devoluciones</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="p-2 border rounded text-sm w-full outline-none focus:border-orange-500"
                value={fechaInicioDev}
                onChange={(e) => setFechaInicioDev(e.target.value)}
              />
              <input
                type="date"
                className="p-2 border rounded text-sm w-full outline-none focus:border-orange-500"
                value={fechaFinDev}
                onChange={(e) => setFechaFinDev(e.target.value)}
              />
            </div>
            <Button
              onClick={ejecutarReporteDevoluciones}
              className="w-full bg-orange-700 hover:bg-orange-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingDevoluciones ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Generar"
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 border-t-4 border-red-600 shadow-lg bg-white">
            <div className="flex items-center gap-2 font-bold text-red-700">
              <TrendingDown size={24} /> <h3 className="truncate">Pérdidas</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="p-2 border rounded text-sm w-full outline-none focus:border-red-500"
                value={fechaInicioPer}
                onChange={(e) => setFechaInicioPer(e.target.value)}
              />
              <input
                type="date"
                className="p-2 border rounded text-sm w-full outline-none focus:border-red-500"
                value={fechaFinPer}
                onChange={(e) => setFechaFinPer(e.target.value)}
              />
            </div>
            <Button
              onClick={ejecutarReportePerdidas}
              className="w-full bg-red-700 hover:bg-red-800 text-white font-bold uppercase tracking-widest"
            >
              {loadingPerdidas ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Generar"
              )}
            </Button>
          </Card>
        </div>
      )}

      {/* ÁREA DE RESULTADOS DINÁMICOS */}
      <div
        className={`mt-12 ${imprimiendo ? "block space-y-8 pb-0" : "flex flex-col gap-12 pb-32"}`}
      >
        {resultadoGerencial &&
          (!imprimiendo ||
            seleccionVista === "1" ||
            seleccionVista === "todos") && (
            <Card
              className={`p-6 border-l-8 border-green-500 bg-white ${imprimiendo ? "border shadow-none block" : "shadow-xl"} print:break-inside-avoid`}
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between border-b pb-2 mb-4">
                <h4 className="font-black text-green-700 uppercase flex items-center gap-2 print:text-green-800">
                  <TrendingUp size={22} /> Resumen de Desempeño
                </h4>
                <span className="text-xs font-bold text-slate-500 print:text-slate-600 uppercase tracking-widest mt-2 md:mt-0">
                  Período: {fechaInicio.split("-").reverse().join("/")} al{" "}
                  {fechaFin.split("-").reverse().join("/")}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm print:bg-white print:border-slate-200 print:shadow-none">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter print:text-slate-500">
                    Monto Total Vendido
                  </span>
                  <p className="text-2xl font-black text-slate-800">
                    C${" "}
                    {Number(
                      resultadoGerencial.total_ventas || 0,
                    ).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm print:bg-white print:border-slate-200 print:shadow-none">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter print:text-slate-500">
                    Promedio de ventas
                  </span>
                  <p className="text-2xl font-black text-slate-800">
                    C${" "}
                    {Number(
                      resultadoGerencial.promedio_venta || 0,
                    ).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm print:bg-white print:border-slate-200 print:shadow-none">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter print:text-slate-500">
                    Producto Estrella
                  </span>
                  <p className="text-2xl font-black text-green-600 uppercase truncate print:text-green-700">
                    {resultadoGerencial.producto_mas_vendido || "N/A"}
                  </p>
                </div>
              </div>
            </Card>
          )}

        {datosPivot &&
          (!imprimiendo ||
            seleccionVista === "2" ||
            seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-white relative ${imprimiendo ? "border border-slate-200 shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"} print:break-inside-avoid`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 print:h-2"></div>
              <h4 className="font-black mb-6 flex items-center gap-2 text-blue-700 text-lg uppercase tracking-widest print:text-blue-800">
                <Package size={24} /> Análisis de Ventas: {datosPivot.producto}
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-inner print:shadow-none print:border-slate-300 print:overflow-visible">
                <table className="w-full text-center">
                  <thead className="bg-slate-50 uppercase font-black text-[11px] text-slate-500 border-b print:bg-slate-100 print:text-slate-700">
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
                          className="p-5 border-r last:border-r-0 print:p-3 print:border-slate-300"
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
                          className="p-6 font-black text-blue-600 border-r last:border-r-0 print:p-3 print:text-blue-800 print:border-slate-300"
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
          (!imprimiendo ||
            seleccionVista === "3" ||
            seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-white relative ${imprimiendo ? "border border-slate-200 shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-purple-600 print:h-2"></div>
              <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6">
                <Users
                  className="text-purple-600 print:text-purple-800"
                  size={28}
                />{" "}
                Productos abastecidos por el proveedor
              </h4>
              <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 print:overflow-visible">
                <table className="w-full text-left print:border-collapse">
                  <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest print:bg-slate-100 print:text-slate-700 print:border-slate-300">
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
                        <td className="p-6 print:p-3 font-mono text-slate-400 print:text-slate-600 text-xs">
                          #{p.id}
                        </td>
                        <td className="p-6 print:p-3 font-black text-slate-700 uppercase">
                          {p.producto}
                        </td>
                        <td className="p-6 print:p-3 text-center">
                          <span
                            className={`inline-block w-36 py-2.5 rounded-xl font-black text-xs shadow-sm border print:shadow-none ${p.unidades_disponibles < 10 ? "bg-red-50 text-red-600 border-red-100 print:bg-red-100 print:text-red-800" : "bg-green-50 text-green-600 border-green-100 print:bg-green-100 print:text-green-800"}`}
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
          (!imprimiendo ||
            seleccionVista === "4" ||
            seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-white relative ${imprimiendo ? "border border-slate-200 shadow-none p-6 block overflow-visible" : "shadow-2xl overflow-hidden"}`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-600 print:h-2"></div>
              <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6">
                <Undo2
                  className="text-orange-600 print:text-orange-800"
                  size={28}
                />{" "}
                Reporte de Devoluciones
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
                        <td className="p-6 print:p-3 font-mono text-slate-600 text-xs">
                          #{d.id_solicitud}
                        </td>
                        <td className="p-6 print:p-3 font-black text-slate-700 uppercase text-xs">
                          {d.producto}
                        </td>
                        <td className="p-6 print:p-3 text-center font-bold text-slate-700 text-xs">
                          {d.cantidad}
                        </td>
                        <td className="p-6 print:p-3 text-slate-500 text-xs">
                          {d.motivo || "N/A"}
                        </td>
                        <td className="p-6 print:p-3 font-mono text-slate-600 text-xs">
                          {new Date(d.fecha).toLocaleDateString("es-NI", {
                            timeZone: "UTC",
                          })}
                        </td>
                        <td className="p-6 print:p-3 font-black text-orange-600 uppercase text-xs">
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
          (!imprimiendo ||
            seleccionVista === "5" || // si agregas opción
            seleccionVista === "todos") && (
            <Card
              className={`p-8 border-0 bg-white relative ${
                imprimiendo
                  ? "border border-slate-200 shadow-none p-6 block overflow-visible"
                  : "shadow-2xl overflow-hidden"
              }`}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600 print:h-2"></div>

              <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8 print:mb-6">
                <TrendingDown
                  className="text-red-600 print:text-red-800"
                  size={28}
                />
                Reporte de Pérdidas
              </h4>

              <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm print:rounded-lg print:border-slate-300 print:overflow-visible">
                <table className="w-full text-left print:border-collapse">
                  <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                    <tr>
                      <th className="p-6 print:p-3">ID</th>
                      <th className="p-6 print:p-3">Producto</th>
                      <th className="p-6 print:p-3 text-center">Cantidad</th>
                      <th className="p-6 print:p-3">Motivo</th>
                      <th className="p-6 print:p-3 text-center">Total</th>
                      <th className="p-6 print:p-3">Fecha</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                    {resultadoPerdidas.map((p, index) => (
                      <tr key={index}>
                        <td className="p-6 print:p-3 font-mono text-slate-600 text-xs">
                          #{p.id_perdida || "N/A"}
                        </td>

                        <td className="p-6 print:p-3 font-black text-slate-700 uppercase text-xs">
                          {p.producto}
                        </td>

                        <td className="p-6 print:p-3 text-center font-bold text-slate-700 text-xs">
                          {p.cantidad}
                        </td>

                        <td className="p-6 print:p-3 text-slate-500 text-xs">
                          {p.motivo || "N/A"}
                        </td>
                        <td className="p-6 print:p-3 text-center font-bold text-red-600 text-xs">
                          -C$ {Number(p.total || 0).toLocaleString()}
                        </td>
                        <td className="p-6 print:p-3 font-mono text-slate-600 text-xs">
                          {new Date(p.fecha).toLocaleDateString("es-NI", {
                            timeZone: "UTC",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
      </div>

      {/* REPORTES AVANZADOS */}

      {!imprimiendo && (
        <>
          <div className="border-b pb-6 text-center mt-12">
            <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">
              Reportes Avanzados
            </h2>
          </div>

          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-400">
            (Aquí irán los reportes avanzados)
          </div>
        </>
      )}

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
