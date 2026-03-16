import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export function Ajustes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ajustes</h1>
        <p className="text-gray-600">Configuración del sistema</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 border-0 shadow-lg">
          <h3 className="font-bold text-lg mb-4 text-slate-800">Información de la Tienda</h3>
          <div className="space-y-4">
            <div>
              <Label>Nombre de la Tienda</Label>
              <Input placeholder="Bendición de Dios" />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input placeholder="Calle Principal #123" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input placeholder="+52 123 456 7890" />
            </div>
            <Button className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950">Guardar Cambios</Button>
          </div>
        </Card>

        <Card className="p-6 border-0 shadow-lg">
          <h3 className="font-bold text-lg mb-4 text-slate-800">Configuración General</h3>
          <div className="text-center py-12 text-gray-500">
            <p>Opciones de configuración en desarrollo...</p>
          </div>
        </Card>
      </div>
    </div>
  );
}