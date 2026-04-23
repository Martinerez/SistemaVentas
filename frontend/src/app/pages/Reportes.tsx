import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { TrendingUp, CalendarDays, Users, Package, Loader2, FileSpreadsheet, Printer, CheckCircle2 } from 'lucide-react';
import api from '../api/axiosInstance';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export function Reportes() {
  const [productosLista, setProductosLista] = useState<any[]>([]);
  const [proveedoresLista, setProveedoresLista] = useState<any[]>([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [productoSeleccionado, setProductoSeleccionado] = useState('');
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState('');
  const [resultadoGerencial, setResultadoGerencial] = useState<any>(null);
  const [datosPivot, setDatosPivot] = useState<any>(null);
  const [productosProveedor, setProductosProveedor] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Estado para la elección del usuario --La pregunta de los 3 reportes
  const [seleccionVista, setSeleccionVista] = useState<'1' | '2' | '3' | 'todos'>('todos');

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [prodRes, provRes] = await Promise.all([
          api.get('/catalogo/productos/'),
          api.get('/catalogo/proveedores/')
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
    if (!fechaInicio || !fechaFin) return toast.error("Selecciona ambas fechas");
    if (new Date(fechaInicio) > new Date(fechaFin)) {
      return toast.error("La fecha de inicio no puede ser mayor a la fecha final");
    }
    setLoading(true);
    try {
      const { data } = await api.get(`/ventas/reporte-gerencial/?inicio=${fechaInicio}&fin=${fechaFin}`);
      setResultadoGerencial(data);
      toast.success("Reporte generado con éxito");
    } catch (e) {
      toast.error("Error al conectar con el servidor");
    } finally { setLoading(false); }
  };

  const ejecutarReportePivot = async () => {
    if (!productoSeleccionado) return toast.error("Elige un producto");
    setLoading(true);
    try {
      const { data } = await api.get(`/ventas/reporte-pivot/?anio=${anio}&productoId=${productoSeleccionado}`);
      setDatosPivot(data);
      toast.success("Análisis mensual cargado");
    } catch (e) {
      setDatosPivot({ producto: "Sin registros", ene:0, feb:0, mar:0, abr:0, may:0, jun:0, jul:0, ago:0, sep:0, oct:0, nov:0, dic:0 });
      toast.info("No se encontraron ventas para este periodo");
    } finally { setLoading(false); }
  };

  const ejecutarReporteProveedor = async () => {
    if (!proveedorSeleccionado) return toast.error("Elige un proveedor");
    setLoading(true);
    try {
      const { data } = await api.get(`/ventas/productos-proveedor/?proveedorId=${proveedorSeleccionado}`);
      setProductosProveedor(data);
      if (data.length > 0) toast.success("Lista de productos cargada");
    } catch (e) {
      toast.error("Error al obtener productos");
    } finally { setLoading(false); }
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
      sheet.addRow(['--- REPORTE GERENCIAL ---']).font = { bold: true };
      sheet.addRow(['Monto Total Vendido', '', `C$ ${Number(resultadoGerencial.total_ventas).toLocaleString()}`]);
      sheet.addRow(['Promedio de Ventas', '', `C$ ${Number(resultadoGerencial.promedio_venta).toLocaleString()}`]);
      sheet.addRow(['Producto Estrella', '', resultadoGerencial.producto_mas_vendido]);
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

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]),  `Reporte_Miscelanea_BendicionDeDios_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4">
      {/* TÍTULO PRINCIPAL */}
      <div className="border-b pb-4 text-center">
        <h1 className="text-3xl font-black text-slate-800 uppercase leading-none">Reportes de la miscelánea</h1>
        <p className="text-slate-500 font-medium italic">"Bendición de Dios"</p>
      </div>

      {/* PANEL DE SELECCIÓN (LA PREGUNTA) */}
      <Card className="p-4 bg-slate-800 text-white shadow-xl no-print border-none">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-green-500" size={24}/>
            <p className="font-bold text-sm uppercase tracking-wider">¿Qué desea incluir en el documento?</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select 
              value={seleccionVista} 
              onChange={(e: any) => setSeleccionVista(e.target.value)}
              className="bg-slate-700 text-white text-xs font-bold p-2 rounded-lg outline-none border border-slate-600 cursor-pointer"
            >
              <option value="todos">Incluir los 3 reportes</option>
              <option value="1">Solo Reporte Gerencial</option>
              <option value="2">Solo Ventas Mensuales</option>
              <option value="3">Solo Lista de Proveedor</option>
            </select>
            <Button onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-slate-200 font-black text-xs">
              <Printer size={16} className="mr-2" /> PDF
            </Button>
            <Button onClick={exportarExcelEstetico} className="bg-green-600 hover:bg-green-700 text-white font-black text-xs">
              <FileSpreadsheet size={16} className="mr-2" /> DOCUMENTO EXCEL
            </Button>
          </div>
        </div>
      </Card>

      {/* SECCIÓN DE FILTROS */}
      <div className="grid lg:grid-cols-3 gap-6 no-print">
        <Card className="p-6 space-y-4 border-t-4 border-green-600 shadow-lg bg-white">
          <div className="flex items-center gap-2 font-bold text-green-700"><TrendingUp size={24} /> <h3>Reporte Gerencial</h3></div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className="p-2 border rounded text-sm w-full outline-none focus:border-green-500" value={fechaInicio} onChange={(e)=>setFechaInicio(e.target.value)} />
            <input type="date" className="p-2 border rounded text-sm w-full outline-none focus:border-green-500" value={fechaFin} onChange={(e)=>setFechaFin(e.target.value)} />
          </div>
          <Button onClick={ejecutarReporteGerencial} className="w-full bg-green-700 hover:bg-green-800 text-white font-bold uppercase tracking-widest">{loading ? <Loader2 className="animate-spin" /> : "Generar"}</Button>
        </Card>

        <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-white">
          <div className="flex items-center gap-2 font-bold text-blue-700"><CalendarDays size={24} /> <h3>Ventas Mensuales</h3></div>
          <select className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500" value={productoSeleccionado} onChange={(e)=>setProductoSeleccionado(e.target.value)}>
            <option value="">-- Seleccionar Producto --</option>
            {productosLista.map(p => <option key={p.id} value={p.id}>{p.Nombre || p.name}</option>)}
          </select>
          <Button onClick={ejecutarReportePivot} className="w-full bg-blue-700 text-white font-bold uppercase tracking-widest">Analizar</Button>
        </Card>

        <Card className="p-6 space-y-4 border-t-4 border-purple-600 shadow-lg bg-white">
          <div className="flex items-center gap-2 font-bold text-purple-700"><Users size={24} /> <h3>Productos del Proveedor</h3></div>
          <select className="w-full p-2 border rounded text-sm outline-none focus:border-purple-500" value={proveedorSeleccionado} onChange={(e)=>setProveedorSeleccionado(e.target.value)}>
            <option value="">-- Seleccionar Proveedor --</option>
            {proveedoresLista.map(prov => <option key={prov.id} value={prov.id}>{prov.Nombre || prov.name}</option>)}
          </select>
          <Button onClick={ejecutarReporteProveedor} className="w-full bg-purple-700 text-white font-bold uppercase tracking-widest">Listar</Button>
        </Card>
      </div>

      {/* ÁREA DE RESULTADOS DINÁMICOS */}
      <div className="flex flex-col gap-12 mt-12 pb-32">
        {(seleccionVista === '1' || seleccionVista === 'todos') && resultadoGerencial && (
          <Card className="p-6 border-l-8 border-green-500 shadow-xl bg-white">
            <h4 className="font-black text-green-700 uppercase mb-4 flex items-center gap-2 border-b pb-2"><TrendingUp size={22} /> Resumen de Desempeño</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Monto Total Vendido</span>
                <p className="text-2xl font-black text-slate-800">C$ {Number(resultadoGerencial.total_ventas || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Promedio de ventas</span>
                <p className="text-2xl font-black text-slate-800">C$ {Number(resultadoGerencial.promedio_venta || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Producto Estrella</span>
                <p className="text-2xl font-black text-green-600 uppercase truncate">{resultadoGerencial.producto_mas_vendido || 'N/A'}</p>
              </div>
            </div>
          </Card>
        )}

        {(seleccionVista === '2' || seleccionVista === 'todos') && datosPivot && (
          <Card className="p-8 shadow-2xl border-0 bg-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
            <h4 className="font-black mb-6 flex items-center gap-2 text-blue-700 text-lg uppercase tracking-widest">
              <Package size={24}/> Análisis de Ventas: {datosPivot.producto}
            </h4>
            <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-inner">
              <table className="w-full text-center">
                <thead className="bg-slate-50 uppercase font-black text-[11px] text-slate-500 border-b">
                  <tr>{['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map(m=><th key={m} className="p-5 border-r last:border-r-0">{m}</th>)}</tr>
                </thead>
                <tbody className="text-sm">
                  <tr>
                    {[datosPivot.ene, datosPivot.feb, datosPivot.mar, datosPivot.abr, datosPivot.may, datosPivot.jun, datosPivot.jul, datosPivot.ago, datosPivot.sep, datosPivot.oct, datosPivot.nov, datosPivot.dic].map((v, i)=>(
                      <td key={i} className="p-6 font-black text-blue-600 border-r last:border-r-0">C${Number(v || 0).toLocaleString()}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {(seleccionVista === '3' || seleccionVista === 'todos') && productosProveedor.length > 0 && (
          <Card className="p-8 shadow-2xl border-0 bg-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-purple-600"></div>
            <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter mb-8">
              <Users className="text-purple-600" size={28} /> Productos abastecidos por el proveedor
            </h4>
            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="p-6">Cód.</th><th className="p-6">Descripción del Artículo</th><th className="p-6 text-center">Existencia Real</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {productosProveedor.map((p) => (
                    <tr key={p.id}>
                      <td className="p-6 font-mono text-slate-400 text-xs">#{p.id}</td>
                      <td className="p-6 font-black text-slate-700 uppercase">{p.producto}</td>
                      <td className="p-6 text-center">
                        <span className={`inline-block w-36 py-2.5 rounded-xl font-black text-xs shadow-sm border ${p.unidades_disponibles < 10 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
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
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .Card { box-shadow: none !important; border: 1px solid #f1f5f9 !important; margin-bottom: 2rem !important; page-break-inside: avoid; }
          .flex-col { gap: 2rem !important; }
        }
      `}</style>
    </div>
  );
}
