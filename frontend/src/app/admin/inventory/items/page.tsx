'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { adminApi, InventoryItem, UOMBase, ItemCategory } from '@/lib/api';
import { 
    Plus, 
    Archive, 
    X, 
    Save, 
    Loader2, 
    Search, 
    Filter, 
    Tag, 
    Pencil, 
    Trash2, 
    DollarSign, 
    FileUp,
    ChevronUp,
    ChevronDown,
    LayoutGrid,
    Type,
    Scale
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from '@/components/I18nProvider';
import ConfirmationModal from '@/components/ConfirmationModal';

function Row({ item, categories, uoms, t, openEdit, handleDelete }: { 
    item: InventoryItem, 
    categories: ItemCategory[], 
    uoms: UOMBase[], 
    t: any, 
    openEdit: (item: InventoryItem) => void,
    handleDelete: (id: string) => void
}) {
    return (
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
                        {Number(item.last_purchase_cost).toFixed(2)}
                    </div>
                ) : (
                    <span className="text-xs text-text-disabled italic">Sin costo</span>
                )}
            </td>
            <td className="p-4 text-sm text-text-secondary font-medium">
            {uoms.find(u => u.id === item.base_uom_id)?.code || '---'}
            </td>
            <td className="p-4 text-sm text-text-secondary font-medium font-mono">
            {item.min_stock !== undefined ? Number(item.min_stock).toFixed(2) : '0.00'}
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
    );
}

function FilterSelect({ value, onChange, options, placeholder, icon: Icon, className = "" }: { 
    value: string, 
    onChange: (val: string) => void, 
    options: { id: string, name: string }[],
    placeholder: string,
    icon?: any,
    className?: string
}) {
    return (
        <div className={`relative group ${className}`}>
            {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary group-focus-within:text-primary transition-colors z-10" />}
            <select 
                value={value}
                onChange={e => onChange(e.target.value)}
                className={`w-full bg-surface-raised border border-border rounded-xl ${Icon ? 'pl-9' : 'px-4'} pr-10 h-11 text-xs text-text-primary outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer appearance-none shadow-sm font-medium`}
            >
                <option value="">{placeholder}</option>
                {options.map(opt => (
                    <option key={opt.id} value={opt.id} className="bg-surface text-text-primary">{opt.name}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled pointer-events-none group-hover:text-text-secondary transition-colors" />
        </div>
    );
}

export default function ItemsPage() {
  const { t } = useTranslations('inventory.items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [uoms, setUoms] = useState<UOMBase[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterUom, setFilterUom] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [groupBy, setGroupBy] = useState<'none' | 'category_id' | 'type' | 'base_uom_id'>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState({ 
    name: '', 
    code: '', 
    type: 'raw_material', 
    base_uom_id: '',
    category_id: '',
    min_stock: 0
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

  // --- Processed Items Logic ---
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (item.code?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesCategory = !filterCategory || item.category_id === filterCategory;
    const matchesType = !filterType || item.type === filterType;
    const matchesUom = !filterUom || item.base_uom_id === filterUom;

    return matchesSearch && matchesCategory && matchesType && matchesUom;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    let aValue: any = (a as any)[sortConfig.key];
    let bValue: any = (b as any)[sortConfig.key];

    // Special handling for nested names
    if (sortConfig.key === 'category_name') {
        aValue = categories.find(c => c.id === a.category_id)?.name || '';
        bValue = categories.find(c => c.id === b.category_id)?.name || '';
    } else if (sortConfig.key === 'uom_name') {
        aValue = uoms.find(u => u.id === a.base_uom_id)?.code || '';
        bValue = uoms.find(u => u.id === b.base_uom_id)?.code || '';
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });
  };

  // Grouping logic
  const groupedItems: Record<string, InventoryItem[]> = {};
  if (groupBy !== 'none') {
    sortedItems.forEach(item => {
      let groupKey = (item as any)[groupBy] || 'unassigned';
      if (!groupedItems[groupKey]) groupedItems[groupKey] = [];
      groupedItems[groupKey].push(item);
    });
  }

  function getGroupName(key: string) {
    if (groupBy === 'category_id') return categories.find(c => c.id === key)?.name || 'Sin Categoría';
    if (groupBy === 'type') return t(`types.${key}`);
    if (groupBy === 'base_uom_id') return uoms.find(u => u.id === key)?.name || 'Sin Unidad';
    return key;
  }

  function openCreate() {
      setEditingId(null);
      setFormData({ 
          name: '', 
          code: '', 
          type: 'raw_material', 
          base_uom_id: uoms[0]?.id || '',
          category_id: '',
          min_stock: 0
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
          category_id: item.category_id || '',
          min_stock: item.min_stock || 0
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

  const SortIndicator = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <div className="w-4 h-4 opacity-10"><ChevronUp className="w-3 h-3" /></div>;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
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

      {/* Filter & Group Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-4 relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary group-focus-within:text-primary transition-colors z-10" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o código..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-surface-raised border border-border rounded-xl pl-10 pr-4 h-11 text-xs text-text-primary outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm font-medium"
          />
        </div>
        
        <FilterSelect 
            value={filterCategory}
            onChange={setFilterCategory}
            options={categories.map(c => ({ id: c.id, name: c.name }))}
            placeholder="Todas las Categorías"
            icon={LayoutGrid}
            className="lg:col-span-2"
        />

        <FilterSelect 
            value={filterType}
            onChange={setFilterType}
            options={[
                { id: 'raw_material', name: t('types.raw_material') },
                { id: 'semi_finished', name: t('types.semi_finished') },
                { id: 'finished', name: t('types.finished') },
                { id: 'supply', name: t('types.supply') },
                { id: 'packaging', name: t('types.packaging') }
            ]}
            placeholder="Todos los Tipos"
            icon={Type}
            className="lg:col-span-2"
        />

        <FilterSelect 
            value={groupBy}
            onChange={(val) => setGroupBy(val as any)}
            options={[
                { id: 'category_id', name: 'Agrupar por Categoría' },
                { id: 'type', name: 'Agrupar por Tipo' },
                { id: 'base_uom_id', name: 'Agrupar por UOM' }
            ]}
            placeholder="Sin Agrupamiento"
            icon={Scale}
            className="lg:col-span-2"
        />

        <div className="lg:col-span-2 flex items-center justify-center">
            <button 
                onClick={() => {
                    setSearchTerm('');
                    setFilterCategory('');
                    setFilterType('');
                    setFilterUom('');
                    setGroupBy('none');
                }}
                className="text-[10px] font-black uppercase text-text-secondary hover:text-error transition-colors flex items-center gap-1 group"
            >
                <X className="w-3 h-3 group-hover:rotate-90 transition-transform" /> Limpiar Filtros
            </button>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-raised border-b border-border">
                <th className="p-4 cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => handleSort('code')}>
                  <div className="flex items-center gap-2 text-xs font-black text-text-secondary uppercase tracking-widest">
                    {t('table.code')} <SortIndicator column="code" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2 text-xs font-black text-text-secondary uppercase tracking-widest">
                    {t('table.name')} <SortIndicator column="name" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => handleSort('category_name')}>
                  <div className="flex items-center gap-2 text-xs font-black text-text-secondary uppercase tracking-widest">
                    Categoría <SortIndicator column="category_name" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => handleSort('type')}>
                  <div className="flex items-center gap-2 text-xs font-black text-text-secondary uppercase tracking-widest">
                    {t('table.type')} <SortIndicator column="type" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => handleSort('last_purchase_cost')}>
                  <div className="flex items-center gap-2 text-xs font-black text-text-secondary uppercase tracking-widest">
                    Costo <SortIndicator column="last_purchase_cost" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => handleSort('uom_name')}>
                  <div className="flex items-center gap-2 text-xs font-black text-text-secondary uppercase tracking-widest">
                    {t('table.uom')} <SortIndicator column="uom_name" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => handleSort('min_stock')}>
                  <div className="flex items-center gap-2 text-xs font-black text-text-secondary uppercase tracking-widest">
                    Stock Mín. <SortIndicator column="min_stock" />
                  </div>
                </th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groupBy === 'none' ? (
                  sortedItems.map(item => <Row key={item.id} item={item} categories={categories} uoms={uoms} t={t} openEdit={openEdit} handleDelete={handleDelete} />)
              ) : (
                  Object.entries(groupedItems).map(([key, groupItems]) => {
                      const isCollapsed = collapsedGroups.has(key);
                      return (
                        <Fragment key={key}>
                          <tr className="group/group-header cursor-pointer select-none" onClick={() => toggleGroup(key)}>
                              <td colSpan={8} className="p-0 border-b border-border">
                                  <div className={`flex items-center justify-between px-4 py-3 sticky left-0 transition-colors ${isCollapsed ? 'bg-surface hover:bg-surface-raised/50' : 'bg-surface-raised/80 backdrop-blur-sm'}`}>
                                      <div className="flex items-center gap-3">
                                          <ChevronDown className={`w-4 h-4 text-primary transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                                          <div className="w-1 h-5 bg-primary rounded-full" />
                                          <div className="flex flex-col">
                                              <span className="text-[10px] font-black uppercase text-text-secondary tracking-widest leading-none mb-1">
                                                  {groupBy === 'category_id' ? 'Categoría' : groupBy === 'type' ? 'Tipo' : 'Unidad'}
                                              </span>
                                              <div className="flex items-center gap-3">
                                                  <span className="text-sm font-bold text-text-primary">
                                                      {getGroupName(key)}
                                                  </span>
                                                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                                      {groupItems.length} {groupItems.length === 1 ? 'ARTÍCULO' : 'ARTÍCULOS'}
                                                  </span>
                                              </div>
                                          </div>
                                      </div>
                                      {isCollapsed && (
                                          <span className="text-[10px] font-bold text-text-disabled uppercase tracking-tighter mr-2">Click para expandir</span>
                                      )}
                                  </div>
                              </td>
                          </tr>
                          {!isCollapsed && groupItems.map(item => <Row key={item.id} item={item} categories={categories} uoms={uoms} t={t} openEdit={openEdit} handleDelete={handleDelete} />)}
                        </Fragment>
                      );
                  })
              )}
              
              {sortedItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                      <Archive className="w-10 h-10 text-text-disabled mx-auto mb-3" />
                      <p className="text-text-secondary font-medium">{searchTerm ? 'No se encontraron resultados' : t('empty')}</p>
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
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Categoría</label>
                    <div className="relative group">
                        <select 
                        value={formData.category_id}
                        onChange={e => setFormData({...formData, category_id: e.target.value})}
                        className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                        >
                        <option value="" className="bg-surface text-text-primary">Sin categoría</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id} className="bg-surface text-text-primary">{cat.name}</option>
                        ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">{t('typeLabel')}</label>
                    <div className="relative group">
                        <select 
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value})}
                        className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                        >
                        <option value="raw_material" className="bg-surface text-text-primary">{t('types.raw_material')}</option>
                        <option value="semi_finished" className="bg-surface text-text-primary">{t('types.semi_finished')}</option>
                        <option value="finished" className="bg-surface text-text-primary">{t('types.finished')}</option>
                        <option value="supply" className="bg-surface text-text-primary">{t('types.supply')}</option>
                        <option value="packaging" className="bg-surface text-text-primary">{t('types.packaging')}</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled pointer-events-none" />
                    </div>
                  </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">{t('uomLabel')}</label>
                <div className="relative group">
                    <select 
                    value={formData.base_uom_id}
                    disabled={!!editingId}
                    onChange={e => setFormData({...formData, base_uom_id: e.target.value})}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none cursor-pointer disabled:bg-surface-raised disabled:text-text-disabled shadow-sm"
                    >
                    {uoms.map(u => (
                        <option key={u.id} value={u.id} className="bg-surface text-text-primary">{u.name} ({u.code})</option>
                    ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled pointer-events-none" />
                </div>
                {editingId && <p className="text-[10px] text-text-disabled mt-1 px-1">* La unidad base no se puede cambiar después de crear el artículo.</p>}
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest ml-1">Stock Mínimo (Seguridad)</label>
                <input 
                  type="number" 
                  step="any"
                  value={formData.min_stock}
                  onChange={e => setFormData({...formData, min_stock: parseFloat(e.target.value) || 0})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="0.00"
                />
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
