'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  DollarSign,
  Coins,
  CreditCard,
  Building2,
  Smartphone,
  Repeat,
  AlertCircle,
  HelpCircle,
  ArrowRightLeft,
  Loader2
} from 'lucide-react'
import { usePaymentMethods, useCurrencies, useExchangeRates, useBillingConfig } from '@/hooks/useSales'
import { CheckoutPayment, CheckoutChange } from '@/lib/api/sales'

interface PaymentCalculatorProps {
  total: number
  vesRate?: number
  paymentType: 'complete' | 'mixed'
  isProcessing?: boolean
  onBack: () => void
  onComplete: (payments: CheckoutPayment[], change: CheckoutChange | null) => void
}

const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Coins,
  card: CreditCard,
  bank_transfer: Building2,
  mobile_payment: Smartphone,
  other: DollarSign
}

export function PaymentCalculator({
  total,
  paymentType,
  isProcessing = false,
  onBack,
  onComplete
}: PaymentCalculatorProps) {
  const { data: methods = [] } = usePaymentMethods()
  const { data: currencies = [] } = useCurrencies()
  const { data: rates = [] } = useExchangeRates()
  const { data: config } = useBillingConfig()

  // 1. Resolve Base Currency
  const baseCurrency = useMemo(() => {
    const fromConfig = currencies.find((c) => c.code === config?.default_currency)
    if (fromConfig) return fromConfig
    const isBase = currencies.find((c) => c.is_base)
    if (isBase) return isBase
    return currencies[0] || { code: 'USD', symbol: '$', name: 'Dólar Estadounidense' }
  }, [currencies, config])

  // 2. Resolve Secondary Currency & Active Exchange Rate
  const { secondaryCurrency, exchangeRate } = useMemo(() => {
    const sec = currencies.find((c) => c.id !== baseCurrency.id && c.is_active)
    if (!sec) {
      return { secondaryCurrency: null, exchangeRate: 1.0 }
    }

    // Find rate between base and secondary
    const directRate = rates.find(
      (r) =>
        (r.from_currency === baseCurrency.code && r.to_currency === sec.code) ||
        (r.to_currency === sec.code)
    )

    const rVal = directRate?.rate ? Number(directRate.rate) : 1.0
    return {
      secondaryCurrency: sec,
      exchangeRate: rVal > 0 ? rVal : 1.0
    }
  }, [currencies, baseCurrency, rates])

  const hasSecondary = Boolean(secondaryCurrency && exchangeRate > 0)

  // Selected method
  const [selectedMethodId, setSelectedMethodId] = useState<string>('')
  // Currency code of current input (e.g. 'USD', 'VES', 'CLP', etc.)
  const [inputCurrencyCode, setInputCurrencyCode] = useState<string>(baseCurrency.code)
  // String buffer for on-screen numpad
  const [inputAmountStr, setInputAmountStr] = useState<string>('')
  // Cash tendered buffer (when cash method selected)
  const [cashTenderedStr, setCashTenderedStr] = useState<string>('')
  // Reference input (transfer/mobile)
  const [reference, setReference] = useState<string>('')
  // Array of registered payments
  const [paymentsList, setPaymentsList] = useState<
    Array<CheckoutPayment & { methodName: string; methodType: string; symbol: string }>
  >([])

  // Keep inputCurrencyCode aligned with base currency initially
  useEffect(() => {
    if (baseCurrency?.code && !inputCurrencyCode) {
      setInputCurrencyCode(baseCurrency.code)
    }
  }, [baseCurrency, inputCurrencyCode])

  const selectedMethod = useMemo(
    () => methods.find((m) => m.id === selectedMethodId),
    [methods, selectedMethodId]
  )

  // Active currency meta for current input
  const activeInputCurrency = useMemo(() => {
    return (
      currencies.find((c) => c.code === inputCurrencyCode) ||
      (inputCurrencyCode === secondaryCurrency?.code ? secondaryCurrency : baseCurrency)
    )
  }, [currencies, inputCurrencyCode, secondaryCurrency, baseCurrency])

  // Default select first method
  useEffect(() => {
    if (methods.length > 0 && !selectedMethodId) {
      setSelectedMethodId(methods[0].id)
    }
  }, [methods, selectedMethodId])

  // Total paid in Base Currency
  const totalPaidBase = useMemo(() => {
    return paymentsList.reduce((acc, p) => acc + p.amount * (p.exchange_rate || 1.0), 0)
  }, [paymentsList])

  const remainingBase = useMemo(() => {
    const rem = total - totalPaidBase
    return rem > 0.009 ? rem : 0
  }, [total, totalPaidBase])

  const remainingSecondary = useMemo(
    () => (hasSecondary ? remainingBase * exchangeRate : 0),
    [remainingBase, exchangeRate, hasSecondary]
  )

  // Auto prefill input amount based on remaining
  useEffect(() => {
    if (paymentType === 'complete') {
      const amt =
        inputCurrencyCode === baseCurrency.code
          ? total
          : hasSecondary
          ? total * exchangeRate
          : total
      setInputAmountStr(amt.toFixed(2))
    } else {
      const amt =
        inputCurrencyCode === baseCurrency.code
          ? remainingBase
          : hasSecondary
          ? remainingSecondary
          : remainingBase
      setInputAmountStr(amt > 0 ? amt.toFixed(2) : '')
    }
  }, [
    selectedMethodId,
    inputCurrencyCode,
    remainingBase,
    remainingSecondary,
    paymentType,
    total,
    exchangeRate,
    baseCurrency.code,
    hasSecondary
  ])

  // Live Conversion Calculation for Numpad Buffer
  const liveConversion = useMemo(() => {
    const val = parseFloat(inputAmountStr)
    if (!val || isNaN(val) || val <= 0 || !hasSecondary) return null

    if (inputCurrencyCode === baseCurrency.code) {
      // Base -> Secondary
      const converted = val * exchangeRate
      return {
        amount: converted,
        formatted: `${secondaryCurrency?.symbol || ''} ${converted.toLocaleString('es-VE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} ${secondaryCurrency?.code || ''}`,
        targetCurrency: secondaryCurrency?.code
      }
    } else {
      // Secondary -> Base
      const converted = val / exchangeRate
      return {
        amount: converted,
        formatted: `${baseCurrency.symbol} ${converted.toLocaleString('es-VE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} ${baseCurrency.code}`,
        targetCurrency: baseCurrency.code
      }
    }
  }, [inputAmountStr, inputCurrencyCode, baseCurrency, secondaryCurrency, exchangeRate, hasSecondary])

  // Numpad key handlers
  const handleNumpadPress = (val: string) => {
    if (val === 'C') {
      setInputAmountStr('')
      return
    }
    if (val === '⌫') {
      setInputAmountStr((prev) => prev.slice(0, -1))
      return
    }
    if (val === '.') {
      if (inputAmountStr.includes('.')) return
      setInputAmountStr((prev) => (prev ? prev + '.' : '0.'))
      return
    }
    setInputAmountStr((prev) => prev + val)
  }

  // Quick amount buttons
  const handleQuickAmount = (multiplier: number) => {
    if (inputCurrencyCode === baseCurrency.code) {
      setInputAmountStr(multiplier.toString())
    } else {
      setInputAmountStr(hasSecondary ? (multiplier * exchangeRate).toFixed(2) : multiplier.toString())
    }
  }

  const handleAddPayment = () => {
    const rawVal = parseFloat(inputAmountStr)
    if (!rawVal || rawVal <= 0 || !selectedMethod) return

    let amountBase = rawVal
    let rate = 1.0

    if (inputCurrencyCode !== baseCurrency.code && hasSecondary) {
      amountBase = rawVal / exchangeRate
      rate = 1.0 / exchangeRate
    }

    const cashTenderedVal = parseFloat(cashTenderedStr)

    const newPayment: CheckoutPayment & { methodName: string; methodType: string; symbol: string } = {
      payment_method_id: selectedMethod.id,
      amount: rawVal,
      currency_code: inputCurrencyCode,
      exchange_rate: rate,
      reference: reference.trim() || null,
      cash_tendered: cashTenderedVal && cashTenderedVal > rawVal ? cashTenderedVal : null,
      methodName: selectedMethod.name,
      methodType: selectedMethod.method_type,
      symbol: activeInputCurrency?.symbol || '$'
    }

    if (paymentType === 'complete') {
      // In complete flow, we finish right away
      let changeObj: CheckoutChange | null = null
      if (cashTenderedVal && cashTenderedVal > rawVal) {
        changeObj = {
          amount: cashTenderedVal - rawVal,
          currency_code: inputCurrencyCode,
          method: 'cash'
        }
      }
      onComplete([newPayment], changeObj)
    } else {
      // In mixed flow, add to list
      setPaymentsList((prev) => [...prev, newPayment])
      setReference('')
      setCashTenderedStr('')
    }
  }

  const handleRemovePayment = (index: number) => {
    setPaymentsList((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleFinishMixed = () => {
    if (remainingBase > 0.05) return

    // Calculate change if any cash payment was overpaid
    let changeObj: CheckoutChange | null = null
    const cashOverpaid = paymentsList.find((p) => p.cash_tendered && p.cash_tendered > p.amount)
    if (cashOverpaid && cashOverpaid.cash_tendered) {
      changeObj = {
        amount: cashOverpaid.cash_tendered - cashOverpaid.amount,
        currency_code: cashOverpaid.currency_code,
        method: 'cash'
      }
    }

    onComplete(paymentsList, changeObj)
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* Left panel: Payment Methods List (34%-38%) */}
      <div className="w-full md:w-[36%] lg:w-[34%] border-b md:border-b-0 md:border-r border-border bg-surface flex flex-col p-3 sm:p-4 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary px-2.5 py-1.5 rounded-xl hover:bg-surface-raised transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>
          <span className="text-xs font-bold text-text-secondary uppercase">Métodos de Pago</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {methods.map((method) => {
            const IconComponent = METHOD_ICONS[method.method_type] || METHOD_ICONS.other
            const isSelected = selectedMethodId === method.id

            return (
              <button
                key={method.id}
                type="button"
                onClick={() => {
                  setSelectedMethodId(method.id)
                  if (method.currency_code) {
                    setInputCurrencyCode(method.currency_code)
                  } else {
                    setInputCurrencyCode(baseCurrency.code)
                  }
                }}
                className={`w-full flex items-center justify-between p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-text-primary shadow-md shadow-primary/5 ring-1 ring-primary'
                    : 'bg-surface border-border/80 text-text-secondary hover:text-text-primary hover:border-border hover:bg-surface-raised'
                }`}
              >
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border ${
                      isSelected
                        ? 'bg-primary text-black border-primary'
                        : 'bg-surface-raised text-text-secondary border-border'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-text-primary">{method.name}</h4>
                    <span className="text-[10px] sm:text-xs text-text-secondary capitalize">
                      {method.method_type.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-mono font-bold ${
                    isSelected
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-surface-raised text-text-secondary'
                  }`}
                >
                  {method.currency_code || baseCurrency.code}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right panel: Calculator & Payments summary (64%-66%) */}
      <div className="flex-1 flex flex-col p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto">
        {/* Summary Bar */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 p-2.5 sm:p-3.5 bg-surface-raised border border-border rounded-xl sm:rounded-2xl">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-text-secondary uppercase">Total Cuenta</span>
            <div className="text-base sm:text-lg font-black text-text-primary font-mono tracking-tight mt-0.5">
              {baseCurrency.symbol} {total.toFixed(2)}
            </div>
            {hasSecondary && (
              <span className="text-[10px] sm:text-[11px] text-text-secondary font-mono truncate block">
                {secondaryCurrency?.symbol} {(total * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-text-secondary uppercase">Total Pagado</span>
            <div className="text-base sm:text-lg font-black text-emerald-500 font-mono tracking-tight mt-0.5">
              {baseCurrency.symbol} {totalPaidBase.toFixed(2)}
            </div>
            {hasSecondary && (
              <span className="text-[10px] sm:text-[11px] text-emerald-500/80 font-mono truncate block">
                {secondaryCurrency?.symbol} {(totalPaidBase * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-text-secondary uppercase">Por Pagar</span>
            <div
              className={`text-base sm:text-lg font-black font-mono tracking-tight mt-0.5 ${
                remainingBase <= 0.009 ? 'text-emerald-500' : 'text-amber-500'
              }`}
            >
              {baseCurrency.symbol} {remainingBase.toFixed(2)}
            </div>
            {hasSecondary && (
              <span className="text-[10px] sm:text-[11px] text-text-secondary font-mono truncate block">
                {secondaryCurrency?.symbol} {remainingSecondary.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>

        {/* In mixed mode: List of already registered payments */}
        {paymentType === 'mixed' && paymentsList.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-text-secondary uppercase">Pagos Registrados</span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
              {paymentsList.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-surface-raised/70 border border-border rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-text-primary">{p.methodName}</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 bg-surface border border-border rounded-md text-text-secondary">
                      {p.symbol} {p.amount.toFixed(2)} {p.currency_code}
                    </span>
                    {p.reference && (
                      <span className="text-xs text-text-secondary font-mono">Ref: {p.reference}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePayment(idx)}
                    className="p-1 text-text-secondary hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input & Numpad Area */}
        <div className="flex-1 flex gap-6">
          {/* Form fields */}
          <div className="flex-1 flex flex-col justify-between space-y-4">
            {/* Amount input & currency toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  {paymentType === 'complete' ? 'Monto Total a Procesar' : 'Monto a Cobrar'}
                </label>
                {/* Currency Switch (Only shown if secondary currency exists) */}
                {hasSecondary && (
                  <div className="flex bg-surface-raised p-1 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setInputCurrencyCode(baseCurrency.code)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        inputCurrencyCode === baseCurrency.code
                          ? 'bg-primary text-black shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {baseCurrency.code} ({baseCurrency.symbol})
                    </button>
                    {secondaryCurrency && (
                      <button
                        type="button"
                        onClick={() => setInputCurrencyCode(secondaryCurrency.code)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          inputCurrencyCode === secondaryCurrency.code
                            ? 'bg-primary text-black shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {secondaryCurrency.code} ({secondaryCurrency.symbol})
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-text-secondary text-lg">
                  {activeInputCurrency?.symbol || '$'}
                </span>
                <input
                  type="text"
                  readOnly
                  value={inputAmountStr}
                  placeholder="0.00"
                  className={`w-full pl-12 pr-4 py-3 bg-surface-raised border border-border rounded-2xl text-2xl font-black font-mono text-text-primary outline-none transition-all text-right ${
                    paymentType === 'complete' ? 'bg-surface-raised/40 cursor-default' : 'focus:border-primary'
                  }`}
                />
              </div>

              {/* LIVE CONVERSION CALLOUT: Shows instant conversion in the other currency */}
              {hasSecondary && liveConversion && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs text-text-primary font-medium animate-in fade-in">
                  <span className="flex items-center gap-1.5 text-text-secondary text-[11px]">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
                    Equivalente en {liveConversion.targetCurrency}:
                  </span>
                  <span className="font-mono font-bold text-primary">
                    ≈ {liveConversion.formatted}
                  </span>
                </div>
              )}
            </div>

            {/* Quick cash / amounts (only in mixed mode) */}
            {paymentType === 'mixed' && (
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 20, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickAmount(val)}
                    className="py-2 bg-surface-raised hover:bg-surface border border-border rounded-xl text-xs font-mono font-bold text-text-primary hover:border-primary/40 transition-all cursor-pointer"
                  >
                    {baseCurrency.symbol}{val}
                  </button>
                ))}
              </div>
            )}

            {/* Cash Tendered (only if method is cash) */}
            {selectedMethod?.method_type === 'cash' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Monto Recibido en Efectivo (para calcular cambio)
                </label>
                <input
                  type="number"
                  step="any"
                  value={cashTenderedStr}
                  onChange={(e) => setCashTenderedStr(e.target.value)}
                  placeholder={`Ej. ${(parseFloat(inputAmountStr) || 0) + 10}`}
                  className="w-full px-4 py-2.5 bg-surface-raised border border-border focus:border-primary rounded-xl text-sm font-mono text-text-primary outline-none transition-all"
                />
                {parseFloat(cashTenderedStr) > (parseFloat(inputAmountStr) || 0) && (
                  <p className="text-xs text-emerald-400 font-bold mt-1">
                    Cambio a devolver:{' '}
                    {activeInputCurrency?.symbol || '$'}{' '}
                    {(parseFloat(cashTenderedStr) - (parseFloat(inputAmountStr) || 0)).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {/* Reference (if bank or mobile payment) */}
            {selectedMethod?.method_type !== 'cash' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Número de Referencia / Comprobante
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Últimos 4 o 6 dígitos..."
                  className="w-full px-4 py-2.5 bg-surface-raised border border-border focus:border-primary rounded-xl text-sm font-mono text-text-primary outline-none transition-all"
                />
              </div>
            )}

            {/* Bottom Action CTA */}
            <div className="pt-2">
              {paymentType === 'complete' ? (
                <button
                  type="button"
                  onClick={handleAddPayment}
                  disabled={isProcessing || !inputAmountStr || parseFloat(inputAmountStr) <= 0}
                  className={`w-full py-4 font-black text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] select-none ${
                    isProcessing
                      ? 'bg-primary/75 text-black cursor-wait shadow-primary/10 pointer-events-none'
                      : 'bg-primary text-black hover:bg-primary-hover shadow-primary/20 cursor-pointer hover:shadow-xl hover:shadow-primary/30 disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-black" />
                      <span>Procesando Pago Completo...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Procesar Pago Completo ({activeInputCurrency?.symbol}{inputAmountStr})</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleAddPayment}
                    disabled={isProcessing || !inputAmountStr || parseFloat(inputAmountStr) <= 0}
                    className="flex-1 py-3 bg-surface-raised hover:bg-surface border border-primary/40 text-primary font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] select-none"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Pago</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishMixed}
                    disabled={isProcessing || remainingBase > 0.01 || paymentsList.length === 0}
                    className={`flex-1 py-3 font-black text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] select-none ${
                      isProcessing
                        ? 'bg-emerald-500/75 text-black cursor-wait shadow-emerald-500/10 pointer-events-none'
                        : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20 cursor-pointer hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Procesando Cobro...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Finalizar Cobro</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* On-screen Touch Numpad (Only displayed for mixed payment mode) */}
          {paymentType === 'mixed' && (
            <div className="w-60 bg-surface-raised p-3 rounded-2xl border border-border flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-2 flex-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleNumpadPress(key)}
                    className="flex items-center justify-center bg-surface hover:bg-surface-raised active:bg-primary/20 border border-border/80 hover:border-primary/30 rounded-xl text-lg font-bold font-mono text-text-primary transition-all cursor-pointer select-none"
                  >
                    {key}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleNumpadPress('C')}
                className="py-2.5 bg-error/10 text-error hover:bg-error/20 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                Borrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
