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
  DollarSign,
  Loader2,
  Scissors
} from 'lucide-react'
import { PaymentCalculator } from './PaymentCalculator'
import { ChangeRegistration } from './ChangeRegistration'
import { CheckoutConfirmation } from './CheckoutConfirmation'
import { SplitBillModal } from './SplitBillModal'
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

type CheckoutStep = 'decision' | 'calculator' | 'change' | 'confirmation' | 'processing'
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
  const [showSplitBill, setShowSplitBill] = useState(false)

  const {
    activeWorkstationId,
    activeSessionId,
    activeTableId,
    setActiveWorkstation,
    setSessionOpening,
    customerId,
    customerTaxId,
    deliveryZoneId,
    deliveryZoneName,
    deliveryCost,
    deliveryAddress,
    deliveryNotes,
    clearCart,
    clearCustomer,
    clearDelivery
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

    setStep('processing')
    setErrorMessage(null)

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
        table_id: activeTableId || null,
        table_order_id: activeTableId || null,
        customer_id: customerId,
        customer_name: customerName,
        customer_tax_id: customerTaxId,
        items: itemsPayload,
        payments: payments,
        change: change,
        document_type: 'invoice',
        delivery_zone_id: mode === 'delivery' ? deliveryZoneId : undefined,
        delivery_zone_name: mode === 'delivery' ? deliveryZoneName : undefined,
        delivery_cost: mode === 'delivery' ? (deliveryCost || 0) : 0,
        delivery_address: mode === 'delivery' ? deliveryAddress : undefined,
        delivery_notes: mode === 'delivery' ? deliveryNotes : undefined,
        idempotency_key: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random()}`
      }

      const res = await checkoutMutation.mutateAsync(payload)
      setLastInvoice(res.invoice)
      setStep('confirmation')
    } catch (err: any) {
      console.error('Checkout error:', err)
      const detailMsg = err?.response?.data?.detail || err?.detail || err?.message || 'Error al procesar el cobro.'
      setErrorMessage(typeof detailMsg === 'string' ? detailMsg : JSON.stringify(detailMsg))
      setStep('calculator')
    }
  }

  const handleNewOrder = () => {
    clearCart()
    clearCustomer()
    clearDelivery()
    setStep('decision')
    setRegisteredPayments([])
    setRegisteredChange(null)
    setLastInvoice(null)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full h-full max-w-7xl max-h-[92vh] mx-4 bg-surface border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Modal Top Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-b border-border/80 bg-surface-raised/40 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-primary/10 text-primary rounded-xl sm:rounded-2xl border border-primary/20">
                <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg md:text-xl font-black text-text-primary tracking-tight">Cobro POS</h1>
                  <span className="px-2 py-0.2 sm:px-2.5 sm:py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-surface-raised text-text-secondary border border-border font-mono">
                    #{orderNumber}
                  </span>
                  {tableName && (
                    <span className="px-2 py-0.2 sm:px-2.5 sm:py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                      Mesa: {tableName}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-text-secondary mt-0.5 flex items-center gap-1.5">
                  <span>Cliente: <strong className="text-text-primary">{customerName || 'Cliente General'}</strong></span>
                  {customerTaxId && <span className="font-mono text-primary font-semibold">({customerTaxId})</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              {/* Total Badge */}
              <div className="text-right">
                <div className="text-[10px] sm:text-xs font-bold text-text-secondary uppercase tracking-wider">Total a Cobrar</div>
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-lg sm:text-2xl font-black text-primary font-mono tracking-tight">
                    {baseCurrency.symbol} {total.toFixed(2)}
                  </span>
                  {hasSecondary && (
                    <span className="hidden sm:inline text-xs sm:text-sm font-bold text-text-secondary font-mono">
                      / {secondaryCurrency?.symbol} {totalSecondary.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>

              {step !== 'confirmation' && step !== 'processing' && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 sm:p-2 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              )}
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mx-4 sm:mx-8 mt-3 p-3 sm:p-4 bg-error/10 border border-error/20 rounded-2xl text-error text-xs sm:text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Modal Body / Views */}
          <div className="flex-1 flex overflow-hidden">
            {step === 'decision' && (
              <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto">
                <div className="text-center space-y-1">
                  <h2 className="text-lg sm:text-2xl font-black text-text-primary">Selecciona el tipo de pago</h2>
                  <p className="text-xs sm:text-sm text-text-secondary max-w-md">
                    Elige la modalidad para procesar los ${total.toFixed(2)} de esta cuenta.
                  </p>
                </div>

                <div className={`grid gap-3 sm:gap-4 w-full ${mode === 'tables' ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
                  {/* 1. Pago Completo */}
                  <button
                    type="button"
                    onClick={() => handleSelectFlow('complete')}
                    disabled={checkoutMutation.isPending}
                    className="flex flex-col items-center text-center p-4 sm:p-5 bg-surface-raised/50 hover:bg-surface-raised border border-border/80 hover:border-primary/50 rounded-2xl sm:rounded-3xl transition-all group cursor-pointer hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 border border-primary/20 group-hover:scale-105 transition-transform">
                      <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-text-primary group-hover:text-primary transition-colors">
                      Pago Completo
                    </h3>
                    <p className="text-[11px] sm:text-xs text-text-secondary mt-1 leading-relaxed">
                      Efectivo, Tarjeta o Pago Móvil
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                      <span>Continuar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  {/* 2. Pago Mixto */}
                  <button
                    type="button"
                    onClick={() => handleSelectFlow('mixed')}
                    disabled={checkoutMutation.isPending}
                    className="flex flex-col items-center text-center p-4 sm:p-5 bg-surface-raised/50 hover:bg-surface-raised border border-border/80 hover:border-amber-500/50 rounded-2xl sm:rounded-3xl transition-all group cursor-pointer hover:shadow-xl hover:shadow-amber-500/5 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 border border-amber-500/20 group-hover:scale-105 transition-transform">
                      <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-text-primary group-hover:text-amber-500 transition-colors">
                      Pago Mixto
                    </h3>
                    <p className="text-[11px] sm:text-xs text-text-secondary mt-1 leading-relaxed">
                      USD + VES / Múltiples Métodos
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-amber-500 group-hover:translate-x-0.5 transition-transform">
                      <span>Continuar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  {/* 3. Cuenta por Cobrar (CXC) */}
                  <button
                    type="button"
                    onClick={() => handleSelectFlow('cxc')}
                    disabled={checkoutMutation.isPending}
                    className="flex flex-col items-center text-center p-4 sm:p-5 bg-surface-raised/50 hover:bg-surface-raised border border-border/80 hover:border-purple-500/50 rounded-2xl sm:rounded-3xl transition-all group cursor-pointer hover:shadow-xl hover:shadow-purple-500/5 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-3 border border-purple-500/20 group-hover:scale-105 transition-transform">
                      {checkoutMutation.isPending && paymentFlow === 'cxc' ? (
                        <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                      ) : (
                        <FileCheck2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-text-primary group-hover:text-purple-500 transition-colors">
                      Crédito / CXC
                    </h3>
                    <p className="text-[11px] sm:text-xs text-text-secondary mt-1 leading-relaxed">
                      Cargar a saldo del cliente
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-purple-500 group-hover:translate-x-0.5 transition-transform">
                      {checkoutMutation.isPending && paymentFlow === 'cxc' ? (
                        <span>Procesando...</span>
                      ) : (
                        <>
                          <span>Confirmar</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </div>
                  </button>

                  {/* 4. Dividir Cuenta (Visible on tables mode) */}
                  {mode === 'tables' && (
                    <button
                      type="button"
                      onClick={() => setShowSplitBill(true)}
                      disabled={checkoutMutation.isPending}
                      className="flex flex-col items-center text-center p-4 sm:p-5 bg-surface-raised/50 hover:bg-surface-raised border border-border/80 hover:border-teal-500/50 rounded-2xl sm:rounded-3xl transition-all group cursor-pointer hover:shadow-xl hover:shadow-teal-500/5 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3 border border-teal-500/20 group-hover:scale-105 transition-transform">
                        <Scissors className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-text-primary group-hover:text-teal-400 transition-colors">
                        Dividir Cuenta
                      </h3>
                      <p className="text-[11px] sm:text-xs text-text-secondary mt-1 leading-relaxed">
                        Por Asientos o Partes Iguales
                      </p>
                      <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-teal-400 group-hover:translate-x-0.5 transition-transform">
                        <span>Dividir</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {step === 'calculator' && (
              <PaymentCalculator
                total={total}
                paymentType={paymentFlow === 'mixed' ? 'mixed' : 'complete'}
                isProcessing={checkoutMutation.isPending}
                onBack={() => setStep('decision')}
                onComplete={(payments, change) => {
                  setRegisteredPayments(payments)
                  setRegisteredChange(change)
                  handleFinalizeCheckout(payments, change)
                }}
              />
            )}

            {step === 'processing' && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 max-w-lg mx-auto text-center space-y-6 animate-in fade-in zoom-in-95">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 animate-spin">
                    <Loader2 className="w-10 h-10" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl -z-10 animate-pulse" />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-primary uppercase tracking-widest">
                    Procesamiento en Curso
                  </span>
                  <h2 className="text-2xl font-black text-text-primary tracking-tight">
                    Registrando Venta...
                  </h2>
                  <p className="text-xs text-text-secondary max-w-sm">
                    Generando comprobante fiscal, validando pagos y deduciendo inventario.
                  </p>
                </div>

                <div className="w-full p-4 bg-surface-raised border border-border rounded-2xl space-y-2.5 text-left text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Monto Total:</span>
                    <span className="font-mono font-bold text-text-primary">
                      {baseCurrency.symbol} {total.toFixed(2)}
                    </span>
                  </div>
                  {customerName && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Cliente:</span>
                      <span className="font-semibold text-text-primary">{customerName}</span>
                    </div>
                  )}
                  {tableName && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Mesa:</span>
                      <span className="font-semibold text-primary">{tableName}</span>
                    </div>
                  )}
                </div>
              </div>
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

      {/* Split Bill Modal */}
      {showSplitBill && (
        <SplitBillModal
          isOpen={showSplitBill}
          onClose={() => setShowSplitBill(false)}
          onSuccess={() => {
            setShowSplitBill(false)
            onClose()
          }}
        />
      )}
    </>
  )
}
