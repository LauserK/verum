// frontend/src/components/inventory/PrintConfigModal.tsx
import { X, Grid2X2, Grid3X3, LayoutGrid } from 'lucide-react';
import { useTranslations } from '@/components/I18nProvider';

interface PrintConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: { rows: number; cols: number }) => void;
  totalAssets: number;
}

export function PrintConfigModal({ isOpen, onClose, onConfirm, totalAssets }: PrintConfigModalProps) {
  const { t } = useTranslations();
  if (!isOpen) return null;

  const options = [
    { label: '2x2 (4 por hoja)', rows: 2, cols: 2, icon: Grid2X2 },
    { label: '3x3 (9 por hoja)', rows: 3, cols: 3, icon: Grid3X3 },
    { label: '4x4 (16 por hoja)', rows: 4, cols: 4, icon: LayoutGrid },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">Configurar Impresión</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:bg-surface-raised rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-primary/5 text-primary text-sm rounded-xl border border-primary/20">
          Se imprimirán <strong>{totalAssets}</strong> códigos QR.
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-text-secondary">Selecciona la distribución:</label>
          <div className="grid grid-cols-1 gap-2">
            {options.map((opt) => (
              <button
                key={opt.label}
                onClick={() => onConfirm({ rows: opt.rows, cols: opt.cols })}
                className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <opt.icon className="w-5 h-5 text-primary" />
                <span className="font-medium text-text-primary">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full h-12 rounded-xl font-semibold text-sm border border-border text-text-primary hover:bg-surface-raised transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
