// frontend/src/app/admin/purchasing/invoices/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { adminApi, SupplierInvoiceResponse, SupplierResponse } from '@/lib/api';
import { 
  FileSpreadsheet, Loader2, AlertCircle, Plus, Eye,
  CheckCircle, AlertTriangle, XCircle, HelpCircle, ArrowUpRight, Filter
} from 'lucide-react';
import Link from 'next/link';

export default function SupplierInvoicesPage() {
  const [invoices, setInvoices] = useState<SupplierInvoiceResponse[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('');

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const filterObj: any = {};
      if (selectedSupplier) filterObj.supplier_id = selectedSupplier;
      if (selectedPaymentStatus) filterObj.payment_status = selectedPaymentStatus;

      const [invoicesData, suppliersData] = await Promise.all([
        adminApi.getSupplierInvoices(filterObj),
        adminApi.getSuppliers()
      ]);
      setInvoices(invoicesData);
      setSuppliers(suppliersData);
    } catch (err) {
      console.error('Error loading invoices:', err);
      setError('No se pudieron obtener las facturas de proveedores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [selectedSupplier, selectedPaymentStatus]);

  const getMatchingStatusPill = (status: string) => {
    switch (status) {
      case 'matched':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-success-light border border-success/20 text-success">
            <CheckCircle className="h-3.5 w-3.5" /> Matched
          </span>
        );
      case 'partial_match':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-warning-light border border-warning/20 text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> Desviación Aceptada
          </span>
        );
      case 'mismatch':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-error-light border border-error/25 text-error animate-pulse">
            <XCircle className="h-3.5 w-3.5" /> Mismatch (Rechazada)
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-surface-raised border border-border text-text-secondary">
            <HelpCircle className="h-3.5 w-3.5" /> Pendiente
          </span>
        );
    }
  };

  const getPaymentStatusPill = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-success-light border border-success/20 text-success">
            Pagada
          </span>
        );
      case 'exported':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-warning-light border border-warning/20 text-warning">
            Exportada (Odoo)
          </span>
        );
      case 'unpaid':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-surface-raised border border-border text-text-secondary">
            Por Pagar
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" /> Facturas de Proveedores
          </h1>
          <p className="text-sm text-text-secondary mt-1">Conciliación de 3 vías (Orden de Compra vs. Recepción vs. Factura)</p>
        </div>
        <Link
          href="/admin/purchasing/invoices/new"
          className="flex items-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" /> Registrar Factura
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-background-card border border-border rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase">
          <Filter className="h-4 w-4" /> Filtrar
        </div>
        
        <div className="flex flex-1 gap-3 min-w-[280px]">
          {/* Supplier selector */}
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
          >
            <option value="">Todos los Proveedores</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Payment Status selector */}
          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="w-48 bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
          >
            <option value="">Todos los Estados de Pago</option>
            <option value="unpaid">Por Pagar</option>
            <option value="exported">Exportada</option>
            <option value="paid">Pagada</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl flex items-center gap-2 text-sm font-semibold">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Invoices List */}
      <div className="bg-background-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-text-secondary">Cargando facturas...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <FileSpreadsheet className="h-12 w-12 text-text-disabled" />
            <h3 className="font-bold text-text-secondary">No se encontraron facturas</h3>
            <p className="text-xs text-text-disabled max-w-sm">Registra una factura asociada a una orden de compra o ingresa una de manera directa.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-surface-raised border-b border-border text-text-secondary text-xs font-bold uppercase">
                  <th className="py-3 px-4">Factura #</th>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Vínculos</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Conciliación (3-Way)</th>
                  <th className="py-3 px-4 text-center">Estado de Pago</th>
                  <th className="py-3 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-raised/15 transition-colors">
                    <td className="py-4 px-4 font-bold text-text-primary font-mono">
                      {inv.invoice_number}
                    </td>
                    <td className="py-4 px-4 font-semibold text-text-primary">
                      {inv.supplier_name || 'Desconocido'}
                    </td>
                    <td className="py-4 px-4 text-text-secondary text-xs font-semibold">
                      {new Date(inv.invoice_date).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-4 px-4 text-xs font-bold space-y-1">
                      {inv.po_id && (
                        <Link 
                          href={`/admin/purchasing/orders/${inv.po_id}`}
                          className="flex items-center gap-0.5 text-primary hover:underline"
                        >
                          PO: {inv.po_number || 'Ver PO'} <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      )}
                      {inv.receipt_id && (
                        <span className="block text-text-disabled">
                          Doc Recibido
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-text-primary">
                      ${inv.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 flex justify-center">
                      {getMatchingStatusPill(inv.matching_status)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {getPaymentStatusPill(inv.payment_status)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        href={`/admin/purchasing/invoices/${inv.id}`}
                        className="inline-flex items-center justify-center p-2 border border-border rounded-xl text-text-primary hover:bg-background-hover transition-colors active:scale-95"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
