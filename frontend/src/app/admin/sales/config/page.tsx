'use client'

import { useState, useEffect } from 'react'
import { 
  useBillingConfig, 
  usePaymentMethods, 
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  useCurrencies, 
  useCreateCurrency, 
  useExchangeRates, 
  useCreateExchangeRate,
  useModeConfigs,
  useCreateModeConfig,
  useUpdateModeConfig,
  useDeliveryZones,
  useCreateDeliveryZone,
  useUpdateDeliveryZone,
  useDeleteDeliveryZone
} from '@/hooks/useSales'
import { salesApi, PaymentMethod, DeliveryZone } from '@/lib/api/sales'
import { 
  Settings, 
  CreditCard, 
  Coins, 
  TrendingUp, 
  Plus, 
  Save, 
  CheckCircle2, 
  X, 
  Check,
  AlertTriangle,
  Edit2,
  Trash2,
  Power,
  UserCheck,
  Bike
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function SalesConfigPage() {
  const { data: config, isLoading: loadingConfig, refetch: refetchConfig } = useBillingConfig()
  const { data: paymentMethods, isLoading: loadingMethods } = usePaymentMethods()
  const { mutateAsync: createPaymentMethod, isPending: creatingPaymentMethod } = useCreatePaymentMethod()
  const { mutateAsync: updatePaymentMethod, isPending: updatingPaymentMethod } = useUpdatePaymentMethod()
  const { mutateAsync: deletePaymentMethod, isPending: deletingPaymentMethod } = useDeletePaymentMethod()

  const { data: currencies, isLoading: loadingCurrencies } = useCurrencies()
  const { mutateAsync: createCurrency, isPending: creatingCurrency } = useCreateCurrency()
  const { data: exchangeRates, isLoading: loadingRates } = useExchangeRates()
  const { mutateAsync: createExchangeRate, isPending: creatingRate } = useCreateExchangeRate()

  const { data: modeConfigs, refetch: refetchModeConfigs } = useModeConfigs()
  const { mutateAsync: createModeConfig } = useCreateModeConfig()
  const { mutateAsync: updateModeConfig } = useUpdateModeConfig()

  const { data: deliveryZones, isLoading: loadingZones } = useDeliveryZones()
  const { mutateAsync: createDeliveryZone, isPending: creatingZone } = useCreateDeliveryZone()
  const { mutateAsync: updateDeliveryZone, isPending: updatingZone } = useUpdateDeliveryZone()
  const { mutateAsync: deleteDeliveryZone, isPending: deletingZone } = useDeleteDeliveryZone()

  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  
  // Quick Integration connection state
  const [isQuickConnected, setIsQuickConnected] = useState(false)

  // General form state
  const [form, setForm] = useState({
    default_currency: 'USD',
    customer_requirement: 'optional' as 'required' | 'optional' | 'disabled',
    cash_rounding: true,
    cash_rounding_multiple: 1.0,
    cash_rounding_rule: 'nearest' as 'nearest' | 'up' | 'down',
  })

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

  // Payment Method Modal
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [methodError, setMethodError] = useState<string | null>(null)
  const [methodForm, setMethodForm] = useState({
    name: '',
    method_type: 'cash' as 'cash' | 'card' | 'bank_transfer' | 'mobile_payment' | 'digital_wallet' | 'crypto' | 'other',
    currency_code: '',
    instructions: '',
    requires_reference: true,
    is_active: true,
    sync_to_quick: true
  })

  // Delivery Zone Modal
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null)
  const [zoneError, setZoneError] = useState<string | null>(null)
  const [zoneForm, setZoneForm] = useState({
    name: '',
    cost: 0,
    is_active: true,
    sync_to_quick: true
  })

  // Check if VerumQuick integration is active
  useEffect(() => {
    import('@/lib/api').then(({ fetchWithAuth }) => {
      fetchWithAuth<any>('/api/integrations/quick/status')
        .then(res => {
          if (res?.is_connected) {
            setIsQuickConnected(true)
          }
        })
        .catch(() => {})
    })
  }, [])

  useEffect(() => {
    if (config) {
      setForm({
        default_currency: config.default_currency || 'USD',
        customer_requirement: (config as any).customer_requirement || 'optional',
        cash_rounding: config.cash_rounding ?? true,
        cash_rounding_multiple: config.cash_rounding_multiple ?? 1.0,
        cash_rounding_rule: config.cash_rounding_rule || 'nearest',
      })
    }
  }, [config])

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

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSavedSuccess(false)
    setConfigError(null)
    try {
      await salesApi.updateConfig(form)
      await refetchConfig()
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (err: any) {
      setConfigError(err.message || 'Error guardando parámetros de facturación.')
    } finally {
      setSaving(false)
    }
  }

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
      setRateError('La tasa de cambio debe ser mayor a 0.')
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

  const handleOpenCreateMethod = () => {
    setEditingMethod(null)
    setMethodError(null)
    setMethodForm({
      name: '',
      method_type: 'cash',
      currency_code: '',
      instructions: '',
      requires_reference: true,
      is_active: true,
      sync_to_quick: isQuickConnected
    })
    setIsMethodModalOpen(true)
  }

  const handleOpenEditMethod = (method: PaymentMethod) => {
    setEditingMethod(method)
    setMethodError(null)
    setMethodForm({
      name: method.name,
      method_type: method.method_type || 'other',
      currency_code: method.currency_code || '',
      instructions: method.instructions || '',
      requires_reference: method.requires_reference ?? true,
      is_active: method.is_active ?? true,
      sync_to_quick: isQuickConnected
    })
    setIsMethodModalOpen(true)
  }

  const handleSaveMethod = async (e: React.FormEvent) => {
    e.preventDefault()
    setMethodError(null)
    if (!methodForm.name.trim()) {
      setMethodError('El nombre del método de pago es requerido.')
      return
    }

    try {
      if (editingMethod) {
        await updatePaymentMethod({
          id: editingMethod.id,
          data: {
            name: methodForm.name.trim(),
            method_type: methodForm.method_type,
            currency_code: methodForm.currency_code || null,
            instructions: methodForm.instructions.trim(),
            requires_reference: methodForm.requires_reference,
            is_active: methodForm.is_active,
            sync_to_quick: methodForm.sync_to_quick
          }
        })
      } else {
        await createPaymentMethod({
          name: methodForm.name.trim(),
          method_type: methodForm.method_type,
          currency_code: methodForm.currency_code || undefined,
          instructions: methodForm.instructions.trim(),
          requires_reference: methodForm.requires_reference,
          is_active: methodForm.is_active,
          sync_to_quick: methodForm.sync_to_quick
        })
      }
      setIsMethodModalOpen(false)
    } catch (err: any) {
      setMethodError(err.message || 'Error guardando método de pago.')
    }
  }

  const handleToggleMethod = async (method: PaymentMethod) => {
    try {
      await updatePaymentMethod({
        id: method.id,
        data: { is_active: !method.is_active }
      })
    } catch (err: any) {
      alert(err.message || 'Error actualizando estado del método de pago.')
    }
  }

  const handleDeleteMethod = async (method: PaymentMethod) => {
    if (!confirm(`¿Eliminar el método de pago "${method.name}"?`)) return
    try {
      await deletePaymentMethod(method.id)
    } catch (err: any) {
      alert(err.message || 'Error eliminando método de pago.')
    }
  }

  // Delivery Zone Handlers
  const handleOpenCreateZone = () => {
    setEditingZone(null)
    setZoneError(null)
    setZoneForm({
      name: '',
      cost: 0,
      is_active: true,
      sync_to_quick: isQuickConnected
    })
    setIsZoneModalOpen(true)
  }

  const handleOpenEditZone = (zone: DeliveryZone) => {
    setEditingZone(zone)
    setZoneError(null)
    setZoneForm({
      name: zone.name,
      cost: zone.cost,
      is_active: zone.is_active,
      sync_to_quick: isQuickConnected
    })
    setIsZoneModalOpen(true)
  }

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault()
    setZoneError(null)
    if (!zoneForm.name.trim()) {
      setZoneError('El nombre de la zona de delivery es requerido.')
      return
    }
    if (Number(zoneForm.cost) < 0) {
      setZoneError('El costo de delivery no puede ser negativo.')
      return
    }

    try {
      if (editingZone) {
        await updateDeliveryZone({
          id: editingZone.id,
          data: {
            name: zoneForm.name.trim(),
            cost: Number(zoneForm.cost),
            is_active: zoneForm.is_active,
            sync_to_quick: zoneForm.sync_to_quick
          }
        })
      } else {
        await createDeliveryZone({
          name: zoneForm.name.trim(),
          cost: Number(zoneForm.cost),
          is_active: zoneForm.is_active,
          sync_to_quick: zoneForm.sync_to_quick
        })
      }
      setIsZoneModalOpen(false)
    } catch (err: any) {
      setZoneError(err.message || 'Error guardando zona de delivery.')
    }
  }

  const handleToggleZone = async (zone: DeliveryZone) => {
    try {
      await updateDeliveryZone({
        id: zone.id,
        data: { is_active: !zone.is_active }
      })
    } catch (err: any) {
      alert(err.message || 'Error actualizando estado de la zona de delivery.')
    }
  }

  const handleDeleteZone = async (zone: DeliveryZone) => {
    if (!confirm(`¿Eliminar la zona de delivery "${zone.name}"?`)) return
    try {
      await deleteDeliveryZone(zone.id)
    } catch (err: any) {
      alert(err.message || 'Error eliminando zona de delivery.')
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in max-w-4xl pb-12">
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> Configuración de Facturación y Multimoneda
        </h1>
        <p className="text-sm text-text-secondary mt-1">Parámetros generales de facturación, monedas activas y tasas de cambio del día</p>
      </div>

      {/* 1. General Config */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
          <Settings className="w-5 h-5 text-primary" /> Parámetros Generales
        </h2>

        {configError && (
          <div className="p-3 rounded-xl bg-error/10 text-error border border-error/20 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{configError}</span>
          </div>
        )}

        {loadingConfig ? (
          <div className="py-8 text-center text-text-secondary animate-pulse">Cargando parámetros...</div>
        ) : (
          <form onSubmit={handleSaveConfig} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Moneda Base de la Empresa</label>
                <select 
                  value={form.default_currency || 'USD'}
                  onChange={e => setForm({...form, default_currency: e.target.value})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none mt-1"
                >
                  {currencies && currencies.length > 0 ? (
                    currencies.map(c => (
                      <option key={c.id} value={c.code}>
                        {c.code} ({c.symbol}) - {c.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="USD">USD ($) - Dólar Estadounidense</option>
                      <option value="VES">VES (Bs.) - Bolívar</option>
                    </>
                  )}
                </select>
                <p className="text-xs text-text-secondary mt-1">Moneda de referencia para precios y contabilidad.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Política de Cliente (Global)</label>
                <select 
                  value={form.customer_requirement || 'optional'}
                  onChange={e => setForm({...form, customer_requirement: e.target.value as any})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none mt-1"
                >
                  <option value="optional">Opcional (Permite consumidor final)</option>
                  <option value="required">Obligatorio (Exige RIF/Cédula antes de cobrar)</option>
                  <option value="disabled">Desactivado (Oculta selector de clientes en POS)</option>
                </select>
                <p className="text-xs text-text-secondary mt-1">Política por defecto para todo el sistema.</p>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-border">
              {/* Cash Rounding */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={form.cash_rounding ?? true}
                    onChange={e => setForm({...form, cash_rounding: e.target.checked})}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                  />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Redondeo de Efectivo Automático</p>
                    <p className="text-xs text-text-secondary">Ajusta automáticamente fracciones mínimas en pagos en efectivo en caja.</p>
                  </div>
                </label>

                {form.cash_rounding && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7 pt-1 animate-in fade-in">
                    <div>
                      <label className="text-xs font-bold text-text-secondary uppercase">Múltiplo de Redondeo</label>
                      <select 
                        value={form.cash_rounding_multiple ?? 1.0}
                        onChange={e => setForm({...form, cash_rounding_multiple: Number(e.target.value)})}
                        className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                      >
                        <option value="0.01">0.01 (Al centavo exacto - Sin redondeo)</option>
                        <option value="0.05">0.05 (A los 5 centavos más cercanos)</option>
                        <option value="0.10">0.10 (A los 10 centavos más cercanos)</option>
                        <option value="0.50">0.50 (A 50 centavos)</option>
                        <option value="1.00">1.00 (A billetes de $1.00 entero)</option>
                        <option value="5.00">5.00 (Múltiplos de 5)</option>
                        <option value="10.00">10.00 (Múltiplos de 10)</option>
                        <option value="50.00">50.00 (Múltiplos de 50)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-text-secondary uppercase">Criterio de Redondeo</label>
                      <select 
                        value={form.cash_rounding_rule || 'nearest'}
                        onChange={e => setForm({...form, cash_rounding_rule: e.target.value as any})}
                        className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                      >
                        <option value="nearest">Al más cercano (Estándar)</option>
                        <option value="up">Hacia arriba / Techo (A favor de la casa)</option>
                        <option value="down">Hacia abajo / Piso (A favor del cliente)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button 
                type="submit" 
                disabled={saving}
                className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-6 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Parámetros'}
              </button>

              {savedSuccess && (
                <span className="text-sm text-success flex items-center gap-1 font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" /> Guardado correctamente
                </span>
              )}
            </div>
          </form>
        )}
      </div>

      {/* 2. Customer Requirement by Sale Mode */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" /> Políticas de Cliente por Modo de Venta
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Configura si se exige registrar los datos del cliente según el tipo de servicio (Mesas, Delivery, etc.)
          </p>
        </div>

        <div className="space-y-3">
          {[
            { key: 'tables', label: 'Mesas (Dine-in)' },
            { key: 'takeout', label: 'Para Llevar (Takeout)' },
            { key: 'delivery', label: 'Delivery' },
            { key: 'pickup', label: 'Pick-up' },
            { key: 'bar', label: 'Barra (Bar)' },
          ].map((modeItem) => {
            const currentModeConfig = modeConfigs?.find((mc) => mc.mode === modeItem.key)

            return (
              <div
                key={modeItem.key}
                className="flex items-center justify-between p-3.5 bg-surface-raised border border-border rounded-xl"
              >
                <div>
                  <span className="text-sm font-semibold text-text-primary">{modeItem.label}</span>
                  <p className="text-xs text-text-secondary">
                    {currentModeConfig?.customer_requirement
                      ? `Personalizado: ${currentModeConfig.customer_requirement}`
                      : `Heredando política global (${form.customer_requirement})`}
                  </p>
                </div>

                <select
                  value={currentModeConfig?.customer_requirement || ''}
                  onChange={async (e) => {
                    const val = e.target.value
                    try {
                      if (currentModeConfig) {
                        await updateModeConfig({
                          id: currentModeConfig.id,
                          data: { customer_requirement: val ? val : null },
                        })
                      } else if (val) {
                        await createModeConfig({
                          mode: modeItem.key,
                          customer_requirement: val,
                        })
                      }
                      refetchModeConfigs()
                    } catch (err) {
                      console.error('Error updating mode config:', err)
                    }
                  }}
                  className="bg-surface border border-border rounded-xl px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-primary"
                >
                  <option value="">Heredar global ({form.customer_requirement})</option>
                  <option value="required">Obligatorio</option>
                  <option value="optional">Opcional</option>
                  <option value="disabled">Desactivado</option>
                </select>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Currencies Catalog */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" /> Catálogo de Monedas
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">Monedas habilitadas para cobros y facturación</p>
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

      {/* 3. Exchange Rates */}
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

      {/* 4. Payment Methods */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Métodos de Pago Habilitados
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">Métodos de cobro disponibles en facturación y POS</p>
          </div>
          <button 
            onClick={handleOpenCreateMethod}
            className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all shadow-md shadow-primary/20 active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar Método
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
          {loadingMethods ? (
            <div className="col-span-full py-6 text-center text-text-secondary animate-pulse">Cargando métodos...</div>
          ) : !paymentMethods || paymentMethods.length === 0 ? (
            <div className="col-span-full py-6 text-center text-text-secondary">No hay métodos de pago configurados.</div>
          ) : (
            paymentMethods.map(m => {
              const typeLabels: Record<string, string> = {
                cash: 'Efectivo',
                card: 'Tarjeta',
                bank_transfer: 'Transferencia',
                mobile_payment: 'Pago Móvil',
                digital_wallet: 'Billetera Digital',
                crypto: 'Cripto',
                other: 'Otro'
              }
              const label = typeLabels[m.method_type] || m.method_type || 'Otro'

              return (
                <div key={m.id} className={`border border-border bg-surface-raised rounded-xl p-4 space-y-3 transition-all ${!m.is_active ? 'opacity-60 bg-surface/40' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-sm text-text-primary block">{m.name}</span>
                      <span className="text-[11px] text-text-secondary">
                        {label} {m.currency_code ? `(${m.currency_code})` : '(Todas las monedas)'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border font-mono ${
                      m.is_active ? 'bg-success/10 text-success border-success/20' : 'bg-surface text-text-secondary border-border'
                    }`}>
                      {m.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {m.instructions && (
                    <p className="text-xs text-text-secondary italic line-clamp-2 bg-surface/60 p-2 rounded-lg border border-border/50">
                      {m.instructions}
                    </p>
                  )}

                  <div className="text-xs text-text-secondary flex justify-between items-center pt-2 border-t border-border/50">
                    <span className="text-[11px]">
                      {m.requires_reference ? 'Requiere Ref.' : 'Sin Ref.'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleMethod(m)}
                        title={m.is_active ? 'Desactivar' : 'Activar'}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          m.is_active 
                            ? 'hover:bg-error/10 hover:text-error border-border' 
                            : 'hover:bg-success/10 hover:text-success border-border'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditMethod(m)}
                        title="Editar"
                        className="p-1.5 rounded-lg border border-border hover:bg-surface text-text-secondary hover:text-primary transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMethod(m)}
                        title="Eliminar"
                        className="p-1.5 rounded-lg border border-border hover:bg-error/10 text-text-secondary hover:text-error transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 5. Delivery Zones */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Bike className="w-5 h-5 text-primary" /> Zonas de Delivery y Tarifas
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">Configura las zonas de envío a domicilio y sus tarifas para cobro en POS</p>
          </div>
          <button 
            onClick={handleOpenCreateZone}
            className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all shadow-md shadow-primary/20 active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar Zona
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
          {loadingZones ? (
            <div className="col-span-full py-6 text-center text-text-secondary animate-pulse">Cargando zonas...</div>
          ) : !deliveryZones || deliveryZones.length === 0 ? (
            <div className="col-span-full py-6 text-center text-text-secondary">No hay zonas de delivery configuradas.</div>
          ) : (
            deliveryZones.map(z => (
              <div key={z.id} className={`border border-border bg-surface-raised rounded-xl p-4 space-y-3 transition-all ${!z.is_active ? 'opacity-60 bg-surface/40' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-sm text-text-primary block">{z.name}</span>
                    <span className="text-xs font-bold text-primary">
                      ${Number(z.cost).toFixed(2)} USD
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border font-mono ${
                    z.is_active ? 'bg-success/10 text-success border-success/20' : 'bg-surface text-text-secondary border-border'
                  }`}>
                    {z.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                <div className="text-xs text-text-secondary flex justify-between items-center pt-2 border-t border-border/50">
                  <span className="text-[11px] text-text-secondary">
                    Tarifa de envío
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleZone(z)}
                      title={z.is_active ? 'Desactivar' : 'Activar'}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        z.is_active 
                          ? 'hover:bg-error/10 hover:text-error border-border' 
                          : 'hover:bg-success/10 hover:text-success border-border'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEditZone(z)}
                      title="Editar"
                      className="p-1.5 rounded-lg border border-border hover:bg-surface text-text-secondary hover:text-primary transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteZone(z)}
                      title="Eliminar"
                      className="p-1.5 rounded-lg border border-border hover:bg-error/10 text-text-secondary hover:text-error transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
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

      {/* Modal: Método de Pago (Crear / Editar) */}
      {isMethodModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-base font-bold text-text-primary">
                {editingMethod ? 'Editar Método de Pago' : 'Registrar Método de Pago'}
              </h3>
              <button onClick={() => setIsMethodModalOpen(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {methodError && (
              <div className="p-3 rounded-xl bg-error/10 text-error border border-error/20 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{methodError}</span>
              </div>
            )}

            <form onSubmit={handleSaveMethod} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">Nombre del Método *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: Pago Móvil Banesco, Zelle, Punto de Venta"
                  value={methodForm.name}
                  onChange={e => setMethodForm({...methodForm, name: e.target.value})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase">Tipo de Método</label>
                  <select
                    value={methodForm.method_type}
                    onChange={e => setMethodForm({...methodForm, method_type: e.target.value as any})}
                    className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="mobile_payment">Pago Móvil</option>
                    <option value="digital_wallet">Billetera Digital / Zelle</option>
                    <option value="card">Tarjeta / POS</option>
                    <option value="bank_transfer">Transferencia</option>
                    <option value="crypto">Criptomoneda</option>
                    <option value="other">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase">Moneda Específica</label>
                  <select
                    value={methodForm.currency_code}
                    onChange={e => setMethodForm({...methodForm, currency_code: e.target.value})}
                    className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                  >
                    <option value="">Todas / Multi-moneda</option>
                    {currencies?.map(c => (
                      <option key={c.id} value={c.code}>
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">Instrucciones de Pago / Datos Bancarios</label>
                <textarea
                  rows={2}
                  placeholder="Ej: CI: 12345678, Tel: 0414-1234567, Banco Banesco"
                  value={methodForm.instructions}
                  onChange={e => setMethodForm({...methodForm, instructions: e.target.value})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-xs focus:border-primary outline-none mt-1 resize-none"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-border/60">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={methodForm.requires_reference}
                    onChange={e => setMethodForm({...methodForm, requires_reference: e.target.checked})}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                  />
                  <span className="text-xs font-semibold text-text-primary">
                    Exigir número de comprobante / referencia
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={methodForm.is_active}
                    onChange={e => setMethodForm({...methodForm, is_active: e.target.checked})}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                  />
                  <span className="text-xs font-semibold text-text-primary">
                    Método de pago activo
                  </span>
                </label>

                {isQuickConnected && (
                  <div 
                    onClick={() => setMethodForm({...methodForm, sync_to_quick: !methodForm.sync_to_quick})}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer mt-2 ${
                      methodForm.sync_to_quick 
                        ? 'bg-primary/5 border-primary/40 shadow-sm' 
                        : 'bg-surface-raised border-border hover:border-border-strong'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                      methodForm.sync_to_quick
                        ? 'bg-primary border-primary text-white shadow-sm'
                        : 'border-border-strong bg-surface hover:border-primary/50'
                    }`}>
                      {methodForm.sync_to_quick && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div className="flex-1 select-none">
                      <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" /> Sincronizar en VerumQuick
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                        Al guardar, se creará o actualizará automáticamente como forma de pago en tu POS de VerumQuick.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsMethodModalOpen(false)}
                  className="px-4 h-11 border border-border bg-surface hover:bg-surface-raised text-text-primary rounded-xl text-sm font-semibold transition-colors flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={creatingPaymentMethod || updatingPaymentMethod}
                  className="bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <Check className="w-4 h-4" />{' '}
                  {creatingPaymentMethod || updatingPaymentMethod
                    ? 'Guardando...' 
                    : editingMethod ? 'Guardar Cambios' : 'Registrar Método'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Zona de Delivery (Crear / Editar) */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-base font-bold text-text-primary">
                {editingZone ? 'Editar Zona de Delivery' : 'Registrar Zona de Delivery'}
              </h3>
              <button onClick={() => setIsZoneModalOpen(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {zoneError && (
              <div className="p-3 rounded-xl bg-error/10 text-error border border-error/20 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{zoneError}</span>
              </div>
            )}

            <form onSubmit={handleSaveZone} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">Nombre de la Zona *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: Zona Norte, Casco Central, El Rosal"
                  value={zoneForm.name}
                  onChange={e => setZoneForm({...zoneForm, name: e.target.value})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">Costo / Tarifa de Envío ($ USD) *</label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Ej: 2.50"
                  value={zoneForm.cost}
                  onChange={e => setZoneForm({...zoneForm, cost: parseFloat(e.target.value) || 0})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1 font-mono font-bold"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-border/60">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={zoneForm.is_active}
                    onChange={e => setZoneForm({...zoneForm, is_active: e.target.checked})}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                  />
                  <span className="text-xs font-semibold text-text-primary">
                    Zona de delivery activa
                  </span>
                </label>

                {isQuickConnected && (
                  <div 
                    onClick={() => setZoneForm({...zoneForm, sync_to_quick: !zoneForm.sync_to_quick})}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer mt-2 ${
                      zoneForm.sync_to_quick 
                        ? 'bg-primary/5 border-primary/40 shadow-sm' 
                        : 'bg-surface-raised border-border hover:border-border-strong'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                      zoneForm.sync_to_quick
                        ? 'bg-primary border-primary text-white shadow-sm'
                        : 'border-border-strong bg-surface hover:border-primary/50'
                    }`}>
                      {zoneForm.sync_to_quick && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div className="flex-1 select-none">
                      <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" /> Sincronizar en VerumQuick
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                        Al guardar, se creará o actualizará automáticamente como zona de delivery en tu catálogo de VerumQuick.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsZoneModalOpen(false)}
                  className="px-4 h-11 border border-border bg-surface hover:bg-surface-raised text-text-primary rounded-xl text-sm font-semibold transition-colors flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={creatingZone || updatingZone}
                  className="bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <Check className="w-4 h-4" />{' '}
                  {creatingZone || updatingZone
                    ? 'Guardando...' 
                    : editingZone ? 'Guardar Cambios' : 'Registrar Zona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
