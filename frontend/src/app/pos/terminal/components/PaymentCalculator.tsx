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
  HelpCircle
} from 'lucide-react'
import { usePaymentMethods } from '@/hooks/useSales'
import { CheckoutPayment, CheckoutChange } from '@/lib/api/sales'

interface PaymentCalculatorProps {
  total: number
  vesRate: number
  paymentType: 'complete' | 'mixed'
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
  vesRate,
  paymentType,
  onBack,
  onComplete
}: PaymentCalculatorProps) {
  const { data: methods = [] } = usePaymentMethods()

  // Selected method
  const [selectedMethodId, setSelectedMethodId] = useState<string>('')
  // Currency mode of current input: 'USD' or 'VES'
  const [inputCurrency, setInputCurrency] = useState<'USD' | 'VES'>('USD')
  // String buffer for on-screen numpad
  const [inputAmountStr, setInputAmountStr] = useState<string>('')
  // Cash tendered buffer (when cash method selected)
  const [cashTenderedStr, setCashTenderedStr] = useState<string>('')
  // Reference input (transfer/mobile)
  const [reference, setReference] = useState<string>('')
  // Array of registered payments
  const [paymentsList, setPaymentsList] = useState<
    Array<CheckoutPayment & { methodName: string; methodType: string }>
  >([])

  const selectedMethod = useMemo(
    () => methods.find((m) => m.id === selectedMethodId),
    [methods, selectedMethodId]
  )

  // Default select first method
  useEffect(() => {
    if (methods.length > 0 && !selectedMethodId) {
      setSelectedMethodId(methods[0].id)
    }
  }, [methods, selectedMethodId])

  // Total paid in USD
  const totalPaidUSD = useMemo(() => {
    return paymentsList.reduce((acc, p) => acc + p.amount * (p.exchange_rate || 1.0), 0)
  }, [paymentsList])

  const remainingUSD = useMemo(() => {
    const rem = total - totalPaidUSD
    return rem > 0.009 ? rem : 0
  }, [total, totalPaidUSD])

  const remainingVES = useMemo(() => remainingUSD * vesRate, [remainingUSD, vesRate])

  // Auto prefill input amount based on remaining
  useEffect(() => {
    if (paymentType === 'complete') {
      const amt = inputCurrency === 'USD' ? total : total * vesRate
      setInputAmountStr(amt.toFixed(2))
    } else {
      const amt = inputCurrency === 'USD' ? remainingUSD : remainingVES
      setInputAmountStr(amt > 0 ? amt.toFixed(2) : '')
    }
  }, [selectedMethodId, inputCurrency, remainingUSD, remainingVES, paymentType, total, vesRate])

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
    if (inputCurrency === 'USD') {
      setInputAmountStr(multiplier.toString())
    } else {
      setInputAmountStr((multiplier * vesRate).toString())
    }
  }

  const handleAddPayment = () => {
    const rawVal = parseFloat(inputAmountStr)
    if (!rawVal || rawVal <= 0 || !selectedMethod) return

    let amountUSD = rawVal
    let rate = 1.0

    if (inputCurrency === 'VES') {
      amountUSD = rawVal / vesRate
      rate = 1.0 / vesRate
    }

    const cashTenderedVal = parseFloat(cashTenderedStr)

    const newPayment: CheckoutPayment & { methodName: string; methodType: string } = {
      payment_method_id: selectedMethod.id,
      amount: rawVal,
      currency_code: inputCurrency,
      exchange_rate: rate,
      reference: reference.trim() || null,
      cash_tendered: cashTenderedVal && cashTenderedVal > rawVal ? cashTenderedVal : null,
      methodName: selectedMethod.name,
      methodType: selectedMethod.method_type
    }

    if (paymentType === 'complete') {
      // In complete flow, we finish right away
      let changeObj: CheckoutChange | null = null
      if (cashTenderedVal && cashTenderedVal > rawVal) {
        changeObj = {
          amount: cashTenderedVal - rawVal,
          currency_code: inputCurrency,
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
    if (remainingUSD > 0.05) return

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
    <div className="flex-1 flex overflow-hidden">
      {/* Left panel: Payment Methods List (38%) */}
      <div className="w-[38%] border-r border-border bg-surface-raised/30 flex flex-col p-6 space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-xl hover:bg-surface-raised transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>
          <span className="text-xs font-bold text-text-secondary uppercase">Métodos de Pago</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
          {methods.map((method) => {
            const IconComponent = METHOD_ICONS[method.method_type] || METHOD_ICONS.other
            const isSelected = selectedMethodId === method.id

            return (
              <button
                key={method.id}
                type="button"
                onClick={() => {
                  setSelectedMethodId(method.id)
                  if (method.currency_code === 'VES' || method.currency_code === 'Bs') {
                    setInputCurrency('VES')
                  } else {
                    setInputCurrency('USD')
                  }
                }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-text-primary shadow-lg shadow-primary/5 ring-1 ring-primary'
                    : 'bg-surface border-border/80 text-text-secondary hover:text-text-primary hover:border-border hover:bg-surface-raised'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                      isSelected
                        ? 'bg-primary text-black border-primary'
                        : 'bg-surface-raised text-text-secondary border-border'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">{method.name}</h4>
                    <span className="text-xs text-text-secondary capitalize">
                      {method.method_type.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${
                    isSelected
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-surface-raised text-text-secondary'
                  }`}
                >
                  {method.currency_code || 'USD'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right panel: Calculator & Payments summary (62%) */}
      <div className="flex-1 flex flex-col p-6 space-y-5 overflow-y-auto">
        {/* Summary Bar */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-surface-raised border border-border rounded-2xl">
          <div>
            <span className="text-[11px] font-bold text-text-secondary uppercase">Total Cuenta</span>
            <div className="text-lg font-black text-text-primary font-mono tracking-tight mt-0.5">
              ${total.toFixed(2)}
            </div>
            <span className="text-[11px] text-text-secondary font-mono">
              Bs. {(total * vesRate).toFixed(2)}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-text-secondary uppercase">Total Pagado</span>
            <div className="text-lg font-black text-emerald-500 font-mono tracking-tight mt-0.5">
              ${totalPaidUSD.toFixed(2)}
            </div>
            <span className="text-[11px] text-emerald-500/80 font-mono">
              Bs. {(totalPaidUSD * vesRate).toFixed(2)}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-text-secondary uppercase">Por Pagar</span>
            <div
              className={`text-lg font-black font-mono tracking-tight mt-0.5 ${
                remainingUSD <= 0.009 ? 'text-emerald-500' : 'text-amber-500'
              }`}
            >
              ${remainingUSD.toFixed(2)}
            </div>
            <span className="text-[11px] text-text-secondary font-mono">
              Bs. {remainingVES.toFixed(2)}
            </span>
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
                      {p.currency_code} {p.amount.toFixed(2)}
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
                <label className="text-xs font-bold text-text-secondary uppercase">Monto a Cobrar</label>
                {/* Currency Switch */}
                <div className="flex bg-surface-raised p-1 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setInputCurrency('USD')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      inputCurrency === 'USD'
                        ? 'bg-primary text-black shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputCurrency('VES')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      inputCurrency === 'VES'
                        ? 'bg-primary text-black shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    VES (Bs.)
                  </button>
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-text-secondary text-lg">
                  {inputCurrency === 'USD' ? '$' : 'Bs.'}
                </span>
                <input
                  type="text"
                  readOnly
                  value={inputAmountStr}
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-3 bg-surface-raised border border-border focus:border-primary rounded-2xl text-2xl font-black font-mono text-text-primary outline-none transition-all text-right"
                />
              </div>
            </div>

            {/* Quick cash / amounts */}
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="py-2 bg-surface-raised hover:bg-surface border border-border rounded-xl text-xs font-mono font-bold text-text-primary hover:border-primary/40 transition-all cursor-pointer"
                >
                  ${val}
                </button>
              ))}
            </div>

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
                    {inputCurrency === 'USD' ? '$' : 'Bs.'}{' '}
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
                  disabled={!inputAmountStr || parseFloat(inputAmountStr) <= 0}
                  className="w-full py-3.5 bg-primary text-black font-black text-sm rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <Check className="w-5 h-5" />
                  <span>Procesar Pago Completo</span>
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleAddPayment}
                    disabled={!inputAmountStr || parseFloat(inputAmountStr) <= 0}
                    className="flex-1 py-3 bg-surface-raised hover:bg-surface border border-primary/40 text-primary font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Pago</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishMixed}
                    disabled={remainingUSD > 0.01 || paymentsList.length === 0}
                    className="flex-1 py-3 bg-emerald-500 text-black font-black text-sm rounded-2xl hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <Check className="w-4 h-4" />
                    <span>Finalizar Cobro</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* On-screen Touch Numpad */}
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
        </div>
      </div>
    </div>
  )
}
