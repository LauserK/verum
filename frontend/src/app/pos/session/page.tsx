'use client'

import React, { useState, useEffect } from 'react'
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
  DollarSign, 
  Banknote,
  Sparkles,
  ChevronRight,
  LogOut,
  Coins,
  FileText,
  Clock,
  CheckCircle2,
  Layers
} from 'lucide-react'
import { useVenue } from '@/components/VenueContext'
import { useProfile } from '@/hooks/useProfile'
import { useWorkstations, useOpenPosSession, useCurrencies } from '@/hooks/useSales'
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
    title: 'Mesas',
    subtitle: 'Plano interactivo y comandas de salón',
    badge: 'Salón',
    icon: Utensils,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/30'
  },
  {
    id: 'takeout',
    title: 'Para Llevar',
    subtitle: 'Venta rápida por mostrador',
    badge: 'Express',
    icon: ShoppingBag,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30'
  },
  {
    id: 'delivery',
    title: 'Delivery',
    subtitle: 'Despacho con repartidor',
    badge: 'Despacho',
    icon: Bike,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
  },
  {
    id: 'pickup',
    title: 'Pick-up',
    subtitle: 'Retiro programado en local',
    badge: 'Retiro',
    icon: PackageCheck,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/30'
  },
  {
    id: 'bar',
    title: 'Barra',
    subtitle: 'Tragos y cafetería directa',
    badge: 'Barra',
    icon: Wine,
    color: 'text-rose-500 bg-rose-500/10 border-rose-500/30'
  }
]

const QUICK_FLOAT_AMOUNTS = [0, 10, 20, 50, 100, 200]

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

  const { data: workstations = [], isLoading: loadingStations } = useWorkstations(selectedVenueId || undefined)
  const { data: currencies = [] } = useCurrencies()
  const openSessionMutation = useOpenPosSession()

  const activeStations = workstations.filter((w) => w.is_active)

  const [selectedStationId, setSelectedStationId] = useState<string>('')
  const [openingBalance, setOpeningBalance] = useState<string>('0')
  const [currencyCode, setCurrencyCode] = useState<string>('USD')
  const [notes, setNotes] = useState<string>('')
  const [selectedMode, setSelectedMode] = useState<PosMode>('tables')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Auto-select first active workstation
  useEffect(() => {
    if (activeStations.length > 0) {
      if (!selectedStationId || !activeStations.some((s) => s.id === selectedStationId)) {
        setSelectedStationId(activeStations[0].id)
      }
    }
  }, [activeStations, selectedStationId])

  const currentStation = activeStations.find((s) => s.id === selectedStationId) || activeStations[0]

  const handleQuickAmount = (amount: number) => {
    setOpeningBalance(amount.toString())
  }

  const handleStartSession = async (modeToUse?: PosMode) => {
    setErrorMsg(null)
    const targetMode = modeToUse || selectedMode
    const numBalance = parseFloat(openingBalance) || 0

    if (numBalance < 0) {
      setErrorMsg('El fondo de caja no puede ser un monto negativo.')
      return
    }

    setIsSubmitting(true)
    try {
      let createdSession = null
      try {
        createdSession = await openSessionMutation.mutateAsync({
          venue_id: selectedVenueId || null,
          workstation_id: currentStation?.id || null,
          opening_balance: numBalance,
          opening_currency: currencyCode,
          notes: notes.trim() || undefined,
        })
      } catch (apiErr) {
        console.warn('Could not record pos_session in API, fallback to local store:', apiErr)
      }

      // Sync Zustand local store
      usePosStore.getState().setPosMode(targetMode)
      if (currentStation) {
        usePosStore.getState().setActiveWorkstation(currentStation.id, currentStation.name)
      }
      usePosStore.getState().setSessionOpening(numBalance, currencyCode, createdSession?.id || null)

      router.push('/pos/terminal')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al abrir la sesión de caja')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-bg text-text-primary flex flex-col justify-between p-6 sm:p-10 select-none overflow-y-auto">
      {/* Top Bar / Header */}
      <header className="w-full max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl shadow-inner">
            V
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-text-primary">VERUM POS</h1>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-full">
                Apertura de Turno
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">Apertura de caja y registro del fondo inicial de efectivo</p>
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
              <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Cajero / Operador</span>
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

      {/* Main Content: Cash Opening & Station Selection */}
      <main className="w-full max-w-6xl mx-auto py-8 space-y-8 my-auto">
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-error/10 border border-error/20 text-error text-sm font-medium flex items-center gap-2 animate-in fade-in">
            <Coins className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (7 cols): Caja & Fondo de Efectivo */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Estación de Trabajo */}
            <section className="bg-surface border border-border rounded-3xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                  <MonitorCheck className="w-4 h-4 text-primary" /> 1. Estación de Trabajo (Caja Física)
                </h2>
                <button
                  type="button"
                  onClick={() => router.push('/admin/sales/workstations')}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Gestionar Cajas
                </button>
              </div>

              {loadingStations ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 rounded-2xl bg-surface-raised animate-pulse" />
                  ))}
                </div>
              ) : activeStations.length === 0 ? (
                <div className="p-4 rounded-2xl bg-surface-raised border border-dashed border-border text-center space-y-2">
                  <p className="text-xs text-text-secondary">No hay estaciones activas para esta sede.</p>
                  <button
                    type="button"
                    onClick={() => router.push('/admin/sales/workstations')}
                    className="px-3 py-1.5 bg-primary text-text-inverse rounded-xl text-xs font-bold"
                  >
                    Crear Estación en Admin
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeStations.map((station) => {
                    const isSelected = (selectedStationId || activeStations[0]?.id) === station.id
                    return (
                      <button
                        key={station.id}
                        type="button"
                        onClick={() => setSelectedStationId(station.id)}
                        className={`text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-surface-raised border-primary ring-2 ring-primary/20 shadow-sm'
                            : 'bg-surface border-border hover:border-border-strong hover:bg-surface-raised/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${isSelected ? 'bg-primary text-text-inverse' : 'bg-surface-raised text-text-secondary'}`}>
                            <MonitorCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-text-primary">{station.name}</h3>
                            <p className="text-[11px] text-text-secondary">
                              {station.allowed_modes?.length ? `${station.allowed_modes.length} modos disponibles` : 'Todos los modos'}
                            </p>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Step 2: Fondo de Efectivo Inicial */}
            <section className="bg-surface border border-border rounded-3xl p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-primary" /> 2. Fondo de Efectivo Inicial (Base de Caja)
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Indica el monto de dinero en efectivo con el que se inicia el turno en la gaveta.
                  </p>
                </div>
              </div>

              {/* Amount & Currency Input */}
              <div className="space-y-3">
                <div className="relative flex items-center bg-surface-raised border-2 border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 rounded-2xl p-2 transition-all">
                  <div className="flex items-center gap-1 pl-3 pr-2 text-text-secondary font-black text-2xl">
                    <DollarSign className="w-7 h-7 text-primary" />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-3xl font-black text-text-primary focus:outline-none placeholder:text-text-disabled tracking-tight"
                  />
                  <div className="flex items-center gap-1 pr-2">
                    <select
                      value={currencyCode}
                      onChange={(e) => setCurrencyCode(e.target.value)}
                      className="px-3 py-1.5 bg-surface border border-border rounded-xl text-xs font-bold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="VES">VES (Bs.)</option>
                      {currencies.filter(c => c.code !== 'USD' && c.code !== 'VES').map(c => (
                        <option key={c.id} value={c.code}>{c.code} ({c.symbol})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick denomination chips */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mr-1 flex items-center gap-1">
                    <Coins className="w-3 h-3" /> Atajos:
                  </span>
                  {QUICK_FLOAT_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAmount(amt)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                        parseFloat(openingBalance) === amt
                          ? 'bg-primary text-text-inverse border-primary shadow-sm'
                          : 'bg-surface-raised text-text-secondary border-border hover:bg-surface-raised/80 hover:text-text-primary'
                      }`}
                    >
                      ${amt}.00
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes input */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Observaciones de Apertura (Opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Billetes de $1, $5 y $10 para cambio inicial..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-raised border border-border text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </section>
          </div>

          {/* Right Column (5 cols): Modo Inicial & Resumen de Apertura */}
          <div className="lg:col-span-5 space-y-6">
            {/* Step 3: Modo de Inicio (Compacto) */}
            <section className="bg-surface border border-border rounded-3xl p-6 space-y-4 shadow-sm">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" /> 3. Modo Inicial de la Pantalla
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Podrás alternar de modo con 1 clic en la barra superior en cualquier momento.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {POS_MODES.map((mode) => {
                  const isSelected = selectedMode === mode.id
                  const Icon = mode.icon
                  const isAllowed = !currentStation?.allowed_modes?.length || currentStation.allowed_modes.includes(mode.id)

                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setSelectedMode(mode.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'bg-primary/10 border-primary ring-1 ring-primary/30'
                          : !isAllowed
                          ? 'bg-surface-raised/40 border-border/40 opacity-50'
                          : 'bg-surface-raised border-border hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-text-secondary'}`} />
                        <span className="text-[10px] font-bold text-text-secondary">{mode.badge}</span>
                      </div>
                      <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                        {mode.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Final Action Box */}
            <div className="bg-surface border border-border rounded-3xl p-6 space-y-5 shadow-sm">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>Caja seleccionada:</span>
                  <strong className="text-text-primary">{currentStation?.name || 'Caja Principal'}</strong>
                </div>
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>Fondo inicial registrado:</span>
                  <strong className="text-emerald-500 font-mono text-sm">${parseFloat(openingBalance || '0').toFixed(2)} {currencyCode}</strong>
                </div>
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>Operador:</span>
                  <span className="text-text-primary">{profile?.full_name || 'Cajero activo'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleStartSession()}
                disabled={isSubmitting || (activeStations.length === 0 && !loadingStations)}
                className="w-full py-4 rounded-2xl bg-primary text-text-inverse font-bold text-sm hover:bg-primary-hover transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>{isSubmitting ? 'Abriendo Turno...' : 'Abrir Caja e Iniciar Turno'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-6xl mx-auto pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-text-secondary gap-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-text-secondary" />
          <span>Organización: <strong className="text-text-primary font-medium">{activeOrgName || 'VERUM Global'}</strong></span>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span>El arqueo y cuadre de caja calculará los ingresos sobre este fondo inicial.</span>
        </div>
      </footer>
    </div>
  )
}
