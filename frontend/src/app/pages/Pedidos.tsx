import { Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function Pedidos() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pedidos</h1>
          <p className="text-gray-600">Gestiona tus pedidos</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-800 to-slate-900 hover:from-blue-900 hover:to-slate-950">
          <Plus className="size-4 mr-2" />
          Nuevo Pedido
        </Button>
      </div>

      <Card className="p-6">
        <div className="text-center py-12 text-gray-500">
          <p>Contenido de pedidos en desarrollo...</p>
        </div>
      </Card>
    </div>
  );
}
