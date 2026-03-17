// frontend/src/app/admin/inventory/utensils/categories/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminApi, getProfile, type UtensilCategory } from '@/lib/api'
import { Plus, Edit3, Save, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from '@/components/I18nProvider'

export default function UtensilCategoriesPage() {
  const { t } = useTranslations()
  const [categories, setCategories] = useState<UtensilCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingCategory, setEditingCategory] = useState<UtensilCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form State
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const resetForm = () => {
    setNewName('')
    setNewDesc('')
    setEditingCategory(null)
    setError('')
  }

  const startEdit = (cat: UtensilCategory) => {
    setEditingCategory(cat)
    setNewName(cat.name)
    setNewDesc(cat.description || '')
    setShowCreate(true)
  }

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const profile = await getProfile()
      if (profile.organization_id) {
        const data = await adminApi.getUtensilCategories(profile.organization_id)
        setCategories(data)
      }
    } catch (err) {
      console.error('Error fetching categories:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleSave = async () => {
    setError('')
    if (!newName) {
      setError(t('inventory.utensils.categories.errors.required'))
      return
    }

    setSaving(true)
    try {
      const profile = await getProfile()
      if (!profile.organization_id) throw new Error('No organization found')
      
      const payload = {
        org_id: profile.organization_id,
        name: newName,
        description: newDesc || undefined
      }

      if (editingCategory) {
        const data = await adminApi.updateUtensilCategory(editingCategory.id, payload)
        if (data) {
          setCategories(prev => prev.map(c => c.id === editingCategory.id ? data : c).sort((a, b) => a.name.localeCompare(b.name)))
          setShowCreate(false)
          resetForm()
        }
      } else {
        const data = await adminApi.createUtensilCategory(payload)
        if (data) {
          setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
          setShowCreate(false)
          resetForm()
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(t('inventory.utensils.categories.errors.generic'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">{t('inventory.utensils.categories.title')}</h1>
          <div className="flex items-center gap-6 mt-2">
            <Link href="/admin/inventory/assets" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.assets.listTab')}
            </Link>
            <Link href="/admin/inventory/categories" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.assets.categoriesTab')}
            </Link>
            <Link href="/admin/inventory/utensils" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.utensils.listTab')}
            </Link>
            <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1 whitespace-nowrap">{t('inventory.utensils.categoriesTab')}</span>
            <Link href="/admin/inventory/utensils/counts" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              Historial
            </Link>
            <Link href="/admin/inventory/utensils/schedules" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              Programación
            </Link>
            </div>
        </div>
        <button 
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('inventory.utensils.categories.newCategory')}
        </button>
      </div>

      {/* Formulario Crear Categoría (Modal) */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreate(false); resetForm(); }} />
          <div className="relative bg-surface border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4 animate-in slide-in-from-bottom-4 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-text-primary">
                {editingCategory ? 'Editar Categoría' : t('inventory.utensils.categories.createTitle')}
              </h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-2 text-text-secondary hover:bg-surface-raised rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {error && (
              <div className="p-3 bg-error-light text-error text-sm rounded-xl border border-error/20">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-text-secondary">{t('inventory.utensils.nameLabel')}</label>
                <input 
                  placeholder={t('inventory.utensils.namePlaceholder')}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-text-secondary">Descripción (Opcional)</label>
                <input 
                  placeholder="Ej. Artículos de loza y cerámica"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="flex-1 h-12 rounded-xl font-semibold text-sm border border-border text-text-primary hover:bg-surface-raised transition-colors"
              >
                {t('inventory.assets.cancel')}
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] flex items-center justify-center gap-2 bg-primary text-text-inverse px-6 h-12 rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? t('inventory.utensils.saving') : editingCategory ? 'Guardar Cambios' : t('inventory.utensils.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-surface-raised rounded-xl w-full"></div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          {t('inventory.utensils.categories.noCategories')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="bg-surface border border-border rounded-xl p-5 hover:border-border-strong transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-text-primary text-lg">{cat.name}</h3>
                <button 
                  onClick={() => startEdit(cat)}
                  className="text-text-secondary opacity-0 group-hover:opacity-100 hover:text-primary transition-all p-1"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              {cat.description && (
                <p className="text-sm text-text-secondary line-clamp-2">{cat.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
