// frontend/src/app/admin/inventory/categories/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Plus, Edit3, Save, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from '@/components/I18nProvider'

interface Category {
  id: string
  name: string
  review_interval_days: number
  icon?: string
}

export default function CategoriesPage() {
  const { t } = useTranslations()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form State
  const [newName, setNewName] = useState('')
  const [newInterval, setNewInterval] = useState('30')

  const supabase = createClient()

  const resetForm = () => {
    setNewName('')
    setNewInterval('30')
    setEditingCategory(null)
    setError('')
  }

  const startEdit = (cat: Category) => {
    setEditingCategory(cat)
    setNewName(cat.name)
    setNewInterval(cat.review_interval_days.toString())
    setShowCreate(true)
  }

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes.user) return
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userRes.user.id)
      .single()
      
    if (profile?.organization_id) {
      const { data } = await supabase
        .from('asset_categories')
        .select('*')
        .eq('org_id', profile.organization_id)
        .order('name')
      
      if (data) setCategories(data as Category[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleSave = async () => {
    setError('')
    if (!newName) {
      setError(t('inventory.categories.errors.required'))
      return
    }

    setSaving(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', userRes.user?.id).single()
      
      const payload = {
        org_id: profile?.organization_id,
        name: newName,
        review_interval_days: parseInt(newInterval) || 30
      }

      if (editingCategory) {
        const { data, error: err } = await supabase
          .from('asset_categories')
          .update(payload)
          .eq('id', editingCategory.id)
          .select()
          .single()
        
        if (err) throw err
        if (data) {
          setCategories(prev => prev.map(c => c.id === editingCategory.id ? (data as Category) : c).sort((a, b) => a.name.localeCompare(b.name)))
          setShowCreate(false)
          resetForm()
        }
      } else {
        const { data, error: err } = await supabase.from('asset_categories').insert(payload).select().single()

        if (err) throw err
        if (data) {
          setCategories(prev => [...prev, data as Category].sort((a, b) => a.name.localeCompare(b.name)))
          setShowCreate(false)
          resetForm()
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(t('inventory.categories.errors.generic'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">{t('inventory.categories.title')}</h1>
          <div className="flex items-center gap-6 mt-2">
            <Link href="/admin/inventory/assets" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.assets.listTab')}
            </Link>
            <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1">{t('inventory.assets.categoriesTab')}</span>
            <Link href="/admin/inventory/utensils" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.utensils.listTab')}
            </Link>
            <Link href="/admin/inventory/utensils/categories" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.utensils.categoriesTab')}
            </Link>
          </div>
        </div>
        <button 
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('inventory.categories.newCategory')}
        </button>
      </div>

      {/* Formulario Crear Categoría (Modal) */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreate(false); resetForm(); }} />
          <div className="relative bg-surface border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4 animate-in slide-in-from-bottom-4 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-text-primary">
                {editingCategory ? 'Editar Categoría' : t('inventory.categories.createTitle')}
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
                <label className="text-sm font-semibold text-text-secondary">{t('inventory.categories.nameLabel')}</label>
                <input 
                  placeholder={t('inventory.categories.namePlaceholder')}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-text-secondary">{t('inventory.categories.intervalLabel')}</label>
                <input 
                  type="number"
                  min="1"
                  placeholder="Ej. 30"
                  value={newInterval}
                  onChange={e => setNewInterval(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
                <p className="text-xs text-text-secondary">{t('inventory.categories.intervalHint')}</p>
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
                {saving ? t('inventory.categories.saving') : editingCategory ? 'Guardar Cambios' : t('inventory.categories.create')}
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
          {t('inventory.categories.noCategories')}
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
              <div className="flex items-center gap-2">
                <span className="bg-surface-raised text-text-secondary text-xs font-semibold px-2.5 py-1 rounded-lg">
                  {t('inventory.categories.reviewEvery', { days: cat.review_interval_days })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
