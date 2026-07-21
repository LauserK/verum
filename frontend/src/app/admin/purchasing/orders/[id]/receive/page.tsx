// frontend/src/app/admin/purchasing/orders/[id]/receive/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { adminApi, PurchaseOrderResponse } from '@/lib/api';
import { 
  ArrowLeft, Loader2, AlertCircle, ShoppingCart, Calendar, 
  Building2, User, Check, PackageCheck
} from 'lucide-react';
import Link from 'next/link';

interface ReceiveLineState {
  po_line_id: string;
  item_id: string;
  item_name: string;
  uom_name: string;
  qty_ordered: number;
  qty_received_already: number;
  qty_pending: number;
  qty_to_receive: number;
  lot_number: string;
  expiry_date: string;
  factor: number;
  presentation_id: string | null;
}

export default function ReceivePurchaseOrderPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [po, setPo] = useState<PurchaseOrderResponse | null>(null);
  const [lines, setLines] = useState<ReceiveLineState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminApi.getPurchaseOrder(id);
        setPo(data);
        
        // Map lines
        const initialLines = data.lines.map(line => {
          const factor = line.presentation_id ? (line.qty_ordered_base / (line.qty_ordered_presentation || 1.0)) : 1.0;
          const qty_ordered = line.presentation_id ? (line.qty_ordered_presentation || 0) : line.qty_ordered_base;
          const qty_received_already = (line.qty_received_base || 0) / factor;
          const qty_pending = qty_ordered - qty_received_already;
          
          return {
            po_line_id: line.id,
            item_id: line.item_id,
            item_name: line.item_name || 'Artículo sin nombre',
            uom_name: line.uom_name || 'und',
            qty_ordered,
            qty_received_already,
            qty_pending: qty_pending > 0 ? qty_pending : 0,
            qty_to_receive: qty_pending > 0 ? qty_pending : 0,
            lot_number: '',
            expiry_date: '',
            factor,
            presentation_id: line.presentation_id
          };
        });
        setLines(initialLines);
      } catch (err) {
        console.error('Error loading PO:', err);
        setError('No se pudo obtener el detalle de la orden de compra.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchOrder();
    }
  }, [id]);

  const handleQtyChange = (index: number, val: number) => {
    const updated = [...lines];
    updated[index].qty_to_receive = Math.max(0, val);
    setLines(updated);
  };

  const handleTextChange = (index: number, field: 'lot_number' | 'expiry_date', val: string) => {
    const updated = [...lines];
    updated[index][field] = val;
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return;

    // Filter lines that have qty_to_receive > 0
    const linesToSubmit = lines.filter(l => l.qty_to_receive > 0);
    if (linesToSubmit.length === 0) {
      setError('Debes ingresar al menos una cantidad mayor a cero para recibir.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create the inventory document
      const docPayload = {
        document_type: 'receipt',
        po_id: po.id,
        supplier_id: po.supplier_id,
        warehouse_id: po.warehouse_id,
        notes: `Recepción de mercancía asociada a PO ${po.po_number}`,
        lines: linesToSubmit.map(l => {
          const originalLine = po.lines.find(pl => pl.id === l.po_line_id);
          const unitCostPres = originalLine?.unit_cost_presentation ?? originalLine?.unit_cost_base ?? 0;
          
          return {
            po_line_id: l.po_line_id,
            item_id: l.item_id,
            qty_presentation: l.qty_to_receive,
            qty_base: l.qty_to_receive * l.factor,
            presentation_id: l.presentation_id || null,
            unit_cost_presentation: unitCostPres,
            po_qty_ordered_base: l.qty_ordered * l.factor,
            lot_number: l.lot_number || null,
            expiry_date: l.expiry_date || null
          };
        })
      };

      const docRes: any = await adminApi.createInventoryDocument(docPayload);
      if (!docRes || !docRes.id) {
        throw new Error('Error al inicializar el documento de recepción.');
      }

      // 2. Process/Confirm the inventory document to apply stock and update PO quantities
      await adminApi.processInventoryDocument(docRes.id);

      setSuccess(true);
      setTimeout(() => {
        router.push(`/admin/purchasing/orders/${po.id}`);
      }, 1500);
    } catch (err: any) {
      console.error('Error recording receipt:', err);
      setError(err?.detail || err?.message || 'Error al guardar la recepción de inventario.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Cargando detalles de la orden...</p>
      </div>
    );
  }

  if (error && !po) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl flex flex-col items-center text-center gap-3">
        <AlertCircle className="h-10 w-10" />
        <p className="font-bold">{error}</p>
        <Link href={`/admin/purchasing/orders`} className="bg-primary text-text-inverse px-5 py-2 rounded-xl text-sm font-bold mt-2">
          Volver a Órdenes
        </Link>
      </div>
    );
  }

  if (!po) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-24">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/purchasing/orders/${po.id}`}
          className="p-2 hover:bg-background-hover rounded-xl border border-border transition-colors text-text-primary active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Registrar Recepción</h1>
          <p className="text-xs text-text-secondary">Vinculado a la Orden de Compra: <span className="font-bold">{po.po_number}</span></p>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-success-light border border-success/20 text-success rounded-2xl flex items-center gap-3 font-semibold text-sm">
          <Check className="h-5 w-5" />
          <span>¡Recepción registrada y procesada con éxito! Redirigiendo...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-error-light border border-error/20 text-error rounded-2xl flex items-center gap-3 font-semibold text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PO Reference Card */}
        <div className="bg-background-card border border-border rounded-2xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex flex-col">
            <span className="text-xs text-text-secondary flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> Proveedor
            </span>
            <span className="font-semibold text-text-primary mt-0.5">{po.supplier_name}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-text-secondary flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Almacén de Ingreso
            </span>
            <span className="font-semibold text-text-primary mt-0.5">{po.warehouse_name}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-text-secondary flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Fecha Solicitada
            </span>
            <span className="font-semibold text-text-primary mt-0.5">{po.requested_date || '—'}</span>
          </div>
        </div>

        {/* Lines input */}
        <div className="bg-background-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-text-secondary tracking-wider flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Artículos a Recibir
          </h3>

          <div className="border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-surface-raised/50 border-b border-border text-text-secondary text-xs font-bold uppercase">
                  <th className="py-3 px-4">Artículo</th>
                  <th className="py-3 px-4 text-center">Cant. Pedida</th>
                  <th className="py-3 px-4 text-center">Ya Recibido</th>
                  <th className="py-3 px-4 text-center">Pendiente</th>
                  <th className="py-3 px-4 text-center w-28">Recibir ahora</th>
                  <th className="py-3 px-4">Lote (Opcional)</th>
                  <th className="py-3 px-4">Fecha Venc. (Opcional)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((line, idx) => (
                  <tr key={line.po_line_id} className="hover:bg-surface-raised/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-text-primary">
                      {line.item_name}
                      <span className="block text-[10px] text-text-secondary uppercase mt-0.5 font-bold">Unidad: {line.uom_name}</span>
                    </td>
                    <td className="py-4 px-4 text-center font-mono text-text-secondary">
                      {line.qty_ordered}
                    </td>
                    <td className="py-4 px-4 text-center font-mono text-success font-semibold">
                      {line.qty_received_already}
                    </td>
                    <td className="py-4 px-4 text-center font-mono text-warning font-semibold">
                      {line.qty_pending}
                    </td>
                    <td className="py-4 px-4">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={line.qty_to_receive}
                        onChange={(e) => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                        className="w-full bg-surface border border-border rounded-xl px-2.5 py-1.5 text-center font-mono text-text-primary focus:outline-none focus:border-primary font-bold text-sm"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <input
                        type="text"
                        placeholder="LOTE-XYZ"
                        value={line.lot_number}
                        onChange={(e) => handleTextChange(idx, 'lot_number', e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary font-semibold"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <input
                        type="date"
                        value={line.expiry_date}
                        onChange={(e) => handleTextChange(idx, 'expiry_date', e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary font-semibold font-mono"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href={`/admin/purchasing/orders/${po.id}`}
            className="flex items-center justify-center bg-surface border border-border text-text-primary px-6 h-12 rounded-xl text-sm font-bold hover:bg-surface-raised active:scale-95 transition-all"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting || success}
            className="flex items-center gap-2 bg-primary text-text-inverse px-6 h-12 rounded-xl text-sm font-bold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Procesando Ingreso...
              </>
            ) : (
              <>
                <PackageCheck className="h-4 w-4" /> Confirmar Ingreso a Almacén
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
