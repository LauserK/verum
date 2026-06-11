'use client';

import { useState, useEffect } from 'react';
import { adminApi, Warehouse, InventoryItem, UOMPresentation } from '@/lib/api';
import { Plus, Trash2, Save, Loader2, ArrowLeft, ClipboardList, ArrowRightLeft, Search, Package, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ConfirmationModal from '@/components/ConfirmationModal';
import { createClient } from '@/utils/supabase/client';
import { useTranslations } from '@/components/I18nProvider';

export default function CreateTransferPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [itemPresentations, setItemPresentations] = useState<Record<string, UOMPresentation[]>>({});
  const [originWarehouseId, setOriginWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [lines, setLines] = useState<(Partial<{ item_id: string; qty_sent_presentation: number; presentation_id: string | null; searchQuery: string; showSuggestions: boolean }>)[]>([
    { item_id: '', qty_sent_presentation: 0, presentation_id: '', searchQuery: '', showSuggestions: false }
  ]);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: ''
  });

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
      if (whData.length > 0) {
        setOriginWarehouseId(whData[0].id);
        if (whData.length > 1) setDestinationWarehouseId(whData[1].id);
      }
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
    setLines([...lines, { item_id: '', qty_sent_presentation: 0, presentation_id: '', searchQuery: '', showSuggestions: false }]);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!originWarehouseId || !destinationWarehouseId || lines.some(l => !l.item_id || !l.qty_sent_presentation)) {
        setErrorModal({
            isOpen: true,
            message: 'Por favor completa todos los campos obligatorios (Origen, Destino, Artículo y Cantidad).'
        });
        return;
    }

    if (originWarehouseId === destinationWarehouseId) {
        setErrorModal({
            isOpen: true,
            message: 'El almacén de destino debe ser diferente al de origen.'
        });
        return;
    }

    setSaving(true);
    try {
      const payload = {
        origin_warehouse_id: originWarehouseId,
        destination_warehouse_id: destinationWarehouseId,
        notes,
        lines: lines.map(line => ({
          item_id: line.item_id!,
          presentation_id: line.presentation_id === '' ? null : line.presentation_id,
          qty_sent_presentation: Number(line.qty_sent_presentation)
        }))
      };

      await adminApi.createTransfer(payload);
      router.push('/admin/inventory/kardex');
    } catch (error: any) {
      setErrorModal({
        isOpen: true,
        message: error.message || 'Error inesperado al registrar el traslado.'
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4">
      <div className="flex items-center gap-4">
        <Link href="/admin/inventory/kardex" className="p-2 hover:bg-surface-raised rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nuevo Traslado entre Almacenes</h1>
          <p className="text-sm text-text-secondary">Registrar movimiento de mercancía entre ubicaciones</p>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Fecha del Traslado</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input 
                type="date" 
                value={transferDate}
                onChange={e => setTransferDate(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-11 text-sm text-text-primary outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Almacén de Origen</label>
            <select 
              value={originWarehouseId}
              onChange={e => setOriginWarehouseId(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary appearance-none cursor-pointer"
            >
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Almacén de Destino</label>
            <select 
              value={destinationWarehouseId}
              onChange={e => setDestinationWarehouseId(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary appearance-none cursor-pointer border-dashed border-primary/40"
            >
              <option value="">Seleccionar destino...</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id} disabled={wh.id === originWarehouseId}>{wh.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Notas / Justificación</label>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-primary min-h-[80px]"
              placeholder="Ej: Reabastecimiento de producción..."
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" /> Artículos a Trasladar
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
                        <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Cant. a Enviar</label>
                        <input 
                            type="number"
                            value={line.qty_sent_presentation || ''}
                            onChange={e => {
                                const newLines = [...lines];
                                newLines[index].qty_sent_presentation = parseFloat(e.target.value);
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
                            <option value="">{items.find(i => i.id === line.item_id)?.uom_name || 'Unidad Base'}</option>
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
                onClick={handleSave}
                disabled={saving}
                className="px-8 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                Confirmar y Enviar
            </button>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={errorModal.isOpen}
        title="Error en el Traslado"
        message={errorModal.message}
        confirmLabel="Entendido"
        cancelLabel=""
        onConfirm={() => setErrorModal({ ...errorModal, isOpen: false })}
        onCancel={() => setErrorModal({ ...errorModal, isOpen: false })}
      />
    </div>
  );
}
