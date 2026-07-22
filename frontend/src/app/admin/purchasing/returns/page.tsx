'use client';

import { useState, useEffect } from 'react';
import { adminApi, SupplierReturnResponse, SupplierResponse } from '@/lib/api';
import { 
  Loader2, AlertCircle, Plus, Eye, CheckCircle, Package, ArrowUpRight, Filter, ExternalLink, RotateCcw
} from 'lucide-react';
import Link from 'next/link';

export default function SupplierReturnsPage() {
  const [returns, setReturns] = useState<SupplierReturnResponse[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const fetchReturns = async () => {
    setLoading(true);
    setError(null);
    try {
      const filterObj: any = {};
      if (selectedSupplier) filterObj.supplier_id = selectedSupplier;
      if (selectedStatus) filterObj.status = selectedStatus;

      const [returnsData, suppliersData] = await Promise.all([
        adminApi.getSupplierReturns(filterObj),
        adminApi.getSuppliers()
      ]);
      setReturns(returnsData);
      setSuppliers(suppliersData);
    } catch (err) {
      console.error('Error loading returns:', err);
      setError('No se pudieron obtener las devoluciones a proveedores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [selectedSupplier, selectedStatus]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-warning-light border border-warning/20 text-warning">Pendiente</span>;
      case 'sent':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary-light border border-primary/20 text-primary">Enviada</span>;
      case 'credit_note_received':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-success-light border border-success/20 text-success">NC Recibida</span>;
      case 'closed':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-surface-raised border border-border text-text-secondary">Cerrada</span>;
      default:
        return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-surface-raised border border-border text-text-secondary">{status}</span>;
    }
  };

  const getReasonText = (reason: string) => {
    switch(reason) {
      case 'damaged': return 'Mercancía dañada';
      case 'wrong_item': return 'Artículo incorrecto';
      case 'excess_qty': return 'Exceso de cantidad';
      case 'quality': return 'Calidad deficiente';
      case 'expired': return 'Vencido';
      default: return reason;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-primary" /> Devoluciones a Proveedores
          </h1>
          <p className="text-sm text-text-secondary mt-1">Gestión de devoluciones (M29-SRM)</p>
        </div>
        <Link
          href="/admin/purchasing/returns/new"
          className="flex items-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" /> Nueva Devolución
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-background-card border border-border rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase">
          <Filter className="h-4 w-4" /> Filtrar
        </div>
        
        <div className="flex flex-1 gap-3 min-w-[280px]">
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

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-48 bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
          >
            <option value="">Todos los Estados</option>
            <option value="pending">Pendiente</option>
            <option value="sent">Enviada</option>
            <option value="credit_note_received">NC Recibida</option>
            <option value="closed">Cerrada</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl flex items-center gap-2 text-sm font-semibold">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Returns List */}
      <div className="bg-background-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-text-secondary">Cargando devoluciones...</p>
          </div>
        ) : returns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <RotateCcw className="h-12 w-12 text-text-disabled" />
            <h3 className="font-bold text-text-secondary">No hay devoluciones</h3>
            <p className="text-xs text-text-disabled max-w-sm">No se encontraron devoluciones registradas con los filtros actuales.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-surface-raised border-b border-border text-text-secondary text-xs font-bold uppercase">
                  <th className="py-3 px-4">Número</th>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4">Recepción</th>
                  <th className="py-3 px-4">Razón</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-surface-raised/15 transition-colors">
                    <td className="py-4 px-4 font-bold text-text-primary font-mono">
                      {ret.return_number}
                    </td>
                    <td className="py-4 px-4 font-semibold text-text-primary">
                      {ret.supplier_name || 'Desconocido'}
                    </td>
                    <td className="py-4 px-4 text-xs font-bold text-text-secondary">
                      {ret.receipt_number || ret.receipt_id?.slice(0, 8)}
                    </td>
                    <td className="py-4 px-4 text-text-secondary text-sm">
                      {getReasonText(ret.reason)}
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(ret.status)}
                    </td>
                    <td className="py-4 px-4 text-text-secondary text-xs font-semibold">
                      {new Date(ret.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        href={`/admin/purchasing/returns/${ret.id}`}
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
