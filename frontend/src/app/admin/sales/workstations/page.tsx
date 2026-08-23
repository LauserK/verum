'use client'

import React, { useState } from 'react'
import { useVenue } from '@/components/VenueContext'
import {
  useWorkstations,
  useCreateWorkstation,
  useUpdateWorkstation,
  useDeleteWorkstation,
} from '@/hooks/useSales'
import { Workstation } from '@/lib/api/sales'
import {
  Monitor,
  Plus,
  Edit2,
  Trash2,
  Building2,
  CheckCircle2,
  XCircle,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  Package,
  Wine,
  ChevronDown,
  X,
  Loader2,
  Power,
  PowerOff,
  SlidersHorizontal,
  Info,
} from 'lucide-react'

interface SaleModeConfig {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  color: string
}

const AVAILABLE_MODES: SaleModeConfig[] = [
  {
    id: 'tables',
    label: 'Mesas / Salón',
    icon: UtensilsCrossed,
    description: 'Servicio a mesa con comandas y planos',
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'takeout',
    label: 'Para Llevar',
    icon: ShoppingBag,
    description: 'Venta directa en mostrador para llevar',
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    icon: Truck,
    description: 'Despacho a domicilio y gestión de repartidores',
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 'pickup',
    label: 'Pick-up',
    icon: Package,
    description: 'Retiro en local con preparación previa',
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  },
  {
    id: 'bar',
    label: 'Barra / Tragos',
    icon: Wine,
    description: 'Cobro rápido e inmediato en barra',
    color: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
  },
]

export default function WorkstationsAdminPage() {
  const { selectedVenueId, availableVenues, setSelectedVenueId } = useVenue()
  const { data: workstations = [], isLoading } = useWorkstations(selectedVenueId || undefined)

  const createWorkstation = useCreateWorkstation()
  const updateWorkstation = useUpdateWorkstation()
  const deleteWorkstation = useDeleteWorkstation()

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStation, setEditingStation] = useState<Workstation | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    venue_id: '',
    is_active: true,
    allowed_modes: ['tables', 'takeout', 'delivery', 'pickup', 'bar'] as string[],
  })

  // Filter state (Active / All)
  const [filterActiveOnly, setFilterActiveOnly] = useState(false)

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingStation(null)
    setFormData({
      name: '',
      venue_id: selectedVenueId || availableVenues[0]?.id || '',
      is_active: true,
      allowed_modes: ['tables', 'takeout', 'delivery', 'pickup', 'bar'],
    })
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (station: Workstation) => {
    setEditingStation(station)
    setFormData({
      name: station.name,
      venue_id: station.venue_id || selectedVenueId || availableVenues[0]?.id || '',
      is_active: station.is_active,
      allowed_modes: station.allowed_modes && station.allowed_modes.length > 0
        ? station.allowed_modes
        : ['tables', 'takeout', 'delivery', 'pickup', 'bar'],
    })
    setIsModalOpen(true)
  }

  // Save Station (Create / Update)
  const handleSaveStation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    const payload: Partial<Workstation> = {
      name: formData.name.trim(),
      venue_id: formData.venue_id || null,
      is_active: formData.is_active,
      allowed_modes: formData.allowed_modes,
    }

    try {
      if (editingStation) {
        await updateWorkstation.mutateAsync({
          id: editingStation.id,
          data: payload,
        })
      } else {
        await createWorkstation.mutateAsync(payload)
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving workstation:', err)
    }
  }

  // Soft toggle active / inactive for auditability & traceability
  const handleToggleActive = async (station: Workstation) => {
    try {
      await updateWorkstation.mutateAsync({
        id: station.id,
        data: { is_active: !station.is_active },
      })
    } catch (err) {
      console.error('Error toggling workstation active status:', err)
    }
  }

  // Delete Station
  const handleDeleteStation = async (station: Workstation) => {
    const confirmMsg = `¿Estás seguro de que deseas eliminar permanentemente la estación "${station.name}"?\n(Tip: Puedes desactivarla para mantener la trazabilidad)`
    if (!window.confirm(confirmMsg)) return

    try {
      await deleteWorkstation.mutateAsync(station.id)
    } catch (err) {
      console.error('Error deleting workstation:', err)
    }
  }

  // Toggle allowed mode in form
  const toggleMode = (modeId: string) => {
    setFormData((prev) => {
      const exists = prev.allowed_modes.includes(modeId)
      if (exists) {
        if (prev.allowed_modes.length === 1) return prev
        return { ...prev, allowed_modes: prev.allowed_modes.filter((m) => m !== modeId) }
      } else {
        return { ...prev, allowed_modes: [...prev.allowed_modes, modeId] }
      }
    })
  }

  // Filtered list
  const filteredWorkstations = workstations.filter((w) => {
    if (filterActiveOnly && !w.is_active) return false
    return true
  })

  // Helper to get venue name
  const getVenueName = (venueId?: string | null) => {
    if (!venueId) return 'Todas las sedes (Global)'
    const venue = availableVenues.find((v) => v.id === venueId)
    return venue ? venue.name : 'Sede asignada'
  }

  const isSaving = createWorkstation.isPending || updateWorkstation.isPending

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2.5">
              <Monitor className="w-6 h-6 text-primary" /> Estaciones de Trabajo (POS)
            </h1>

            {/* Interactive Venue Switcher */}
            <div className="relative inline-flex items-center">
              <Building2 className="w-3.5 h-3.5 text-primary absolute left-3 pointer-events-none" />
              <select
                value={selectedVenueId || ''}
                onChange={(e) => setSelectedVenueId(e.target.value)}
                className="pl-8 pr-7 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                aria-label="Filtrar por sede"
              >
                <option value="" className="bg-surface text-text-primary">
                  Todas las sedes
                </option>
                {availableVenues.map((v) => (
                  <option key={v.id} value={v.id} className="bg-surface text-text-primary">
                    Sede: {v.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-primary absolute right-2.5 pointer-events-none opacity-70" />
            </div>
          </div>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">
            Gestiona las terminales de venta, cajas registradoras y los modos operativos permitidos (Salón, Llevar, Delivery, etc.) por sede.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-text-inverse hover:bg-primary-hover rounded-xl text-xs font-bold transition-all shadow-sm shadow-primary/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <Plus className="w-4 h-4" /> Nueva Estación
          </button>
        </div>
      </div>

      {/* Filter / Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Total Estaciones: <span className="text-text-primary font-bold">{workstations.length}</span>
          </span>
          <span className="text-border">•</span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {workstations.filter((w) => w.is_active).length} Activas
          </span>
          {workstations.some((w) => !w.is_active) && (
            <>
              <span className="text-border">•</span>
              <span className="text-xs font-semibold text-text-tertiary">
                {workstations.filter((w) => !w.is_active).length} Desactivadas
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFilterActiveOnly(!filterActiveOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filterActiveOnly
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {filterActiveOnly ? 'Mostrando sólo activas' : 'Mostrar todas'}
          </button>
        </div>
      </div>

      {/* Workstations Grid / Empty States */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border rounded-2xl">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-medium text-text-secondary">Cargando estaciones de trabajo...</p>
        </div>
      ) : filteredWorkstations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-surface border border-border rounded-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-border flex items-center justify-center text-text-secondary">
            <Monitor className="w-7 h-7 stroke-[1.5] text-primary/60" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">
              {filterActiveOnly ? 'No hay estaciones activas' : 'No hay estaciones registradas'}
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mt-1">
              {filterActiveOnly
                ? 'Todas las estaciones de esta vista se encuentran actualmente desactivadas.'
                : 'Crea tu primera estación de trabajo para que los cajeros o meseros puedan iniciar sesión en el POS.'}
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-text-inverse hover:bg-primary-hover rounded-xl text-xs font-bold transition-all shadow-sm shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Crear Estación
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWorkstations.map((station) => {
            const modes = station.allowed_modes || ['tables', 'takeout', 'delivery', 'pickup', 'bar']
            return (
              <div
                key={station.id}
                className={`group bg-surface border rounded-2xl p-5 shadow-sm transition-all duration-200 flex flex-col justify-between hover:shadow-md ${
                  station.is_active
                    ? 'border-border hover:border-primary/50'
                    : 'border-border/60 bg-surface/60 opacity-80'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Row: Name and Active Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
                          station.is_active
                            ? 'bg-primary/10 border-primary/25 text-primary'
                            : 'bg-surface-raised border-border text-text-secondary'
                        }`}
                      >
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-text-primary leading-tight flex items-center gap-1.5">
                          {station.name}
                        </h2>
                        <span className="text-xs text-text-secondary flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-text-tertiary" />
                          {getVenueName(station.venue_id)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(station)}
                      title={station.is_active ? 'Hacer clic para desactivar' : 'Hacer clic para activar'}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                        station.is_active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-surface-raised text-text-secondary border-border hover:bg-surface-raised/80'
                      }`}
                    >
                      {station.is_active ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Activa
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-text-secondary" /> Inactiva
                        </>
                      )}
                    </button>
                  </div>

                  {/* Allowed Modes Section */}
                  <div className="space-y-1.5 pt-2 border-t border-border/70">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                      Modos de Venta Habilitados
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {modes.map((modeKey) => {
                        const config = AVAILABLE_MODES.find((m) => m.id === modeKey)
                        if (!config) return null
                        const Icon = config.icon
                        return (
                          <span
                            key={modeKey}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.color}`}
                          >
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </span>
                        )
                      })}
                      {modes.length === 0 && (
                        <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
                          <Info className="w-3.5 h-3.5" /> Sin modos asignados
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-border gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(station)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      station.is_active
                        ? 'text-text-secondary hover:text-amber-600 hover:bg-amber-500/10'
                        : 'text-emerald-600 hover:bg-emerald-500/10'
                    }`}
                  >
                    {station.is_active ? (
                      <>
                        <PowerOff className="w-3.5 h-3.5" /> Desactivar
                      </>
                    ) : (
                      <>
                        <Power className="w-3.5 h-3.5" /> Activar
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(station)}
                      className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg transition-colors"
                      title="Editar estación"
                      aria-label={`Editar estación ${station.name}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStation(station)}
                      className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Eliminar permanentemente"
                      aria-label={`Eliminar estación ${station.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Workstation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-raised/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    {editingStation ? 'Editar Estación de Trabajo' : 'Nueva Estación de Trabajo'}
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Configuración de terminal y modos operativos para el POS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveStation} className="p-6 space-y-5">
              {/* Station Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">
                  Nombre de la Estación / Caja <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Caja Principal 01, Barra Terraza, POS Rápido"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-surface-raised border border-border rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Sede / Venue Assignment */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">
                  Asignar a Sede / Local
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-text-secondary absolute left-3 top-3 pointer-events-none" />
                  <select
                    value={formData.venue_id}
                    onChange={(e) => setFormData({ ...formData, venue_id: e.target.value })}
                    className="w-full pl-9 pr-8 py-2.5 bg-surface-raised border border-border rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                  >
                    <option value="">Todas las sedes (Global / Flotante)</option>
                    {availableVenues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-text-secondary absolute right-3 top-3 pointer-events-none" />
                </div>
                <p className="text-[11px] text-text-tertiary">
                  Si seleccionas una sede específica, este terminal solo estará disponible para dicha ubicación.
                </p>
              </div>

              {/* Allowed Modes Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-secondary">
                    Modos de Venta Permitidos
                  </label>
                  <span className="text-[11px] text-text-tertiary">
                    {formData.allowed_modes.length} seleccionados
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AVAILABLE_MODES.map((mode) => {
                    const isSelected = formData.allowed_modes.includes(mode.id)
                    const Icon = mode.icon
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => toggleMode(mode.id)}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary shadow-xs'
                            : 'bg-surface-raised border-border text-text-secondary hover:border-text-secondary/40 hover:text-text-primary'
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-lg mt-0.5 ${
                            isSelected ? 'bg-primary text-white' : 'bg-surface border border-border'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold block leading-snug">
                            {mode.label}
                          </span>
                          <span className="text-[10px] text-text-tertiary block leading-tight mt-0.5 line-clamp-1">
                            {mode.description}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Active Switch */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <span className="text-xs font-semibold text-text-primary block">
                    Estado de la Estación
                  </span>
                  <span className="text-[11px] text-text-secondary block">
                    Habilita o suspende el acceso a este punto de venta
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.is_active}
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                    formData.is_active ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      formData.is_active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-surface-raised border border-border hover:bg-surface text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formData.name.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 bg-primary text-text-inverse hover:bg-primary-hover rounded-xl text-xs font-bold transition-all shadow-sm shadow-primary/20 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingStation ? 'Guardar Cambios' : 'Crear Estación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
