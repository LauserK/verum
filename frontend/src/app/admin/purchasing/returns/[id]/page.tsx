'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, SupplierReturnResponse } from '@/lib/api';
import { 
  ArrowLeft, Loader2, AlertCircle, FileText, CheckCircle2, Clock, Send, CreditCard, RotateCcw
} from 'lucide-react';
import Link from 'next/link';

export default function SupplierReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [ret, setRet] = useState<SupplierReturnResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showSendModal, setShowSendModal] = useState(false);

  const fetchReturn = async () => {
    try {
      const data = await adminApi.getSupplierReturn(id);
      setRet(data);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar la devolución.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturn();
  }, [id]);

  const handleConfirmSend = async () => {
    try {
      await adminApi.sendSupplierReturn(id);
      setShowSendModal(false);
      fetchReturn();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error al enviar la devolución.');
      setShowSendModal(false);
    }
  };



  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-text-secondary">Cargando detalle...</p>
    </div>
  );

  if (!ret) return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-center text-error font-bold">
      {error || 'Devolución no encontrada.'}
    </div>
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-warning-light border border-warning/20 text-warning"><Clock className="h-4 w-4"/> Pendiente</span>;
      case 'sent':
        return <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-primary-light border border-primary/20 text-primary"><Send className="h-4 w-4"/> Enviada</span>;
      case 'credit_note_received':
        return <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-success-light border border-success/20 text-success"><CheckCircle2 className="h-4 w-4"/> NC Recibida</span>;
      case 'closed':
        return <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-surface-raised border border-border text-text-secondary"><CheckCircle2 className="h-4 w-4"/> Cerrada</span>;
      default:
        return <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-surface-raised border border-border text-text-secondary">{status}</span>;
    }
  };

  const totalReturn = ret.lines.reduce((acc, l) => acc + (l.line_total || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 pb-24 relative">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-background-hover rounded-xl border border-border transition-colors text-text-primary active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{ret.return_number}</h1>
          <p className="text-sm text-text-secondary">{ret.supplier_name}</p>
        </div>
        <div className="ml-auto">
          {getStatusBadge(ret.status)}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-3 font-semibold text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-background-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between relative">
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-border z-0"></div>
          <div className="absolute top-4 left-4 h-0.5 bg-primary z-0 transition-all duration-500" 
            style={{ width: ret.status === 'closed' ? '100%' : ret.status === 'credit_note_received' ? '66%' : ret.status === 'sent' ? '33%' : '0%' }}>
          </div>
          
          {[ 
            { s: 'pending', label: 'Pendiente' },
            { s: 'sent', label: 'Enviada' },
            { s: 'credit_note_received', label: 'NC Recibida' },
            { s: 'closed', label: 'Cerrada' }
          ].map((step, idx) => (
            <div key={step.s} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300
                ${['pending','sent','credit_note_received','closed'].indexOf(ret.status) >= idx ? 'bg-primary border-primary text-text-inverse' : 'bg-surface border-border text-text-disabled'}`}>
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className={`text-xs font-bold ${['pending','sent','credit_note_received','closed'].indexOf(ret.status) >= idx ? 'text-primary' : 'text-text-disabled'}`}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-background-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase text-text-secondary tracking-wider mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Líneas Devueltas
            </h3>
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-raised border-b border-border text-text-secondary text-xs font-bold uppercase">
                    <th className="py-3 px-4">Artículo</th>
                    <th className="py-3 px-4 text-center">Cant.</th>
                    <th className="py-3 px-4 text-right">Costo U.</th>
                    <th className="py-3 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ret.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-4 px-4 font-semibold text-text-primary">{line.item_name}</td>
                      <td className="py-4 px-4 text-center font-mono text-text-secondary">
                        {line.qty_base} <span className="text-[10px] uppercase font-bold text-text-muted">{line.uom_name || 'uds'}</span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-text-secondary">${(line.unit_cost_base || 0).toFixed(2)}</td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-text-primary">${(line.line_total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="text-right">
                <p className="text-xs text-text-secondary font-bold uppercase">Total Estimado</p>
                <p className="text-2xl font-black text-text-primary">${totalReturn.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-background-card border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold text-text-secondary uppercase mb-1">Razón</p>
              <p className="font-semibold text-text-primary">{ret.reason}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-text-secondary uppercase mb-1">Recepción</p>
              <p className="font-semibold text-text-primary">{ret.receipt_number || ret.receipt_id}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-text-secondary uppercase mb-1">Notas</p>
              <p className="text-sm text-text-secondary">{ret.notes || 'Sin notas'}</p>
            </div>
          </div>

          <div className="bg-background-card border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-3">
            <h3 className="text-sm font-bold uppercase text-text-secondary tracking-wider mb-2">Acciones</h3>
            
            {ret.status === 'pending' && (
              <button 
                onClick={() => { setShowSendModal(true); setError(null); }}
                className="w-full flex items-center justify-center gap-2 bg-primary text-text-inverse px-4 py-3 rounded-xl font-bold hover:bg-primary-hover active:scale-95 transition-all"
              >
                <Send className="h-4 w-4" /> Marcar como Enviada
              </button>
            )}

            {ret.status === 'sent' && (
              <Link 
                href={`/admin/purchasing/returns/${ret.id}/credit-note/new`}
                className="w-full flex items-center justify-center gap-2 bg-surface border border-primary text-primary px-4 py-3 rounded-xl font-bold hover:bg-primary/5 active:scale-95 transition-all text-center"
              >
                <CreditCard className="h-4 w-4" /> Registrar Nota de Crédito
              </Link>
            )}

            {(ret.status === 'credit_note_received' || ret.status === 'closed') && (
              <div className="text-center text-sm font-bold text-success border border-success/20 bg-success-light py-3 rounded-xl">
                Nota de Crédito Registrada
              </div>
            )}
          </div>
        </div>
      </div>



      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in space-y-4">
            <div>
              <h3 className="text-lg font-bold text-text-primary">¿Confirmar Envío?</h3>
              <p className="text-xs text-text-secondary mt-1">Esta acción marcará la devolución como despachada al proveedor y no podrá ser revertida.</p>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setShowSendModal(false)} 
                className="flex-1 px-4 py-2 bg-surface-raised border border-border text-text-primary rounded-xl font-bold hover:bg-background-hover transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleConfirmSend} 
                className="flex-1 px-4 py-2 bg-primary text-text-inverse rounded-xl font-bold hover:bg-primary-hover transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
