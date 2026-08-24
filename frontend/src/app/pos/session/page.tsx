'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Building2, 
  MapPin, 
  MonitorCheck, 
  UserCircle2, 
  ArrowRight, 
  DollarSign, 
  Banknote,
  LogOut,
  Coins,
  Clock,
  CheckCircle2,
  Delete
} from 'lucide-react'
import { useVenue } from '@/components/VenueContext'
import { useProfile } from '@/hooks/useProfile'
import { useWorkstations, useOpenPosSession, useCurrencies } from '@/hooks/useSales'
import { usePosStore, PosMode } from '@/store/posStore'

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

  // Keypad Handlers
  const handleKeypadPress = (val: string) => {
    if (val === 'C') {
      setOpeningBalance('0')
      return
    }

    if (val === 'BACK') {
      setOpeningBalance((prev) => {
        if (prev.length <= 1 || prev === '0') return '0'
        return prev.slice(0, -1)
      })
      return
    }

    if (val === '.') {
      setOpeningBalance((prev) => {
        if (prev.includes('.')) return prev
        return prev + '.'
      })
      return
    }

    // Numbers
    setOpeningBalance((prev) => {
      if (prev === '0') return val
      if (prev.includes('.')) {
        const [, decimals] = prev.split('.')
        if (decimals && decimals.length >= 2) return prev
      }
      return prev + val
    })
  }

  const handleQuickAmount = (amount: number) => {
    setOpeningBalance(amount.toString())
  }

  const handleStartSession = async () => {
    setErrorMsg(null)
    const numBalance = parseFloat(openingBalance) || 0

    if (numBalance < 0) {
      setErrorMsg('El fondo de caja no puede ser un monto negativo.')
      return
    }

    const defaultMode: PosMode = (currentStation?.allowed_modes?.[0] as PosMode) || 'tables'

    setIsSubmitting(true)
    try {
      let createdSession = null
      try {
        createdSession = await openSessionMutation.mutateAsync({
          venue_id: selectedVenueId || null,
          workstation_id: currentStation?.id || null,
          opening_balance: numBalance,
          opening_currency: currencyCode,
        })
      } catch (apiErr) {
        console.warn('Could not record pos_session in API, fallback to local store:', apiErr)
      }

      usePosStore.getState().setPosMode(defaultMode)
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
    <div className="h-screen w-screen bg-bg text-text-primary flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden">
      {/* Top Bar / Header */}
      <header className="w-full max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-lg shadow-inner">
            V
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-text-primary">VERUM POS</h1>
              <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-full">
                Apertura de Caja
              </span>
            </div>
            <p className="text-[11px] text-text-secondary">Ingresa el fondo de efectivo inicial para iniciar el turno</p>
          </div>
        </div>

        {/* User & Venue Status Indicators */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
          {/* Active Sede / Venue Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs shadow-sm">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-text-secondary tracking-wider">Sede</span>
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
                <span className="font-bold text-text-primary truncate max-w-[120px]">
                  {selectedVenueName || 'Sede Principal'}
                </span>
              )}
            </div>
          </div>

          {/* Cashier / Operator Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs shadow-sm">
            <UserCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold text-text-secondary tracking-wider">Cajero</span>
              <span className="font-bold text-text-primary truncate max-w-[120px]">
                {profile?.full_name || profile?.email || 'Operador POS'}
              </span>
            </div>
          </div>

          {/* Back to Admin / Exit */}
          <button
            onClick={() => router.push('/admin/sales')}
            className="p-2 rounded-xl border border-border bg-surface hover:bg-surface-raised hover:text-error text-text-secondary transition-colors"
            title="Salir al panel de administración"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-6xl mx-auto py-3 my-auto flex-1 flex flex-col justify-center overflow-hidden">
        {errorMsg && (
          <div className="mb-3 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-medium flex items-center gap-2 animate-in fade-in shrink-0">
            <Coins className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Column (5 cols): Estación & Resumen */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            {/* Step 1: Estación de Trabajo */}
            <section className="bg-surface border border-border rounded-2xl p-4 space-y-3 shadow-sm flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                  <MonitorCheck className="w-3.5 h-3.5 text-primary" /> 1. Estación de Trabajo (Caja)
                </h2>
                <button
                  type="button"
                  onClick={() => router.push('/admin/sales/workstations')}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Gestionar
                </button>
              </div>

              {loadingStations ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 rounded-xl bg-surface-raised animate-pulse" />
                  ))}
                </div>
              ) : activeStations.length === 0 ? (
                <div className="p-3 rounded-xl bg-surface-raised border border-dashed border-border text-center space-y-2">
                  <p className="text-xs text-text-secondary">No hay estaciones activas para esta sede.</p>
                  <button
                    type="button"
                    onClick={() => router.push('/admin/sales/workstations')}
                    className="px-3 py-1 bg-primary text-text-inverse rounded-lg text-xs font-bold"
                  >
                    Crear Estación en Admin
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {activeStations.map((station) => {
                    const isSelected = (selectedStationId || activeStations[0]?.id) === station.id
                    return (
                      <button
                        key={station.id}
                        type="button"
                        onClick={() => setSelectedStationId(station.id)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-surface-raised border-primary ring-1 ring-primary/20 shadow-sm'
                            : 'bg-surface border-border hover:border-border-strong hover:bg-surface-raised/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-primary text-text-inverse' : 'bg-surface-raised text-text-secondary'}`}>
                            <MonitorCheck className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-xs text-text-primary">{station.name}</h3>
                            <p className="text-[10px] text-text-secondary">
                              {station.allowed_modes?.length ? `${station.allowed_modes.length} modos disponibles` : 'Todos los modos'}
                            </p>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Final Action Box */}
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>Caja a operar:</span>
                  <strong className="text-text-primary">{currentStation?.name || 'Caja Principal'}</strong>
                </div>
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>Fondo inicial:</span>
                  <strong className="text-emerald-500 font-mono text-sm font-bold">${parseFloat(openingBalance || '0').toFixed(2)} {currencyCode}</strong>
                </div>
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>Cajero:</span>
                  <span className="text-text-primary">{profile?.full_name || 'Cajero activo'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleStartSession()}
                disabled={isSubmitting || (activeStations.length === 0 && !loadingStations)}
                className="w-full py-3 rounded-xl bg-primary text-text-inverse font-bold text-xs hover:bg-primary-hover transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>{isSubmitting ? 'Abriendo Caja...' : 'Abrir Caja e Iniciar Turno'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Column (7 cols): Teclado Numérico & Fondo Inicial */}
          <div className="lg:col-span-7">
            <section className="bg-surface border border-border rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-primary" /> 2. Fondo de Efectivo Inicial (Base de Caja)
                </h2>
              </div>

              {/* Display Box */}
              <div className="bg-surface-raised border border-border focus-within:border-primary rounded-2xl p-3 transition-all flex flex-col items-center justify-center text-center gap-1.5">
                <div className="flex items-center justify-center gap-1.5 w-full">
                  <span className="text-2xl sm:text-3xl font-black text-primary">$</span>
                  <span className="text-3xl sm:text-4xl font-black text-text-primary tracking-tight font-mono">
                    {openingBalance || '0'}
                  </span>
                  <select
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value)}
                    className="ml-2 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-bold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="VES">VES (Bs.)</option>
                    {currencies.filter(c => c.code !== 'USD' && c.code !== 'VES').map(c => (
                      <option key={c.id} value={c.code}>{c.code} ({c.symbol})</option>
                    ))}
                  </select>
                </div>

                {/* Quick denomination chips */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
                  {QUICK_FLOAT_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAmount(amt)}
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${
                        parseFloat(openingBalance) === amt
                          ? 'bg-primary text-text-inverse border-primary shadow-sm'
                          : 'bg-surface text-text-secondary border-border hover:bg-surface-raised hover:text-text-primary'
                      }`}
                    >
                      ${amt}.00
                    </button>
                  ))}
                </div>
              </div>

              {/* On-Screen Touch Keypad (Compact scale) */}
              <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '.'].map((key) => {
                  const isAction = key === 'C'
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeypadPress(key)}
                      className={`h-11 sm:h-12 rounded-xl text-base font-bold border transition-all active:scale-90 flex items-center justify-center select-none shadow-xs ${
                        isAction
                          ? 'bg-error/10 text-error border-error/20 hover:bg-error/20 text-xs font-black'
                          : 'bg-surface-raised text-text-primary border-border hover:bg-surface-raised/80 hover:border-primary/50'
                      }`}
                    >
                      {key === 'C' ? 'Limpiar (C)' : key}
                    </button>
                  )
                })}
              </div>

              {/* Backspace Button */}
              <div className="max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={() => handleKeypadPress('BACK')}
                  className="w-full h-9 rounded-xl bg-surface-raised text-text-secondary border border-border hover:text-text-primary hover:bg-surface-raised/80 transition-all flex items-center justify-center gap-1.5 text-xs font-bold active:scale-95 shadow-xs"
                >
                  <Delete className="w-3.5 h-3.5" />
                  <span>Borrar dígito (⌫)</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-6xl mx-auto pt-2 flex flex-col sm:flex-row items-center justify-between text-[11px] text-text-secondary gap-1 border-t border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <Building2 className="w-3 h-3 text-text-secondary" />
          <span>Organización: <strong className="text-text-primary font-medium">{activeOrgName || 'VERUM Global'}</strong></span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <Clock className="w-3 h-3 text-primary" />
          <span>El arqueo y cuadre de caja calculará los ingresos sobre este fondo inicial.</span>
        </div>
      </footer>
    </div>
  )
}
