'use client';

import { useState, useEffect, use } from 'react';
import { adminApi } from '@/lib/api';
import { Loader2, ArrowLeft, ClipboardList, Save, Package, ArrowRight, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useTranslations } from '@/components/I18nProvider';

export default function ConfirmTransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useTranslations();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [header, setHeader] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  // Error modal state
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: ''
  });

  useEffect(() => {
    loadDetail();
  }, [id]);

  async function loadDetail() {
    try {
      const data = await adminApi.getTransferDetail(id);
      setHeader(data.header);
      setLines(data.lines.map((l: any) => ({
        ...l,
        qty_received_presentation: l.qty_received_presentation !== null ? l.qty_received_presentation : l.qty_sent_presentation
      })));
      setNotes(data.header.notes || '');
    } catch (error) {
      console.error('Error loading transfer:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      const payload = {
        notes,
        lines: lines.map(l => ({
          id: l.id,
          qty_received_presentation: Number(l.qty_received_presentation)
        }))
      };

      await adminApi.confirmTransfer(id, payload);
      router.push('/admin/inventory/kardex');
    } catch (error: any) {
      setErrorModal({
        isOpen: true,
        message: error.message || 'Error al confirmar la recepción.'
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

  const isAlreadyConfirmed = header?.status === 'confirmed' || header?.status === 'confirmed_with_discrepancy';

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4">
      <div className="flex items-center gap-4">
        <Link href="/admin/inventory/kardex" className="p-2 hover:bg-surface-raised rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isAlreadyConfirmed ? 'Consulta de Traslado' : 'Confirmar Recepción'}
          </h1>
          <p className="text-sm text-text-secondary">
            {isAlreadyConfirmed ? 'Detalles del movimiento ya procesado' : 'Verificar mercancía recibida en destino'}
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-8">
        {/* Already Confirmed Banner */}
        {isAlreadyConfirmed && (
            <div className="bg-success/5 border border-success/20 p-4 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                    <Save className="w-4 h-4 text-success" />
                </div>
                <div>
                    <p className="text-sm font-bold text-success uppercase tracking-widest">Traslado Recibido</p>
                    <p className="text-xs text-text-secondary italic">Este documento ya fue confirmado el {new Date(header.confirmed_at).toLocaleString()}</p>
                </div>
            </div>
        )}

        {/* Info Banner */}
        <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-xl border border-primary/10">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-text-primary">{header.origin?.name}</span>
                    <ArrowRight className="w-4 h-4 text-text-disabled" />
                    <span className="text-sm font-bold text-primary">{header.destination?.name}</span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">Traslado enviado el {new Date(header.created_at).toLocaleDateString()}</p>
            </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" /> Verificación de Artículos
          </h3>

          <div className="bg-surface-raised rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface/50">
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Artículo</th>
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-center">Enviado</th>
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-center">Recibido</th>
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Unidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((l, index) => {
                  const hasDiscrepancy = Number(l.qty_received_presentation) !== Number(l.qty_sent_presentation);
                  return (
                    <tr key={l.id} className="hover:bg-surface transition-colors">
                      <td className="p-4">
                        <p className="text-sm font-bold text-text-primary">{l.items?.name}</p>
                        <p className="text-[10px] text-text-secondary">REF: {l.id.slice(0, 8)}</p>
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-3 py-1 bg-surface border border-border rounded-lg font-mono text-sm font-bold text-text-secondary">
                          {l.qty_sent_presentation}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="relative inline-block w-24">
                          <input 
                            type="number"
                            value={l.qty_received_presentation}
                            disabled={isAlreadyConfirmed}
                            onChange={e => {
                                const newLines = [...lines];
                                newLines[index].qty_received_presentation = e.target.value;
                                setLines(newLines);
                            }}
                            className={`w-full bg-surface border rounded-lg h-9 px-3 text-center text-sm font-mono font-bold outline-none transition-all ${hasDiscrepancy ? 'border-error text-error ring-2 ring-error/10' : 'border-border focus:border-primary text-text-primary'} ${isAlreadyConfirmed ? 'opacity-70 cursor-not-allowed' : ''}`}
                          />
                          {hasDiscrepancy && (
                            <AlertTriangle className="absolute -right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-error animate-pulse" />
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-bold text-text-secondary uppercase">{l.uom_presentations?.name || l.items?.uom_base?.name || 'Unidad'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">Observaciones de Recepción</label>
            <textarea 
              value={notes}
              disabled={isAlreadyConfirmed}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-primary min-h-[100px] disabled:opacity-70"
              placeholder="Ej: Se recibió todo en buen estado..."
            />
        </div>

        <div className="pt-6 border-t border-border flex justify-end gap-3">
            <button 
                onClick={() => router.back()}
                className="px-6 h-11 border border-border text-text-primary rounded-xl font-bold text-sm hover:bg-surface-raised transition-all"
            >
                {isAlreadyConfirmed ? 'Volver' : 'Cancelar'}
            </button>
            {!isAlreadyConfirmed && (
                <button 
                    onClick={handleConfirm}
                    disabled={saving}
                    className="px-8 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Confirmar Recepción
                </button>
            )}
        </div>
      </div>

      <ConfirmationModal 
        isOpen={errorModal.isOpen}
        title="Error de Confirmación"
        message={errorModal.message}
        confirmLabel="Entendido"
        cancelLabel=""
        onConfirm={() => setErrorModal({ ...errorModal, isOpen: false })}
        onCancel={() => setErrorModal({ ...errorModal, isOpen: false })}
      />
    </div>
  );
}
