'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Utensils, 
  ShoppingBag, 
  Bike, 
  PackageCheck, 
  Wine, 
  Building2, 
  MapPin, 
  MonitorCheck, 
  UserCircle2, 
  ArrowRight, 
  Sparkles,
  ChevronRight,
  LogOut
} from 'lucide-react'
import { useVenue } from '@/components/VenueContext'
import { useProfile } from '@/hooks/useProfile'
import { usePosStore, PosMode } from '@/store/posStore'

interface ModeOption {
  id: PosMode
  title: string
  subtitle: string
  badge: string
  icon: React.ElementType
  color: string
}

const POS_MODES: ModeOption[] = [
  {
    id: 'tables',
    title: 'Servicio de Mesas',
    subtitle: 'Comedor, salones y asignación de mesas con plano interactivo',
    badge: 'Salón',
    icon: Utensils,
    color: 'from-amber-500/20 to-orange-500/10 text-amber-500 border-amber-500/30'
  },
  {
    id: 'takeout',
    title: 'Para Llevar',
    subtitle: 'Venta rápida directa por mostrador o caja principal',
    badge: 'Express',
    icon: ShoppingBag,
    color: 'from-blue-500/20 to-cyan-500/10 text-blue-500 border-blue-500/30'
  },
  {
    id: 'delivery',
    title: 'Delivery',
    subtitle: 'Despacho a domicilio con tracking de repartidor y dirección',
    badge: 'Despacho',
    icon: Bike,
    color: 'from-emerald-500/20 to-teal-500/10 text-emerald-500 border-emerald-500/30'
  },
  {
    id: 'pickup',
    title: 'Pick-up / Retiro',
    subtitle: 'Pedidos con retiro programado en tienda o ventanilla',
    badge: 'Retiro',
    icon: PackageCheck,
    color: 'from-purple-500/20 to-indigo-500/10 text-purple-500 border-purple-500/30'
  },
  {
    id: 'bar',
    title: 'Barra & Bebidas',
    subtitle: 'Cuentas rápidas de barra, coctelería y café',
    badge: 'Barra',
    icon: Wine,
    color: 'from-rose-500/20 to-pink-500/10 text-rose-500 border-rose-500/30'
  }
]

const WORKSTATIONS = [
  { id: 'pos-1', name: 'Caja Principal (POS 01)', location: 'Mostrador Central' },
  { id: 'pos-2', name: 'Terminal Barra (POS 02)', location: 'Área Bar / Terraza' },
  { id: 'pos-3', name: 'Caja Rápida / Takeout (POS 03)', location: 'Entrada' }
]

export default function PosSessionPage() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const { 
    activeOrgName, 
    selectedVenueId, 
    selectedVenueName, 
    availableVenues, 
    setSelectedVenueId 
  } = useVenue()

  const [selectedStation, setSelectedStation] = useState<string>('pos-1')
  const [selectedMode, setSelectedMode] = useState<PosMode>('tables')
  const [isEntering, setIsEntering] = useState(false)

  const handleStartSession = (modeToUse?: PosMode) => {
    const targetMode = modeToUse || selectedMode
    usePosStore.getState().setPosMode(targetMode)
    setIsEntering(true)
    setTimeout(() => {
      router.push('/pos/terminal')
    }, 200)
  }

  return (
    <div className="min-h-screen w-full bg-bg text-text-primary flex flex-col justify-between p-6 sm:p-10 select-none overflow-y-auto">
      {/* Top Bar / Header */}
      <header className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl shadow-inner">
            V
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-text-primary">VERUM POS</h1>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-full">
                Terminal v2.0
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">Apertura de sesión y selección de modo operativo</p>
          </div>
        </div>

        {/* User & Venue Status Indicators */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
          {/* Active Sede / Venue Selector */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border text-xs shadow-sm">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Sede Activa</span>
              {availableVenues.length > 1 ? (
                <select
                  value={selectedVenueId || ''}
                  onChange={(e) => setSelectedVenueId(e.target.value)}
                  className="bg-transparent font-bold text-text-primary focus:outline-none cursor-pointer text-xs pr-1"
                >
                  {availableVenues.map((v) => (
                    <option key={v.id} value={v.id} className="bg-surface text-text-primary">
                      {v.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold text-text-primary truncate max-w-[140px]">
                  {selectedVenueName || 'Sede Principal'}
                </span>
              )}
            </div>
          </div>

          {/* Cashier / Operator Indicator */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface border border-border text-xs shadow-sm">
            <UserCircle2 className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Cajero / Turno</span>
              <span className="font-bold text-text-primary truncate max-w-[140px]">
                {profile?.full_name || profile?.email || 'Operador POS'}
              </span>
            </div>
          </div>

          {/* Back to Admin / Exit */}
          <button
            onClick={() => router.push('/admin/sales')}
            className="p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-raised hover:text-error text-text-secondary transition-colors"
            title="Salir al panel de administración"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content: Mode & Station Selection */}
      <main className="w-full max-w-7xl mx-auto py-8 space-y-10 my-auto">
        {/* Section 1: Estación de Trabajo / Workstation */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                <MonitorCheck className="w-4 h-4 text-primary" /> 1. Selecciona tu Estación de Trabajo (Caja)
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {WORKSTATIONS.map((station) => {
              const isSelected = selectedStation === station.id
              return (
                <button
                  key={station.id}
                  onClick={() => setSelectedStation(station.id)}
                  className={`relative text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-surface border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/5'
                      : 'bg-surface border-border hover:border-border-strong hover:bg-surface-raised/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 rounded-xl bg-surface-raised border border-border text-primary">
                      <MonitorCheck className="w-5 h-5" />
                    </div>
                    {isSelected && (
                      <span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-text-primary">{station.name}</h3>
                    <p className="text-xs text-text-secondary mt-0.5">{station.location}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Section 2: Modo Operativo de Venta */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> 2. Selecciona el Modo Operativo para iniciar
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {POS_MODES.map((mode) => {
              const isSelected = selectedMode === mode.id
              const Icon = mode.icon

              return (
                <div
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  onDoubleClick={() => handleStartSession(mode.id)}
                  className={`group relative text-left p-5 rounded-3xl border transition-all duration-300 flex flex-col justify-between gap-6 cursor-pointer ${
                    isSelected
                      ? 'bg-surface border-primary ring-2 ring-primary/20 shadow-xl shadow-primary/10 -translate-y-1'
                      : 'bg-surface border-border hover:border-primary/50 hover:bg-surface-raised/70'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${mode.color} border flex items-center justify-center transition-transform group-hover:scale-105 duration-300`}>
                      <Icon className="w-7 h-7" strokeWidth={2.2} />
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                      isSelected
                        ? 'bg-primary text-text-inverse border-primary'
                        : 'bg-surface-raised text-text-secondary border-border'
                    }`}>
                      {mode.badge}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-base text-text-primary group-hover:text-primary transition-colors flex items-center justify-between">
                      <span>{mode.title}</span>
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                      {mode.subtitle}
                    </p>
                  </div>

                  {/* Card Action */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartSession(mode.id)
                    }}
                    disabled={isEntering}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      isSelected
                        ? 'bg-primary text-text-inverse hover:bg-primary-hover shadow-md shadow-primary/20 active:scale-95'
                        : 'bg-surface-raised border border-border text-text-secondary hover:text-text-primary hover:border-primary'
                    }`}
                  >
                    <span>Ingresar</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* Section 3: Bottom Action Banner */}
        <section className="bg-surface border border-border rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <MonitorCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-text-secondary tracking-wider">Configuración Lista</p>
              <h4 className="text-base font-bold text-text-primary mt-0.5">
                Entrar como <span className="text-primary capitalize">{POS_MODES.find(m => m.id === selectedMode)?.title}</span> en <span className="text-text-primary font-mono text-xs bg-surface-raised px-2 py-0.5 rounded-lg border border-border">{WORKSTATIONS.find(w => w.id === selectedStation)?.name}</span>
              </h4>
            </div>
          </div>

          <button
            onClick={() => handleStartSession()}
            disabled={isEntering}
            className="w-full sm:w-auto px-8 h-13 rounded-2xl bg-primary text-text-inverse font-bold text-sm hover:bg-primary-hover transition-all shadow-xl shadow-primary/25 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
          >
            <span>{isEntering ? 'Abriendo Terminal...' : 'Abrir Terminal POS'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-7xl mx-auto pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-text-secondary gap-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-text-secondary" />
          <span>Organización: <strong className="text-text-primary font-medium">{activeOrgName || 'VERUM Global'}</strong></span>
        </div>
        <div className="text-[11px]">
          Atajo: Haz doble clic en cualquier modo para ingresar directamente.
        </div>
      </footer>
    </div>
  )
}
