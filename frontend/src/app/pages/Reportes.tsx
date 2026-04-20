import React, { useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FileText, Download } from 'lucide-react';

export function Reportes() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Reportes del Sistema</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-6 rounded-xl border shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium">Fecha Inicio</label>
          <input 
            type="date" 
            className="w-full p-2 border rounded-md"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Fecha Fin</label>
          <input 
            type="date" 
            className="w-full p-2 border rounded-md"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button className="w-full bg-slate-800 hover:bg-slate-700">
            Generar Reporte
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 flex items-center gap-4 hover:border-slate-400 cursor-pointer transition-all">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><FileText /></div>
          <div>
            <h3 className="font-bold">Ventas por Fecha</h3>
            <p className="text-sm text-gray-500">Historial detallado de ingresos.</p>
          </div>
        </Card>
        {/* Aquí puedes agregar más tarjetas para otros reportes */}
      </div>
    </div>
  );
}