// frontend/src/app/admin/purchasing/orders/[id]/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { adminApi, PurchaseOrderResponse } from '@/lib/api';
import { useReactToPrint } from 'react-to-print';
import { PurchaseOrderPrintTemplate } from '@/components/purchasing/PurchaseOrderPrintTemplate';
import { 
  ArrowLeft, Loader2, AlertCircle, ShoppingCart, Calendar, 
  Building2, User, HelpCircle, Check, X, Ban, Send, FileSpreadsheet, MessageSquare, Printer
} from 'lucide-react';
import Link from 'next/link';

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [po, setPo] = useState<PurchaseOrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal / Input states
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Ref for Printing Template
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: po ? `Orden-Compra-${po.po_number}` : 'Orden-Compra'
  });

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getPurchaseOrder(id);
      setPo(data);
    } catch (err) {
      console.error('Error loading PO detail:', err);
      setError('No se pudo obtener el detalle de la orden de compra.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const handleAction = async (apiCall: () => Promise<any>, successMsg: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await apiCall();
      await fetchOrder(); // Reload data
      setShowApprovalModal(false);
      setShowRejectionModal(false);
      setApprovalNotes('');
      setRejectionNotes('');
      setValidationError(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.detail || 'Ocurrió un error al procesar la acción operativa.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = () => {
    handleAction(
      () => adminApi.approvePurchaseOrder(id, { notes: approvalNotes || undefined }),
      'Orden aprobada exitosamente'
    );
  };

  const handleReject = () => {
    if (!rejectionNotes.trim()) {
      setValidationError('Se requiere ingresar un comentario para rechazar la orden.');
      return;
    }
    handleAction(
      () => adminApi.rejectPurchaseOrder(id, { notes: rejectionNotes }),
      'Orden rechazada y devuelta a borrador'
    );
  };

  // Timeline Step Generator
  const getTimelineSteps = (currentStatus: string) => {
    const steps = [
      { key: 'draft', label: 'Borrador' },
      { key: 'pending', label: 'Pendiente' },
      { key: 'approved', label: 'Aprobada' },
      { key: 'sent', label: 'Enviada' },
      { key: 'received', label: 'Recibida' }
    ];

    const statusIndex = steps.findIndex(s => s.key === currentStatus);
    const isCancelled = currentStatus === 'cancelled';

    return (
      <div className="flex items-center justify-between w-full max-w-2xl mx-auto px-4 py-6">
        {isCancelled ? (
          <div className="flex items-center gap-2 text-error font-bold bg-error-light px-4 py-2 rounded-xl border border-error/25 mx-auto">
            <Ban className="h-5 w-5" />
            ORDEN ANULADA / CANCELADA
          </div>
        ) : (
          steps.map((step, idx) => {
            const isCompleted = idx < statusIndex || currentStatus === 'received' || currentStatus === 'partially_received' || currentStatus === 'invoiced' || currentStatus === 'closed';
            const isActive = step.key === currentStatus || (step.key === 'received' && (currentStatus === 'partially_received' || currentStatus === 'invoiced' || currentStatus === 'closed'));
            
            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border font-bold text-xs transition-all ${
                    isCompleted 
                      ? 'bg-success text-text-inverse border-success' 
                      : isActive 
                        ? 'bg-primary text-text-inverse border-primary ring-4 ring-primary/20 scale-110' 
                        : 'bg-surface text-text-secondary border-border'
                  }`}>
                    {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-[10px] sm:text-xs font-semibold mt-2 absolute -bottom-5 whitespace-nowrap ${
                    isActive ? 'text-primary font-bold' : isCompleted ? 'text-success' : 'text-text-disabled'
                  }`}>
                    {step.key === 'received' && currentStatus === 'partially_received' ? 'Parcial' : step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 transition-all ${
                    isCompleted ? 'bg-success' : isActive ? 'bg-primary/50' : 'bg-border'
                  }`} />
                )}
              </div>
            )
          })
        )}
      </div>
    );
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Borrador';
      case 'pending': return 'Pendiente por Firmar';
      case 'approved': return 'Aprobada';
      case 'sent': return 'Enviada al Proveedor';
      case 'partially_received': return 'Recepción Parcial';
      case 'received': return 'Recibida Totalmente';
      case 'invoiced': return 'Conciliada / Facturada';
      case 'closed': return 'Cerrada';
      case 'cancelled': return 'Cancelada';
      default: return status;
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
        <Link href="/admin/purchasing/orders" className="bg-primary text-text-inverse px-5 py-2 rounded-xl text-sm font-bold mt-2">
          Volver a Órdenes
        </Link>
      </div>
    );
  }

  if (!po) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-24">
      {/* Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/purchasing/orders"
            className="p-2 hover:bg-background-hover rounded-xl border border-border transition-colors text-text-primary active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary">{po.po_number}</h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                po.status === 'draft' ? 'bg-surface-raised border-border text-text-secondary' :
                po.status === 'pending' ? 'bg-warning-light border-warning/20 text-warning' :
                po.status === 'approved' || po.status === 'sent' ? 'bg-primary-light border-primary/20 text-primary' :
                po.status === 'cancelled' ? 'bg-error-light border-error/20 text-error' : 'bg-success-light border-success/20 text-success'
              }`}>
                {getStatusLabel(po.status)}
              </span>
            </div>
            <p className="text-xs text-text-secondary">Creado el {new Date(po.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Global Errors */}
        {error && (
          <div className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 text-xs rounded-xl flex items-center gap-2 max-w-md">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Progress Timeline */}
      <div className="bg-background-card border border-border rounded-2xl p-4 shadow-sm pb-10">
        {getTimelineSteps(po.status)}
      </div>

      {/* Action panel (contextual buttons) */}
      <div className="bg-background-card border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Acciones Operativas</span>
        
        <div className="flex gap-2">
          {actionLoading && <Loader2 className="h-5 w-5 animate-spin text-primary self-center" />}

          {/* Printable Button (Always active if not cancelled) */}
          {po.status !== 'cancelled' && (
            <button
              onClick={() => handlePrint()}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-surface border border-border text-text-primary px-4 h-11 rounded-xl text-sm font-bold hover:bg-surface-raised active:scale-95 transition-all disabled:opacity-50"
            >
              <Printer className="h-4 w-4 text-text-secondary" /> Imprimir / Guardar PDF
            </button>
          )}

          {po.status === 'draft' && (
            <>
              <button
                onClick={() => handleAction(() => adminApi.submitPurchaseOrder(po.id), 'Orden enviada a aprobación')}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Enviar a Firma
              </button>
              
              <button
                onClick={() => handleAction(() => adminApi.cancelPurchaseOrder(po.id), 'Orden cancelada')}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-surface border border-border text-text-primary px-5 h-11 rounded-xl text-sm font-bold hover:bg-surface-raised active:scale-95 transition-all disabled:opacity-50"
              >
                <Ban className="h-4 w-4" /> Anular Orden
              </button>
            </>
          )}

          {po.status === 'pending' && (
            <>
              <button
                onClick={() => setShowApprovalModal(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-success text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-success/90 active:scale-95 transition-all disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Aprobar / Firmar
              </button>
              
              <button
                onClick={() => setShowRejectionModal(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-error text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-error/90 active:scale-95 transition-all disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Rechazar Orden
              </button>

              <button
                onClick={() => handleAction(() => adminApi.cancelPurchaseOrder(po.id), 'Orden cancelada')}
                disabled={actionLoading}
                className="flex items-center gap-2 bg-surface border border-border text-text-primary px-4 h-11 rounded-xl text-sm font-bold hover:bg-surface-raised active:scale-95 transition-all disabled:opacity-50"
              >
                <Ban className="h-4 w-4" /> Anular
              </button>
            </>
          )}

          {po.status === 'approved' && (
            <button
              onClick={() => handleAction(() => adminApi.sendPurchaseOrder(po.id), 'Orden marcada como enviada al proveedor')}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Marcar como Enviada
            </button>
          )}
        </div>
      </div>

      {/* Main Details and Lines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lines and Items (Col span 2) */}
        <div className="md:col-span-2 bg-background-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-text-secondary tracking-wider flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Líneas de la Orden
          </h3>

          <div className="border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-surface-raised/50 border-b border-border text-text-secondary text-xs font-bold uppercase">
                  <th className="py-3 px-4">Artículo</th>
                  <th className="py-3 px-4 text-right">Cantidad</th>
                  <th className="py-3 px-4 text-center">Unidad</th>
                  <th className="py-3 px-4 text-right">Costo Unit.</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {po.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-surface-raised/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-text-primary">
                      {line.item_name || 'Artículo sin nombre'}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-text-primary">
                      {line.display_qty !== undefined ? line.display_qty : line.qty_ordered_base} <span className="text-[10px] text-text-secondary uppercase">({line.status === 'pending' ? 'Pedida' : line.status})</span>
                    </td>
                    <td className="py-4 px-4 text-center text-text-secondary font-bold text-xs uppercase">
                      {line.uom_name || 'und'}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-text-primary">
                      ${(line.display_unit_cost !== undefined ? line.display_unit_cost : line.unit_cost_base).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-text-primary">
                      ${line.line_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-end gap-1.5 pt-2 border-t border-border">
            <div className="flex justify-between w-full max-w-[240px] text-xs text-text-secondary">
              <span>Subtotal:</span>
              <span className="font-semibold text-text-primary">${po.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between w-full max-w-[240px] text-xs text-text-secondary">
              <span>IVA (16%):</span>
              <span className="font-semibold text-text-primary">${po.tax_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between w-full max-w-[240px] text-sm font-bold text-text-primary border-t border-border/50 pt-1.5">
              <span>Total:</span>
              <span>${po.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Sidebar Info (Col span 1) */}
        <div className="space-y-6">
          <div className="bg-background-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase text-text-secondary tracking-wider">
              Detalles Comerciales
            </h3>

            <div className="space-y-3.5 text-sm">
              <div className="flex flex-col">
                <span className="text-xs text-text-secondary flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Proveedor
                </span>
                <span className="font-semibold text-text-primary mt-0.5">{po.supplier_name || 'Sin Asignar'}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-text-secondary flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> Almacén Destino
                </span>
                <span className="font-semibold text-text-primary mt-0.5">{po.warehouse_name || 'Sin Asignar'}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-text-secondary flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Fecha Solicitada
                </span>
                <span className="font-semibold text-text-primary mt-0.5">{po.requested_date || '—'}</span>
              </div>

              {po.promised_date && (
                <div className="flex flex-col">
                  <span className="text-xs text-text-secondary flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Fecha Prometida
                  </span>
                  <span className="font-semibold text-text-primary mt-0.5">{po.promised_date}</span>
                </div>
              )}

              <div className="flex flex-col">
                <span className="text-xs text-text-secondary">Días de Crédito</span>
                <span className="font-semibold text-text-primary mt-0.5">{po.payment_terms_days} días</span>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-text-secondary flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Creado Por
                </span>
                <span className="font-semibold text-text-primary mt-0.5">{po.created_by_name || 'Desconocido'}</span>
              </div>
            </div>
          </div>

          {/* Notes Card */}
          {po.notes && (
            <div className="bg-background-card border border-border rounded-2xl p-6 space-y-2">
              <h3 className="text-xs font-bold uppercase text-text-secondary tracking-wider flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Notas del Comprador
              </h3>
              <p className="text-sm text-text-secondary italic leading-relaxed">
                "{po.notes}"
              </p>
            </div>
          )}

          {/* Approvals History Card */}
          {po.approvals && po.approvals.length > 0 && (
            <div className="bg-background-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase text-text-secondary tracking-wider flex items-center gap-1.5 border-b border-border pb-2">
                <Check className="h-4 w-4 text-success" />
                Bitácora de Firmas
              </h3>
              <div className="space-y-3 max-h-48 overflow-y-auto divide-y divide-border">
                {po.approvals.map((app) => (
                  <div key={app.id} className="pt-2 text-xs flex flex-col gap-1.5 first:pt-0 first:border-0">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-text-primary">{app.approver_name || 'Aprobador'}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                        app.action === 'approved' ? 'bg-success-light border-success/20 text-success' : 'bg-error-light border-error/20 text-error'
                      }`}>
                        {app.action === 'approved' ? 'Firmó' : 'Rechazó'}
                      </span>
                    </div>
                    {app.notes && <p className="text-text-secondary italic">"{app.notes}"</p>}
                    <span className="text-[10px] text-text-disabled">{new Date(app.created_at).toLocaleString('es-ES')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Modals for Approval and Rejection --- */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Check className="h-5 w-5 text-success" /> Aprobar y Firmar Orden
            </h3>
            <p className="text-xs text-text-secondary">
              ¿Estás seguro de que deseas autorizar esta orden de compra? Puedes añadir una nota opcional a continuación.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-primary">Notas de Aprobación</label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Ej: Proveedor validado, condiciones de crédito correctas..."
                rows={3}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none font-semibold text-text-primary"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="bg-surface border border-border text-text-primary px-4 py-2 rounded-xl text-sm font-bold hover:bg-surface-raised active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="bg-success text-text-inverse px-5 py-2 rounded-xl text-sm font-bold hover:bg-success/90 active:scale-95"
              >
                {actionLoading ? 'Procesando...' : 'Confirmar Firma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectionModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <X className="h-5 w-5 text-error" /> Rechazar Orden de Compra
            </h3>
            <p className="text-xs text-text-secondary">
              La orden será devuelta al estado "Borrador" para que el comprador pueda realizar los ajustes solicitados.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-primary">Motivo del Rechazo *</label>
              <textarea
                value={rejectionNotes}
                onChange={(e) => {
                  setRejectionNotes(e.target.value);
                  if (e.target.value.trim()) setValidationError(null);
                }}
                placeholder="Detalla el motivo (Ej: Precios desactualizados, falta cotización)..."
                rows={3}
                required
                className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none font-semibold text-text-primary"
              />
              {validationError && <p className="text-xs text-error font-semibold mt-1">{validationError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setValidationError(null);
                }}
                className="bg-surface border border-border text-text-primary px-4 py-2 rounded-xl text-sm font-bold hover:bg-surface-raised active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="bg-error text-text-inverse px-5 py-2 rounded-xl text-sm font-bold hover:bg-error/90 active:scale-95"
              >
                {actionLoading ? 'Procesando...' : 'Rechazar Orden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Container */}
      <div className="hidden">
        <PurchaseOrderPrintTemplate ref={printRef} po={po} />
      </div>
    </div>
  );
}
