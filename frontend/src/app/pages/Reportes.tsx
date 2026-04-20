import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { TrendingUp, CalendarDays, Users, Package, Loader2, FileSpreadsheet, Printer } from 'lucide-react';
import api from '../api/axiosInstance';
import { toast } from 'sonner';

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
    } finally {
      setLoading(false);
    }
  };

  const ejecutarReportePivot = async () => {
    if (!productoSeleccionado) return toast.error("Elige un producto");
    setLoading(true);
    try {
      const { data } = await api.get(`/ventas/reporte-pivot/?anio=${anio}&productoId=${productoSeleccionado}`);
      setDatosPivot(data);
      toast.success("Análisis mensual cargado");
    } catch (e) {
      setDatosPivot({ 
        producto: "Sin registros", 
        ene:0, feb:0, mar:0, abr:0, may:0, jun:0, 
        jul:0, ago:0, sep:0, oct:0, nov:0, dic:0 
      });
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
      else toast.info("Este proveedor no tiene productos vinculados.");
    } catch (e) {
      toast.error("Error al obtener productos");
    } finally { setLoading(false); }
  };

  const exportarExcelProveedor = (datos: any[]) => {
    const encabezados = "ID,PRODUCTO,EXISTENCIAS\n";
    const filas = datos.map(p => `${p.id},${p.producto},${p.unidades_disponibles}`).join("\n");
    const blob = new Blob(["\ufeff" + encabezados + filas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Inventario_Proveedor.csv");
    link.click();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4">
      {/* TÍTULO PRINCIPAL */}
      <div className="border-b pb-4 text-center">
        <h1 className="text-3xl font-black text-slate-800 uppercase">Reportes de la miscelánea</h1>
        <p className="text-slate-500 font-medium italic">"Bendición de Dios"</p>
      </div>

      {/* SECCIÓN DE FILTROS (3 COLUMNAS) */}
      <div className="grid lg:grid-cols-3 gap-6 no-print">
        {/* REPORTE 1: GERENCIAL */}
        <Card className="p-6 space-y-4 border-t-4 border-green-600 shadow-lg bg-white">
          <div className="flex items-center gap-2 font-bold text-green-700">
            <TrendingUp size={24} /> <h3>Reporte Gerencial</h3>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input 
                type="date" 
                className={`p-2 border rounded text-sm w-full outline-none ${fechaInicio && fechaFin && new Date(fechaInicio) > new Date(fechaFin) ? 'border-red-500 bg-red-50' : 'focus:border-green-500'}`} 
                value={fechaInicio} 
                onChange={(e)=>setFechaInicio(e.target.value)} 
              />
              <input 
                type="date" 
                className="p-2 border rounded text-sm w-full outline-none focus:border-green-500" 
                value={fechaFin} 
                onChange={(e)=>setFechaFin(e.target.value)} 
              />
            </div>
          </div>
          <Button 
            onClick={ejecutarReporteGerencial} 
            className="w-full bg-green-700 hover:bg-green-800 text-white font-bold uppercase tracking-widest disabled:bg-slate-300"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : "Generar"}
          </Button>
        </Card>

        {/* REPORTE 2: PIVOT */}
        <Card className="p-6 space-y-4 border-t-4 border-blue-600 shadow-lg bg-white">
          <div className="flex items-center gap-2 font-bold text-blue-700">
            <CalendarDays size={24} /> <h3>Ventas Mensuales</h3>
          </div>
          <select className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500" value={productoSeleccionado} onChange={(e)=>setProductoSeleccionado(e.target.value)}>
            <option value="">-- Seleccionar Producto --</option>
            {productosLista.map(p => (
              <option key={p.IdProducto || p.id} value={p.IdProducto || p.id}>{p.Nombre || p.name}</option>
            ))}
          </select>
          <Button onClick={ejecutarReportePivot} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold uppercase tracking-widest">
            Analizar
          </Button>
        </Card>

        {/* REPORTE 3: PROVEEDOR */}
        <Card className="p-6 space-y-4 border-t-4 border-purple-600 shadow-lg bg-white">
          <div className="flex items-center gap-2 font-bold text-purple-700">
            <Users size={24} /> <h3>Productos del Proveedor</h3>
          </div>
          <select className="w-full p-2 border rounded text-sm outline-none focus:border-purple-500" value={proveedorSeleccionado} onChange={(e)=>setProveedorSeleccionado(e.target.value)}>
            <option value="">-- Seleccionar Proveedor --</option>
            {proveedoresLista.map(prov => (
              <option key={prov.IdProveedor || prov.id} value={prov.IdProveedor || prov.id}>{prov.Nombre || prov.name}</option>
            ))}
          </select>
          <Button onClick={ejecutarReporteProveedor} disabled={loading} className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold uppercase tracking-widest">
            Listar
          </Button>
        </Card>
      </div>

      {/* ÁREA DE RESULTADOS DINÁMICOS - ESPACIADO FLEXIBLE PARA EVITAR SUPERPOSICIÓN */}
      <div className="flex flex-col gap-12 mt-12 pb-32">
        
        {/* 1. RESULTADO GERENCIAL */}
        {resultadoGerencial && (
          <Card className="p-6 border-l-8 border-green-500 shadow-xl bg-white transition-all">
            <h4 className="font-black text-green-700 uppercase mb-4 flex items-center gap-2 border-b pb-2">
              <TrendingUp size={22} /> Resumen de Desempeño
            </h4>
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

        {/* 2. TABLA PIVOT (ANÁLISIS ANUAL) */}
        {datosPivot && (
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
                  <tr className="hover:bg-blue-50/40 transition-colors">
                    {[datosPivot.ene, datosPivot.feb, datosPivot.mar, datosPivot.abr, datosPivot.may, datosPivot.jun, datosPivot.jul, datosPivot.ago, datosPivot.sep, datosPivot.oct, datosPivot.nov, datosPivot.dic].map((v, i)=>(
                      <td key={i} className="p-6 font-black text-blue-600 border-r last:border-r-0">
                        C${Number(v || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 3. TABLA DE PROVEEDOR */}
        {productosProveedor.length > 0 && (
          <Card className="p-8 shadow-2xl border-0 bg-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-purple-600"></div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <h4 className="font-black text-xl flex items-center gap-2 text-slate-800 uppercase tracking-tighter">
                <Users className="text-purple-600" size={28} /> Productos abastecidos por el proveedor
              </h4>
              <div className="flex gap-3 no-print">
                <Button onClick={() => window.print()} className="bg-slate-800 text-white hover:bg-black font-bold px-6 shadow-md transition-all">
                  <Printer size={18} className="mr-2" /> PDF
                </Button>
                <Button onClick={() => exportarExcelProveedor(productosProveedor)} className="bg-green-700 text-white hover:bg-green-800 font-bold px-6 shadow-md transition-all">
                  <FileSpreadsheet size={18} className="mr-2" /> EXCEL
                </Button>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-[12px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="p-6">Cód.</th>
                    <th className="p-6">Descripción del Artículo</th>
                    <th className="p-6 text-center">Existencia Real</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {productosProveedor.map((p) => (
                    <tr key={p.id} className="hover:bg-purple-50/50 transition-colors group">
                      <td className="p-6 font-mono text-slate-400 text-xs">#{p.id}</td>
                      <td className="p-6 font-black text-slate-700 uppercase group-hover:text-purple-700 transition-colors">{p.producto}</td>
                      <td className="p-6 text-center">
                        <span className={`inline-block w-36 py-2.5 rounded-xl font-black text-xs shadow-sm border ${
                          p.unidades_disponibles < 10 
                          ? 'bg-red-50 text-red-600 border-red-100' 
                          : 'bg-green-50 text-green-600 border-green-100'
                        }`}>
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
          .Card { box-shadow: none !important; border: 1px solid #f1f5f9 !important; margin-bottom: 2rem !important; }
          .flex-col { gap: 2rem !important; }
        }
      `}</style>
    </div>
  );
}