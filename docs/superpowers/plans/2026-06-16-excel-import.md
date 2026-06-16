# Excel Import Utility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a temporary utility page at `/admin/inventory/import-utility` to bulk import items from an Excel file (Columns A, B, C, K).

**Architecture:** 
- React state-managed preview table for parsed data.
- Column mapping: A->code, B->category, C->name, K->last_purchase_cost.
- Global config for `type` and `base_uom_id`.
- Sequential API calls for creation.

**Tech Stack:** Next.js (App Router), Lucide Icons, Tailwind CSS, `xlsx` library.

---

### Task 1: Create the Page Structure and Data Fetching

**Files:**
- Create: `frontend/src/app/admin/inventory/import-utility/page.tsx`

- [ ] **Step 1: Scaffold the page with basic imports and state**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { adminApi, ItemCategory, UOMBase, InventoryItem } from '@/lib/api';
import { useTranslations } from '@/components/I18nProvider';
import { 
  FileUp, 
  Table, 
  Settings2, 
  Save, 
  Loader2, 
  X, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function ImportUtilityPage() {
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [uoms, setUoms] = useState<UOMBase[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadData() {
      try {
        const [cats, uomList] = await Promise.all([
          adminApi.getItemCategories(),
          adminApi.getUOMBase()
        ]);
        setCategories(cats);
        setUoms(uomList);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
       <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/inventory/items" className="p-2 hover:bg-surface-raised rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Utilidad de Importación Excel</h1>
          <p className="text-sm text-text-secondary mt-1">Herramienta temporal para carga masiva de artículos</p>
        </div>
      </div>
      {/* File Upload Section */}
    </div>
  );
}
```

- [ ] **Step 2: Implement File Upload and Parsing Logic**

Add state for parsed data and the file handler:

```tsx
interface ParsedRow {
  id: string;
  code: string;
  categoryName: string;
  categoryId: string | null;
  name: string;
  price: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

// Inside component:
const [data, setData] = useState<ParsedRow[]>([]);
const [globalType, setGlobalType] = useState<string>('raw_material');
const [globalUom, setGlobalUom] = useState<string>('');

const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const bstr = evt.target?.result;
    const wb = XLSX.read(bstr, { type: 'binary' });
    const wsname = wb.SheetNames[0];
    const ws = wb.Sheets[wsname];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    // Skip header row if needed (assuming row 1 is data or has headers)
    const rows = json.slice(1).map((row, idx) => {
      const catName = String(row[1] || '').trim();
      const matchedCat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        code: String(row[0] || '').trim(),
        categoryName: catName,
        categoryId: matchedCat?.id || null,
        name: String(row[2] || '').trim(),
        price: Number(row[10]) || 0,
        status: 'pending' as const,
      };
    }).filter(r => r.name); // Filter empty names

    setData(rows);
  };
  reader.readAsBinaryString(file);
};
```

### Task 2: Build the Preview Table and Global Config

- [ ] **Step 1: Render Global Settings and File Input**

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
  <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm">
    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-3">Paso 1: Seleccionar Archivo</label>
    <div className="relative">
      <input 
        type="file" 
        accept=".xlsx, .xls" 
        onChange={handleFileUpload}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-primary transition-colors">
        <FileUp className="w-8 h-8 text-text-disabled" />
        <span className="text-sm text-text-secondary font-medium">Click para subir Excel</span>
      </div>
    </div>
  </div>

  <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm md:col-span-2">
    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-3">Paso 2: Configuración Global</label>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-xs text-text-secondary mb-1 block">Tipo de Artículo</label>
        <select 
          value={globalType}
          onChange={e => setGlobalType(e.target.value)}
          className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary outline-none transition-all"
        >
          <option value="raw_material">Materia Prima</option>
          <option value="semi_finished">Semielaborado</option>
          <option value="finished">Producto Terminado</option>
          <option value="supply">Insumo</option>
          <option value="packaging">Empaque</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-text-secondary mb-1 block">Unidad Base (Global)</label>
        <select 
          value={globalUom}
          onChange={e => setGlobalUom(e.target.value)}
          className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary outline-none transition-all"
        >
          <option value="">Seleccionar UOM...</option>
          {uoms.map(u => (
            <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
          ))}
        </select>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Render the Editable Preview Table**

```tsx
{data.length > 0 && (
  <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
    <div className="overflow-x-auto max-h-[500px]">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-raised shadow-sm">
          <tr className="border-b border-border">
            <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Estado</th>
            <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Código (A)</th>
            <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Nombre (C)</th>
            <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Categoría (B)</th>
            <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Precio (K)</th>
            <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row, idx) => (
            <tr key={row.id} className="hover:bg-surface-raised/50 transition-colors">
              <td className="p-4">
                {row.status === 'pending' && <div className="w-2 h-2 rounded-full bg-text-disabled" />}
                {row.status === 'success' && <CheckCircle2 className="w-5 h-5 text-success" />}
                {row.status === 'error' && <AlertCircle className="w-5 h-5 text-error" title={row.error} />}
              </td>
              <td className="p-2">
                <input 
                  value={row.code}
                  onChange={e => {
                    const newData = [...data];
                    newData[idx].code = e.target.value;
                    setData(newData);
                  }}
                  className="w-full bg-transparent border-none text-sm text-text-primary focus:bg-surface rounded px-2 py-1 outline-none"
                />
              </td>
              <td className="p-2">
                <input 
                  value={row.name}
                  onChange={e => {
                    const newData = [...data];
                    newData[idx].name = e.target.value;
                    setData(newData);
                  }}
                  className="w-full bg-transparent border-none text-sm font-bold text-text-primary focus:bg-surface rounded px-2 py-1 outline-none"
                />
              </td>
              <td className="p-2">
                <select 
                  value={row.categoryId || ''}
                  onChange={e => {
                    const newData = [...data];
                    newData[idx].categoryId = e.target.value;
                    setData(newData);
                  }}
                  className="w-full bg-transparent border-none text-sm text-text-secondary focus:bg-surface rounded px-2 py-1 outline-none appearance-none"
                >
                  <option value="">(Seleccionar)</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </td>
              <td className="p-2">
                <input 
                  type="number"
                  value={row.price}
                  onChange={e => {
                    const newData = [...data];
                    newData[idx].price = Number(e.target.value);
                    setData(newData);
                  }}
                  className="w-24 bg-transparent border-none text-sm text-text-primary focus:bg-surface rounded px-2 py-1 outline-none"
                />
              </td>
              <td className="p-2">
                <button onClick={() => setData(data.filter(r => r.id !== row.id))} className="text-text-disabled hover:text-error">
                  <X className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}
```

### Task 3: Implement Import Execution

- [ ] **Step 1: Add Import Logic and Progress State**

```tsx
const [importing, setImporting] = useState(false);
const [progress, setProgress] = useState({ current: 0, total: 0 });

async function handleImport() {
  if (!globalUom) {
    alert('Seleccione una Unidad Base global primero');
    return;
  }
  
  setImporting(true);
  setProgress({ current: 0, total: data.length });

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row.status === 'success') continue;

    try {
      await adminApi.createInventoryItem({
        name: row.name,
        code: row.code || null,
        type: globalType as any,
        category_id: row.categoryId || null,
        base_uom_id: globalUom,
        last_purchase_cost: row.price || null
      });
      
      const newData = [...data];
      newData[i].status = 'success';
      setData(newData);
    } catch (err: any) {
      const newData = [...data];
      newData[i].status = 'error';
      newData[i].error = err.message;
      setData(newData);
    }
    setProgress(p => ({ ...p, current: i + 1 }));
  }
  setImporting(false);
}
```

- [ ] **Step 2: Add the Execution Button**

```tsx
<div className="flex justify-between items-center mt-6">
  <p className="text-sm text-text-secondary">
    {data.length} filas listas para importar.
  </p>
  <button 
    onClick={handleImport}
    disabled={importing || data.length === 0}
    className="bg-primary text-text-inverse px-8 h-12 rounded-xl font-bold flex items-center gap-3 hover:bg-primary-hover transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
  >
    {importing ? (
      <>
        <Loader2 className="w-5 h-5 animate-spin" />
        Importando ({progress.current}/{progress.total})
      </>
    ) : (
      <>
        <Save className="w-5 h-5" />
        Importar Todo
      </>
    )}
  </button>
</div>
```

### Task 4: Final Polish and Accessibility

- [ ] **Step 1: Add link to the utility in the main items page**

Modify `frontend/src/app/admin/inventory/items/page.tsx` to add a button/link next to "New Item".

```tsx
<Link 
    href="/admin/inventory/import-utility"
    className="flex items-center gap-2 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
>
    <FileUp className="w-4 h-4" />
    Importar Excel
</Link>
```

---
**Validation:**
- Test uploading a dummy file.
- Verify column mapping.
- Verify editable fields.
- Verify global config overrides.
- Verify successful import into `items` table.
