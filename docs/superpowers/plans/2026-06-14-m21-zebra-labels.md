# M21-PRD: Etiquetado Formato Carta (Stickers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a dynamic label configuration modal and a printable Letter/A4 layout (using CSS Grid and `react-to-print`) to generate product stickers directly from the browser.

**Architecture:** 
1. Database migration for label tracking.
2. Backend endpoint to update printed status.
3. Frontend modal allowing operators to define mixed label batches (e.g., 8 labels of 800g, 1 label of 500g).
4. Frontend print component generating a grid of stickers suitable for standard office printers.

**Tech Stack:** Python (FastAPI), Supabase (PostgreSQL), TypeScript (Next.js, Tailwind CSS, `react-to-print`, `qrcode.react`).

---

### Task 1: Database Migration & Backend Endpoint

**Files:**
- Create: `backend/migrations/037_label_tracking.sql`
- Modify: `backend/main.py`

- [ ] **Step 1: Create the SQL migration**

```sql
-- backend/migrations/037_label_tracking.sql
alter table production_lots add column if not exists label_printed boolean default false;
```

- [ ] **Step 2: Run the migration**
Use the python DB client to execute the migration:
```bash
backend/.venv/Scripts/python.exe -c "
import os
from dotenv import load_dotenv
from database import supabase
load_dotenv('backend/.env')

with open('backend/migrations/037_label_tracking.sql', 'r') as f:
    sql = f.read()

# Execute migration...
"
```

- [ ] **Step 3: Implement Backend Endpoint**

```python
# In backend/main.py, near production endpoints
@app.patch("/production/lots/{lot_id}/printed", tags=["Production"])
async def mark_lot_printed(
    lot_id: str,
    db=Depends(get_db),
    _=Depends(require_permission("production.execute"))
):
    res = db.table("production_lots").update({"label_printed": True}).eq("id", lot_id).execute()
    return {"ok": True}
```

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/037_label_tracking.sql backend/main.py
git commit -m "feat(backend): add label_printed tracking to production lots"
```

---

### Task 2: Frontend API and Print Layout Component

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/production/LabelsPrintLayout.tsx`

- [ ] **Step 1: Update API client**

```typescript
// In frontend/src/lib/api.ts (add to adminApi)
    markLotPrinted: (lotId: string): Promise<any> =>
        fetchWithAuth(`/production/lots/${lotId}/printed`, { method: 'PATCH' }),
```

- [ ] **Step 2: Create Print Layout Component**

```tsx
// frontend/src/components/production/LabelsPrintLayout.tsx
import React, { forwardRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { format, addDays } from 'date-fns'

interface LabelConfig {
    quantity: number
    weight: number
}

interface LabelsPrintLayoutProps {
    itemName: string
    lotNumber: string
    productionDate: string
    shelfLifeDays?: number | null
    uomName: string
    configs: LabelConfig[]
}

export const LabelsPrintLayout = forwardRef<HTMLDivElement, LabelsPrintLayoutProps>(({
    itemName, lotNumber, productionDate, shelfLifeDays, uomName, configs
}, ref) => {
    // Generate array of individual labels based on config
    const labels: number[] = []
    configs.forEach(conf => {
        for(let i = 0; i < conf.quantity; i++) {
            labels.push(conf.weight)
        }
    })

    const prodDate = new Date(productionDate)
    const expDate = shelfLifeDays ? addDays(prodDate, shelfLifeDays) : null

    return (
        <div className="hidden">
            <div ref={ref} className="print:block p-8 bg-white text-black w-full" style={{ width: '210mm' }}>
                <div className="grid grid-cols-2 gap-x-8 gap-y-12">
                    {labels.map((weight, idx) => (
                        <div key={idx} className="border-2 border-black rounded-2xl p-6 flex flex-col justify-between" style={{ height: '130mm' }}>
                            <div className="text-center mb-4">
                                <h1 className="text-4xl font-black uppercase tracking-tight leading-none mb-2">{itemName}</h1>
                                <p className="text-xl font-bold uppercase border-t-2 border-b-2 border-black py-2 mt-2">
                                    Contenido: {weight} {uomName}
                                </p>
                            </div>
                            
                            <div className="flex justify-between items-center my-6">
                                <div className="space-y-3 flex-1 pr-4">
                                    <div>
                                        <p className="text-xs uppercase font-bold text-gray-600">Lote</p>
                                        <p className="text-2xl font-mono font-black">{lotNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase font-bold text-gray-600">Elaboración</p>
                                        <p className="text-xl font-bold">{format(prodDate, 'dd/MM/yyyy')}</p>
                                    </div>
                                    {expDate && (
                                        <div>
                                            <p className="text-xs uppercase font-bold text-gray-600">Vencimiento</p>
                                            <p className="text-xl font-bold">{format(expDate, 'dd/MM/yyyy')}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-2 border-4 border-black rounded-xl">
                                    <QRCodeSVG value={lotNumber} size={120} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
})
LabelsPrintLayout.displayName = 'LabelsPrintLayout'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/components/production/LabelsPrintLayout.tsx
git commit -m "feat(frontend): add letter format print layout for production stickers"
```

---

### Task 3: Frontend Label Configuration Modal

**Files:**
- Create: `frontend/src/components/production/LabelConfigModal.tsx`

- [ ] **Step 1: Implement Modal**

```tsx
// frontend/src/components/production/LabelConfigModal.tsx
import React, { useState, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { X, Plus, Trash2, Printer } from 'lucide-react'
import { LabelsPrintLayout } from './LabelsPrintLayout'
import { adminApi } from '@/lib/api'

interface LabelConfigModalProps {
    isOpen: boolean
    onClose: () => void
    producedLotId: string
    lotNumber: string
    itemName: string
    productionDate: string
    shelfLifeDays?: number | null
    uomName: string
    totalProduced: number
}

export function LabelConfigModal(props: LabelConfigModalProps) {
    const [configs, setConfigs] = useState([{ quantity: 1, weight: props.totalProduced }])
    const printRef = useRef<HTMLDivElement>(null)

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        onAfterPrint: async () => {
            try {
                await adminApi.markLotPrinted(props.producedLotId)
            } catch (e) {
                console.error("Error marking lot as printed", e)
            }
            props.onClose()
        }
    })

    if (!props.isOpen) return null

    const totalConfigured = configs.reduce((acc, c) => acc + (c.quantity * c.weight), 0)
    const difference = Math.abs(totalConfigured - props.totalProduced)
    const hasWarning = difference > 0.01

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-surface rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 border-b border-border flex justify-between items-center bg-surface-raised/30">
                    <div>
                        <h2 className="text-xl font-black">Configurar Etiquetas</h2>
                        <p className="text-sm text-text-secondary mt-1">Lote: {props.lotNumber}</p>
                    </div>
                    <button onClick={props.onClose} className="p-2 hover:bg-surface-raised rounded-xl transition-colors"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    <div className="flex justify-between items-center p-4 bg-surface-raised rounded-2xl border border-border">
                        <span className="text-sm font-bold text-text-secondary uppercase">Rendimiento Real:</span>
                        <span className="text-2xl font-black text-primary">{props.totalProduced} <span className="text-base">{props.uomName}</span></span>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-black text-text-secondary uppercase tracking-widest">Distribución</label>
                            <button onClick={() => setConfigs([...configs, { quantity: 1, weight: 0 }])} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                                <Plus className="w-3 h-3"/> Agregar Fila
                            </button>
                        </div>
                        
                        {configs.map((conf, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className="flex-1">
                                    <label className="block text-[10px] uppercase font-bold text-text-secondary mb-1">Stickers</label>
                                    <input type="number" min="1" value={conf.quantity} onChange={e => {
                                        const newConf = [...configs]; newConf[idx].quantity = Number(e.target.value); setConfigs(newConf)
                                    }} className="w-full h-10 px-3 bg-surface border border-border rounded-xl font-mono text-center" />
                                </div>
                                <span className="mt-5 text-text-secondary font-bold">x</span>
                                <div className="flex-[2]">
                                    <label className="block text-[10px] uppercase font-bold text-text-secondary mb-1">Peso/Contenido ({props.uomName})</label>
                                    <input type="number" min="0" step="0.01" value={conf.weight} onChange={e => {
                                        const newConf = [...configs]; newConf[idx].weight = Number(e.target.value); setConfigs(newConf)
                                    }} className="w-full h-10 px-3 bg-surface border border-border rounded-xl font-mono text-right" />
                                </div>
                                <div className="flex-1 pt-5 text-right font-mono font-bold text-text-secondary">
                                    = {conf.quantity * conf.weight}
                                </div>
                                <div className="pt-5">
                                    <button onClick={() => setConfigs(configs.filter((_, i) => i !== idx))} className="p-2 text-error hover:bg-error/10 rounded-lg">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className={`p-4 rounded-2xl flex justify-between items-center border ${hasWarning ? 'bg-warning/10 border-warning/20' : 'bg-success/10 border-success/20'}`}>
                        <span className={`text-xs font-bold uppercase ${hasWarning ? 'text-warning' : 'text-success'}`}>
                            {hasWarning ? 'Diferencia Detectada' : 'Distribución Exacta'}
                        </span>
                        <span className={`font-mono font-black ${hasWarning ? 'text-warning' : 'text-success'}`}>
                            Total: {totalConfigured} {props.uomName}
                        </span>
                    </div>
                </div>

                <div className="p-6 border-t border-border flex gap-3 bg-surface-raised/30">
                    <button onClick={props.onClose} className="flex-1 py-3 font-bold text-text-secondary border border-border rounded-xl hover:bg-surface-raised">Cancelar</button>
                    <button onClick={() => handlePrint()} className="flex-1 py-3 font-bold bg-primary text-text-inverse rounded-xl flex items-center justify-center gap-2">
                        <Printer className="w-4 h-4"/> Generar {configs.reduce((a,c) => a + c.quantity, 0)} Etiquetas
                    </button>
                </div>
            </div>

            <LabelsPrintLayout 
                ref={printRef}
                itemName={props.itemName}
                lotNumber={props.lotNumber}
                productionDate={props.productionDate}
                shelfLifeDays={props.shelfLifeDays}
                uomName={props.uomName}
                configs={configs}
            />
        </div>
    )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/production/LabelConfigModal.tsx
git commit -m "feat(frontend): create label configuration modal for dynamic sticker weights"
```

---

### Task 4: Frontend - Integration in KDS and Orders

**Files:**
- Modify: `frontend/src/app/production/kds/page.tsx`
- Modify: `frontend/src/app/admin/production/orders/page.tsx`

- [ ] **Step 1: Integrate in KDS post-completion**

```tsx
// In KDSPage, import LabelConfigModal
// Add states:
const [printLotData, setPrintLotData] = useState<any>(null);

// In handleFinalize (success path):
// Instead of just clearing selectedOrder, fetch the lot generated and setPrintLotData
// e.g. after completeProductionOrder:
const detail = await adminApi.getProductionOrderDetail(completingOrder.id);
if (detail.produced_lots && detail.produced_lots.length > 0) {
    setPrintLotData({
        producedLotId: detail.produced_lots[0].id, // Need to ensure backend sends lot ID, or adjust
        lotNumber: detail.produced_lots[0].lot_number,
        itemName: detail.items?.name,
        productionDate: detail.completed_at || new Date().toISOString(),
        shelfLifeDays: detail.items?.shelf_life_days, // Ensure schema includes this
        uomName: detail.items?.uom_base?.name,
        totalProduced: detail.qty_produced_base
    });
}
// Clear other states

// In render:
{printLotData && (
    <LabelConfigModal 
        isOpen={true}
        onClose={() => setPrintLotData(null)}
        {...printLotData}
    />
)}
```

- [ ] **Step 2: Integrate in Orders History detail**

```tsx
// In admin/production/orders/page.tsx
// Add import and state for LabelConfigModal
// Add a "Imprimir Etiquetas" button in the Detail Modal header
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/production/kds/page.tsx frontend/src/app/admin/production/orders/page.tsx
git commit -m "feat(frontend): integrate label printing in KDS and history views"
```
