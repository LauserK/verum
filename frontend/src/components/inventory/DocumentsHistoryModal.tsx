'use client';

import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';
import { Loader2, Search, FileText, ArrowUpRight, ArrowDownRight, Eye, Calendar, Package, Printer } from 'lucide-react';

interface DocumentsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDetail: (doc: any) => void;
  onPrint: (doc: any) => void;
}

export default function DocumentsHistoryModal({ isOpen, onClose, onViewDetail, onPrint }: DocumentsHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'receipt' | 'issue'>('all');

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

  const filteredDocs = docs.filter(d => {
    const matchesFilter = (d.receipt_number || '').toLowerCase().includes(filter.toLowerCase()) ||
      (d.supplier || '').toLowerCase().includes(filter.toLowerCase()) ||
      (d.reason || '').toLowerCase().includes(filter.toLowerCase()) ||
      (d.warehouses?.name || '').toLowerCase().includes(filter.toLowerCase());
    
    const matchesTab = activeTab === 'all' || d.type === activeTab;
    
    return matchesFilter && matchesTab;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-surface w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-border flex flex-col h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-center bg-surface-raised">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Historial de Documentos</h2>
            <p className="text-xs text-text-secondary">Gestión y auditoría de ingresos y egresos</p>
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

        {/* Filters & Tabs */}
        <div className="p-4 border-b border-border bg-surface flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input 
              type="text"
              placeholder="Buscar por Nº, Proveedor, Almacén..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full bg-surface-raised border border-border rounded-xl pl-10 pr-4 h-11 text-sm outline-none focus:border-primary transition-all"
            />
          </div>
          <div className="flex bg-surface-raised p-1 rounded-xl border border-border">
            <button 
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'all' ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setActiveTab('receipt')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'receipt' ? 'bg-surface text-success shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Ingresos
            </button>
            <button 
              onClick={() => setActiveTab('issue')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'issue' ? 'bg-surface text-error shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Egresos
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
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
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Referencia</th>
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Almacén</th>
                  <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocs.map(d => (
                  <tr key={d.id} className="hover:bg-surface-raised/50 transition-colors group">
                    <td className="p-4">
                      <p className="text-sm font-medium text-text-primary">
                        {new Date(d.date || d.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-text-secondary">
                        {new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${d.type === 'receipt' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                        {d.type === 'receipt' ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {d.docType}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-bold text-text-primary">
                        {d.receipt_number || d.reason || 'Sin Nº'}
                      </p>
                      <p className="text-[10px] text-text-secondary uppercase truncate max-w-[200px]">
                        {d.supplier || 'N/A'}
                      </p>
                    </td>
                    <td className="p-4">
                       <span className="text-sm text-text-primary font-medium">{d.warehouses?.name || '---'}</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => onViewDetail(d)}
                          className="p-2 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                          title="Ver detalle"
                        >
                          <Eye className="w-4.5 h-4.5" />
                        </button>
                        <button 
                          onClick={() => onPrint(d)}
                          className="p-2 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                          title="Abrir PDF / Imprimir"
                        >
                          <Printer className="w-4.5 h-4.5" />
                        </button>
                      </div>
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
