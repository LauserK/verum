'use client';

import { useState, useEffect, useRef } from 'react';
import { adminApi, Warehouse, InventoryItem, UOMPresentation, IssueDocument } from '@/lib/api';
import { Plus, Trash2, Save, Loader2, ArrowLeft, ClipboardList, ArrowDownRight, Printer, Search, Package, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ConfirmationModal from '@/components/ConfirmationModal';
import { createClient } from '@/utils/supabase/client';
import { useReactToPrint } from 'react-to-print';
import { MovementPrint } from '@/components/inventory/MovementPrint';
import { useTranslations } from '@/components/I18nProvider';

export default function IssuesPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [profile, setProfile] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [itemPresentations, setItemPresentations] = useState<Record<string, UOMPresentation[]>>({});
  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState('waste');
  const [notes, setNotes] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [lines, setLines] = useState<(Partial<{ item_id: string; qty_presentation: number; presentation_id: string | null; searchQuery: string; showSuggestions: boolean }>)[]>([
    { item_id: '', qty_presentation: 0, presentation_id: '', searchQuery: '', showSuggestions: false }
  ]);

  // Printing state
  const printRef = useRef<HTMLDivElement>(null);
  const [lastSavedData, setLastSavedData] = useState<any>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Egreso-${new Date().getTime()}`,
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
    setLines([...lines, { item_id: '', qty_presentation: 0, presentation_id: '', searchQuery: '', showSuggestions: false }]);
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
        item_id: line.item_id!,
        presentation_id: (line.presentation_id === '' || !line.presentation_id) ? null : line.presentation_id,
        qty_presentation: Number(line.qty_presentation)
      }));

      const res = await adminApi.createIssueDocument({
        warehouse_id: warehouseId,
        reason,
        notes,
        lines: cleanedLines
      });

      if (shouldPrint) {
        const warehouse = warehouses.find(w => w.id === warehouseId);
        const reasonLabels: any = { 
            waste: 'Merma / Desperdicio', 
            sale: 'Venta / Catering', 
            adjustment: 'Ajuste de Inventario', 
            internal_consumption: 'Consumo Interno',
            other: 'Otro' 
        };

        setLastSavedData({
            id: res.id,
            warehouseName: warehouse?.name || 'Almacén',
            reason: reasonLabels[reason] || reason,
            notes,
            createdAt: new Date().toISOString(),
            createdBy: profile?.full_name || 'Usuario',
            lines: cleanedLines.map(l => {
                const item = items.find(i => i.id === l.item_id);
                const presentation = l.presentation_id ? itemPresentations[l.item_id!]?.find(p => p.id === l.presentation_id) : null;
                return {
                    itemName: item?.name || 'Artículo',
                    qty: l.qty_presentation,
                    uom: presentation ? presentation.name : (item?.uom_name || 'Unidad')
                };
            })
        });
      } else {
        router.push('/admin/inventory/kardex');
      }
    } catch (error: any) {
      setErrorModal({
        isOpen: true,
        message: error.message || 'Error inesperado al registrar el egreso. Por favor intenta de nuevo.'
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
          <h1 className="text-2xl font-bold text-text-primary">Salida de Mercancía</h1>
          <p className="text-sm text-text-secondary">Registrar egreso por merma, ajuste o consumo</p>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Fecha</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input 
                type="date" 
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-11 text-sm text-text-primary outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Almacén de Origen</label>
            <select 
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary appearance-none cursor-pointer"
            >
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Motivo de Salida</label>
            <select 
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary appearance-none cursor-pointer"
            >
              <option value="waste">Merma / Desperdicio</option>
              <option value="sale">Venta / Catering</option>
              <option value="adjustment">Ajuste de Inventario</option>
              <option value="internal_consumption">Consumo Interno</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Notas / Observaciones</label>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-primary min-h-[80px]"
              placeholder="Ej: Producto dañado por refrigeración..."
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
                <div className="md:col-span-6 relative">
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
                <div className="md:col-span-5 flex gap-1">
                    <div className="flex-[2]">
                        <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Cant. a Retirar</label>
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
                Registrar Egreso
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
        title="Error al registrar egreso"
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
            type="issue"
            data={lastSavedData}
          />
        )}
      </div>
    </div>
  );
}
