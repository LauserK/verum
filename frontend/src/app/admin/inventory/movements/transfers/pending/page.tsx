'use client';

import { useState, useEffect } from 'react';
import { adminApi, Warehouse } from '@/lib/api';
import { Loader2, ArrowLeft, ArrowRightLeft, Package, Calendar, ArrowRight, Eye } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/components/I18nProvider';

export default function PendingTransfersPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPending();
  }, []);

  async function loadPending() {
    try {
      const data = await adminApi.getPendingTransfers();
      setTransfers(data);
    } catch (error) {
      console.error('Error loading pending transfers:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4">
      <div className="flex items-center gap-4">
        <Link href="/admin/inventory/kardex" className="p-2 hover:bg-surface-raised rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Traslados Pendientes</h1>
          <p className="text-sm text-text-secondary">Mercancía en tránsito esperando confirmación de recepción</p>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-raised border-b border-border">
                <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Fecha Envío</th>
                <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Ruta (Origen → Destino)</th>
                <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Notas</th>
                <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center">
                    <ArrowRightLeft className="w-12 h-12 text-text-disabled mx-auto mb-4" />
                    <p className="text-text-secondary font-medium">No hay traslados pendientes de recepción</p>
                  </td>
                </tr>
              ) : transfers.map((tr) => (
                <tr key={tr.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="p-4 whitespace-nowrap">
                    <p className="text-sm font-medium text-text-primary">
                      {new Date(tr.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] text-text-secondary uppercase">
                      {new Date(tr.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-text-secondary uppercase tracking-tighter">Origen</span>
                        <span className="text-sm font-bold text-text-primary">{tr.origin?.name}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-text-disabled" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-text-secondary uppercase tracking-tighter">Destino</span>
                        <span className="text-sm font-bold text-primary">{tr.destination?.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-xs text-text-primary line-clamp-2 max-w-[300px] italic">
                        {tr.notes || '---'}
                    </p>
                  </td>
                  <td className="p-4 text-center">
                    <Link 
                      href={`/admin/inventory/movements/transfers/${tr.id}/confirm`}
                      className="inline-flex items-center gap-2 px-4 h-9 bg-primary text-text-inverse rounded-lg text-xs font-bold hover:bg-primary-hover transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Confirmar Recepción
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
