'use client';

import { useState, useEffect } from 'react';
import { adminApi, Warehouse } from '@/lib/api';
import { Plus, Warehouse as WarehouseIcon, X, Save, Loader2, MapPin, Edit2 } from 'lucide-react';
import { useTranslations } from '@/components/I18nProvider';
import { useVenue } from '@/components/VenueContext';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function WarehousesPage() {
  const { t } = useTranslations('inventory.warehouses');
  const { availableVenues } = useVenue();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newWarehouse, setNewWarehouse] = useState<{ name: string; type: Warehouse['type']; venue_id: string; is_active?: boolean }>({ name: '', type: 'storage', venue_id: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function loadWarehouses() {
    try {
      const data = await adminApi.getInventoryWarehouses();
      setWarehouses(data);
    } catch (error) {
      console.error('Error loading warehouses:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingId(null);
    setNewWarehouse({ name: '', type: 'storage', venue_id: '', is_active: true });
    setShowModal(true);
  }

  function openEditModal(wh: Warehouse) {
    setEditingId(wh.id);
    setNewWarehouse({ name: wh.name, type: wh.type, venue_id: wh.venue_id || '', is_active: wh.is_active });
    setShowModal(true);
  }

  async function handleSave() {
    if (!newWarehouse.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await adminApi.updateInventoryWarehouse(editingId, newWarehouse);
      } else {
        await adminApi.createInventoryWarehouse(newWarehouse);
      }
      setShowModal(false);
      setNewWarehouse({ name: '', type: 'storage', venue_id: '', is_active: true });
      await loadWarehouses();
    } catch (error: any) {
      console.error('Error saving warehouse:', error);
      setErrorModal({ isOpen: true, message: error?.message || (editingId ? 'Error al actualizar almacén' : 'Error al crear almacén') });
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
      <ConfirmationModal 
        isOpen={errorModal.isOpen}
        title="Error"
        message={errorModal.message}
        confirmLabel="Entendido"
        cancelLabel=""
        onConfirm={() => setErrorModal({ ...errorModal, isOpen: false })}
        onCancel={() => setErrorModal({ ...errorModal, isOpen: false })}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('subtitle')}</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('newWarehouse')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map(wh => (
          <div key={wh.id} className="bg-surface p-5 rounded-2xl border border-border shadow-sm hover:border-border-strong transition-all relative group">
            <button 
                onClick={() => openEditModal(wh)}
                className="absolute top-4 right-4 p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                title="Editar Almacén"
            >
                <Edit2 className="w-4 h-4" />
            </button>
            <div className="flex items-start justify-between pr-8">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <WarehouseIcon className="w-5 h-5 text-primary" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${wh.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                    {wh.is_active ? 'Activo' : 'Inactivo'}
                </span>
            </div>
            <div className="mt-4">
                <h3 className="font-bold text-text-primary text-lg">{wh.name}</h3>
                <p className="text-xs text-text-secondary uppercase tracking-widest mt-1 font-semibold">
                    {t(`types.${wh.type}`)}
                </p>
                {wh.venue_id && (
                    <p className="text-[10px] text-text-secondary mt-2 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Sede vinculada
                    </p>
                )}
            </div>
          </div>
        ))}
        {warehouses.length === 0 && (
            <div className="col-span-full bg-surface border border-dashed border-border rounded-2xl py-20 text-center">
                <WarehouseIcon className="w-12 h-12 text-text-disabled mx-auto mb-4" />
                <p className="text-text-secondary font-medium">{t('empty')}</p>
                <button 
                    onClick={() => setShowModal(true)}
                    className="text-primary text-sm font-bold mt-2 hover:underline"
                >
                    {t('createFirst')}
                </button>
            </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-surface rounded-3xl p-6 w-full max-w-md shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-text-primary">{editingId ? 'Editar Almacén' : t('newTitle')}</h2>
                <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('nameLabel')}</label>
                <input 
                  type="text" 
                  value={newWarehouse.name}
                  onChange={e => setNewWarehouse({...newWarehouse, name: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder={t('namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('typeLabel')}</label>
                <select 
                  value={newWarehouse.type}
                  onChange={e => setNewWarehouse({...newWarehouse, type: e.target.value as Warehouse['type']})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="storage">{t('types.storage')}</option>
                  <option value="production">{t('types.production')}</option>
                  <option value="point_of_sale">{t('types.point_of_sale')}</option>
                  <option value="transit">{t('types.transit')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Asociar a Sede (Opcional)</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                  <select 
                    value={newWarehouse.venue_id || ''}
                    onChange={e => setNewWarehouse({...newWarehouse, venue_id: e.target.value})}
                    className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">No asociar a ninguna sede</option>
                    {availableVenues.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-text-secondary mt-1">Requerido si el tipo de almacén es Producción o Punto de Venta.</p>
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
                disabled={saving || !newWarehouse.name.trim()}
                className="flex-1 px-4 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Guardar Cambios' : t('create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
