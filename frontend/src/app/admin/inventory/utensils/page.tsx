// frontend/src/app/admin/inventory/utensils/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminApi, getProfile, type Utensil, type UtensilCategory, type VenueInfo } from '@/lib/api'
import { useVenue } from '@/components/VenueContext'
import { Plus, Edit3, Save, X, Loader2, Search, Filter, ArrowRightLeft } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from '@/components/I18nProvider'

export default function UtensilsPage() {
  const { t } = useTranslations()
  const { availableVenues, activeOrgId } = useVenue()
  const [utensils, setUtensils] = useState<Utensil[]>([])
  const [categories, setCategories] = useState<UtensilCategory[]>([])
  const [uniqueUnits, setUniqueUnits] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modals visibility
  const [showCreate, setShowCreate] = useState(false)
  const [showMovement, setShowMovement] = useState(false)
  
  const [editingUtensil, setEditingUtensil] = useState<Utensil | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Create/Edit Form State
  const [newName, setNewName] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newMinStock, setNewMinStock] = useState('0')

  // Movement Form State
  const [moveUtensilId, setMoveUtensilId] = useState('')
  const [moveType, setMoveType] = useState<'entry' | 'exit' | 'transfer' | 'adjustment'>('entry')
  const [moveQty, setMoveQty] = useState('1')
  const [moveFromVenue, setMoveFromVenue] = useState('')
  const [moveToVenue, setMoveToVenue] = useState('')
  const [moveNotes, setMoveNotes] = useState('')

  const resetForm = () => {
    setNewName('')
    setNewCategoryId('')
    setNewUnit('')
    setNewMinStock('0')
    setEditingUtensil(null)
    setError('')
  }

  const resetMovementForm = () => {
    setMoveUtensilId('')
    setMoveType('entry')
    setMoveQty('1')
    setMoveFromVenue('')
    setMoveToVenue('')
    setMoveNotes('')
    setError('')
  }

  const startEdit = (item: Utensil) => {
    setEditingUtensil(item)
    setNewName(item.name)
    setNewCategoryId(item.category_id || '')
    setNewUnit(item.unit)
    setNewMinStock(item.min_stock.toString())
    setShowCreate(true)
  }

  const startMovement = (item?: Utensil) => {
    if (item) setMoveUtensilId(item.id)
    setShowMovement(true)
  }

  const fetchData = useCallback(async () => {
    if (!activeOrgId) return
    setLoading(true)
    try {
      const [utRes, catRes] = await Promise.all([
        adminApi.getUtensils({ org_id: activeOrgId }),
        adminApi.getUtensilCategories(activeOrgId)
      ])
      setUtensils(utRes)
      setCategories(catRes)
      
      // Extract unique units for suggestions
      const units = Array.from(new Set(utRes.map(u => u.unit))).filter(Boolean)
      setUniqueUnits(units)
    } catch (err) {
      console.error('Error fetching utensils data:', err)
    } finally {
      setLoading(false)
    }
  }, [activeOrgId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    setError('')
    if (!newName || !newCategoryId) {
      setError(t('inventory.assets.errors.required'))
      return
    }

    setSaving(true)
    try {
      if (!activeOrgId) throw new Error('No organization found')
      
      const payload = {
        org_id: activeOrgId,
        category_id: newCategoryId,
        name: newName,
        unit: newUnit || 'unidades',
        min_stock: parseInt(newMinStock) || 0
      }

      if (editingUtensil) {
        const data = await adminApi.updateUtensil(editingUtensil.id, payload)
        if (data) {
          setUtensils(prev => prev.map(u => u.id === editingUtensil.id ? data : u).sort((a, b) => a.name.localeCompare(b.name)))
          setShowCreate(false)
          resetForm()
        }
      } else {
        const data = await adminApi.createUtensil(payload)
        if (data) {
          setUtensils(prev => [data, ...prev].sort((a, b) => a.name.localeCompare(b.name)))
          
          if (newUnit && !uniqueUnits.includes(newUnit)) {
            setUniqueUnits(prev => [...prev, newUnit].sort())
          }
          
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

  const handleRecordMovement = async () => {
    setError('')
    if (!moveUtensilId || !moveQty) {
      setError('Utensilio y cantidad son obligatorios.')
      return
    }

    setSaving(true)
    try {
      await adminApi.recordUtensilMovement({
        utensil_id: moveUtensilId,
        type: moveType,
        quantity: parseInt(moveQty),
        from_venue_id: moveFromVenue || undefined,
        to_venue_id: moveToVenue || undefined,
        notes: moveNotes || undefined
      })

      setShowMovement(false)
      resetMovementForm()
      alert('Movimiento registrado exitosamente')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error al registrar movimiento')
      }
    } finally {
      setSaving(false)
    }
  }

  const filteredUtensils = utensils.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.utensil_categories?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = !categoryFilter || u.category_id === categoryFilter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && u.is_active) || 
      (statusFilter === 'inactive' && !u.is_active)

    return matchesSearch && matchesCategory && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">{t('inventory.utensils.title')}</h1>
          <div className="flex items-center gap-6 mt-2 overflow-x-auto">
            <Link href="/admin/inventory/assets" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              {t('inventory.assets.listTab')}
            </Link>
            <Link href="/admin/inventory/categories" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              {t('inventory.assets.categoriesTab')}
            </Link>
            <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1 whitespace-nowrap">{t('inventory.utensils.listTab')}</span>
            <Link href="/admin/inventory/utensils/categories" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              {t('inventory.utensils.categoriesTab')}
            </Link>
            <Link href="/admin/inventory/utensils/counts" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              Historial
            </Link>
            <Link href="/admin/inventory/utensils/schedules" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              Programación
            </Link>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => startMovement()}
            className="flex items-center gap-2 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Movimiento
          </button>
          <button 
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('inventory.utensils.newItem')}
          </button>
        </div>
      </div>

      {/* Formulario Crear/Editar Utensilio (Modal) */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreate(false); resetForm(); }} />
          <div className="relative bg-surface border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4 animate-in slide-in-from-bottom-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-text-primary">
                {editingUtensil ? t('inventory.utensils.editTitle') : t('inventory.utensils.createTitle')}
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
                <label className="text-sm font-semibold text-text-secondary">{t('inventory.utensils.categoryLabel')}</label>
                <select 
                  value={newCategoryId}
                  onChange={e => setNewCategoryId(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                >
                  <option value="">{t('inventory.utensils.selectCategory')}</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">{t('inventory.utensils.unitLabel')}</label>
                  <input 
                    list="units-list"
                    placeholder={t('inventory.utensils.unitPlaceholder')}
                    value={newUnit}
                    onChange={e => setNewUnit(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                  <datalist id="units-list">
                    {uniqueUnits.map(unit => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">{t('inventory.utensils.minStockLabel')}</label>
                  <input 
                    type="number"
                    min="0"
                    value={newMinStock}
                    onChange={e => setNewMinStock(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
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
                {saving ? t('inventory.utensils.saving') : editingUtensil ? t('inventory.utensils.save') : t('inventory.utensils.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario Registrar Movimiento (Modal) */}
      {showMovement && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowMovement(false); resetMovementForm(); }} />
          <div className="relative bg-surface border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4 animate-in slide-in-from-bottom-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-text-primary">Registrar Movimiento</h2>
              <button onClick={() => { setShowMovement(false); resetMovementForm(); }} className="p-2 text-text-secondary hover:bg-surface-raised rounded-full transition-colors">
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
                <label className="text-sm font-semibold text-text-secondary">Utensilio *</label>
                <select 
                  value={moveUtensilId}
                  onChange={e => setMoveUtensilId(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary outline-none transition-all appearance-none"
                >
                  <option value="">Seleccionar ítem</option>
                  {utensils.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">Tipo de Movimiento</label>
                  <select 
                    value={moveType}
                    onChange={e => setMoveType(e.target.value as 'entry' | 'exit' | 'transfer' | 'adjustment')}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary outline-none appearance-none"
                  >
                    <option value="entry">Entrada (Ingreso)</option>
                    <option value="exit">Salida (Merma/Baja)</option>
                    <option value="transfer">Traslado entre Sedes</option>
                    <option value="adjustment">Ajuste Manual</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">Cantidad *</label>
                  <input 
                    type="number"
                    min="1"
                    value={moveQty}
                    onChange={e => setMoveQty(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary outline-none"
                  />
                </div>
              </div>

              {moveType === 'transfer' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-text-secondary">Desde Sede</label>
                    <select 
                      value={moveFromVenue}
                      onChange={e => setMoveFromVenue(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary outline-none appearance-none"
                    >
                      <option value="">Seleccionar origen</option>
                      {availableVenues.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-text-secondary">Hacia Sede</label>
                    <select 
                      value={moveToVenue}
                      onChange={e => setMoveToVenue(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary outline-none appearance-none"
                    >
                      <option value="">Seleccionar destino</option>
                      {availableVenues.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-text-secondary">Notas / Observaciones</label>
                <textarea 
                  placeholder="Ej. Reposición por rotura o Traslado de emergencia..."
                  value={moveNotes}
                  onChange={e => setMoveNotes(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl p-4 text-sm text-text-primary focus:border-primary outline-none transition-all h-24 resize-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => { setShowMovement(false); resetMovementForm(); }}
                className="flex-1 h-12 rounded-xl font-semibold text-sm border border-border text-text-primary hover:bg-surface-raised transition-colors"
              >
                {t('inventory.assets.cancel')}
              </button>
              <button 
                onClick={handleRecordMovement}
                disabled={saving || (moveType === 'transfer' && (!moveFromVenue || !moveToVenue))}
                className="flex-[2] flex items-center justify-center gap-2 bg-primary text-text-inverse px-6 h-12 rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Registrando...' : 'Confirmar Movimiento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input 
              placeholder="Buscar utensilios..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-11 text-sm text-text-primary focus:border-primary outline-none transition-all"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 border px-4 rounded-xl transition-colors
              ${showFilters || categoryFilter || statusFilter !== 'all' 
                ? 'bg-primary/10 border-primary text-primary' 
                : 'bg-surface border-border text-text-secondary hover:bg-surface-raised'}`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">Filtros</span>
          </button>
        </div>

        {showFilters && (
          <div className="bg-surface border border-border rounded-2xl p-4 flex flex-wrap gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">Categoría</label>
              <select 
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full bg-surface-raised border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none"
              >
                <option value="">Todas las categorías</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">Estado</label>
              <div className="flex gap-2">
                {(['all', 'active', 'inactive'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border
                      ${statusFilter === s 
                        ? 'bg-primary text-text-inverse border-primary' 
                        : 'bg-surface-raised border-border text-text-secondary hover:border-border-strong'}`}
                  >
                    {s === 'all' ? 'Todos' : s === 'active' ? 'Activos' : 'Inactivos'}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-full sm:w-auto flex items-end">
              <button 
                onClick={() => { setCategoryFilter(''); setStatusFilter('all'); }}
                className="text-xs font-bold text-primary hover:underline px-2 py-1"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse flex flex-col gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-surface-raised rounded-xl w-full"></div>
          ))}
        </div>
      ) : filteredUtensils.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-2xl">
          <h3 className="text-lg font-bold text-text-primary mb-1">{t('inventory.utensils.noItemsTitle')}</h3>
          <p className="text-sm text-text-secondary max-w-sm mx-auto mb-6">{t('inventory.utensils.noItemsDesc')}</p>
          <button 
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="text-primary font-medium hover:underline"
          >
            {t('inventory.utensils.createFirst')}
          </button>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-raised text-text-secondary font-semibold">
              <tr>
                <th className="px-6 py-4">{t('inventory.utensils.table.name')}</th>
                <th className="px-6 py-4">{t('inventory.utensils.table.category')}</th>
                <th className="px-6 py-4">{t('inventory.utensils.table.unit')}</th>
                <th className="px-6 py-4">{t('inventory.utensils.table.minStock')}</th>
                <th className="px-6 py-4">{t('inventory.utensils.table.status')}</th>
                <th className="px-6 py-4 text-right">{t('inventory.utensils.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUtensils.map(item => (
                <tr key={item.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-text-primary">{item.name}</td>
                  <td className="px-6 py-4 text-text-secondary">{item.utensil_categories?.name || '—'}</td>
                  <td className="px-6 py-4 text-text-secondary">{item.unit}</td>
                  <td className="px-6 py-4 text-text-secondary">{item.min_stock}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider
                      ${item.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                      {item.is_active ? t('inventory.utensils.status.active') : t('inventory.utensils.status.inactive')}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex justify-end gap-2">
                    <button 
                      onClick={() => startMovement(item)}
                      className="p-2 text-text-secondary hover:text-primary transition-colors bg-surface-raised rounded-lg" 
                      title="Mover"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => startEdit(item)}
                      className="p-2 text-text-secondary hover:text-primary transition-colors bg-surface-raised rounded-lg" 
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
