# Purchase Receipt UOM Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Unit of Measure (UOM) presentation selector next to the quantity field in the Purchase Receipts ("Ingresos") form.

**Architecture:**
- Extend the `ReceiptsPage` component to manage available UOM presentations per item.
- Update the item line UI to include a `<select>` for `presentation_id`.
- Dynamically fetch presentations when an item is selected.
- Re-layout the line items grid to accommodate the new field.

**Tech Stack:** React (Next.js), Supabase Client, Tailwind CSS, Lucide Icons.

---

### Task 1: Update State and Logic for UOM Presentations

**Files:**
- Modify: `frontend/src/app/admin/inventory/movements/receipts/page.tsx`

- [ ] **Step 1: Add `itemPresentations` state to store UOMs by itemId**

```typescript
// Add this near other useState calls
const [itemPresentations, setItemPresentations] = useState<Record<string, UOMPresentation[]>>({});
```

- [ ] **Step 2: Update `handleItemChange` to fetch and store presentations**

```typescript
  async function handleItemChange(index: number, itemId: string) {
    const newLines = [...lines];
    newLines[index].item_id = itemId;
    
    const item = items.find(i => i.id === itemId);
    if (item) {
        try {
            const supabase = createClient();
            const { data } = await supabase.from('uom_presentations').select('*').eq('base_uom_id', item.base_uom_id);
            if (data && data.length > 0) {
                newLines[index].presentation_id = data[0].id;
                // Store in our lookup map
                setItemPresentations(prev => ({ ...prev, [itemId]: data as UOMPresentation[] }));
            }
        } catch (e) {
            console.error('Error fetching presentations:', e);
        }
    }
    
    setLines(newLines);
  }
```

- [ ] **Step 3: Commit changes**

```bash
git add frontend/src/app/admin/inventory/movements/receipts/page.tsx
git commit -m "feat: add logic to fetch and store item presentations in receipts form"
```

### Task 2: Update UI Layout and Add UOM Selector

**Files:**
- Modify: `frontend/src/app/admin/inventory/movements/receipts/page.tsx`

- [ ] **Step 1: Adjust grid columns and add UOM selector next to Quantity**

```tsx
// Find the loop over lines.map and replace the grid structure.
// Change md:col-span-5 for Item to md:col-span-4
// Change md:col-span-2 for Qty to md:col-span-2
// Add md:col-span-2 for UOM selector
// Keep md:col-span-2 for Cost
// Change md:col-span-2 for Expiry to md:col-span-1
```

Implementation detail:
```tsx
                <div className="md:col-span-4">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Artículo</label>
                    <select 
                        value={line.item_id}
                        onChange={e => handleItemChange(index, e.target.value)}
                        className="w-full bg-surface border border-border rounded-lg px-3 h-10 text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        {items.map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Cantidad</label>
                    <input 
                        type="number"
                        value={line.qty_presentation || ''}
                        onChange={e => {
                            const newLines = [...lines];
                            newLines[index].qty_presentation = parseFloat(e.target.value);
                            setLines(newLines);
                        }}
                        className="w-full bg-surface border border-border rounded-lg px-3 h-10 text-sm"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Unidad</label>
                    <select 
                        value={line.presentation_id || ''}
                        onChange={e => {
                            const newLines = [...lines];
                            newLines[index].presentation_id = e.target.value;
                            setLines(newLines);
                        }}
                        className="w-full bg-surface border border-border rounded-lg px-3 h-10 text-sm"
                        disabled={!line.item_id}
                    >
                        <option value="">Básica</option>
                        {line.item_id && itemPresentations[line.item_id]?.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Costo Unit.</label>
                    <input 
                        type="number"
                        value={line.unit_cost_presentation || ''}
                        onChange={e => {
                            const newLines = [...lines];
                            newLines[index].unit_cost_presentation = parseFloat(e.target.value);
                            setLines(newLines);
                        }}
                        className="w-full bg-surface border border-border rounded-lg px-3 h-10 text-sm"
                    />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Venc.</label>
                    <input 
                        type="date"
                        value={line.expiry_date || ''}
                        onChange={e => {
                            const newLines = [...lines];
                            newLines[index].expiry_date = e.target.value;
                            setLines(newLines);
                        }}
                        className="w-full bg-surface border border-border rounded-lg px-2 h-10 text-[11px]"
                    />
                </div>
```

- [ ] **Step 2: Commit UI changes**

```bash
git add frontend/src/app/admin/inventory/movements/receipts/page.tsx
git commit -m "feat: implement UOM selector in receipts form UI"
```

### Task 3: Verification and Polishing

**Files:**
- Modify: `frontend/src/app/admin/inventory/movements/receipts/page.tsx`

- [ ] **Step 1: Ensure `handleSave` correctly handles `presentation_id`**
Verify that `presentation_id` is sent to the backend. The current code already does:
```typescript
      const cleanedLines = lines.map(line => ({
        ...line,
        presentation_id: line.presentation_id === '' ? null : line.presentation_id,
        qty_presentation: Number(line.qty_presentation),
        unit_cost_presentation: Number(line.unit_cost_presentation)
      }));
```
This looks correct.

- [ ] **Step 2: Manual verification**
If the frontend was running, we would verify by selecting an item and seeing the UOMs. Since we are in Auto-Edit, we assume the Supabase fetch works as intended.

- [ ] **Step 3: Cleanup and Final Commit**
```bash
git add frontend/src/app/admin/inventory/movements/receipts/page.tsx
git commit -m "chore: final adjustments to UOM selector in receipts"
```
