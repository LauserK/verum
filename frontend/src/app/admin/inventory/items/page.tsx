'use client';

import { useState, useEffect } from 'react';
import { adminApi, InventoryItem, UOMBase } from '@/lib/api';
import { Plus, Archive, X, Save, Loader2, Search, Filter } from 'lucide-react';
import { useTranslations } from '@/components/I18nProvider';

export default function ItemsPage() {
  const { t } = useTranslations('inventory.items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [uoms, setUoms] = useState<UOMBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ 
    name: '', 
    code: '', 
    type: 'raw_material', 
    base_uom_id: '' 
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [itemsData, uomsData] = await Promise.all([
        adminApi.getInventoryItems(),
        adminApi.getUOMBase()
      ]);
      setItems(itemsData);
      setUoms(uomsData);
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
      await adminApi.createInventoryItem(newItem);
      setShowModal(false);
      setNewItem({ name: '', code: '', type: 'raw_material', base_uom_id: uoms[0]?.id || '' });
      await loadData();
    } catch (error) {
      alert('Error al crear artículo');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('subtitle')}</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('newItem')}
        </button>
      </div>

      {/* Filters/Search placeholder */}
      <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-10 text-sm focus:border-primary outline-none"
              />
          </div>
          <button className="flex items-center gap-2 px-4 h-10 border border-border rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors text-text-secondary">
              <Filter className="w-4 h-4" /> Filtros
          </button>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-raised border-b border-border">
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">{t('table.code')}</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">{t('table.name')}</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">{t('table.type')}</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">{t('table.uom')}</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest text-right">{t('table.status')}</th>
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
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-primary/5 text-primary uppercase tracking-wider border border-primary/10">
                      {t(`types.${item.type}`)}
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
                  <td colSpan={5} className="p-12 text-center">
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
                <h2 className="text-xl font-bold text-text-primary">{t('newTitle')}</h2>
                <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('nameLabel')}</label>
                <input 
                  type="text" 
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder={t('namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('codeLabel')}</label>
                <input 
                  type="text" 
                  value={newItem.code}
                  onChange={e => setNewItem({...newItem, code: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder={t('codePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('typeLabel')}</label>
                <select 
                  value={newItem.type}
                  onChange={e => setNewItem({...newItem, type: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="raw_material">{t('types.raw_material')}</option>
                  <option value="semi_finished">{t('types.semi_finished')}</option>
                  <option value="finished">{t('types.finished')}</option>
                  <option value="supply">{t('types.supply')}</option>
                  <option value="packaging">{t('types.packaging')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('uomLabel')}</label>
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
                {t('cancel')}
              </button>
              <button 
                onClick={handleCreate}
                disabled={saving || !newItem.name.trim() || !newItem.base_uom_id}
                className="flex-1 px-4 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
