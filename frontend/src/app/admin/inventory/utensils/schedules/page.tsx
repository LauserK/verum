// frontend/src/app/admin/inventory/utensils/schedules/page.tsx
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { adminApi, getProfile, type CountSchedule, type VenueInfo, type UtensilCategory, type Utensil } from '@/lib/api'
import { Plus, Save, X, Loader2, Calendar, Clock, MapPin, User, Search, Trash2, Edit3 } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTranslations } from '@/components/I18nProvider'
import { useVenue } from '@/components/VenueContext'

export default function SchedulesPage() {
  const { t } = useTranslations()
  const { availableVenues, activeOrgId } = useVenue()
  const [schedules, setSchedules] = useState<CountSchedule[]>([])
  const [users, setUsers] = useState<{ id: string, full_name: string }[]>([])
  const [categories, setCategories] = useState<UtensilCategory[]>([])
  const [utensils, setUtensils] = useState<Utensil[]>([])
  
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingSchedule, setEditingSchedule] = useState<CountSchedule | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // Form State
  const [newName, setNewName] = useState('')
  const [newVenueId, setNewVenueId] = useState('')
  const [newAssignedTo, setNewAssignedTo] = useState('')
  const [newFrequency, setNewFrequency] = useState('weekly')
  const [newScope, setNewScope] = useState<'all' | 'category' | 'custom'>('all')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newNextDue, setNewNextDue] = useState('')
  
  // Custom items predictive search state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItems, setSelectedItems] = useState<Utensil[]>([])

  const resetForm = () => {
    setNewName('')
    setNewVenueId(availableVenues.length > 0 ? availableVenues[0].id : '')
    setNewAssignedTo('')
    setNewFrequency('weekly')
    setNewScope('all')
    setNewCategoryId('')
    setNewNextDue('')
    setSearchTerm('')
    setSelectedItems([])
    setError('')
  }

  const fetchData = useCallback(async () => {
    if (!activeOrgId) return
    setLoading(true)
    try {
      const [schedRes, usersRes, catRes, utRes] = await Promise.all([
        adminApi.getSchedules(),
        adminApi.getUsers(), // Assuming we can list users in the org
        adminApi.getUtensilCategories(activeOrgId),
        adminApi.getUtensils({ org_id: activeOrgId })
      ])
      setSchedules(schedRes)
      setUsers(usersRes)
      setCategories(catRes)
      setUtensils(utRes.filter(u => u.is_active))
      
      if (availableVenues.length > 0 && !newVenueId) {
        setNewVenueId(availableVenues[0].id)
      }
    } catch (err) {
      console.error('Error fetching schedules data:', err)
    } finally {
      setLoading(false)
    }
  }, [activeOrgId, availableVenues, newVenueId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Predictive search logic
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase()
    return utensils.filter(u => 
      !selectedItems.find(si => si.id === u.id) && // Exclude already selected
      (u.name.toLowerCase().includes(term) || u.utensil_categories?.name?.toLowerCase().includes(term))
    ).slice(0, 5) // Limit to 5 suggestions
  }, [searchTerm, utensils, selectedItems])

  const handleAddItem = (item: Utensil) => {
    setSelectedItems(prev => {
      const updated = [...prev, item]
      // Sort by Category Name, then Item Name
      return updated.sort((a, b) => {
        const catA = a.utensil_categories?.name || 'Z'
        const catB = b.utensil_categories?.name || 'Z'
        if (catA < catB) return -1
        if (catA > catB) return 1
        return a.name.localeCompare(b.name)
      })
    })
    setSearchTerm('')
  }

  const handleRemoveItem = (id: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== id))
  }

  const startEdit = (schedule: CountSchedule) => {
    setEditingSchedule(schedule)
    setNewName(schedule.name)
    setNewVenueId(schedule.venue_id)
    setNewAssignedTo(schedule.assigned_to || '')
    setNewFrequency(schedule.frequency)
    const currentScope = schedule.scope === 'full' ? 'all' : schedule.scope as 'all' | 'category' | 'custom'
    setNewScope(currentScope)
    setNewCategoryId(schedule.category_id || '')
    setNewNextDue(schedule.next_due)
    
    if (schedule.scope === 'custom' && schedule.item_ids) {
       const preSelected = utensils.filter(u => schedule.item_ids!.includes(u.id))
       setSelectedItems(preSelected)
    } else {
       setSelectedItems([])
    }
    setShowCreate(true)
  }

  const handleArchive = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres archivar (eliminar) esta programación?')) return
    try {
      await adminApi.updateSchedule(id, { is_active: false })
      await fetchData()
    } catch (e) {
      console.error(e)
      alert('Error al archivar la programación')
    }
  }

  const handleSave = async () => {
    setError('')
    if (!newName || !newVenueId || !newNextDue) {
      setError('Nombre, Sede y Fecha de inicio son obligatorios.')
      return
    }
    if (newScope === 'category' && !newCategoryId) {
      setError('Debes seleccionar una categoría.')
      return
    }
    if (newScope === 'custom' && selectedItems.length === 0) {
      setError('Debes seleccionar al menos un ítem.')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, string | null | string[]> = {
        venue_id: newVenueId,
        assigned_to: newAssignedTo || null,
        name: newName,
        frequency: newFrequency,
        scope: newScope,
        category_id: newScope === 'category' ? newCategoryId : null,
        next_due: newNextDue,
      }
      
      if (newScope === 'custom') {
        payload.item_ids = selectedItems.map(i => i.id)
      }

      if (editingSchedule) {
        const data = await adminApi.updateSchedule(editingSchedule.id, payload)
        if (data) {
          await fetchData()
          setShowCreate(false)
          resetForm()
        }
      } else {
        const data = await adminApi.createSchedule(payload)
        if (data) {
          await fetchData()
          setShowCreate(false)
          resetForm()
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error al crear la programación.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Programación de Conteos</h1>
          <div className="flex items-center gap-6 mt-2 overflow-x-auto">
            <Link href="/admin/inventory/assets" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              {t('inventory.assets.listTab')}
            </Link>
            <Link href="/admin/inventory/categories" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              {t('inventory.assets.categoriesTab')}
            </Link>
            <Link href="/admin/inventory/utensils" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              {t('inventory.utensils.listTab')}
            </Link>
            <Link href="/admin/inventory/utensils/categories" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              {t('inventory.utensils.categoriesTab')}
            </Link>
            <Link href="/admin/inventory/utensils/counts" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              Historial
            </Link>
            <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1 whitespace-nowrap">Programación</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input 
              type="checkbox" 
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary w-4 h-4"
            />
            Mostrar Inactivas
          </label>
          <button 
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nueva Programación
          </button>
        </div>
      </div>

      {/* Create Schedule Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreate(false); resetForm(); }} />
          <div className="relative bg-surface border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <h2 className="text-xl font-bold text-text-primary">{editingSchedule ? 'Editar Programación' : 'Programar Inventario'}</h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-2 text-text-secondary hover:bg-surface-raised rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {error && (
              <div className="p-3 bg-error-light text-error text-sm rounded-xl border border-error/20 flex-shrink-0">
                {error}
              </div>
            )}

            <div className="space-y-4 overflow-y-auto pr-2 flex-1">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-text-secondary">Nombre de la Orden *</label>
                <input 
                  placeholder="Ej. Conteo Mensual Cubertería"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">Sede *</label>
                  <select 
                    value={newVenueId}
                    onChange={e => setNewVenueId(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="">Seleccionar sede</option>
                    {availableVenues.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">Asignar a (Opcional)</label>
                  <select 
                    value={newAssignedTo}
                    onChange={e => setNewAssignedTo(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="">Cualquiera en la sede</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">Frecuencia *</label>
                  <select 
                    value={newFrequency}
                    onChange={e => setNewFrequency(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                    <option value="one_time">Una sola vez</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">Siguiente Conteo (Inicio) *</label>
                  <input 
                    type="date"
                    value={newNextDue}
                    onChange={e => setNewNextDue(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-sm font-semibold text-text-secondary">Alcance del Conteo *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['all', 'category', 'custom'] as const).map(scope => (
                    <button
                      key={scope}
                      onClick={() => setNewScope(scope)}
                      className={`h-10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border
                        ${newScope === scope 
                          ? 'bg-primary text-text-inverse border-primary' 
                          : 'bg-surface-raised border-border text-text-secondary hover:border-border-strong'}`}
                    >
                      {scope === 'all' ? 'Todo' : scope === 'category' ? 'Categoría' : 'Personalizado'}
                    </button>
                  ))}
                </div>
              </div>

              {newScope === 'category' && (
                <div className="space-y-1.5 animate-in fade-in">
                  <label className="text-sm font-semibold text-text-secondary">Seleccionar Categoría *</label>
                  <select 
                    value={newCategoryId}
                    onChange={e => setNewCategoryId(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="">Selecciona una categoría...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {newScope === 'custom' && (
                <div className="space-y-3 animate-in fade-in bg-surface-raised p-4 rounded-2xl border border-border">
                  <div className="space-y-1.5 relative">
                    <label className="text-sm font-semibold text-text-secondary">Agregar Ítems *</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input 
                        placeholder="Escribe para buscar..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-11 text-sm text-text-primary focus:border-primary outline-none transition-all"
                      />
                    </div>
                    
                    {/* Predictive Search Results */}
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
                        {searchResults.map(item => (
                          <button
                            key={item.id}
                            onClick={() => handleAddItem(item)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-surface-raised transition-colors border-b border-border last:border-0 flex justify-between items-center"
                          >
                            <span className="font-semibold text-text-primary">{item.name}</span>
                            <span className="text-xs text-text-secondary">{item.utensil_categories?.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected Items List */}
                  {selectedItems.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Ítems a contar ({selectedItems.length})</p>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                        {selectedItems.map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2">
                            <div>
                              <p className="text-sm font-semibold text-text-primary">{item.name}</p>
                              <p className="text-[10px] text-text-secondary">{item.utensil_categories?.name || 'Sin categoría'}</p>
                            </div>
                            <button 
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 text-text-secondary hover:text-error transition-colors rounded-md hover:bg-error/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
            
            <div className="flex gap-3 pt-4 border-t border-border flex-shrink-0">
              <button 
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="flex-1 h-12 rounded-xl font-semibold text-sm border border-border text-text-primary hover:bg-surface-raised transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] flex items-center justify-center gap-2 bg-primary text-text-inverse px-6 h-12 rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingSchedule ? 'Guardar Cambios' : 'Crear Programación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List Schedules */}
      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-surface-raised rounded-2xl w-full"></div>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-2xl">
          <Calendar className="w-12 h-12 text-text-secondary mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-text-primary mb-1">Sin programaciones activas</h3>
          <p className="text-sm text-text-secondary">Crea órdenes de conteo para que el staff sepa qué y cuándo auditar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules.filter(s => showArchived ? true : s.is_active).map((s) => (
            <div 
              key={s.id} 
              className={`bg-surface border border-border rounded-2xl p-5 shadow-sm transition-opacity group ${!s.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-text-primary text-lg">{s.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-surface-raised text-text-secondary px-2 py-0.5 rounded-md">
                      {s.frequency.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                      {s.scope}
                    </span>
                    {!s.is_active && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-error/10 text-error px-2 py-0.5 rounded-md">
                        Inactiva
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(s)} className="p-1.5 text-text-secondary hover:text-primary bg-surface-raised rounded-md transition-colors" title="Editar">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {s.is_active && (
                    <button onClick={() => handleArchive(s.id)} className="p-1.5 text-text-secondary hover:text-error bg-surface-raised rounded-md transition-colors" title="Eliminar/Archivar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 mt-4 text-sm">
                <div className="flex items-center gap-2 text-text-secondary">
                  <MapPin className="w-4 h-4" />
                  <span>{s.venues?.name || 'Sede no encontrada'}</span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <User className="w-4 h-4" />
                  <span>{s.profiles?.full_name || 'Cualquiera en la sede'}</span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <Clock className="w-4 h-4" />
                  <span className={s.is_active && new Date(s.next_due) <= new Date() ? 'text-warning font-semibold' : ''}>
                    Próximo: {format(new Date(s.next_due), "dd MMM yyyy", { locale: es })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
