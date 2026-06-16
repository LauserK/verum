'use client';

import { useState, useEffect } from 'react';
import { adminApi, InventoryItem, UOMBase, ItemCategory } from '@/lib/api';
import { Plus, Archive, X, Save, Loader2, Search, Filter, Tag, Pencil, Trash2, DollarSign, FileUp } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from '@/components/I18nProvider';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function ItemsPage() {
  const { t } = useTranslations('inventory.items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [uoms, setUoms] = useState<UOMBase[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    code: '', 
    type: 'raw_material', 
    base_uom_id: '',
    category_id: ''
  });

  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: ''
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
      
      if (uomsData.length > 0 && !formData.base_uom_id) {
        setFormData(prev => ({ ...prev, base_uom_id: uomsData[0].id }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
      setEditingId(null);
      setFormData({ 
          name: '', 
          code: '', 
          type: 'raw_material', 
          base_uom_id: uoms[0]?.id || '',
          category_id: ''
      });
      setShowModal(true);
  }

  function openEdit(item: InventoryItem) {
      setEditingId(item.id);
      setFormData({
          name: item.name,
          code: item.code || '',
          type: item.type,
          base_uom_id: item.base_uom_id,
          category_id: item.category_id || ''
      });
      setShowModal(true);
  }

  async function handleSave() {
    if (!formData.name.trim() || !formData.base_uom_id) return;
    setSaving(true);
    try {
      const payload = {
          ...formData,
          category_id: formData.category_id || null
      };

      if (editingId) {
          await adminApi.updateInventoryItem(editingId, payload as any);
      } else {
          await adminApi.createInventoryItem(payload as any);
      }
      
      setShowModal(false);
      await loadData();
    } catch (error: any) {
      setErrorModal({
          isOpen: true,
          message: error.message || 'Error al guardar el artículo'
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
      if (!confirm('¿Estás seguro de eliminar este artículo?')) return;
      try {
          await adminApi.deleteInventoryItem(id);
          await loadData();
      } catch (error: any) {
          setErrorModal({ isOpen: true, message: error.message || 'Error al eliminar' });
      }
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
            <Link 
                href="/admin/inventory/import-utility"
                className="flex items-center gap-2 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
            >
                <FileUp className="w-4 h-4" />
                Importar Excel
            </Link>
            <Link 
                href="/admin/inventory/items/categories"
                className="flex items-center gap-2 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
            >
                <Tag className="w-4 h-4" />
                Gestionar Categorías
            </Link>
            <button 
                onClick={openCreate}
                className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
            >
                <Plus className="w-4 h-4" />
                {t('newItem')}
            </button>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-raised border-b border-border">
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">{t('table.code')}</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">{t('table.name')}</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Categoría</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">{t('table.type')}</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Último Costo</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">{t('table.uom')}</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest text-right">Acciones</th>
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
                      <Link 
                        href={`/admin/inventory/items/${item.id}`}
                        className="font-bold text-text-primary text-sm hover:text-primary transition-colors"
                      >
                        {item.name}
                      </Link>
                  </td>
                  <td className="p-4">
                      <span className="text-sm text-text-secondary font-medium italic">
                        {categories.find(c => c.id === item.category_id)?.name || 'Sin categoría'}
                      </span>
                  </td>
                  <td className="p-4">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-primary/5 text-primary uppercase tracking-wider border border-primary/10">
                      {t(`types.${item.type}`)}
                    </span>
                  </td>
                  <td className="p-4">
                      {item.last_purchase_cost ? (
                          <div className="flex items-center gap-1 text-sm font-bold text-text-primary">
                              <DollarSign className="w-3 h-3 text-text-secondary" />
                              {item.last_purchase_cost.toFixed(2)}
                          </div>
                      ) : (
                          <span className="text-xs text-text-disabled italic">Sin costo</span>
                      )}
                  </td>
                  <td className="p-4 text-sm text-text-secondary font-medium">
                    {uoms.find(u => u.id === item.base_uom_id)?.code || '---'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                        <button 
                            onClick={() => openEdit(item)}
                            className="p-2 text-text-secondary hover:text-primary transition-all"
                            title="Editar artículo"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-text-disabled hover:text-error transition-all"
                            title="Eliminar artículo"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                      <Archive className="w-10 h-10 text-text-disabled mx-auto mb-3" />
                      <p className="text-text-secondary font-medium">{t('empty')}</p>
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
                <h2 className="text-xl font-bold text-text-primary">{editingId ? 'Editar Artículo' : t('newTitle')}</h2>
                <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('nameLabel')}</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder={t('namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('codeLabel')}</label>
                <input 
                  type="text" 
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder={t('codePlaceholder')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Categoría</label>
                    <select 
                      value={formData.category_id}
                      onChange={e => setFormData({...formData, category_id: e.target.value})}
                      className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Sin categoría</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('typeLabel')}</label>
                    <select 
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                      className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="raw_material">{t('types.raw_material')}</option>
                      <option value="semi_finished">{t('types.semi_finished')}</option>
                      <option value="finished">{t('types.finished')}</option>
                      <option value="supply">{t('types.supply')}</option>
                      <option value="packaging">{t('types.packaging')}</option>
                    </select>
                  </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('uomLabel')}</label>
                <select 
                  value={formData.base_uom_id}
                  disabled={!!editingId}
                  onChange={e => setFormData({...formData, base_uom_id: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer disabled:bg-surface-raised disabled:text-text-disabled"
                >
                  {uoms.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                  ))}
                </select>
                {editingId && <p className="text-[10px] text-text-disabled mt-1">* La unidad base no se puede cambiar después de crear el artículo.</p>}
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 h-11 border border-border text-text-primary rounded-xl font-bold text-sm hover:bg-surface-raised transition-all"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSave}
                disabled={saving || !formData.name.trim() || !formData.base_uom_id}
                className="flex-1 px-4 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Guardar Cambios' : t('create')}
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
