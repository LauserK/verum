# Impresión Masiva de QRs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un sistema de impresión masiva de códigos QR para activos de inventario, permitiendo configurar la rejilla (2x2, 3x3, etc.) y optimizando el espacio en hojas tamaño Carta.

**Architecture:** Se creará un componente `BulkQRCodePrint` que organiza los QRs en una rejilla CSS y un `PrintConfigModal` para que el usuario elija la distribución antes de disparar el diálogo de impresión del navegador.

**Tech Stack:** React (Next.js), Tailwind CSS, Lucide React, react-to-print.

---

### Task 1: Componente BulkQRCodePrint

**Files:**
- Create: `frontend/src/components/inventory/BulkQRCodePrint.tsx`

- [ ] **Step 1: Crear el componente básico de impresión masiva**

```tsx
// frontend/src/components/inventory/BulkQRCodePrint.tsx
import { forwardRef } from 'react';
import { QRCodePrint } from './QRCodePrint';

interface Asset {
  id: string;
  name: string;
  qr_code: string;
  venue_id: string;
}

interface Venue {
  id: string;
  name: string;
}

interface BulkQRCodePrintProps {
  assets: Asset[];
  venues: Venue[];
  gridConfig: { rows: number; cols: number };
}

export const BulkQRCodePrint = forwardRef<HTMLDivElement, BulkQRCodePrintProps>(
  ({ assets, venues, gridConfig }, ref) => {
    return (
      <div ref={ref} className="bg-white p-[10mm] text-black w-full">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: letter;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
        `}} />
        <div 
          className="grid gap-4" 
          style={{ 
            gridTemplateColumns: `repeat(${gridConfig.cols}, 1fr)`,
            gridAutoRows: 'auto'
          }}
        >
          {assets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-center border border-gray-100 overflow-hidden" style={{ breakInside: 'avoid' }}>
              <div style={{ transform: `scale(${1 / Math.max(gridConfig.cols, gridConfig.rows/1.5)})`, transformOrigin: 'center' }}>
                <QRCodePrint 
                  asset={{
                    name: asset.name,
                    qr_code: asset.qr_code,
                    venueName: venues.find(v => v.id === asset.venue_id)?.name || 'Sede'
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

BulkQRCodePrint.displayName = 'BulkQRCodePrint';
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/inventory/BulkQRCodePrint.tsx
git commit -m "feat: add BulkQRCodePrint component"
```

---

### Task 2: Componente PrintConfigModal

**Files:**
- Create: `frontend/src/components/inventory/PrintConfigModal.tsx`

- [ ] **Step 1: Crear el modal de configuración de impresión**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/inventory/PrintConfigModal.tsx
git commit -m "feat: add PrintConfigModal component"
```

---

### Task 3: Integración en AssetsPage

**Files:**
- Modify: `frontend/src/app/admin/inventory/assets/page.tsx`

- [ ] **Step 1: Añadir imports y estados necesarios**

```tsx
// frontend/src/app/admin/inventory/assets/page.tsx
// Añadir imports al principio
import { BulkQRCodePrint } from '@/components/inventory/BulkQRCodePrint'
import { PrintConfigModal } from '@/components/inventory/PrintConfigModal'

// Dentro del componente AssetsPage
const [showPrintConfig, setShowPrintConfig] = useState(false)
const [gridConfig, setGridConfig] = useState({ rows: 2, cols: 2 })
const bulkPrintRef = useRef<HTMLDivElement>(null)

const handleBulkPrintTrigger = useReactToPrint({
  contentRef: bulkPrintRef,
  documentTitle: 'Inventario-QRs-Masivo',
  onAfterPrint: () => setShowPrintConfig(false)
})

const handleConfirmPrint = (config: { rows: number; cols: number }) => {
  setGridConfig(config)
  setTimeout(() => {
    handleBulkPrintTrigger()
  }, 200)
}
```

- [ ] **Step 2: Añadir el botón de impresión masiva**

```tsx
// Localizar el botón de "Nuevo Activo" y añadir el de impresión masiva al lado
<div className="flex gap-2">
  <button 
    onClick={() => setShowPrintConfig(true)}
    disabled={filteredAssets.length === 0}
    className="flex items-center gap-2 bg-surface border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors disabled:opacity-50"
  >
    <QrCode className="w-4 h-4" />
    Imprimir Filtrados
  </button>
  <button 
    onClick={() => { resetForm(); setShowCreate(true); }}
    className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
  >
    <Plus className="w-4 h-4" />
    {t('inventory.assets.newAsset')}
  </button>
</div>
```

- [ ] **Step 3: Renderizar el modal y el contenedor de impresión oculto**

```tsx
// Al final del return, antes de cerrar el div principal
<PrintConfigModal 
  isOpen={showPrintConfig}
  onClose={() => setShowPrintConfig(false)}
  onConfirm={handleConfirmPrint}
  totalAssets={filteredAssets.length}
/>

<div className="hidden">
  <div className="print-only">
    <BulkQRCodePrint 
      ref={bulkPrintRef}
      assets={filteredAssets}
      venues={venues}
      gridConfig={gridConfig}
    />
  </div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/inventory/assets/page.tsx
git commit -m "feat: integrate bulk printing in AssetsPage"
```

---

### Task 4: Verificación Final

- [ ] **Step 1: Probar filtros e impresión**
1. Filtrar activos por categoría o sede.
2. Hacer clic en "Imprimir Filtrados".
3. Elegir 3x3.
4. Verificar que en la vista previa del navegador aparezcan los activos filtrados en rejilla de 3x3.
5. Verificar que el tamaño sea Carta.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: finalize bulk printing implementation" --allow-empty
```
