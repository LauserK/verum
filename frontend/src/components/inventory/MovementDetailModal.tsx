'use client';

import { Package, Calendar, User, FileText, ClipboardList } from 'lucide-react';

interface MovementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
}

export default function MovementDetailModal({ isOpen, onClose, data }: MovementDetailModalProps) {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-surface w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-primary p-6 text-text-inverse relative">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">
                {data.type === 'receipt' ? 'Documento de Ingreso' : 'Documento de Egreso'}
              </p>
              <h2 className="text-2xl font-bold">
                {data.receiptNumber || data.reason || 'Movimiento de Inventario'}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Fecha
              </p>
              <p className="text-sm font-medium text-text-primary">
                {new Date(data.createdAt || data.date).toLocaleDateString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                <Package className="w-3 h-3" /> Almacén
              </p>
              <p className="text-sm font-medium text-text-primary">{data.warehouseName}</p>
            </div>
            {data.supplier && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Proveedor
                </p>
                <p className="text-sm font-medium text-text-primary">{data.supplier}</p>
              </div>
            )}
            {data.reason && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Motivo
                </p>
                <p className="text-sm font-medium text-text-primary">{data.reason}</p>
              </div>
            )}
          </div>

          {/* Lines Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" /> Detalle de Artículos
            </h3>
            <div className="border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-raised border-b border-border">
                    <th className="p-3 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Artículo</th>
                    <th className="p-3 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-right">Cant.</th>
                    <th className="p-3 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Unidad</th>
                    {data.type === 'receipt' && (
                      <th className="p-3 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-right">Costo U.</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.lines.map((line: any, i: number) => (
                    <tr key={i} className="hover:bg-surface-raised/50 transition-colors">
                      <td className="p-3">
                        <p className="text-sm font-bold text-text-primary">{line.itemName}</p>
                        {line.lot && <p className="text-[10px] text-text-secondary">Lote: {line.lot}</p>}
                      </td>
                      <td className="p-3 text-sm font-mono font-bold text-right">{line.qty}</td>
                      <td className="p-3 text-[11px] text-text-secondary">{line.uom}</td>
                      {data.type === 'receipt' && (
                        <td className="p-3 text-sm font-mono text-right text-text-primary">
                          ${Number(line.cost || 0).toFixed(2)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.notes && (
            <div className="p-4 bg-surface-raised rounded-2xl border border-border">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5">Observaciones</p>
              <p className="text-sm text-text-primary leading-relaxed">{data.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-surface-raised border-t border-border flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 h-11 bg-surface border border-border text-text-primary rounded-xl font-bold text-sm hover:bg-surface-raised transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
