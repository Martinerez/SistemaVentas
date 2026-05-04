/**
 * @fileoverview Página de Ventas — Punto de Venta (POS) e Historial
 *
 * Contiene dos vistas en tabs:
 *   1. "Punto de Venta": Interfaz de POS tipo kiosko para registrar ventas.
 *   2. "Historial": Tabla de ventas previas con expansión por detalle y anulación.
 *
 * SINCRONIZACIÓN DE INVENTARIO EN EL POS (fetchInventoryForSale):
 *   Para mostrar los productos disponibles, el frontend hace 3 peticiones
 *   paralelas y las ensambla en memoria:
 *     - /inventario/inventarios/ → Todas las unidades físicas con su Estado.
 *     - /inventario/detalles-entrada/ → Qué producto es cada unidad (FK).
 *     - /catalogo/productos/ → Datos del producto (nombre, precio).
 *
 *   Se filtran las unidades 'Disponibles' y se agrupan por producto para
 *   mostrar una sola tarjeta con el stock total (`availableQty`) y la lista
 *   de IDs de inventario disponibles (`inventarioIds`).
 *
 * FLUJO DE CHECKOUT:
 *   Al cobrar, se envían los IDs específicos de inventario (no el productId):
 *   `item.inventarioIds.slice(0, item.quantity)` toma los primeros N IDs
 *   disponibles del producto (donde N = cantidad en carrito).
 *   El backend (ProcesarVentaView) vincula cada ID de inventario a la venta
 *   y cambia su estado a 'Vendido' de forma atómica.
 *
 * ANULACIÓN:
 *   Solo accesible para admins (isAdmin guard en el JSX).
 *   Usa un modal de confirmación (ConfirmAnularModal) para prevenir
 *   anulaciones accidentales. El backend revierte el stock automáticamente.
 */
import {
  Plus, Search, ShoppingCart, Minus, Trash2, Loader2, Receipt,
  ChevronDown, ChevronRight, Ban, AlertTriangle, X, Download, Printer, CheckCircle
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { useState, useEffect } from "react";
import api from "../api/axiosInstance";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Modal de confirmación de anulación de venta.
 *
 * Componente separado para mantener la lógica del modal aislada.
 * El backdrop `onClick={onCancel}` permite cerrar el modal haciendo
 * clic fuera, siguiendo la convención de UX estándar.
 *
 * @param ventaId - ID de la venta a anular (para mostrar al usuario).
 * @param onConfirm - Callback ejecutado al confirmar la anulación.
 * @param onCancel - Callback para cerrar el modal sin anular.
 * @param isLoading - True mientras la petición de anulación está en vuelo.
 */
function ConfirmAnularModal({
  ventaId,
  onConfirm,
  onCancel,
  isLoading,
}: {
  ventaId: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5 flex items-center gap-3">
          <div className="bg-white/20 rounded-full p-2">
            <AlertTriangle className="size-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Confirmar Anulación</h2>
            <p className="text-red-100 text-sm">Venta #{ventaId}</p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto text-white/70 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              <strong>¿Estás seguro?</strong> Esta acción devolverá los productos al
              stock y marcará la venta como <strong>inválida</strong>. No se puede
              deshacer.
            </p>
          </div>
          <p className="text-sm text-gray-500 text-center">
            Los ítems de inventario volverán al estado <em>Disponible</em>.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-gray-200"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Ban className="size-4" />
            )}
            {isLoading ? "Anulando..." : "Sí, anular venta"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Función utilitaria para generar y descargar el PDF de una venta (recibo).
 * Reutilizada tanto al terminar una venta como desde el historial.
 */
const downloadSalePDF = (venta: any) => {
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 180] // Formato ticket estándar 80mm
  });

  const margin = 5;
  const pageWidth = 80;
  const center = pageWidth / 2;
  let y = 10;

  // Header - Estilo Premium
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("BENDICIÓN DE DIOS", center, y, { align: "center" });

  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("De lo recibido de tu mano, te damos.", center, y, { align: "center" });

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text("Managua, Nicaragua", center, y, { align: "center" });

  y += 7;
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`FACTURA: #${venta.id}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(venta.fecha || new Date()).toLocaleString(), pageWidth - margin, y, { align: "right" });

  y += 5;
  // Tabla de productos agrupados
  const groupedDetails = (venta.detalles || []).reduce((acc: any, d: any) => {
    const key = d.nombreProducto || "Producto";
    if (!acc[key]) {
      acc[key] = { nombre: key, cantidad: 0, precio: Number(d.precioVentaUnitario) };
    }
    acc[key].cantidad += d.cantidad || 1;
    return acc;
  }, {});

  const tableData = Object.values(groupedDetails).map((g: any) => [
    g.nombre.toUpperCase(),
    `x${g.cantidad}`,
    `C$ ${(g.cantidad * g.precio).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: y,
    head: [['DESCRIPCIÓN', 'CANT', 'TOTAL']],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 7,
      cellPadding: 1,
      textColor: [51, 65, 85], // slate-700
      font: 'helvetica'
    },
    headStyles: {
      fontStyle: 'bold',
      textColor: [15, 23, 42], // slate-900
      borderBottom: { lineWidth: 0.1, color: [0, 0, 0] }
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 15 },
      2: { halign: 'right', cellWidth: 20 }
    },
    margin: { left: margin, right: margin },
  });

  const lastY = (doc as any).lastAutoTable.finalY;
  y = lastY + 5;

  // Totales con fondo sutil
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(margin, y, pageWidth - (margin * 2), 15, 'F');

  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL A PAGAR:", margin + 2, y);
  doc.text(`C$ ${Number(venta.total).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`, pageWidth - margin - 2, y, { align: "right" });

  if (venta.pagado) {
    y += 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text("RECIBIDO:", margin + 2, y);
    doc.text(`C$ ${Number(venta.pagado).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`, pageWidth - margin - 2, y, { align: "right" });

    y += 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74); // green-600
    doc.text("SU CAMBIO:", margin + 2, y);
    doc.text(`C$ ${Number(venta.vuelto || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`, pageWidth - margin - 2, y, { align: "right" });
  }

  y += 15;
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text("¡MUCHAS GRACIAS POR SU COMPRA!", center, y, { align: "center" });

  y += 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text("Dios le bendiga", center, y, { align: "center" });

  doc.save(`Ticket_Venta_${venta.id}.pdf`);
};

/**
 * Estilos para impresión — Oculta todo excepto el recibo cuando se imprime
 */
const PrintStyles = () => (
  <style>
    {`
      @media print {
        body * {
          visibility: hidden;
        }
        #printable-receipt, #printable-receipt * {
          visibility: visible;
        }
        #printable-receipt {
          position: absolute;
          left: 0;
          top: 0;
          width: 100mm;
          padding: 5mm;
          background: white;
        }
        .no-print {
          display: none !important;
        }
      }
    `}
  </style>
);

/**
 * Modal de Pago (Cobro)
 */
function PaymentModal({
  total,
  onConfirm,
  onCancel,
  isLoading
}: {
  total: number;
  onConfirm: (monto: number) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [monto, setMonto] = useState("");
  const vuelto = Number(monto) > total ? Number(monto) - total : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-6 text-white text-center">
          <h2 className="text-xl font-bold">Cobrar Venta</h2>
          <p className="opacity-90">Ingrese la cantidad recibida</p>
        </div>
        <div className="p-6 space-y-6">
          <div className="text-center">
            <span className="text-sm text-gray-500 uppercase font-bold tracking-wider">Total a Pagar</span>
            <p className="text-4xl font-black text-slate-800">C$ {total.toFixed(2)}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Monto Recibido (Efectivo)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">C$</span>
              <Input
                type="number"
                autoFocus
                placeholder="0.00"
                className="pl-10 h-12 text-lg font-bold bg-gray-50"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-dashed border-gray-300">
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-600">Cambio (Vuelto)</span>
              <span className={`text-2xl font-black ${vuelto > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                C$ {vuelto.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
            disabled={isLoading || Number(monto) < total}
            onClick={() => onConfirm(Number(monto))}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal de Recibo (Resultado Post-Venta)
 */
function ReceiptModal({
  sale,
  onClose
}: {
  sale: any;
  onClose: () => void;
}) {
  const facturaId = sale.id || "N/A";
  const fechaVenta = sale.fecha ? new Date(sale.fecha).toLocaleString() : new Date().toLocaleString();
  const totalVenta = Number(sale.total || 0);
  const pagado = Number(sale.pagado || 0);
  const vuelto = Number(sale.vuelto || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <PrintStyles />
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm no-print" onClick={onClose} />

      {/* Modal UI */}
      <div className="relative bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-300 no-print border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 bg-white/80 backdrop-blur-md hover:bg-white text-slate-400 hover:text-slate-900 size-10 rounded-full flex items-center justify-center transition-all border border-slate-100 shadow-sm active:scale-90"
        >
          <X className="size-5" />
        </button>

        <div className="bg-slate-50 p-10 text-center border-b border-slate-100">
          <div className="bg-green-500 size-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200">
            <CheckCircle className="size-10 text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">¡Venta Exitosa!</h2>
          <p className="text-slate-500 font-medium">Comprobante generado correctamente</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="relative">
            <div className="absolute -left-8 -right-8 top-0 h-px bg-dashed bg-slate-200" />
            <div className="pt-6 space-y-4 font-mono text-sm">
              <div className="flex justify-between items-center text-slate-400">
                <span className="uppercase tracking-widest text-[10px] font-bold">No. Factura</span>
                <span className="font-bold text-slate-900 text-base">#{facturaId}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="uppercase tracking-widest text-[10px] font-bold">Fecha y Hora</span>
                <span className="font-medium text-slate-600 text-xs">{fechaVenta}</span>
              </div>

              <div className="py-6 border-y border-dashed border-slate-200 my-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase tracking-widest text-[10px] font-bold">Total Pagado</span>
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">
                    C$ {totalVenta.toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {pagado > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-slate-500">
                    <span className="uppercase tracking-widest text-[10px] font-bold">Monto Recibido</span>
                    <span className="font-bold text-slate-700">C$ {pagado.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-green-600 bg-green-50/50 p-4 rounded-[1.5rem] border border-green-100 shadow-inner">
                    <span className="font-bold uppercase tracking-widest text-[10px]">Vuelto</span>
                    <span className="font-black text-2xl tracking-tighter">C$ {vuelto.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button
            className="w-full h-16 rounded-[1.25rem] font-black gap-3 bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200 transition-all active:scale-95 text-base"
            onClick={() => downloadSalePDF(sale)}
          >
            <Download className="size-6" />
            DESCARGAR RECIBO
          </Button>
        </div>
      </div>

      {/* Ticket Térmico Oculto */}
      <div id="printable-receipt" className="hidden print:block text-slate-900 font-mono text-[11px] w-[80mm] bg-white p-4">
        <div className="text-center mb-4">
          <h1 className="text-lg font-black uppercase tracking-tighter">BENDICIÓN DE DIOS</h1>
          <div className="text-[10px] space-y-0.5 text-slate-600 italic">
            <p>De lo recibido de tu mano, te damos.</p>
            <p>Managua, Nicaragua</p>
            <p>Telf: +505 8888-8888</p>
          </div>
          <div className="my-2 border-b border-double border-slate-900 py-1">
            <p className="font-bold text-xs">FACTURA DE VENTA</p>
          </div>
        </div>

        <div className="mb-4 space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span>FACTURA NO:</span>
            <span className="font-bold">#{facturaId}</span>
          </div>
          <div className="flex justify-between">
            <span>FECHA:</span>
            <span>{fechaVenta}</span>
          </div>
          <div className="flex justify-between">
            <span>ATENDIDO POR:</span>
            <span className="uppercase">Cajero General</span>
          </div>
        </div>

        <table className="w-full mb-4">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left text-[9px]">
              <th className="pb-1">DESCRIPCIÓN</th>
              <th className="text-right pb-1">CANT</th>
              <th className="text-right pb-1">TOTAL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Object.values((sale.detalles || []).reduce((acc: any, d: any) => {
              const key = d.nombreProducto || 'Producto';
              if (!acc[key]) acc[key] = { nombre: key, cant: 0, precio: Number(d.precioVentaUnitario) };
              acc[key].cant += d.cantidad || 1;
              return acc;
            }, {})).map((g: any, i: number) => (
              <tr key={i} className="text-[10px]">
                <td className="py-2 uppercase leading-tight pr-2">{g.nombre}</td>
                <td className="py-2 text-right">x{g.cant}</td>
                <td className="py-2 text-right font-bold">C${(g.cant * g.precio).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1.5 border-t-2 border-slate-900 pt-3">
          <div className="flex justify-between font-black text-sm">
            <span>TOTAL A PAGAR:</span>
            <span>C$ {totalVenta.toFixed(2)}</span>
          </div>
          {pagado > 0 && (
            <>
              <div className="flex justify-between text-[10px]">
                <span>EFECTIVO RECIBIDO:</span>
                <span>C$ {pagado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] italic">
                <span>CAMBIO:</span>
                <span>C$ {vuelto.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 text-center space-y-2 border-t border-dashed border-slate-300 pt-4">
          <p className="font-bold text-[10px]">¡MUCHAS GRACIAS POR SU PREFERENCIA!</p>
          <p className="text-[9px] italic">"Porque de él, y por él, y para él, son todas las cosas."</p>
          <p className="font-black text-xs mt-2 uppercase tracking-widest">Dios le bendiga</p>
        </div>
      </div>
    </div>
  );
}


/**
 * Fila expandible del historial de ventas.
 *
 * Implementa el patrón "master-detail" con una fila principal resumida
 * y una fila de expansión que muestra los ítems de la venta.
 *
 * `expanded`: Estado local de la fila. Cada fila gestiona su propia
 * expansión independientemente, permitiendo expandir múltiples filas
 * simultáneamente sin estado en el componente padre.
 *
 * La opacidad reducida y fondo rojizo en ventas anuladas comunica
 * visualmente el estado sin necesitar leer el texto del badge.
 *
 * @param venta - Objeto de venta con sus detalles anidados.
 * @param isAdmin - Determina si se muestra el botón de anulación.
 * @param onAnular - Callback que recibe la venta para iniciar el flujo de anulación.
 */
function VentaRow({
  venta,
  isAdmin,
  onAnular,
}: {
  venta: any;
  isAdmin: boolean;
  onAnular: (venta: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detalles: any[] = venta.detalles ?? [];
  const isAnulada = venta.estado === "Anulada";

  return (
    <>
      {/* Fila principal */}
      <TableRow
        className={`cursor-pointer select-none transition-colors hover:bg-gray-50 ${isAnulada ? "opacity-60 bg-red-50/40" : ""
          }`}
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell className="w-10">
          <span className="text-gray-400">
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </span>
        </TableCell>
        <TableCell className="font-medium">#{venta.id}</TableCell>
        <TableCell>{new Date(venta.fecha).toLocaleString()}</TableCell>
        <TableCell>{venta.usuarioId}</TableCell>
        <TableCell>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isAnulada
              ? "bg-red-100 text-red-700"
              : "bg-emerald-100 text-emerald-700"
              }`}
          >
            {isAnulada ? <Ban className="size-3" /> : null}
            {venta.estado ?? "Completada"}
          </span>
        </TableCell>
        <TableCell className="text-right font-bold text-green-700">
          C${Number(venta.total).toFixed(2)}
        </TableCell>
        <TableCell className="text-right space-x-2">
          {isAdmin && !isAnulada && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:bg-red-50 hover:text-red-700 gap-1.5 font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                onAnular(venta);
              }}
            >
              <Ban className="size-4" />
              Anular
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-blue-500 hover:bg-blue-50 hover:text-blue-700 gap-1.5 font-semibold"
            onClick={(e) => {
              e.stopPropagation();
              downloadSalePDF(venta);
            }}
          >
            <Download className="size-4" />
            Recibo
          </Button>
        </TableCell>
      </TableRow>

      {/* Fila expandida con detalles */}
      {expanded && (
        <TableRow className="bg-slate-50/80">
          <TableCell colSpan={7} className="p-0">
            <div className="px-8 py-4 border-t border-gray-100">
              {detalles.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  Sin detalles registrados.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-200">
                      <th className="pb-2 pr-4">Cant.</th>
                      <th className="pb-2 pr-4">Producto</th>
                      <th className="pb-2 pr-4 text-right">Precio unitario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(detalles.reduce((acc: any, d: any) => {
                      const key = d.nombreProducto || `Inventario #${d.inventarioId}`;
                      if (!acc[key]) acc[key] = { nombre: key, cant: 0, precio: d.precioVentaUnitario };
                      acc[key].cant += 1;
                      return acc;
                    }, {})).map((g: any, i: number) => (
                      <tr
                        key={i}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="py-1.5 pr-4 font-bold text-slate-800">
                          {g.cant}x
                        </td>
                        <td className="py-1.5 pr-4 font-medium text-slate-700">
                          {g.nombre}
                        </td>
                        <td className="py-1.5 text-right text-green-700 font-semibold">
                          C${Number(g.precio).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────
export function Ventas() {
  const [activeTab, setActiveTab] = useState<"pos" | "historial">("pos");

  // Estados POS
  const [productos, setProductos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth
  const { userId, userRole } = useAuth();
  const isAdmin = userRole === "admin";

  // Historial
  const [ventas, setVentas] = useState<any[]>([]);

  // Modal de anulación
  const [ventaAAnular, setVentaAAnular] = useState<any | null>(null);
  const [isAnulando, setIsAnulando] = useState(false);

  // Flujo de Pago y Recibo
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [lastSaleResult, setLastSaleResult] = useState<any | null>(null);

  useEffect(() => {
    setSearchTerm("");
    fetchInventoryForSale();
    if (activeTab === "historial") {
      fetchVentasHistory();
    }
  }, [activeTab]);

  /**
   * Carga y ensambla el catálogo de productos disponibles para el POS.
   *
   * Ejecuta 3 peticiones en paralelo y las combina:
   *   1. inventarios: Todas las unidades físicas (filtra Estado='Disponible').
   *   2. detalles-entrada: Permite mapear unidad física → producto.
   *   3. productos: Datos del producto (nombre, precio de venta calculado).
   *
   * El mapeo multi-clave (`inv.detalle_entrada_id || inv.detalleEntradaId || ...`)
   * es defensivo: cubre las diferentes capitalizaciones que la API puede
   * devolver según la versión del serializer o la normalización.
   *
   * El resultado final (`posProducts`) es un array de productos con:
   *   - `availableQty`: Cuántas unidades disponibles tiene.
   *   - `inventarioIds`: Los IDs específicos a enviar al backend al vender.
   */
  const fetchInventoryForSale = async () => {
    try {
      const [invRes, detRes, prodRes] = await Promise.all([
        api.get("/inventario/inventarios/"),
        api.get("/inventario/detalles-entrada/"),
        api.get("/catalogo/productos/"),
      ]);

      const inventarios = Array.isArray(invRes.data.results ?? invRes.data)
        ? invRes.data.results ?? invRes.data
        : [];
      const detalles = Array.isArray(detRes.data.results ?? detRes.data)
        ? detRes.data.results ?? detRes.data
        : [];
      const prods = Array.isArray(prodRes.data.results ?? prodRes.data)
        ? prodRes.data.results ?? prodRes.data
        : [];

      const dispo = inventarios.filter(
        (i: any) => i.estado?.toString().toLowerCase() === "disponible"
      );

      const mappedDispo = dispo.map((inv: any) => {
        const dId =
          inv.detalle_entrada_id ||
          inv.detalleEntradaId ||
          inv.detalle_entrada ||
          inv.detalleEntrada;
        const d = detalles.find((det: any) => det.id === dId);
        return {
          inventarioId: inv.id,
          productoId: d?.producto_id || d?.productoId || d?.producto,
        };
      });

      const posProducts = prods
        .map((p: any) => {
          const stockItems = mappedDispo.filter(
            (m: any) => m.productoId === p.id
          );
          return {
            ...p,
            availableQty: stockItems.length,
            inventarioIds: stockItems.map((s: any) => s.inventarioId),
          };
        })
        .filter((p: any) => p.availableQty > 0);

      setProductos(posProducts);
    } catch (e) {
      console.error("Error en fetchInventoryForSale:", e);
      toast.error("Error al sincronizar el inventario.");
    }
  };

  const fetchVentasHistory = async () => {
    try {
      const { data } = await api.get("/ventas/ventas/");
      const arr = data.results ?? data;
      setVentas(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error(e);
    }
  };

  const addToCart = (product: any) => {
    if (!product) return;
    const existing = cart.find((c) => c.productoId === product.id);
    if (existing) {
      if (existing.quantity >= product.availableQty) {
        toast.warning("Stock máximo alcanzado en carrito.");
        return;
      }
      setCart(
        cart.map((c) =>
          c.productoId === product.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      );
    } else {
      if (product.availableQty <= 0) return;
      setCart([
        ...cart,
        {
          productoId: product.id,
          name: product.name || product.nombre,
          price: Number(product.salePrice || product.precio_venta || 0),
          quantity: 1,
          inventarioIds: product.inventarioIds,
        },
      ]);
    }
  };

  const decreaseQuantity = (productoId: number) => {
    const existing = cart.find((c) => c.productoId === productoId);
    if (existing && existing.quantity > 1) {
      setCart(
        cart.map((c) =>
          c.productoId === productoId ? { ...c, quantity: c.quantity - 1 } : c
        )
      );
    } else {
      removeFromCart(productoId);
    }
  };

  const removeFromCart = (productoId: number) => {
    setCart(cart.filter((c) => c.productoId !== productoId));
  };

  const totalCart = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  /**
   * Procesa el pago de los ítems en el carrito.
   *
   * SELECCIÓN DE UNIDADES FÍSICAS:
   *   `item.inventarioIds.slice(0, item.quantity)` selecciona los primeros
   *   N IDs de inventario disponibles, donde N = cantidad en el carrito.
   *   Estos son los IDs específicos que el backend marcará como 'Vendido'.
   *
   * Después de una venta exitosa:
   *   1. Se limpia el carrito (`setCart([])`).
   *   2. Se recarga el inventario (`fetchInventoryForSale()`) para que el
   *      stock en pantalla refleje las unidades recién vendidas.
   */
  const handleCheckout = async (montoRecibido: number) => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const detalles = [];
      for (const item of cart) {
        const idsToSell = item.inventarioIds.slice(0, item.quantity);
        for (const invId of idsToSell) {
          detalles.push({
            inventarioId: invId,
            precioVentaUnitario: item.price,
          });
        }
      }
      const { data } = await api.post("/ventas/procesar/", {
        usuarioId: userId,
        fecha: new Date().toISOString(),
        total: totalCart,
        detalles,
      });

      // Enriquecer el resultado con datos del pago y carrito para el recibo
      const saleWithPayment = {
        ...data,
        detalles: cart.map(item => ({
          nombreProducto: item.name,
          precioVentaUnitario: item.price,
          cantidad: item.quantity
        })),
        pagado: montoRecibido,
        vuelto: montoRecibido - totalCart
      };

      toast.success("Venta realizada con éxito");
      setLastSaleResult(saleWithPayment);
      setIsPaymentModalOpen(false);
      setCart([]);
      fetchInventoryForSale();
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.response?.data?.error || "Error al procesar la transacción."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Lógica de anulación ──────────────────────────────────────
  const handleAnularConfirm = async () => {
    if (!ventaAAnular) return;
    setIsAnulando(true);
    try {
      await api.post(
        `/ventas/${ventaAAnular.id}/anular/`
      );
      toast.success(`Venta #${ventaAAnular.id} anulada. Stock revertido.`);
      setVentaAAnular(null);
      fetchVentasHistory();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Error al anular la venta."
      );
    } finally {
      setIsAnulando(false);
    }
  };

  const filteredProducts = productos.filter((p) =>
    (p.name || p.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Modales de Flujo de Venta */}
      {isPaymentModalOpen && (
        <PaymentModal
          total={totalCart}
          onConfirm={handleCheckout}
          onCancel={() => setIsPaymentModalOpen(false)}
          isLoading={isSubmitting}
        />
      )}

      {lastSaleResult && (
        <ReceiptModal
          sale={lastSaleResult}
          onClose={() => setLastSaleResult(null)}
        />
      )}

      {/* Modal de confirmación */}
      {ventaAAnular && (
        <ConfirmAnularModal
          ventaId={ventaAAnular.id}
          onConfirm={handleAnularConfirm}
          onCancel={() => setVentaAAnular(null)}
          isLoading={isAnulando}
        />
      )}

      {/* Cabecera + tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Terminal de Ventas
          </h1>
          <p className="text-gray-600">Gestión de salida de productos</p>
        </div>
        <div className="flex gap-4 border-b">
          <button
            className={`pb-2 px-4 text-sm font-semibold transition-colors ${activeTab === "pos"
              ? "border-b-2 border-green-600 text-green-700"
              : "text-gray-500 hover:text-slate-700"
              }`}
            onClick={() => setActiveTab("pos")}
          >
            Punto de Venta
          </button>
          <button
            className={`pb-2 px-4 text-sm font-semibold transition-colors ${activeTab === "historial"
              ? "border-b-2 border-green-600 text-green-700"
              : "text-gray-500 hover:text-slate-700"
              }`}
            onClick={() => setActiveTab("historial")}
          >
            Historial
          </button>
        </div>
      </div>

      {/* ─── TAB: POS ─── */}
      {activeTab === "pos" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4 border-0 shadow-sm sticky top-0 z-10">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre de producto..."
                  className="pl-10 h-11 bg-gray-50 border-gray-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredProducts.map((p) => (
                <Card
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="p-4 border-0 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group bg-gradient-to-br from-white to-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-lg text-slate-800">
                      C${Number(p.salePrice || p.precio_venta).toFixed(2)}
                    </span>
                    <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Stock: {p.availableQty}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-700 min-h-[40px] leading-tight group-hover:text-green-700 transition-colors">
                    {p.name || p.nombre}
                  </h3>
                </Card>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                  No hay productos con stock disponible para mostrar.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card className="flex flex-col h-[600px] border-0 shadow-xl overflow-hidden sticky top-4">
              <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-4 text-white">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Carrito de Compras
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                    <ShoppingCart className="size-16 mb-4" />
                    <p>Selecciona productos para vender</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.productoId}
                      className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-100"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-semibold text-sm text-slate-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-green-700 text-xs font-bold">
                          C${item.price.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg border p-1 border-gray-200 shadow-inner">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            decreaseQuantity(item.productoId);
                          }}
                          className="p-1 hover:bg-white rounded text-slate-600 hover:text-red-500 transition-colors"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(
                              productos.find((p) => p.id === item.productoId)
                            );
                          }}
                          className="p-1 hover:bg-white rounded text-slate-600 hover:text-green-600 transition-colors"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(item.productoId);
                        }}
                        className="ml-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between mb-4 text-2xl">
                  <span className="font-bold text-slate-800">Total</span>
                  <span className="font-black text-green-600">
                    C${totalCart.toFixed(2)}
                  </span>
                </div>
                <Button
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={cart.length === 0 || isSubmitting}
                  className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin size-6 mr-2" />
                  ) : (
                    <Receipt className="size-6 mr-2" />
                  )}
                  Cobrar ahora
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ─── TAB: HISTORIAL ─── */}
      {activeTab === "historial" && (
        <Card className="p-6 border-0 shadow-lg">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Factura</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cajero ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-gray-400"
                    >
                      No hay ventas registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  ventas.map((venta) => (
                    <VentaRow
                      key={venta.id}
                      venta={venta}
                      isAdmin={isAdmin}
                      onAnular={setVentaAAnular}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}