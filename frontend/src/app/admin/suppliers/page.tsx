'use client';

import { useState, useEffect } from 'react';
import { adminApi, SupplierResponse } from '@/lib/api';
import { Plus, Search, Star, ExternalLink, Loader2, Users, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function SuppliersDirectoryPage() {
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      setLoading(true);
      try {
        const data = await adminApi.getSuppliers();
        setSuppliers(data || []);
      } catch (err) {
        console.error('Error fetching suppliers:', err);
        setError('No se pudo cargar el directorio de proveedores');
      } finally {
        setLoading(false);
      }
    };
    fetchSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = searchQuery.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(query) ||
      (supplier.code && supplier.code.toLowerCase().includes(query)) ||
      (supplier.tax_id && supplier.tax_id.toLowerCase().includes(query))
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2.5 py-1 text-xs font-semibold bg-green-500/10 text-green-500 rounded-full border border-green-500/20">Activo</span>;
      case 'inactive':
        return <span className="px-2.5 py-1 text-xs font-semibold bg-gray-500/10 text-gray-400 rounded-full border border-gray-500/20">Inactivo</span>;
      case 'blocked':
        return <span className="px-2.5 py-1 text-xs font-semibold bg-red-500/10 text-red-500 rounded-full border border-red-500/20 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Bloqueado</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold bg-gray-500/10 text-gray-500 rounded-full border border-gray-500/20">{status}</span>;
    }
  };

  const renderStars = (score: number | null) => {
    if (score === null || score === undefined) return <span className="text-text-secondary text-xs">—</span>;
    let colorClass = "fill-red-500 text-red-500";
    if (score >= 4.0) colorClass = "fill-green-500 text-green-500";
    else if (score >= 3.0) colorClass = "fill-yellow-500 text-yellow-500";
    
    return (
      <div className="flex items-center gap-1">
        <Star className={`h-4 w-4 shrink-0 ${colorClass}`} />
        <span className="text-sm font-semibold text-text-primary">{score.toFixed(1)}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Cargando directorio de proveedores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Proveedores (SRM)</h1>
          <p className="text-sm text-text-secondary">Administra los proveedores comerciales, contactos y listas de precios negociadas.</p>
        </div>
        <Link
          href="/admin/suppliers/new"
          className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 w-full sm:w-auto active:scale-95 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nuevo Proveedor
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-sm flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Actions Bar */}
      <div className="flex items-center bg-background-card border border-border rounded-xl px-4 py-3 gap-3">
        <Search className="h-5 w-5 text-text-muted" />
        <input
          type="text"
          placeholder="Buscar por nombre, código o RIF..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-sm text-text-primary focus:outline-none placeholder-text-muted"
        />
      </div>

      {/* Directory Table */}
      <div className="bg-background-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {filteredSuppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Users className="h-12 w-12 text-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-1">No se encontraron proveedores</h3>
            <p className="text-sm text-text-secondary max-w-sm">Intenta ajustar tu búsqueda o crea un nuevo proveedor en el sistema.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-background-hover/10 text-[11px] uppercase text-text-muted tracking-wider">
                  <th className="py-2.5 px-4 font-bold whitespace-nowrap">Código</th>
                  <th className="py-2.5 px-4 font-bold">Nombre comercial</th>
                  <th className="py-2.5 px-4 font-bold whitespace-nowrap">RIF / Identificación</th>
                  <th className="py-2.5 px-4 font-bold">Contacto Directo</th>
                  <th className="py-2.5 px-4 font-bold whitespace-nowrap">Estado</th>
                  <th className="py-2.5 px-4 font-bold whitespace-nowrap">Score</th>
                  <th className="py-2.5 px-4 text-right font-bold whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="hover:bg-background-hover/20 transition-colors group"
                  >
                    <td className="py-2 px-4 font-semibold text-text-primary whitespace-nowrap text-xs">
                      {supplier.code || '—'}
                    </td>
                    <td className="py-2 px-4">
                      <div className="font-semibold text-text-primary group-hover:text-primary transition-colors text-xs leading-tight">
                        {supplier.name}
                      </div>
                      {supplier.payment_terms_days > 0 ? (
                        <div className="text-[10px] text-text-secondary mt-0.5 leading-none">
                          Crédito {supplier.payment_terms_days} días
                        </div>
                      ) : (
                        <div className="text-[10px] text-text-secondary mt-0.5 leading-none">Contado</div>
                      )}
                    </td>
                    <td className="py-2 px-4 text-text-primary whitespace-nowrap text-xs">
                      {supplier.tax_id || '—'}
                    </td>
                    <td className="py-2 px-4">
                      {supplier.email && <div className="text-text-primary text-[11px] leading-tight max-w-[180px] truncate">{supplier.email}</div>}
                      {supplier.phone && <div className="text-text-secondary text-[10px] mt-0.5 leading-none">{supplier.phone}</div>}
                      {!supplier.email && !supplier.phone && <span className="text-text-secondary text-xs">—</span>}
                    </td>
                    <td className="py-2 px-4 whitespace-nowrap">{getStatusBadge(supplier.status)}</td>
                    <td className="py-2 px-4 whitespace-nowrap">{renderStars(supplier.score)}</td>
                    <td className="py-2 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/suppliers/${supplier.id}`}
                        title="Ver ficha completa"
                        className="inline-flex items-center justify-center h-7 w-7 bg-background-button hover:bg-background-button-hover text-text-primary rounded-lg border border-border transition-all shadow-sm active:scale-95 ml-auto"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
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
