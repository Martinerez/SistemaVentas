import { Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function Devoluciones() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Devoluciones</h1>
          <p className="text-gray-600">Gestión de devoluciones de productos</p>
        </div>
        <Button className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950">
          <Plus className="size-4 mr-2" />
          Nueva Devolución
        </Button>
      </div>

      <Card className="p-6">
        <div className="text-center py-12 text-gray-500">
          <p>Contenido de devoluciones en desarrollo...</p>
        </div>
      </Card>
    </div>
  );
}