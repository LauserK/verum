'use client'

import { useState, useEffect } from 'react'
import { 
  useCurrencies, 
  useCreateCurrency, 
  useExchangeRates, 
  useCreateExchangeRate 
} from '@/hooks/useSales'
import { Coins, TrendingUp, Plus, X, Check, Building2, MapPin, AlertTriangle, Receipt } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function CompanyCurrenciesPage() {
  const { data: currencies, isLoading: loadingCurrencies } = useCurrencies()
  const { mutateAsync: createCurrency, isPending: creatingCurrency } = useCreateCurrency()
  const { data: exchangeRates, isLoading: loadingRates } = useExchangeRates()
  const { mutateAsync: createExchangeRate, isPending: creatingRate } = useCreateExchangeRate()

  // Modals
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false)
  const [currencyError, setCurrencyError] = useState<string | null>(null)
  const [currencyForm, setCurrencyForm] = useState({
    code: '',
    name: '',
    symbol: '',
    is_base: false,
  })

  const [isRateModalOpen, setIsRateModalOpen] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)
  const [rateForm, setRateForm] = useState({
    from_currency: 'USD',
    to_currency: 'VES',
    rate: 1,
  })

  // Auto-fill rate defaults when currencies load or modal opens
  useEffect(() => {
    if (currencies && currencies.length > 0) {
      const base = currencies.find(c => c.is_base) || currencies[0]
      const secondary = currencies.find(c => !c.is_base) || currencies[1] || currencies[0]
      setRateForm(prev => ({
        ...prev,
        from_currency: base.code,
        to_currency: secondary.code,
      }))
    }
  }, [currencies])

  const handleCreateCurrency = async (e: React.FormEvent) => {
    e.preventDefault()
    setCurrencyError(null)
    if (!currencyForm.code || !currencyForm.name || !currencyForm.symbol) {
      setCurrencyError('Todos los campos son obligatorios.')
      return
    }
    try {
      await createCurrency({
        code: currencyForm.code.toUpperCase().trim(),
        name: currencyForm.name.trim(),
        symbol: currencyForm.symbol.trim(),
        is_base: currencyForm.is_base,
      })
      setIsCurrencyModalOpen(false)
      setCurrencyForm({ code: '', name: '', symbol: '', is_base: false })
    } catch (err: any) {
      setCurrencyError(err.message || 'Error registrando moneda.')
    }
  }

  const handleCreateRate = async (e: React.FormEvent) => {
    e.preventDefault()
    setRateError(null)
    if (!rateForm.from_currency || !rateForm.to_currency) {
      setRateError('Debes seleccionar las monedas de origen y destino.')
      return
    }
    if (rateForm.from_currency === rateForm.to_currency) {
      setRateError('La moneda origen y destino no pueden ser la misma.')
      return
    }
    if (Number(rateForm.rate) <= 0) {
      setRateError('La tasa de cambio debe ser un número mayor a 0.')
      return
    }
    try {
      await createExchangeRate({
        from_currency: rateForm.from_currency,
        to_currency: rateForm.to_currency,
        rate: Number(rateForm.rate),
      })
      setIsRateModalOpen(false)
      setRateForm(prev => ({ ...prev, rate: 1 }))
    } catch (err: any) {
      setRateError(err.message || 'Error registrando tasa de cambio.')
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Configuración de Empresa
          </h1>
          <p className="text-sm text-text-secondary mt-1">Gestión corporativa de monedas base, monedas secundarias y tasas de cambio oficiales</p>
        </div>
      </div>

      {/* Submenu Redirection Links */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        <Link href="/admin/venues" className="px-4 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold hover:border-primary transition-colors flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" /> Sedes y Locales
        </Link>
        <Link href="/admin/venues/currencies" className="px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
          <Coins className="w-4 h-4" /> Monedas y Tasas
        </Link>
        <Link href="/admin/venues/taxes" className="px-4 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold hover:border-primary transition-colors flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" /> Impuestos y Alícuotas
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* 1. Currencies Catalog */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" /> Monedas de la Empresa
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">Monedas habilitadas en el sistema</p>
            </div>
            <button 
              onClick={() => {
                setCurrencyError(null)
                setIsCurrencyModalOpen(true)
              }}
              className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all shadow-md shadow-primary/20 active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar Moneda
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] font-black uppercase tracking-wider text-text-secondary">
                  <th className="pb-3 pl-2">Código</th>
                  <th className="pb-3">Nombre</th>
                  <th className="pb-3">Símbolo</th>
                  <th className="pb-3 text-center">Tipo</th>
                  <th className="pb-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {loadingCurrencies ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-text-secondary animate-pulse">Cargando monedas...</td>
                  </tr>
                ) : !currencies || currencies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-text-secondary">No has registrado monedas aún.</td>
                  </tr>
                ) : (
                  currencies.map(c => (
                    <tr key={c.id} className="hover:bg-surface-raised/50 transition-colors">
                      <td className="py-3 pl-2 font-mono font-bold text-text-primary">{c.code}</td>
                      <td className="py-3 text-text-primary">{c.name}</td>
                      <td className="py-3 font-mono font-bold text-text-secondary">{c.symbol}</td>
                      <td className="py-3 text-center">
                        {c.is_base ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            Base
                          </span>
                        ) : (
                          <span className="text-text-secondary text-xs">Secundaria</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          c.is_active ? 'bg-success/10 text-success border border-success/20' : 'bg-surface-raised text-text-secondary'
                        }`}>
                          {c.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Exchange Rates */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Tasas de Cambio del Día
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">Paridades cambiarias actualizadas</p>
            </div>
            <button 
              onClick={() => {
                setRateError(null)
                setIsRateModalOpen(true)
              }}
              className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all shadow-md shadow-primary/20 active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Registrar Tasa
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] font-black uppercase tracking-wider text-text-secondary">
                  <th className="pb-3 pl-2">Fecha</th>
                  <th className="pb-3">Paridad</th>
                  <th className="pb-3 text-right">Tasa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {loadingRates ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-text-secondary animate-pulse">Cargando tasas...</td>
                  </tr>
                ) : !exchangeRates || exchangeRates.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-text-secondary">No hay tasas de cambio registradas.</td>
                  </tr>
                ) : (
                  exchangeRates.map(r => (
                    <tr key={r.id} className="hover:bg-surface-raised/50 transition-colors">
                      <td className="py-3 pl-2 text-text-secondary text-xs">
                        {format(new Date(r.effective_date), "dd MMM, HH:mm", { locale: es })}
                      </td>
                      <td className="py-3 font-bold text-text-primary">
                        1 {r.from_currency} → {r.to_currency}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-text-primary">
                        {Number(r.rate).toFixed(4)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Nueva Moneda */}
      {isCurrencyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-base font-bold text-text-primary">Registrar Nueva Moneda</h3>
              <button onClick={() => setIsCurrencyModalOpen(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {currencyError && (
              <div className="p-3 rounded-xl bg-error/10 text-error border border-error/20 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{currencyError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCurrency} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">Código ISO *</label>
                <input 
                  type="text" 
                  required
                  maxLength={5}
                  placeholder="Ej: USD, VES, EUR, COP"
                  value={currencyForm.code}
                  onChange={e => setCurrencyForm({...currencyForm, code: e.target.value.toUpperCase()})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1 font-mono uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">Nombre Completo *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: Dólar Estadounidense"
                  value={currencyForm.name}
                  onChange={e => setCurrencyForm({...currencyForm, name: e.target.value})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">Símbolo *</label>
                <input 
                  type="text" 
                  required
                  maxLength={6}
                  placeholder="Ej: $, Bs., €"
                  value={currencyForm.symbol}
                  onChange={e => setCurrencyForm({...currencyForm, symbol: e.target.value})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1 font-mono"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={currencyForm.is_base}
                  onChange={e => setCurrencyForm({...currencyForm, is_base: e.target.checked})}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                />
                <span className="text-xs font-semibold text-text-primary">Establecer como Moneda Base</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsCurrencyModalOpen(false)}
                  className="px-4 h-11 border border-border bg-surface hover:bg-surface-raised text-text-primary rounded-xl text-sm font-semibold transition-colors flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={creatingCurrency}
                  className="bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <Check className="w-4 h-4" /> {creatingCurrency ? 'Guardando...' : 'Crear Moneda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Tasa de Cambio */}
      {isRateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-base font-bold text-text-primary">Registrar Tasa de Cambio</h3>
              <button onClick={() => setIsRateModalOpen(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {rateError && (
              <div className="p-3 rounded-xl bg-error/10 text-error border border-error/20 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{rateError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase">Moneda Origen (Base)</label>
                  <select
                    required
                    value={rateForm.from_currency}
                    onChange={e => setRateForm({...rateForm, from_currency: e.target.value})}
                    className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                  >
                    {currencies && currencies.length > 0 ? (
                      currencies.map(c => (
                        <option key={c.id} value={c.code}>
                          {c.code} ({c.symbol}) {c.is_base ? '★ Base' : ''}
                        </option>
                      ))
                    ) : (
                      <option value="USD">USD ($)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase">Moneda Destino</label>
                  <select
                    required
                    value={rateForm.to_currency}
                    onChange={e => setRateForm({...rateForm, to_currency: e.target.value})}
                    className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                  >
                    {currencies && currencies.length > 0 ? (
                      currencies.map(c => (
                        <option key={c.id} value={c.code}>
                          {c.code} ({c.symbol})
                        </option>
                      ))
                    ) : (
                      <option value="VES">VES (Bs.)</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Tasa de Cambio (1 {rateForm.from_currency} = X {rateForm.to_currency})
                </label>
                <input 
                  type="number" 
                  step="0.0001"
                  min="0.0001"
                  required
                  placeholder="Ej: 40.5000"
                  value={rateForm.rate}
                  onChange={e => setRateForm({...rateForm, rate: Number(e.target.value)})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none mt-1 font-mono font-bold"
                />
              </div>

              {/* Equivalence Preview */}
              <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between text-xs">
                <span className="text-text-secondary font-medium">Ejemplo de conversión:</span>
                <span className="font-mono font-bold text-primary text-sm">
                  1 {rateForm.from_currency} = {rateForm.rate ? Number(rateForm.rate).toFixed(4) : '0.0000'} {rateForm.to_currency}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsRateModalOpen(false)}
                  className="px-4 h-11 border border-border bg-surface hover:bg-surface-raised text-text-primary rounded-xl text-sm font-semibold transition-colors flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={creatingRate}
                  className="bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <Check className="w-4 h-4" /> {creatingRate ? 'Registrando...' : 'Registrar Tasa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
