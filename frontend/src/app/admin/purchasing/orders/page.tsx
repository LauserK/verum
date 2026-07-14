// frontend/src/app/admin/purchasing/orders/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { adminApi, PurchaseOrderResponse, SupplierResponse } from '@/lib/api';
import { 
  Plus, Search, Filter, Loader2, AlertCircle, ShoppingCart, 
  ChevronRight, Calendar, Building2, ShieldAlert
} from 'lucide-react';
import Link from 'next/link';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrderResponse[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const poData = await adminApi.getPurchaseOrders();
        setOrders(poData || []);

        const supData = await adminApi.getSuppliers();
        setSuppliers(supData || []);
      } catch (err) {
        console.error('Error loading purchase orders data:', err);
        setError('No se pudieron cargar las órdenes de compra. Verifica los permisos del usuario.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter Logic
  const filteredOrders = orders.filter(po => {
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    const matchesSupplier = supplierFilter === 'all' || po.supplier_id === supplierFilter;
    const matchesSearch = po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (po.supplier_name && po.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSupplier && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 inline-flex items-center gap-1";
    switch (status) {
      case 'draft':
        return <span className={`${baseClasses} bg-surface-raised text-text-secondary border-border`}>Borrador</span>;
      case 'pending':
        return <span className={`${baseClasses} bg-warning-light text-warning border-warning/20 animate-pulse`}>Pendiente</span>;
      case 'approved':
        return <span className={`${baseClasses} bg-primary-light text-primary border-primary/20`}>Aprobada</span>;
      case 'sent':
        return <span className={`${baseClasses} bg-primary-light/50 text-primary border-primary/25`}>Enviada</span>;
      case 'partially_received':
        return <span className={`${baseClasses} bg-warning-light text-warning border-warning/20`}>Recepción Parcial</span>;
      case 'received':
        return <span className={`${baseClasses} bg-success-light text-success border-success/20`}>Recibida</span>;
      case 'invoiced':
        return <span className={`${baseClasses} bg-success-light/80 text-success border-success/30`}>Facturada</span>;
      case 'closed':
        return <span className={`${baseClasses} bg-surface-raised text-text-disabled border-border`}>Cerrada</span>;
      case 'cancelled':
        return <span className={`${baseClasses} bg-error-light text-error border-error/20`}>Cancelada</span>;
      default:
        return <span className={`${baseClasses} bg-surface-raised text-text-secondary border-border`}>{status}</span>;
    }
  };

  const pendingApprovalsCount = orders.filter(po => po.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Cargando órdenes de compra...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Órdenes de Compra (BOM)
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Gestiona la adquisición de materia prima e insumos y el flujo de autorizaciones.
          </p>
        </div>
        <Link
          href="/admin/purchasing/orders/new"
          className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 w-full sm:w-auto active:scale-95 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nueva Orden
        </Link>
      </div>

      {/* Pending Approvals Notice Banner */}
      {pendingApprovalsCount > 0 && (
        <div className="p-4 rounded-2xl bg-warning-light text-warning border border-warning/20 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Aprobaciones Pendientes</h4>
            <p className="text-xs text-text-secondary mt-0.5">
              Tienes {pendingApprovalsCount} {pendingApprovalsCount === 1 ? 'orden' : 'órdenes'} de compra esperando revisión de firmas por los aprobadores configurados.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-background-card border border-border rounded-2xl p-4">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Buscar por PO-XXXX o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background-input border border-border rounded-xl pl-9 pr-4 h-11 text-text-primary text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-background-input border border-border rounded-xl px-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary appearance-none cursor-pointer"
          >
            <option value="all">Todos los Estados</option>
            <option value="draft">Borradores</option>
            <option value="pending">Pendientes de Firma</option>
            <option value="approved">Aprobadas</option>
            <option value="sent">Enviadas</option>
            <option value="partially_received">Recepción Parcial</option>
            <option value="received">Recibidas</option>
            <option value="invoiced">Facturadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        <div className="relative">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full bg-background-input border border-border rounded-xl px-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary appearance-none cursor-pointer"
          >
            <option value="all">Todos los Proveedores</option>
            {suppliers.map(sup => (
              <option key={sup.id} value={sup.id}>{sup.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-background-card border border-border rounded-2xl overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-16 text-center text-text-secondary italic">
            No se encontraron órdenes de compra que coincidan con los filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-raised/50 text-text-secondary text-xs font-bold uppercase">
                  <th className="py-4 px-6">Código PO</th>
                  <th className="py-4 px-6">Proveedor</th>
                  <th className="py-4 px-6">Fecha Req.</th>
                  <th className="py-4 px-6">Almacén Destino</th>
                  <th className="py-4 px-6 text-right">Total</th>
                  <th className="py-4 px-6">Estado</th>
                  <th className="py-4 px-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map(po => (
                  <tr 
                    key={po.id} 
                    className="hover:bg-surface-raised transition-colors group cursor-pointer"
                    onClick={() => window.location.href = `/admin/purchasing/orders/${po.id}`}
                  >
                    <td className="py-4 px-6 font-mono font-bold text-text-primary text-sm">
                      {po.po_number}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-text-primary text-sm">{po.supplier_name || '—'}</div>
                      <div className="text-xs text-text-secondary mt-0.5">Condiciones: {po.payment_terms_days} días</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-xs text-text-primary">
                        <Calendar className="h-3.5 w-3.5 text-text-secondary" />
                        {po.requested_date || '—'}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-xs text-text-primary">
                        <Building2 className="h-3.5 w-3.5 text-text-secondary" />
                        {po.warehouse_name || '—'}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-bold text-text-primary text-sm">
                      ${po.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(po.status)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <ChevronRight className="h-5 w-5 text-text-disabled group-hover:text-primary transition-colors inline-block" />
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
