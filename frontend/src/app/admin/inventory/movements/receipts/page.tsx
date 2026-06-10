'use client';

import { useState, useEffect } from 'react';
import { adminApi, Warehouse, InventoryItem, UOMPresentation, PurchaseReceiptLine } from '@/lib/api';
import { Plus, Trash2, Save, Loader2, ArrowLeft, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ReceiptsPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [presentations, setPresentations] = useState<Record<string, UOMPresentation[]>>({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [warehouseId, setWarehouseId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [lines, setLines] = useState<Partial<PurchaseReceiptLine>[]>([
    { item_id: '', qty_presentation: 0, unit_cost_presentation: 0, presentation_id: '' }
  ]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [whData, itemsData] = await Promise.all([
        adminApi.getInventoryWarehouses(),
        adminApi.getInventoryItems()
      ]);
      setWarehouses(whData);
      setItems(itemsData);
      if (whData.length > 0) setWarehouseId(whData[0].id);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleItemChange(index: number, itemId: string) {
    const newLines = [...lines];
    newLines[index].item_id = itemId;
    setLines(newLines);

    if (itemId && !presentations[itemId]) {
        // Fetch presentations for this item
        // For now, let's assume a simplified way to get them or just fetch all once
        // To keep it simple for M17, we'll fetch them on demand or use a generic list
        try {
            // In a real app, we'd have a specific endpoint for this
            // res = await adminApi.getItemPresentations(itemId)
            // For now, we'll mock or skip if not strictly required for the demo
        } catch (e) {}
    }
  }

  function addLine() {
    setLines([...lines, { item_id: '', qty_presentation: 0, unit_cost_presentation: 0, presentation_id: '' }]);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!warehouseId || lines.some(l => !l.item_id || !l.qty_presentation)) {
        alert('Por favor completa todos los campos obligatorios');
        return;
    }

    setSaving(true);
    try {
      await adminApi.createPurchaseReceipt({
        warehouse_id: warehouseId,
        supplier,
        receipt_number: receiptNumber,
        lines: lines as PurchaseReceiptLine[]
      });
      router.push('/admin/inventory/kardex');
    } catch (error) {
      alert('Error al guardar el ingreso');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/admin/inventory" className="p-2 hover:bg-surface-raised rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Ingreso de Mercancía</h1>
          <p className="text-sm text-text-secondary">Registrar entrada por compra o traspaso</p>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Almacén de Destino</label>
            <select 
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary"
            >
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Proveedor (Opcional)</label>
            <input 
              type="text" 
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary"
              placeholder="Ej: Distribuidora Central"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Nº Documento / Factura</label>
            <input 
              type="text" 
              value={receiptNumber}
              onChange={e => setReceiptNumber(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary"
              placeholder="Ej: FAC-12345"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" /> Detalle de Artículos
            </h3>
            <button 
                onClick={addLine}
                className="text-primary text-xs font-bold hover:underline flex items-center gap-1"
            >
                <Plus className="w-3 h-3" /> Agregar Fila
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-surface-raised p-4 rounded-xl border border-border group">
                <div className="md:col-span-5">
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
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Vencimiento</label>
                    <input 
                        type="date"
                        value={line.expiry_date || ''}
                        onChange={e => {
                            const newLines = [...lines];
                            newLines[index].expiry_date = e.target.value;
                            setLines(newLines);
                        }}
                        className="w-full bg-surface border border-border rounded-lg px-3 h-10 text-sm"
                    />
                </div>
                <div className="md:col-span-1 flex justify-center">
                    <button 
                        onClick={() => removeLine(index)}
                        className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                        disabled={lines.length === 1}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-border flex justify-end gap-3">
            <button 
                onClick={() => router.back()}
                className="px-6 h-11 border border-border text-text-primary rounded-xl font-bold text-sm hover:bg-surface-raised transition-all"
            >
                Cancelar
            </button>
            <button 
                onClick={handleSave}
                disabled={saving}
                className="px-8 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Confirmar Ingreso
            </button>
        </div>
      </div>
    </div>
  );
}
