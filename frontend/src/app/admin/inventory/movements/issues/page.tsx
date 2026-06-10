'use client';

import { useState, useEffect, useRef } from 'react';
import { adminApi, Warehouse, InventoryItem, IssueDocument } from '@/lib/api';
import { Plus, Trash2, Save, Loader2, ArrowLeft, ClipboardList, ArrowDownRight, Printer } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useReactToPrint } from 'react-to-print';
import { MovementPrint } from '@/components/inventory/MovementPrint';
import { useTranslations } from '@/components/I18nProvider';

export default function IssuesPage() {
  const router = useRouter();
  const { t } = useTranslations('inventory.warehouses');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState('waste');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Array<{ item_id: string; qty_presentation: number; presentation_id: string | null }>>([
    { item_id: '', qty_presentation: 0, presentation_id: null }
  ]);

  // Printing state
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Egreso-${new Date().getTime()}`,
    onAfterPrint: () => router.push('/admin/inventory/kardex')
  });

  const [lastSavedData, setLastSavedData] = useState<any>(null);

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

  function addLine() {
    setLines([...lines, { item_id: '', qty_presentation: 0, presentation_id: null }]);
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
      const res = await adminApi.createIssueDocument({
        warehouse_id: warehouseId,
        reason,
        notes,
        lines: lines.map(line => ({
            ...line,
            presentation_id: line.presentation_id === '' ? null : line.presentation_id,
            qty_presentation: Number(line.qty_presentation)
        }))
      });

      if (shouldPrint) {
          const warehouse = warehouses.find(w => w.id === warehouseId);
          const reasonLabels: any = { 
            waste: t('types.storage'), // Placeholder or mapping needed if specific reason translations don't exist
            sale: 'Venta', 
            adjustment: 'Ajuste', 
            sample: 'Muestra', 
            other: 'Otro' 
          };
          
          setLastSavedData({
              id: res.id,
              warehouseName: warehouse?.name || 'Almacén',
              reason: reasonLabels[reason] || reason,
              notes,
              createdAt: new Date().toISOString(),
              lines: lines.map(l => ({
                  itemName: items.find(i => i.id === l.item_id)?.name || 'Artículo',
                  qty: l.qty_presentation,
                  uom: 'Unidad'
              }))
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
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Almacén de Origen</label>
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
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Motivo de Salida</label>
            <select 
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary"
            >
              <option value="waste">Merma / Desperdicio</option>
              <option value="sale">Venta / Catering</option>
              <option value="adjustment">Ajuste de Inventario</option>
              <option value="sample">Muestra / Degustación</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Notas / Observaciones</label>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-sm text-text-primary outline-none focus:border-primary min-h-[80px]"
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
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-surface-raised p-4 rounded-xl border border-border group">
                <div className="md:col-span-8">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Artículo</label>
                    <select 
                        value={line.item_id}
                        onChange={e => {
                            const newLines = [...lines];
                            newLines[index].item_id = e.target.value;
                            setLines(newLines);
                        }}
                        className="w-full bg-surface border border-border rounded-lg px-3 h-10 text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        {items.map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Cantidad a Retirar</label>
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
                {t('cancel')}
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
                className="px-8 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
