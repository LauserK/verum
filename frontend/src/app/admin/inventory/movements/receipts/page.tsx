'use client';

import { useState, useEffect, useRef } from 'react';
import { adminApi, Warehouse, InventoryItem, UOMPresentation, PurchaseReceiptLine } from '@/lib/api';
import { Plus, Trash2, Save, Loader2, ArrowLeft, ClipboardList, Printer, Search, Calendar, Package } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ConfirmationModal from '@/components/ConfirmationModal';
import { createClient } from '@/utils/supabase/client';
import { useReactToPrint } from 'react-to-print';
import { MovementPrint } from '@/components/inventory/MovementPrint';
import { useTranslations } from '@/components/I18nProvider';

export default function ReceiptsPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [profile, setProfile] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [itemPresentations, setItemPresentations] = useState<Record<string, UOMPresentation[]>>({});
  const [warehouseId, setWarehouseId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [lines, setLines] = useState<(Partial<PurchaseReceiptLine> & { searchQuery?: string; showSuggestions?: boolean })[]>([
    { item_id: '', qty_presentation: 0, unit_cost_presentation: 0, presentation_id: '', searchQuery: '', showSuggestions: false }
  ]);

  // Printing state
  const printRef = useRef<HTMLDivElement>(null);
  const [lastSavedData, setLastSavedData] = useState<any>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ingreso-${receiptNumber || 'S-N'}`,
    onAfterPrint: () => router.push('/admin/inventory/kardex')
  });

  // Error modal state
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: ''
  });

  useEffect(() => {
    if (lastSavedData && printRef.current) {
        handlePrint();
    }
  }, [lastSavedData]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [whData, itemsData, profileData] = await Promise.all([
        adminApi.getInventoryWarehouses(),
        adminApi.getInventoryItems(),
        adminApi.getProfile()
      ]);
      setWarehouses(whData);
      setItems(itemsData);
      setProfile(profileData);

      if (whData.length > 0) setWarehouseId(whData[0].id);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleItemSelect(index: number, item: InventoryItem) {
    const newLines = [...lines];
    newLines[index].item_id = item.id;
    newLines[index].searchQuery = item.name;
    newLines[index].showSuggestions = false;
    newLines[index].presentation_id = '';
    
    if (!itemPresentations[item.id]) {
        try {
            const supabase = createClient();
            const { data } = await supabase.from('uom_presentations').select('*').eq('base_uom_id', item.base_uom_id);
            if (data && data.length > 0) {
                setItemPresentations(prev => ({ ...prev, [item.id]: data as UOMPresentation[] }));
            }
        } catch (e) {
            console.error('Error fetching presentations:', e);
        }
    }
    
    setLines(newLines);
  }

  function addLine() {
    setLines([...lines, { item_id: '', qty_presentation: 0, unit_cost_presentation: 0, presentation_id: '', searchQuery: '', showSuggestions: false }]);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  async function handleSave(shouldPrint = false) {
    if (!warehouseId || lines.some(l => !l.item_id || !l.qty_presentation)) {
        setErrorModal({
            isOpen: true,
            message: 'Por favor completa todos los campos obligatorios (Almacén, Artículo y Cantidad).'
        });
        return;
    }

    setSaving(true);
    try {
      const cleanedLines = lines.map(line => ({
        item_id: line.item_id,
        presentation_id: line.presentation_id === '' ? null : line.presentation_id,
        qty_presentation: Number(line.qty_presentation),
        unit_cost_presentation: Number(line.unit_cost_presentation),
        expiry_date: line.expiry_date || null,
        lot_number: line.lot_number || null
      }));

      const res = await adminApi.createPurchaseReceipt({
        warehouse_id: warehouseId,
        supplier,
        receipt_number: receiptNumber,
        date: receiptDate,
        lines: cleanedLines as PurchaseReceiptLine[]
      });

      if (shouldPrint) {
        const warehouse = warehouses.find(w => w.id === warehouseId);
        setLastSavedData({
            id: res.id,
            warehouseName: warehouse?.name || 'Almacén',
            supplier,
            receiptNumber,
            date: receiptDate,
            createdAt: new Date().toISOString(),
            createdBy: profile?.full_name || 'Usuario',
            lines: cleanedLines.map(l => {
                const item = items.find(i => i.id === l.item_id);
                const presentation = l.presentation_id ? itemPresentations[l.item_id!]?.find(p => p.id === l.presentation_id) : null;
                return {
                    itemName: item?.name || 'Artículo',
                    qty: l.qty_presentation,
                    uom: presentation ? presentation.name : (item?.uom_name || 'Unidad'),
                    cost: l.unit_cost_presentation,
                    lot: l.lot_number
                };
            })
        });
      } else {
        router.push('/admin/inventory/kardex');
      }
    } catch (error: any) {
      setErrorModal({
        isOpen: true,
        message: error.message || 'Error inesperado al guardar el ingreso. Por favor intenta de nuevo.'
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Fecha del Documento</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input 
                type="date" 
                value={receiptDate}
                onChange={e => setReceiptDate(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-11 text-sm text-text-primary outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Almacén de Destino</label>
            <select 
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary appearance-none"
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
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-surface-raised p-4 rounded-xl border border-border group transition-all hover:border-primary/30">
                {/* Autocomplete Articulo */}
                <div className="md:col-span-4 relative">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Artículo</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
                        <input 
                            type="text"
                            value={line.searchQuery}
                            onFocus={() => {
                                const newLines = [...lines];
                                newLines[index].showSuggestions = true;
                                setLines(newLines);
                            }}
                            onChange={e => {
                                const newLines = [...lines];
                                newLines[index].searchQuery = e.target.value;
                                newLines[index].showSuggestions = true;
                                if (!e.target.value) newLines[index].item_id = '';
                                setLines(newLines);
                            }}
                            placeholder="Buscar artículo..."
                            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 h-10 text-sm outline-none focus:border-primary"
                        />
                    </div>
                    
                    {line.showSuggestions && (line.searchQuery || "").length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto">
                            {items
                                .filter(item => 
                                    item.name.toLowerCase().includes((line.searchQuery || "").toLowerCase()) ||
                                    item.code?.toLowerCase().includes((line.searchQuery || "").toLowerCase())
                                )
                                .map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleItemSelect(index, item)}
                                        className="w-full text-left px-4 py-3 hover:bg-surface-raised border-b border-border last:border-0 flex items-center gap-3"
                                    >
                                        <Package className="w-4 h-4 text-primary" />
                                        <div>
                                            <p className="text-sm font-medium text-text-primary">{item.name}</p>
                                            <p className="text-[10px] text-text-secondary uppercase">{item.code} • {item.uom_name}</p>
                                        </div>
                                    </button>
                                ))
                            }
                        </div>
                    )}
                </div>

                {/* Cantidad y Unidad Lado a Lado */}
                <div className="md:col-span-3 flex gap-1">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Cant.</label>
                        <input 
                            type="number"
                            value={line.qty_presentation || ''}
                            onChange={e => {
                                const newLines = [...lines];
                                newLines[index].qty_presentation = parseFloat(e.target.value);
                                setLines(newLines);
                            }}
                            className="w-full bg-surface border border-border rounded-lg px-3 h-10 text-sm outline-none focus:border-primary"
                            placeholder="0"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Unidad</label>
                        <select 
                            value={line.presentation_id || ''}
                            onChange={e => {
                                const newLines = [...lines];
                                newLines[index].presentation_id = e.target.value;
                                setLines(newLines);
                            }}
                            className="w-full bg-surface border border-border rounded-lg px-2 h-10 text-[11px] outline-none focus:border-primary appearance-none cursor-pointer"
                            disabled={!line.item_id}
                        >
                            <option value="">{items.find(i => i.id === line.item_id)?.uom_name || t('inventory.items.uomBaseFallback')}</option>
                            {line.item_id && itemPresentations[line.item_id]?.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Costo Unitario */}
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Costo Unit.</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-sm">$</span>
                        <input 
                            type="number"
                            value={line.unit_cost_presentation || ''}
                            onChange={e => {
                                const newLines = [...lines];
                                newLines[index].unit_cost_presentation = parseFloat(e.target.value);
                                setLines(newLines);
                            }}
                            className="w-full bg-surface border border-border rounded-lg pl-7 pr-3 h-10 text-sm outline-none focus:border-primary"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                {/* Vencimiento Opcional */}
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Vencimiento (Opc.)</label>
                    <input 
                        type={line.expiry_date ? "date" : "text"}
                        value={line.expiry_date || ''}
                        onFocus={(e) => (e.target.type = "date")}
                        onBlur={(e) => {
                            if (!e.target.value) e.target.type = "text";
                        }}
                        onChange={e => {
                            const newLines = [...lines];
                            newLines[index].expiry_date = e.target.value;
                            setLines(newLines);
                        }}
                        placeholder="Sin vencimiento"
                        className="w-full bg-surface border border-border rounded-lg px-2 h-10 text-[11px] outline-none focus:border-primary"
                    />
                </div>

                {/* Eliminar Fila */}
                <div className="md:col-span-1 flex justify-center pb-1">
                    <button 
                        onClick={() => removeLine(index)}
                        className="p-2.5 text-error hover:bg-error/10 rounded-xl transition-colors"
                        disabled={lines.length === 1}
                        title="Eliminar fila"
                    >
                        <Trash2 className="w-4.5 h-4.5" />
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-border flex flex-col md:flex-row justify-end gap-3">
            <button 
                onClick={() => router.back()}
                className="px-6 h-11 border border-border text-text-primary rounded-xl font-bold text-sm hover:bg-surface-raised transition-all"
            >
                {t('common.cancel')}
            </button>
            <button 
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-6 h-11 border border-primary text-primary rounded-xl font-bold text-sm hover:bg-primary/5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Confirmar Ingreso
            </button>
            <button 
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-8 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Confirmar e Imprimir
            </button>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={errorModal.isOpen}
        title="Error al registrar"
        message={errorModal.message}
        confirmLabel="Entendido"
        cancelLabel=""
        onConfirm={() => setErrorModal({ ...errorModal, isOpen: false })}
        onCancel={() => setErrorModal({ ...errorModal, isOpen: false })}
      />

      {/* Hidden print container */}
      <div className="hidden">
        {lastSavedData && (
          <MovementPrint 
            ref={printRef}
            type="receipt"
            data={lastSavedData}
          />
        )}
      </div>
    </div>
  );
}
