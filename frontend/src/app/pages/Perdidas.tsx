import { Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function Perdidas() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pérdidas</h1>
          <p className="text-gray-600">Registro de pérdidas y mermas</p>
        </div>
        <Button className="bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800">
          <Plus className="size-4 mr-2" />
          Registrar Pérdida
        </Button>
      </div>

      <Card className="p-6">
        <div className="text-center py-12 text-gray-500">
          <p>Contenido de pérdidas en desarrollo...</p>
        </div>
      </Card>
    </div>
  );
}