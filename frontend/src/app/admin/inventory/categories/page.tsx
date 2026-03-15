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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form State
  const [newName, setNewName] = useState('')
  const [newInterval, setNewInterval] = useState('30')

  const supabase = createClient()

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

  const handleCreate = async () => {
    setError('')
    if (!newName) {
      setError(t('inventory.categories.errors.required'))
      return
    }

    setSaving(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', userRes.user?.id).single()
      
      const { data, error: err } = await supabase.from('asset_categories').insert({
        org_id: profile?.organization_id,
        name: newName,
        review_interval_days: parseInt(newInterval) || 30
      }).select().single()

      if (err) throw err
      
      if (data) {
        setCategories(prev => [...prev, data as Category].sort((a, b) => a.name.localeCompare(b.name)))
        setShowCreate(false)
        setNewName('')
        setNewInterval('30')
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
          </div>
        </div>
        <button 
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? t('inventory.assets.cancel') : t('inventory.categories.newCategory')}
        </button>
      </div>

      {showCreate && (
        <div className="bg-surface border border-primary/30 rounded-2xl p-6 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-bold text-text-primary">{t('inventory.categories.createTitle')}</h2>
          
          {error && (
            <div className="p-3 bg-error-light text-error text-sm rounded-xl border border-error/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          
          <div className="pt-2 flex justify-end">
            <button 
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-text-inverse px-6 h-11 rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? t('inventory.categories.saving') : t('inventory.categories.create')}
            </button>
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
                <button className="text-text-secondary opacity-0 group-hover:opacity-100 hover:text-primary transition-all">
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
