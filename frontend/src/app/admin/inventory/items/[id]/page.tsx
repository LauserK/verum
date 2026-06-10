'use client';

import { useState, useEffect, use } from 'react';
import { adminApi, InventoryItem, UOMBase, ItemCategory, UOMPresentation, Warehouse, StockMovement } from '@/lib/api';
import { 
    Plus, X, Save, Loader2, ArrowLeft, Tag, Pencil, 
    Trash2, DollarSign, Package, Settings, History, 
    Warehouse as WarehouseIcon, Scale, Trash 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/components/I18nProvider';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { t } = useTranslations('inventory.items');
  
  const [activeTab, setActiveTab] = useState<'general' | 'units' | 'warehouses' | 'history'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [uoms, setUoms] = useState<UOMBase[]>([]);
  const [presentations, setPresentations] = useState<UOMPresentation[]>([]);
  const [allGlobalPresentations, setAllGlobalPresentations] = useState<UOMPresentation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemStock, setItemStock] = useState<any[]>([]);
  const [history, setHistory] = useState<StockMovement[]>([]);

  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: ''
  });

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [newUnit, setNewUnit] = useState({ name: '', conversion_factor: 1, is_default: false });

  useEffect(() => {
    loadAllData();
  }, [id]);

  async function loadAllData() {
    setLoading(true);
    try {
      const [itemData, catsData, uomsData, itemPresData, globalPresData, whData, stockData, historyData] = await Promise.all([
        adminApi.getInventoryItem(id),
        adminApi.getItemCategories(),
        adminApi.getUOMBase(),
        adminApi.getItemPresentations(id),
        adminApi.getUOMPresentations(),
        adminApi.getInventoryWarehouses(),
        adminApi.getItemStock(id),
        adminApi.getKardex({ item_id: id })
      ]);

      setItem(itemData);
      setCategories(catsData);
      setUoms(uomsData);
      setPresentations(itemPresData);
      setAllGlobalPresentations(globalPresData);
      setWarehouses(whData);
      setItemStock(stockData);
      setHistory(historyData);
    } catch (error: any) {
      console.error('Error loading item detail:', error);
      setErrorModal({ isOpen: true, message: 'No se pudo cargar el detalle del artículo' });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateItem(formData: any) {
    setSaving(true);
    try {
      await adminApi.updateInventoryItem(id, formData);
      await loadAllData();
    } catch (error: any) {
      setErrorModal({ isOpen: true, message: error.message || 'Error al actualizar' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUnit() {
      if (!newUnit.name || !item) return;
      setSaving(true);
      try {
          // 1. Create global presentation first
          const created = await adminApi.createUOMPresentation({
              ...newUnit,
              base_uom_id: item.base_uom_id
          });
          // 2. Enable for this item
          await adminApi.enableItemPresentation(id, created.id);
          setShowUnitModal(false);
          setNewUnit({ name: '', conversion_factor: 1, is_default: false });
          await loadAllData();
      } catch (error: any) {
          setErrorModal({ isOpen: true, message: error.message || 'Error al crear unidad' });
      } finally {
          setSaving(false);
      }
  }

  async function handleToggleGlobalUnit(presId: string, enabled: boolean) {
      try {
          if (enabled) await adminApi.enableItemPresentation(id, presId);
          else await adminApi.disableItemPresentation(id, presId);
          await loadAllData();
      } catch (error: any) {
          setErrorModal({ isOpen: true, message: 'Error al cambiar estado de unidad' });
      }
  }

  async function handleAssociateWarehouse(whId: string) {
      try {
          await adminApi.associateWarehouseToItem(id, whId);
          await loadAllData();
      } catch (error: any) {
          setErrorModal({ isOpen: true, message: 'Error al asociar almacén' });
      }
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;
  if (!item) return <div className="p-20 text-center">Artículo no encontrado</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/inventory/items" className="p-2 hover:bg-surface-raised rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div className="flex-1">
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-text-primary">{item.name}</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-raised border border-border text-text-secondary uppercase tracking-widest">
                    {item.code || 'SIN CÓDIGO'}
                </span>
            </div>
            <p className="text-sm text-text-secondary">{t(`types.${item.type}`)} • {categories.find(c => c.id === item.category_id)?.name || 'Sin Categoría'}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-full text-xs font-bold">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Activo
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto no-scrollbar">
          {[
              { id: 'general', label: 'General', icon: Settings },
              { id: 'units', label: 'Unidades / Empaques', icon: Scale },
              { id: 'warehouses', label: 'Stock / Almacenes', icon: WarehouseIcon },
              { id: 'history', label: 'Kardex Local', icon: History },
          ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                    activeTab === tab.id 
                    ? 'border-primary text-primary bg-primary/5' 
                    : 'border-transparent text-text-disabled hover:text-text-secondary'
                }`}
              >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
              </button>
          ))}
      </div>

      {/* Content */}
      <div className="mt-6">
          {activeTab === 'general' && (
              <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                  <h3 className="text-lg font-bold text-text-primary mb-6">Información Básica</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Nombre del Artículo</label>
                          <input 
                            type="text" 
                            defaultValue={item.name}
                            onBlur={(e) => handleUpdateItem({ name: e.target.value })}
                            className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Código Interno</label>
                          <input 
                            type="text" 
                            defaultValue={item.code || ''}
                            onBlur={(e) => handleUpdateItem({ code: e.target.value })}
                            className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Categoría</label>
                          <select 
                            value={item.category_id || ''}
                            onChange={(e) => handleUpdateItem({ category_id: e.target.value || null })}
                            className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary"
                          >
                              <option value="">Sin categoría</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Tipo Técnico</label>
                          <select 
                            value={item.type}
                            onChange={(e) => handleUpdateItem({ type: e.target.value })}
                            className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary"
                          >
                              <option value="raw_material">Materia Prima</option>
                              <option value="semi_finished">Semi-elaborado</option>
                              <option value="finished">Producto Terminado</option>
                              <option value="supply">Insumo</option>
                              <option value="packaging">Empaque</option>
                          </select>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'units' && (
              <div className="space-y-6 animate-in fade-in">
                  <div className="bg-primary/5 rounded-2xl border border-primary/20 p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Scale className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-text-primary text-lg">Unidades de Medida</h3>
                            <p className="text-sm text-text-secondary">Unidad Base: <span className="font-bold text-primary">{uoms.find(u => u.id === item.base_uom_id)?.name}</span></p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowUnitModal(true)}
                        className="bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors flex items-center gap-2"
                      >
                          <Plus className="w-4 h-4" /> Nueva Equivalencia
                      </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allGlobalPresentations.filter(p => p.base_uom_id === item.base_uom_id).map(pres => {
                          const isEnabled = presentations.some(p => p.id === pres.id);
                          return (
                              <div key={pres.id} className={`p-5 rounded-2xl border transition-all flex items-center justify-between ${isEnabled ? 'bg-surface border-primary shadow-sm' : 'bg-surface-raised border-border opacity-60 hover:opacity-100'}`}>
                                  <div>
                                      <p className="font-bold text-text-primary">{pres.name}</p>
                                      <p className="text-xs text-text-secondary">Factor: <span className="font-mono">1 {pres.name} = {pres.conversion_factor} {uoms.find(u => u.id === item.base_uom_id)?.code}</span></p>
                                  </div>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={isEnabled} 
                                        onChange={(e) => handleToggleGlobalUnit(pres.id, e.target.checked)}
                                        className="sr-only peer" 
                                      />
                                      <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                  </label>
                              </div>
                          );
                      })}
                  </div>
              </div>
          )}

          {activeTab === 'warehouses' && (
              <div className="space-y-6 animate-in fade-in">
                  <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-text-primary">Stock por Almacén</h3>
                        <div className="flex gap-2">
                            <select 
                                onChange={(e) => handleAssociateWarehouse(e.target.value)}
                                className="bg-surface border border-border rounded-xl px-4 h-10 text-sm outline-none focus:border-primary"
                                value=""
                            >
                                <option value="">+ Asociar nuevo almacén</option>
                                {warehouses.filter(w => !itemStock.some(s => s.warehouse_id === w.id)).map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                      </div>

                      <div className="space-y-3">
                          {itemStock.map(stock => (
                              <div key={stock.id} className="flex items-center justify-between p-4 bg-surface-raised rounded-xl border border-border group hover:border-primary/30 transition-all">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center border border-border">
                                          <WarehouseIcon className="w-5 h-5 text-text-secondary" />
                                      </div>
                                      <div>
                                          <p className="font-bold text-sm text-text-primary">{stock.warehouses?.name || 'Almacén'}</p>
                                          <p className="text-[10px] text-text-disabled uppercase font-bold tracking-widest">{stock.warehouses?.type || 'General'}</p>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-xl font-black text-text-primary font-mono">{stock.qty_base.toFixed(2)}</p>
                                      <p className="text-[10px] text-text-secondary font-bold uppercase">{uoms.find(u => u.id === item.base_uom_id)?.code}</p>
                                  </div>
                              </div>
                          ))}
                          {itemStock.length === 0 && (
                              <div className="text-center py-10 border-2 border-dashed border-border rounded-2xl">
                                  <p className="text-text-disabled text-sm">Este artículo no tiene stock registrado en ningún almacén.</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'history' && (
              <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm animate-in fade-in">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-surface-raised border-b border-border">
                              <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Fecha</th>
                              <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Almacén</th>
                              <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Movimiento</th>
                              <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-right">Cant.</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                          {history.slice(0, 15).map(m => (
                              <tr key={m.id} className="hover:bg-surface-raised transition-colors">
                                  <td className="p-4 text-xs text-text-secondary font-medium">{new Date(m.created_at).toLocaleDateString()}</td>
                                  <td className="p-4 text-xs text-text-primary font-bold">{warehouses.find(w => w.id === m.warehouse_id)?.name || 'Almacén'}</td>
                                  <td className="p-4">
                                      <div className="flex items-center gap-2">
                                          {m.qty_base > 0 ? <ArrowUpRight className="w-3 h-3 text-success" /> : <ArrowDownRight className="w-3 h-3 text-error" />}
                                          <span className={`text-xs font-bold uppercase ${m.qty_base > 0 ? 'text-success' : 'text-error'}`}>
                                              {m.movement_type}
                                          </span>
                                      </div>
                                  </td>
                                  <td className="p-4 text-right text-sm font-mono font-bold">{m.qty_base > 0 ? '+' : ''}{m.qty_base.toFixed(2)}</td>
                              </tr>
                          ))}
                          {history.length === 0 && (
                              <tr>
                                  <td colSpan={4} className="p-20 text-center text-text-disabled text-sm">No hay movimientos registrados</td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}
      </div>

      {/* Unit Creation Modal */}
      {showUnitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-3xl p-6 w-full max-w-md shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-text-primary">Nueva Unidad / Empaque</h2>
                <button onClick={() => setShowUnitModal(false)} className="text-text-secondary hover:text-text-primary">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Nombre de la Unidad</label>
                <input 
                  type="text" 
                  value={newUnit.name}
                  onChange={e => setNewUnit({...newUnit, name: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary"
                  placeholder="Ej: Saco 45kg, Caja x 12, etc."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Factor de Conversión</label>
                <div className="relative">
                    <input 
                        type="number" 
                        value={newUnit.conversion_factor}
                        onChange={e => setNewUnit({...newUnit, conversion_factor: parseFloat(e.target.value)})}
                        className="w-full bg-surface border border-border rounded-xl pl-4 pr-20 h-11 text-sm outline-none focus:border-primary"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-disabled uppercase">
                        {uoms.find(u => u.id === item.base_uom_id)?.code}
                    </div>
                </div>
                <p className="text-[10px] text-text-secondary mt-2 px-1">Ej: Si es un saco de 45kg y tu unidad base es Gramos, el factor es 45000.</p>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setShowUnitModal(false)}
                className="flex-1 px-4 h-11 border border-border text-text-primary rounded-xl font-bold text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddUnit}
                disabled={saving || !newUnit.name}
                className="flex-1 px-4 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Unidad
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={errorModal.isOpen}
        title="Error"
        message={errorModal.message}
        confirmLabel="Entendido"
        cancelLabel=""
        onConfirm={() => setErrorModal({ ...errorModal, isOpen: false })}
        onCancel={() => setErrorModal({ ...errorModal, isOpen: false })}
      />
    </div>
  );
}

function ArrowUpRight(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>;
}

function ArrowDownRight(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 7 10 10"/><path d="M17 7v10H7"/></svg>;
}
