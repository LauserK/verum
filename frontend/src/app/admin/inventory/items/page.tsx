'use client';

import { useState, useEffect } from 'react';
import { adminApi, InventoryItem, UOMBase, ItemCategory } from '@/lib/api';
import { Plus, Archive, X, Save, Loader2, Search, Filter, Tag } from 'lucide-react';
import Link from 'next/link';

export default function ItemsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [uoms, setUoms] = useState<UOMBase[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ 
    name: '', 
    code: '', 
    type: 'raw_material', 
    base_uom_id: '',
    category_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [itemsData, uomsData, catsData] = await Promise.all([
        adminApi.getInventoryItems(),
        adminApi.getUOMBase(),
        adminApi.getItemCategories()
      ]);
      setItems(itemsData);
      setUoms(uomsData);
      setCategories(catsData);
      
      if (uomsData.length > 0 && !newItem.base_uom_id) {
        setNewItem(prev => ({ ...prev, base_uom_id: uomsData[0].id }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newItem.name.trim() || !newItem.base_uom_id) return;
    setSaving(true);
    try {
      await adminApi.createInventoryItem({
          ...newItem,
          category_id: newItem.category_id || null
      });
      setShowModal(false);
      setNewItem({ 
          name: '', 
          code: '', 
          type: 'raw_material', 
          base_uom_id: uoms[0]?.id || '',
          category_id: ''
      });
      await loadData();
    } catch (error) {
      alert('Error al crear artículo');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Maestro de Artículos</h1>
          <p className="text-sm text-text-secondary mt-1">Catálogo global de materias primas e insumos</p>
        </div>
        <div className="flex gap-2">
            <Link 
                href="/admin/inventory/items/categories"
                className="flex items-center gap-2 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
            >
                <Tag className="w-4 h-4" />
                Gestionar Categorías
            </Link>
            <button 
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
            >
                <Plus className="w-4 h-4" />
                Nuevo Artículo
            </button>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-raised border-b border-border">
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Código</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Nombre</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Categoría</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Tipo</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">UOM Base</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-surface-raised transition-colors group">
                  <td className="p-4">
                      <span className="font-mono text-xs text-text-secondary bg-surface-raised px-2 py-1 rounded border border-border">
                          {item.code || '---'}
                      </span>
                  </td>
                  <td className="p-4">
                      <p className="font-bold text-text-primary text-sm">{item.name}</p>
                  </td>
                  <td className="p-4">
                      <span className="text-sm text-text-secondary font-medium italic">
                        {categories.find(c => c.id === item.category_id)?.name || 'Sin categoría'}
                      </span>
                  </td>
                  <td className="p-4">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-primary/5 text-primary uppercase tracking-wider border border-primary/10">
                      {item.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-text-secondary font-medium">
                    {uoms.find(u => u.id === item.base_uom_id)?.code || '---'}
                  </td>
                  <td className="p-4 text-right">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${item.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                      {item.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                      <Archive className="w-10 h-10 text-text-disabled mx-auto mb-3" />
                      <p className="text-text-secondary font-medium">No hay artículos registrados</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-surface rounded-3xl p-6 w-full max-w-md shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-text-primary">Nuevo Artículo</h2>
                <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Nombre del Artículo</label>
                <input 
                  type="text" 
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Ej: Harina de Trigo"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Código Interno</label>
                <input 
                  type="text" 
                  value={newItem.code}
                  onChange={e => setNewItem({...newItem, code: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Ej: MAT-001"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Categoría</label>
                    <select 
                      value={newItem.category_id}
                      onChange={e => setNewItem({...newItem, category_id: e.target.value})}
                      className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Sin categoría</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Tipo Técnico</label>
                    <select 
                      value={newItem.type}
                      onChange={e => setNewItem({...newItem, type: e.target.value})}
                      className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="raw_material">Materia Prima</option>
                      <option value="semi_finished">Semi-elaborado</option>
                      <option value="finished">Producto Terminado</option>
                      <option value="supply">Insumo / Suministro</option>
                      <option value="packaging">Empaque</option>
                    </select>
                  </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Unidad de Medida Base</label>
                <select 
                  value={newItem.base_uom_id}
                  onChange={e => setNewItem({...newItem, base_uom_id: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                >
                  {uoms.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 h-11 border border-border text-text-primary rounded-xl font-bold text-sm hover:bg-surface-raised transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreate}
                disabled={saving || !newItem.name.trim() || !newItem.base_uom_id}
                className="flex-1 px-4 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Artículo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
