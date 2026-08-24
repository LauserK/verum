'use client'

import React, { useState, useMemo } from 'react'
import {
  X,
  CreditCard,
  Layers,
  FileCheck2,
  Receipt,
  User,
  AlertCircle,
  ArrowRight,
  Sparkles,
  DollarSign
} from 'lucide-react'
import { PaymentCalculator } from './PaymentCalculator'
import { ChangeRegistration } from './ChangeRegistration'
import { CheckoutConfirmation } from './CheckoutConfirmation'
import { useCheckout, useBillingConfig, useCurrencies, useExchangeRates, useWorkstations, useActivePosSession } from '@/hooks/useSales'
import { usePosStore, CartItem, PosMode } from '@/store/posStore'
import { CheckoutPayment, CheckoutChange } from '@/lib/api/sales'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  total: number
  cartItems: CartItem[]
  customerName?: string | null
  mode: PosMode
  tableName?: string | null
  orderNumber: number
}

type CheckoutStep = 'decision' | 'calculator' | 'change' | 'confirmation'
type PaymentFlowType = 'complete' | 'mixed' | 'cxc'

export function CheckoutModal({
  isOpen,
  onClose,
  total,
  cartItems,
  customerName,
  mode,
  tableName,
  orderNumber
}: CheckoutModalProps) {
  const [step, setStep] = useState<CheckoutStep>('decision')
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlowType>('complete')
  const [registeredPayments, setRegisteredPayments] = useState<CheckoutPayment[]>([])
  const [registeredChange, setRegisteredChange] = useState<CheckoutChange | null>(null)
  const [lastInvoice, setLastInvoice] = useState<any | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    activeWorkstationId,
    activeSessionId,
    setActiveWorkstation,
    setSessionOpening,
    customerId,
    customerTaxId,
    clearCart,
    clearCustomer
  } = usePosStore()

  const { data: workstations = [] } = useWorkstations()
  const effectiveWorkstationId = useMemo(() => {
    if (activeWorkstationId) return activeWorkstationId
    const activeOne = workstations.find((w) => w.is_active) || workstations[0]
    return activeOne?.id || null
  }, [activeWorkstationId, workstations])

  const { data: serverSession } = useActivePosSession(effectiveWorkstationId || undefined)
  const effectiveSessionId = activeSessionId || serverSession?.id || null

  const { data: config } = useBillingConfig()
  const { data: currencies = [] } = useCurrencies()
  const { data: rates = [] } = useExchangeRates()
  const checkoutMutation = useCheckout()

  // 1. Resolve Base Currency
  const baseCurrency = useMemo(() => {
    const fromConfig = currencies.find((c) => c.code === config?.default_currency)
    if (fromConfig) return fromConfig
    const isBase = currencies.find((c) => c.is_base)
    if (isBase) return isBase
    return currencies[0] || { code: 'USD', symbol: '$', name: 'Dólar' }
  }, [currencies, config])

  // 2. Resolve Secondary Currency & Active Exchange Rate
  const { secondaryCurrency, exchangeRate } = useMemo(() => {
    const sec = currencies.find((c) => c.id !== baseCurrency.id && c.is_active)
    if (!sec) {
      return { secondaryCurrency: null, exchangeRate: 1.0 }
    }

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
  const totalSecondary = useMemo(() => total * exchangeRate, [total, exchangeRate])

  if (!isOpen) return null

  const handleSelectFlow = (flow: PaymentFlowType) => {
    setPaymentFlow(flow)
    setErrorMessage(null)

    if (flow === 'cxc') {
      if (!customerId) {
        setErrorMessage('La venta a Crédito (CXC) requiere un cliente registrado con RIF/Cédula.')
        return
      }
      // Execute CXC directly without payments
      handleFinalizeCheckout([], null)
      return
    }

    setStep('calculator')
  }

  const handleFinalizeCheckout = async (
    payments: CheckoutPayment[],
    change: CheckoutChange | null
  ) => {
    const wsId = effectiveWorkstationId
    const sessId = effectiveSessionId

    if (!wsId || !sessId) {
      setErrorMessage('No hay sesión de caja activa o estación de trabajo asignada. Por favor abre una sesión de caja.')
      return
    }

    try {
      const itemsPayload = cartItems.map((item) => ({
        sale_item_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        discount_pct: 0
      }))

      const payload = {
        workstation_id: wsId,
        pos_session_id: sessId,
        mode: mode,
        customer_id: customerId,
        customer_name: customerName,
        customer_tax_id: customerTaxId,
        items: itemsPayload,
        payments: payments,
        change: change,
        document_type: 'invoice'
      }

      const res = await checkoutMutation.mutateAsync(payload)
      setLastInvoice(res.invoice)
      setStep('confirmation')
    } catch (err: any) {
      console.error('Checkout error:', err)
      setErrorMessage(err.message || 'Error al procesar el cobro.')
    }
  }

  const handleNewOrder = () => {
    clearCart()
    clearCustomer()
    setStep('decision')
    setRegisteredPayments([])
    setRegisteredChange(null)
    setLastInvoice(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full h-full max-w-7xl max-h-[92vh] mx-4 bg-surface border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-border/80 bg-surface-raised/40">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl border border-primary/20">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black text-text-primary tracking-tight">Cobro POS</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-raised text-text-secondary border border-border font-mono">
                  #{orderNumber}
                </span>
                {tableName && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                    Mesa: {tableName}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-2">
                <span>Cliente: <strong className="text-text-primary">{customerName || 'Cliente General'}</strong></span>
                {customerTaxId && <span className="font-mono text-primary font-semibold">({customerTaxId})</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Total Badge */}
            <div className="text-right">
              <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">Total a Cobrar</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-primary font-mono tracking-tight">
                  {baseCurrency.symbol} {total.toFixed(2)}
                </span>
                {hasSecondary && (
                  <span className="text-sm font-bold text-text-secondary font-mono">
                    / {secondaryCurrency?.symbol} {totalSecondary.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {secondaryCurrency?.code}
                  </span>
                )}
              </div>
            </div>

            {step !== 'confirmation' && (
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-2xl transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-8 mt-4 p-4 bg-error/10 border border-error/20 rounded-2xl text-error text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body / Views */}
        <div className="flex-1 flex overflow-hidden">
          {step === 'decision' && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 max-w-5xl mx-auto space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-text-primary">Selecciona el tipo de pago</h2>
                <p className="text-sm text-text-secondary max-w-md">
                  Elige la modalidad para procesar los ${total.toFixed(2)} correspondientes a esta cuenta.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {/* 1. Pago Completo */}
                <button
                  type="button"
                  onClick={() => handleSelectFlow('complete')}
                  className="flex flex-col items-center text-center p-8 bg-surface-raised/50 hover:bg-surface-raised border border-border/80 hover:border-primary/50 rounded-3xl transition-all group cursor-pointer hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5 border border-primary/20 group-hover:scale-110 transition-transform">
                    <CreditCard className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors">
                    Pago Completo
                  </h3>
                  <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                    Un solo método de pago (Efectivo, Tarjeta, Pago Móvil o Zelle).
                  </p>
                  <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>

                {/* 2. Pago Mixto */}
                <button
                  type="button"
                  onClick={() => handleSelectFlow('mixed')}
                  className="flex flex-col items-center text-center p-8 bg-surface-raised/50 hover:bg-surface-raised border border-border/80 hover:border-amber-500/50 rounded-3xl transition-all group cursor-pointer hover:shadow-xl hover:shadow-amber-500/5 hover:-translate-y-1"
                >
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-5 border border-amber-500/20 group-hover:scale-110 transition-transform">
                    <Layers className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary group-hover:text-amber-500 transition-colors">
                    Pago Mixto / Múltiple
                  </h3>
                  <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                    Combina efectivo en USD + Pago Móvil en VES o varias tarjetas.
                  </p>
                  <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-amber-500 group-hover:translate-x-1 transition-transform">
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>

                {/* 3. Cuenta por Cobrar (CXC) */}
                <button
                  type="button"
                  onClick={() => handleSelectFlow('cxc')}
                  className="flex flex-col items-center text-center p-8 bg-surface-raised/50 hover:bg-surface-raised border border-border/80 hover:border-purple-500/50 rounded-3xl transition-all group cursor-pointer hover:shadow-xl hover:shadow-purple-500/5 hover:-translate-y-1"
                >
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-5 border border-purple-500/20 group-hover:scale-110 transition-transform">
                    <FileCheck2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary group-hover:text-purple-500 transition-colors">
                    Crédito / CXC
                  </h3>
                  <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                    Cargar al saldo pendiente del cliente con factura confirmada.
                  </p>
                  <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-purple-500 group-hover:translate-x-1 transition-transform">
                    <span>Confirmar CXC</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'calculator' && (
            <PaymentCalculator
              total={total}
              paymentType={paymentFlow === 'mixed' ? 'mixed' : 'complete'}
              onBack={() => setStep('decision')}
              onComplete={(payments, change) => {
                setRegisteredPayments(payments)
                setRegisteredChange(change)
                handleFinalizeCheckout(payments, change)
              }}
            />
          )}

          {step === 'confirmation' && lastInvoice && (
            <CheckoutConfirmation
              invoice={lastInvoice}
              onNewOrder={handleNewOrder}
            />
          )}
        </div>
      </div>
    </div>
  )
}
