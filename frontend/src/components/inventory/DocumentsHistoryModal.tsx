'use client';

import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';
import { Loader2, Search, FileText, ArrowUpRight, ArrowDownRight, Eye, Calendar, Package } from 'lucide-react';

interface DocumentsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDetail: (doc: any) => void;
}

export default function DocumentsHistoryModal({ isOpen, onClose, onViewDetail }: DocumentsHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen]);

  async function loadDocuments() {
    setLoading(true);
    try {
      const [receipts, issues] = await Promise.all([
        adminApi.getPurchaseReceipts(),
        adminApi.getIssueDocuments()
      ]);

      const combined = [
        ...receipts.map(r => ({ ...r, type: 'receipt', docType: 'Ingreso' })),
        ...issues.map(i => ({ ...i, type: 'issue', docType: 'Egreso' }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setDocs(combined);
    } catch (error) {
      console.error('Error loading document history:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredDocs = docs.filter(d => 
    (d.receipt_number || '').toLowerCase().includes(filter.toLowerCase()) ||
    (d.supplier || '').toLowerCase().includes(filter.toLowerCase()) ||
    (d.reason || '').toLowerCase().includes(filter.toLowerCase()) ||
    (d.warehouses?.name || '').toLowerCase().includes(filter.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-surface w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-center bg-surface-raised">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Historial de Documentos</h2>
            <p className="text-xs text-text-secondary">Listado de todos los ingresos y egresos registrados</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-surface border border-border rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-border bg-surface">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input 
              type="text"
              placeholder="Buscar por Nº, Proveedor, Almacén..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full bg-surface-raised border border-border rounded-xl pl-10 pr-4 h-11 text-sm outline-none focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
            <div className="p-20 text-center">
              <Loader2 className="animate-spin w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-text-secondary text-sm font-medium">Cargando historial...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-20 text-center">
              <FileText className="w-12 h-12 text-text-disabled mx-auto mb-4" />
              <p className="text-text-secondary font-medium">No se han encontrado documentos</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-raised z-10">
                <tr className="border-b border-border">
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Fecha</th>
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Tipo</th>
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Identificador / Origen</th>
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Almacén</th>
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocs.map(d => (
                  <tr key={d.id} className="hover:bg-surface-raised/50 transition-colors group">
                    <td className="p-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-text-primary">
                        {new Date(d.date || d.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-text-secondary">
                        {new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {d.type === 'receipt' ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 text-error" />
                        )}
                        <span className={`text-xs font-bold ${d.type === 'receipt' ? 'text-success' : 'text-error'}`}>
                          {d.docType}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-bold text-text-primary">
                        {d.receipt_number || d.reason || 'Sin Ref'}
                      </p>
                      <p className="text-[10px] text-text-secondary uppercase truncate max-w-[150px]">
                        {d.supplier || 'N/A'}
                      </p>
                    </td>
                    <td className="p-4">
                       <div className="flex items-center gap-1.5">
                          <Package className="w-3 h-3 text-text-secondary" />
                          <span className="text-sm text-text-primary font-medium">{d.warehouses?.name || 'Almacén'}</span>
                       </div>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => onViewDetail(d)}
                        className="p-2 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                        title="Ver detalle completo"
                      >
                        <Eye className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-raised border-t border-border flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 h-10 bg-surface border border-border text-text-primary rounded-xl font-bold text-sm hover:bg-surface-raised transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
