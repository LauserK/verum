// frontend/src/app/admin/purchasing/invoices/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { adminApi, SupplierInvoiceResponse } from '@/lib/api';
import { 
  ArrowLeft, Loader2, AlertCircle, ShoppingCart, Calendar, 
  Building2, User, Check, FileSpreadsheet, Percent, Info,
  CheckCircle, AlertTriangle, XCircle, HelpCircle, ArrowUpRight,
  ExternalLink, FileCheck, CircleDollarSign
} from 'lucide-react';
import Link from 'next/link';

export default function SupplierInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<SupplierInvoiceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getSupplierInvoice(id);
      setInvoice(data);
    } catch (err) {
      console.error('Error loading invoice:', err);
      setError('No se pudo obtener el detalle de la factura del proveedor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const handleAction = async (apiCall: () => Promise<any>, successText: string) => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiCall();
      setSuccessMsg(successText);
      // Reload details
      const data = await adminApi.getSupplierInvoice(id);
      setInvoice(data);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.detail || 'Ocurrió un error al procesar la acción.');
    } finally {
      setActionLoading(false);
    }
  };

  const getMatchingStatusPill = (status: string) => {
    switch (status) {
      case 'matched':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success-light border border-success/20 text-success">
            <CheckCircle className="h-4 w-4" /> Conciliada Completamente (Matched)
          </span>
        );
      case 'partial_match':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning-light border border-warning/20 text-warning">
            <AlertTriangle className="h-4 w-4" /> Diferencia Aceptada (Dentro de Tolerancia)
          </span>
        );
      case 'mismatch':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-error-light border border-error/25 text-error animate-pulse">
            <XCircle className="h-4 w-4" /> Discrepancia Crítica (Mismatch)
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface-raised border border-border text-text-secondary">
            <HelpCircle className="h-4 w-4" /> Conciliación Pendiente
          </span>
        );
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Pagada';
      case 'exported': return 'Exportada a Odoo';
      case 'unpaid': return 'Pendiente por Pagar';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Cargando detalles de la factura...</p>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl flex flex-col items-center text-center gap-3">
        <AlertCircle className="h-10 w-10" />
        <p className="font-bold">{error}</p>
        <Link href="/admin/purchasing/invoices" className="bg-primary text-text-inverse px-5 py-2 rounded-xl text-sm font-bold mt-2">
          Volver a Facturas
        </Link>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-24">
      {/* Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/purchasing/invoices"
            className="p-2 hover:bg-background-hover rounded-xl border border-border transition-colors text-text-primary active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary">Factura {invoice.invoice_number}</h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                invoice.payment_status === 'unpaid' ? 'bg-surface-raised border-border text-text-secondary' :
                invoice.payment_status === 'exported' ? 'bg-warning-light border-warning/20 text-warning' : 'bg-success-light border-success/20 text-success'
              }`}>
                {getPaymentStatusLabel(invoice.payment_status)}
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Registrada el {new Date(invoice.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="p-2.5 bg-success-light border border-success/20 text-success text-xs font-semibold rounded-xl">
            {successMsg}
          </div>
        )}

        {error && (
          <div className="p-2.5 bg-error-light border border-error/25 text-error text-xs font-semibold rounded-xl max-w-sm">
            {error}
          </div>
        )}
      </div>

      {/* Global Matching Status Panel */}
      <div className="bg-background-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Estado de Conciliación (3-Way)</span>
          {getMatchingStatusPill(invoice.matching_status)}
        </div>
        
        {invoice.matching_notes && (
          <div className={`p-4 rounded-xl border text-sm font-semibold whitespace-pre-line leading-relaxed ${
            invoice.matching_status === 'matched' ? 'bg-success-light/20 border-success/15 text-success' :
            invoice.matching_status === 'partial_match' ? 'bg-warning-light/20 border-warning/15 text-warning' :
            invoice.matching_status === 'mismatch' ? 'bg-error-light/20 border-error/15 text-error' : 'bg-surface-raised/40 border-border text-text-secondary'
          }`}>
            {invoice.matching_notes}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="bg-background-card border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Acciones de Pago</span>
        
        <div className="flex gap-2">
          {actionLoading && <Loader2 className="h-5 w-5 animate-spin text-primary self-center" />}

          {invoice.payment_status === 'unpaid' && (
            <button
              onClick={() => handleAction(() => adminApi.markInvoiceExported(invoice.id), 'Factura exportada exitosamente')}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
            >
              <FileCheck className="h-4 w-4" /> Exportar a Odoo (ERP)
            </button>
          )}

          {invoice.payment_status !== 'paid' && (
            <button
              onClick={() => handleAction(() => adminApi.markInvoicePaid(invoice.id), 'Factura marcada como pagada')}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-success text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-success/90 active:scale-95 transition-all disabled:opacity-50"
            >
              <CircleDollarSign className="h-4 w-4" /> Marcar como Pagada
            </button>
          )}
        </div>
      </div>

      {/* Main Details and Lines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lines and Audit (Col span 2) */}
        <div className="md:col-span-2 bg-background-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-text-secondary tracking-wider flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Auditoría de Conciliación por Artículo
          </h3>

          <div className="border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-raised/50 border-b border-border text-text-secondary font-bold uppercase">
                  <th className="py-2.5 px-3">Artículo</th>
                  <th className="py-2.5 px-3 text-center">Facturado</th>
                  <th className="py-2.5 px-3 text-center">Pedida PO</th>
                  <th className="py-2.5 px-3 text-center">Recibido</th>
                  <th className="py-2.5 px-3 text-right">Costo Fact.</th>
                  <th className="py-2.5 px-3 text-right">Costo PO</th>
                  <th className="py-2.5 px-3 text-right">Desv. Cant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.lines.map((line) => {
                  const hasQtyDeviation = (line.diff_vs_po_base !== undefined && line.diff_vs_po_base !== null && line.diff_vs_po_base !== 0) || 
                                         (line.diff_vs_receipt_base !== undefined && line.diff_vs_receipt_base !== null && line.diff_vs_receipt_base !== 0);
                  
                  return (
                    <tr 
                      key={line.id} 
                      className={`transition-colors ${
                        hasQtyDeviation 
                          ? 'bg-warning-light/5 hover:bg-warning-light/10' 
                          : 'hover:bg-surface-raised/10'
                      }`}
                    >
                      <td className="py-3.5 px-3 font-semibold text-text-primary">
                        {line.item_name || 'Artículo sin nombre'}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-text-primary">
                        {line.qty_invoiced_base}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-text-secondary">
                        {line.diff_vs_po_base !== null && line.diff_vs_po_base !== undefined ? (line.qty_invoiced_base - line.diff_vs_po_base) : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-text-secondary">
                        {line.diff_vs_receipt_base !== null && line.diff_vs_receipt_base !== undefined ? (line.qty_invoiced_base - line.diff_vs_receipt_base) : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-text-primary">
                        ${line.unit_cost_base.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-text-secondary">
                        {line.po_line_id ? 'Vinculado' : '—'}
                      </td>
                      <td className={`py-3.5 px-3 text-right font-mono font-bold ${
                        hasQtyDeviation ? 'text-warning' : 'text-success'
                      }`}>
                        {line.diff_vs_po_base !== null && line.diff_vs_po_base !== undefined && line.diff_vs_po_base !== 0 ? `${line.diff_vs_po_base > 0 ? '+' : ''}${line.diff_vs_po_base}` : '0.00'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-end gap-1.5 pt-2 border-t border-border">
            <div className="flex justify-between w-full max-w-[240px] text-xs text-text-secondary">
              <span>Subtotal:</span>
              <span className="font-semibold text-text-primary">${invoice.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between w-full max-w-[240px] text-xs text-text-secondary">
              <span>IVA (16%):</span>
              <span className="font-semibold text-text-primary">${invoice.tax_amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between w-full max-w-[240px] text-sm font-bold text-text-primary border-t border-border/50 pt-1.5">
              <span>Total Facturado:</span>
              <span>${invoice.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                <span className="font-semibold text-text-primary mt-0.5">{invoice.supplier_name || 'Sin Asignar'}</span>
              </div>

              {invoice.po_id && (
                <div className="flex flex-col">
                  <span className="text-xs text-text-secondary flex items-center gap-1">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Orden de Compra
                  </span>
                  <Link 
                    href={`/admin/purchasing/orders/${invoice.po_id}`}
                    className="font-semibold text-primary mt-0.5 flex items-center gap-0.5 hover:underline"
                  >
                    {invoice.po_number || 'Ver PO'} <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              <div className="flex flex-col">
                <span className="text-xs text-text-secondary flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Fecha de Facturación
                </span>
                <span className="font-semibold text-text-primary mt-0.5">{invoice.invoice_date}</span>
              </div>

              {invoice.due_date && (
                <div className="flex flex-col">
                  <span className="text-xs text-text-secondary flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Fecha de Vencimiento
                  </span>
                  <span className="font-semibold text-text-primary mt-0.5">{invoice.due_date}</span>
                </div>
              )}

              {invoice.pdf_url && (
                <div className="flex flex-col">
                  <span className="text-xs text-text-secondary">Soporte Digital</span>
                  <a 
                    href={invoice.pdf_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="font-semibold text-primary mt-0.5 flex items-center gap-1 hover:underline"
                  >
                    Ver Archivo PDF <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}

              {invoice.exported_at && (
                <div className="flex flex-col">
                  <span className="text-xs text-text-secondary">Exportada el</span>
                  <span className="font-semibold text-text-primary mt-0.5">{new Date(invoice.exported_at).toLocaleString('es-ES')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
