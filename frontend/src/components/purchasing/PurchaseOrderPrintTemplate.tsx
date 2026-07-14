import React, { forwardRef } from 'react';
import { PurchaseOrderResponse } from '@/lib/api';

interface Props {
  po: PurchaseOrderResponse;
}

export const PurchaseOrderPrintTemplate = forwardRef<HTMLDivElement, Props>(({ po }, ref) => {
  if (!po) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div ref={ref} className="bg-white text-black p-8 font-sans max-w-[800px] mx-auto space-y-6 print:p-6 print:max-w-full print:text-black">
      {/* Header Info */}
      <div className="flex justify-between items-start border-b border-gray-300 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight uppercase text-gray-900">{po.org_name || 'VERUM'}</h1>
          <div className="text-xs text-gray-600 space-y-0.5 pt-2">
            <p><span className="font-bold text-gray-700">RIF:</span> {po.org_tax_id || 'J-40899652-3'}</p>
            <p><span className="font-bold text-gray-700">Dirección:</span> {po.org_address || 'Sede Principal VERUM, Caracas, Venezuela'}</p>
            <p><span className="font-bold text-gray-700">Teléfono:</span> {po.org_phone || '+58 (212) 555-0199'}</p>
            <p><span className="font-bold text-gray-700">Email:</span> {po.org_email || 'operaciones@verum.com'}</p>
          </div>
        </div>

        <div className="text-right space-y-1">
          <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg inline-block border border-gray-200">
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Orden de Compra</p>
            <p className="text-lg font-bold font-mono text-gray-900">{po.po_number}</p>
          </div>
          <div className="text-xs text-gray-600 space-y-0.5 pt-2">
            <p><span className="font-bold text-gray-700">Estado:</span> <span className="uppercase font-bold text-gray-800">{po.status}</span></p>
            <p><span className="font-bold text-gray-700">Emisión:</span> {formatDate(po.created_at)}</p>
            <p><span className="font-bold text-gray-700">Moneda:</span> {po.currency}</p>
          </div>
        </div>
      </div>

      {/* Supplier & Delivery Info Grid */}
      <div className="grid grid-cols-2 gap-6 text-xs text-gray-800">
        {/* Proveedor */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
          <h3 className="font-bold uppercase text-gray-700 border-b border-gray-200 pb-1 text-[10px] tracking-wider">Proveedor</h3>
          <p className="text-sm font-bold text-gray-900">{po.supplier_name || 'Sin Asignar'}</p>
          <div className="space-y-0.5 text-gray-600">
            <p><span className="font-semibold text-gray-800">Contacto:</span> Principal</p>
            <p><span className="font-semibold text-gray-800">Email:</span> {po.sent_to_email || '—'}</p>
          </div>
        </div>

        {/* Datos de Despacho */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
          <h3 className="font-bold uppercase text-gray-700 border-b border-gray-200 pb-1 text-[10px] tracking-wider">Detalles de Entrega</h3>
          <div className="space-y-1 text-gray-600">
            <p><span className="font-bold text-gray-800">Almacén de Entrega:</span> {po.warehouse_name || 'Sin Asignar'}</p>
            <p><span className="font-bold text-gray-800">Fecha Requerida:</span> {formatDate(po.requested_date)}</p>
            {po.promised_date && <p><span className="font-bold text-gray-800">Fecha Prometida:</span> {formatDate(po.promised_date)}</p>}
            <p><span className="font-bold text-gray-800">Condiciones:</span> {po.payment_terms_days > 0 ? `${po.payment_terms_days} días de crédito` : 'Pago de Contado'}</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="border border-gray-300 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold uppercase">
              <th className="py-2.5 px-3">Artículo</th>
              <th className="py-2.5 px-3 text-right w-24">Cantidad</th>
              <th className="py-2.5 px-3 text-center w-24">Unidad</th>
              <th className="py-2.5 px-3 text-right w-28">Costo Unit.</th>
              <th className="py-2.5 px-3 text-right w-28">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-gray-800">
            {po.lines && po.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2 px-3 font-semibold text-gray-900">{line.item_name || 'Artículo sin nombre'}</td>
                <td className="py-2 px-3 text-right font-mono font-semibold">{line.display_qty}</td>
                <td className="py-2 px-3 text-center uppercase font-bold text-gray-500 text-[10px]">{line.uom_name || 'und'}</td>
                <td className="py-2 px-3 text-right font-mono">${line.display_unit_cost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">${line.line_total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes and Totals */}
      <div className="grid grid-cols-3 gap-6 pt-4 items-start text-xs">
        <div className="col-span-2 border border-gray-200 rounded-xl p-4 min-h-[80px] bg-gray-50/50 space-y-1">
          <span className="font-bold text-gray-500 text-[9px] uppercase tracking-wider">Notas / Observaciones de la Orden</span>
          <p className="text-gray-700 italic">{po.notes || 'Sin observaciones registradas.'}</p>
        </div>

        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2 text-gray-800">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal:</span>
            <span className="font-bold font-mono text-gray-900">${po.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">IVA (16%):</span>
            <span className="font-bold font-mono text-gray-900">${po.tax_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-sm text-gray-900">
            <span>Total:</span>
            <span className="font-mono text-base">${po.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Footer / Signatures */}
      <div className="pt-12 border-t border-gray-200 text-center text-[10px] text-gray-400 space-y-4">
        <div className="grid grid-cols-2 gap-12 max-w-[500px] mx-auto pb-4">
          <div className="border-t border-gray-300 pt-4 text-center font-semibold text-gray-500">
            <p>Elaborado Por</p>
            <p className="text-gray-700 font-bold mt-1">{po.created_by_name || 'Desconocido'}</p>
          </div>
          <div className="border-t border-gray-300 pt-4 text-center font-semibold text-gray-500">
            <p>Autorizado Por</p>
            <p className="text-gray-700 font-bold mt-1">Firma Autorizada</p>
          </div>
        </div>
        <p className="pt-4">Este documento es una orden de compra formal generada por VERUM ERP. Prohibida su alteración física o digital.</p>
      </div>
    </div>
  );
});

PurchaseOrderPrintTemplate.displayName = 'PurchaseOrderPrintTemplate';
