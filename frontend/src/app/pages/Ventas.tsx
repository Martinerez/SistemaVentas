import { Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function Ventas() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ventas</h1>
          <p className="text-gray-600">Historial y registro de ventas</p>
        </div>
        <Button className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800">
          <Plus className="size-4 mr-2" />
          Nueva Venta
        </Button>
      </div>

      <Card className="p-6">
        <div className="text-center py-12 text-gray-500">
          <p>Contenido de ventas en desarrollo...</p>
        </div>
      </Card>
    </div>
  );
}