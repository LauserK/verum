'use client';

import { useState, useEffect } from 'react';
import { adminApi, ItemCategory } from '@/lib/api';
import { Plus, Tag, X, Save, Loader2, ArrowLeft, Trash2, Pencil } from 'lucide-react';
import Link from 'next/link';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function ItemCategoriesPage() {
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: ''
  });

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const data = await adminApi.getItemCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
      setEditingId(null);
      setFormData({ name: '', description: '' });
      setShowModal(true);
  }

  function openEdit(category: ItemCategory) {
      setEditingId(category.id);
      setFormData({ name: category.name, description: category.description || '' });
      setShowModal(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
          await adminApi.updateItemCategory(editingId, formData);
      } else {
          await adminApi.createItemCategory(formData);
      }
      setShowModal(false);
      setFormData({ name: '', description: '' });
      await loadCategories();
    } catch (error: any) {
      setErrorModal({
        isOpen: true,
        message: error.message || 'Error al guardar la categoría'
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return;
    try {
        await adminApi.deleteItemCategory(id);
        await loadCategories();
    } catch (error: any) {
        setErrorModal({ isOpen: true, message: error.message || 'Error al eliminar' });
    }
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
            <Link href="/admin/inventory/items" className="p-2 hover:bg-surface-raised rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </Link>
            <div>
                <h1 className="text-2xl font-bold text-text-primary">Categorías de Artículos</h1>
                <p className="text-sm text-text-secondary mt-1">Clasificación personalizada (Harinados, Lácteos, etc.)</p>
            </div>
        </div>
        <button 
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Categoría
        </button>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-raised border-b border-border">
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest w-12"></th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Nombre</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Descripción</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Estado</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-surface-raised transition-colors group">
                  <td className="p-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Tag className="w-4 h-4 text-primary" />
                      </div>
                  </td>
                  <td className="p-4">
                      <p className="font-bold text-text-primary text-sm">{cat.name}</p>
                  </td>
                  <td className="p-4 text-sm text-text-secondary">
                      {cat.description || <span className="italic text-text-disabled">Sin descripción</span>}
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${cat.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                      {cat.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                        <button 
                            onClick={() => openEdit(cat)}
                            className="p-2 text-text-secondary hover:text-primary transition-all"
                            title="Editar categoría"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleDelete(cat.id)}
                            className="p-2 text-text-disabled hover:text-error transition-all"
                            title="Eliminar categoría"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                      <Tag className="w-12 h-12 text-text-disabled mx-auto mb-4" />
                      <p className="text-text-secondary font-medium">No hay categorías configuradas</p>
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
                <h2 className="text-xl font-bold text-text-primary">{editingId ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
                <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-primary">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Nombre</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Ej: Harinas"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Descripción</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[100px]"
                  placeholder="Opcional..."
                />
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
                onClick={handleSave}
                disabled={saving || !formData.name.trim()}
                className="flex-1 px-4 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Guardar Cambios' : 'Crear Categoría'}
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
