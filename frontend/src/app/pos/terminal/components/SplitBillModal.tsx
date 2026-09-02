'use client'

import React, { useState, useMemo } from 'react'
import {
  X,
  Scissors,
  Users,
  PieChart,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  User,
  RefreshCw,
  Divide,
  Loader2
} from 'lucide-react'
import { usePosStore, Seat } from '@/store/posStore'
import { useInvoiceByTableOrder, useCheckout, useBillingConfig, useCurrencies, useExchangeRates, useWorkstations, useActivePosSession } from '@/hooks/useSales'
import { PaymentCalculator } from './PaymentCalculator'
import { CheckoutConfirmation } from './CheckoutConfirmation'
import { CheckoutPayment, CheckoutChange } from '@/lib/api/sales'

interface SplitBillModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

type SplitTab = 'seats' | 'equal' | 'manual'

export function SplitBillModal({ isOpen, onClose, onSuccess }: SplitBillModalProps) {
  const [activeTab, setActiveTab] = useState<SplitTab>('seats')
  const [equalPartsCount, setEqualPartsCount] = useState<number>(2)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  
  // Payment calculator active state for sub-flow
  const [payingTarget, setPayingTarget] = useState<{
    splitMode: 'seats' | 'equal' | 'manual'
    amount: number
    seatLabel?: string
    coveredItemIds: string[]
    description: string
  } | null>(null)

  const [lastInvoice, setLastInvoice] = useState<any | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isProcessingPartial, setIsProcessingPartial] = useState<boolean>(false)

  const {
    cart,
    total,
    posMode,
    activeTableId,
    activeTableName,
    activeWorkstationId,
    activeSessionId,
    customerId,
    customerName,
    customerTaxId,
    cartsByContext,
    clearCart,
    clearCustomer,
    setActiveTable
  } = usePosStore()

  const currentCtx = posMode === 'tables' && activeTableId ? cartsByContext[`table:${activeTableId}`] : null
  const seats: Seat[] = useMemo(() => {
    if (currentCtx?.seats && currentCtx.seats.length > 0) {
      return currentCtx.seats
    }
    return []
  }, [currentCtx])

  // Fetch partial table invoice & existing payments
  const { 
    data: tableInvoiceData, 
    isLoading: isLoadingInvoice,
    isFetching: isFetchingInvoice,
    refetch: refetchInvoice 
  } = useInvoiceByTableOrder(activeTableId)
  
  const existingPayments = useMemo(() => tableInvoiceData?.payments || [], [tableInvoiceData])

  const partialInvoice = useMemo(() => tableInvoiceData?.invoice || null, [tableInvoiceData])

  // Paid covered item IDs
  const paidItemIds = useMemo(() => {
    const ids = new Set<string>()
    existingPayments.forEach((p) => {
      if (Array.isArray(p.covered_items)) {
        p.covered_items.forEach((id) => ids.add(String(id)))
      }
    })
    return ids
  }, [existingPayments])

  // Paid seat labels
  const paidSeatLabels = useMemo(() => {
    const seatNames = new Set<string>()
    existingPayments.forEach((p) => {
      if (p.seat_label) {
        seatNames.add(p.seat_label)
      }
    })
    return seatNames
  }, [existingPayments])

  // Already paid amount from backend invoice or payments sum
  const amountPaidAccumulated = useMemo(() => {
    if (partialInvoice && typeof partialInvoice.amount_paid === 'number') {
      return partialInvoice.amount_paid
    }
    return existingPayments.reduce((acc, p) => acc + (p.amount * (p.exchange_rate || 1.0)), 0)
  }, [partialInvoice, existingPayments])

  const tableTotal = useMemo(() => {
    if (partialInvoice && typeof partialInvoice.total === 'number') {
      return partialInvoice.total
    }
    return total
  }, [partialInvoice, total])

  const remainingTableBalance = useMemo(() => {
    const rem = tableTotal - amountPaidAccumulated
    return rem > 0.009 ? rem : 0
  }, [tableTotal, amountPaidAccumulated])

  // Workstation and session
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

  // Base Currency
  const baseCurrency = useMemo(() => {
    const fromConfig = currencies.find((c) => c.code === config?.default_currency)
    if (fromConfig) return fromConfig
    const isBase = currencies.find((c) => c.is_base)
    if (isBase) return isBase
    return currencies[0] || { code: 'USD', symbol: '$', name: 'Dólar' }
  }, [currencies, config])

  // Secondary Currency
  const { secondaryCurrency, exchangeRate } = useMemo(() => {
    const sec = currencies.find((c) => c.id !== baseCurrency.id && c.is_active)
    if (!sec) return { secondaryCurrency: null, exchangeRate: 1.0 }

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

  // 1. Calculations for Seat Mode
  const seatsData = useMemo(() => {
    return seats.map((seat) => {
      const items = cart.filter((item) => (item.seat || 'seat-1') === seat.id || item.seat === seat.label)
      const seatTotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0)
      const seatItemIds = items.map((i) => i.cartItemId || i.id)
      const isExplicitlyPaid = paidSeatLabels.has(seat.label) || paidSeatLabels.has(seat.id)
      const allItemsPaid = items.length > 0 && items.every((i) => paidItemIds.has(i.cartItemId || i.id))
      const isPaid = isExplicitlyPaid || allItemsPaid

      return {
        seat,
        items,
        subtotal: seatTotal,
        itemIds: seatItemIds,
        isPaid
      }
    })
  }, [seats, cart, paidSeatLabels, paidItemIds])

  // Unassigned items (pool general)
  const unassignedItems = useMemo(() => {
    return cart.filter((item) => !item.seat)
  }, [cart])

  // 2. Calculations for Equal Parts Mode
  const equalParts = useMemo(() => {
    const n = Math.max(2, equalPartsCount)
    const basePart = Math.floor((tableTotal / n) * 100) / 100
    const parts = []
    let accumulated = 0

    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1
      const amount = isLast ? Math.round((tableTotal - accumulated) * 100) / 100 : basePart
      accumulated += amount
      const isPaidByLabel = i < existingPayments.filter((p) => p.seat_label?.startsWith('Parte ') || p.seat_label === `Parte ${i + 1}`).length
      const isPaidByAmount = (accumulated - 0.01) <= amountPaidAccumulated
      const isPaid = isPaidByLabel || isPaidByAmount
      
      // Proportional items round-robin
      const coveredIds = cart
        .filter((_, idx) => idx % n === i)
        .map((it) => it.cartItemId || it.id)

      parts.push({
        partIndex: i + 1,
        label: `Parte ${i + 1}`,
        amount: Math.max(0, amount),
        isPaid,
        coveredIds
      })
    }
    return parts
  }, [tableTotal, equalPartsCount, existingPayments, amountPaidAccumulated, cart])

  // 3. Calculations for Manual / Items Mode
  const unpaidItems = useMemo(() => {
    return cart.map((item) => {
      const isPaid = paidItemIds.has(item.cartItemId || item.id)
      return {
        ...item,
        isPaid
      }
    })
  }, [cart, paidItemIds])

  const manualSelectedTotal = useMemo(() => {
    return unpaidItems
      .filter((i) => selectedItemIds.includes(i.cartItemId || i.id) && !i.isPaid)
      .reduce((acc, i) => acc + i.price * i.quantity, 0)
  }, [unpaidItems, selectedItemIds])

  if (!isOpen) return null

  // Process sub-payment flow
  const handleFinalizePartialCheckout = async (
    payments: CheckoutPayment[],
    change: CheckoutChange | null
  ) => {
    if (!payingTarget) return

    const wsId = effectiveWorkstationId
    const sessId = effectiveSessionId

    if (!wsId || !sessId) {
      setErrorMessage('No hay sesión de caja activa o estación de trabajo asignada.')
      return
    }

    setIsProcessingPartial(true)

    try {
      const itemsPayload = cart.map((item) => ({
        sale_item_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        discount_pct: 0
      }))

      // Check if this payment will settle the entire remainder
      const paymentTotalBase = payments.reduce((acc, p) => acc + p.amount * (p.exchange_rate || 1.0), 0)
      const willBeFullyPaid = (remainingTableBalance - paymentTotalBase) <= 0.01

      // Attach seat_label and covered_items to each payment item
      const enrichedPayments = payments.map((p) => ({
        ...p,
        seat_label: payingTarget.seatLabel || null,
        covered_items: payingTarget.coveredItemIds || null
      }))

      const payload = {
        workstation_id: wsId,
        pos_session_id: sessId,
        venue_id: currentCtx?.seats ? null : null,
        mode: posMode,
        table_id: activeTableId,
        table_order_id: activeTableId,
        customer_id: customerId,
        customer_name: customerName,
        customer_tax_id: customerTaxId,
        items: itemsPayload,
        payments: enrichedPayments,
        change: change,
        document_type: 'invoice',
        is_partial: !willBeFullyPaid,
        split_mode: payingTarget.splitMode,
        seat_label: payingTarget.seatLabel || null,
        covered_item_ids: payingTarget.coveredItemIds,
        idempotency_key: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random()}`
      }

      const res = await checkoutMutation.mutateAsync(payload)

      // Immediately clear paying target and selection to avoid any calculator flash
      setPayingTarget(null)
      setSelectedItemIds([])

      if (willBeFullyPaid || res.invoice.status === 'paid' || res.invoice.balance_due <= 0.01) {
        setLastInvoice(res.invoice)
      }

      await refetchInvoice()
    } catch (err: any) {
      console.error('Partial checkout error:', err)
      const detailMsg = err?.response?.data?.detail || err?.detail || err?.message || 'Error al procesar el pago parcial.'
      setErrorMessage(typeof detailMsg === 'string' ? detailMsg : JSON.stringify(detailMsg))
    } finally {
      setIsProcessingPartial(false)
    }
  }

  const handleFinishTable = () => {
    clearCart()
    clearCustomer()
    setActiveTable(null, null)
    onClose()
    if (onSuccess) onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full h-full max-w-6xl max-h-[92vh] mx-4 bg-surface border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-b border-border/80 bg-surface-raised/40 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-teal-500/10 text-teal-400 rounded-xl sm:rounded-2xl border border-teal-500/20">
              <Scissors className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg md:text-xl font-black text-text-primary tracking-tight">Dividir Cuenta</h1>
                {activeTableName && (
                  <span className="px-2 py-0.2 sm:px-2.5 sm:py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                    Mesa: {activeTableName}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-text-secondary mt-0.5">
                Selecciona la modalidad para cobrar por partes independientes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Total Balance Indicator */}
            <div className="text-right">
              <div className="text-[10px] sm:text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                Saldo Restante / Total
              </div>
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <span className={`text-base sm:text-2xl font-black font-mono tracking-tight ${remainingTableBalance <= 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {baseCurrency.symbol} {remainingTableBalance.toFixed(2)}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-text-secondary font-mono">
                  de {baseCurrency.symbol} {tableTotal.toFixed(2)}
                </span>
              </div>
              {hasSecondary && (
                <div className="hidden sm:block text-[10px] sm:text-[11px] text-text-secondary font-mono">
                  ≈ {secondaryCurrency?.symbol} {(remainingTableBalance * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>

            {!payingTarget && !lastInvoice && (
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
          <div className="mx-8 mt-4 p-4 bg-error/10 border border-error/20 rounded-2xl text-error text-sm font-medium flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs underline hover:text-text-primary cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Inner Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Loading Overlay / Screen on initial sync */}
          {isLoadingInvoice && !tableInvoiceData ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 animate-spin">
                <RefreshCw className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text-primary">
                  Sincronizando estado de la mesa...
                </h3>
                <p className="text-xs text-text-secondary max-w-sm">
                  Cargando pagos parciales y balance actualizado desde el servidor.
                </p>
              </div>
            </div>
          ) : lastInvoice ? (
            <CheckoutConfirmation
              invoice={lastInvoice}
              onNewOrder={handleFinishTable}
            />
          ) : payingTarget ? (
            isProcessingPartial || checkoutMutation.isPending ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 max-w-lg mx-auto text-center space-y-6 animate-in fade-in zoom-in-95">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20 animate-spin">
                    <Loader2 className="w-10 h-10" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-teal-500/20 blur-xl -z-10 animate-pulse" />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">
                    Procesamiento en Curso
                  </span>
                  <h2 className="text-2xl font-black text-text-primary tracking-tight">
                    Registrando Pago de {payingTarget.description}...
                  </h2>
                  <p className="text-xs text-text-secondary max-w-sm">
                    Comunicando con el servidor, actualizando balance de la comanda y registrando comprobante.
                  </p>
                </div>

                <div className="w-full p-4 bg-surface-raised border border-border rounded-2xl space-y-2.5 text-left text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Monto Procesado:</span>
                    <span className="font-mono font-bold text-text-primary">
                      {baseCurrency.symbol} {payingTarget.amount.toFixed(2)}
                    </span>
                  </div>
                  {activeTableName && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Mesa:</span>
                      <span className="font-semibold text-teal-400">{activeTableName}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* View 2: Embedded Payment Calculator for Split portion */
              <PaymentCalculator
                total={payingTarget.amount}
                paymentType="mixed"
                isProcessing={isProcessingPartial || checkoutMutation.isPending}
                onBack={() => setPayingTarget(null)}
                onComplete={(payments, change) => {
                  handleFinalizePartialCheckout(payments, change)
                }}
              />
            )
          ) : (
            /* View 3: Mode Selection and Split Views */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab Navigation Header */}
              <div className="flex items-center justify-between px-8 py-3 bg-surface-raised/20 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-surface-raised p-1.5 rounded-2xl border border-border">
                    <button
                      type="button"
                      onClick={() => setActiveTab('seats')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'seats'
                          ? 'bg-primary text-black shadow-md'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Por Asientos</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('equal')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'equal'
                          ? 'bg-primary text-black shadow-md'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <Divide className="w-4 h-4" />
                      <span>Partes Iguales</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('manual')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'manual'
                          ? 'bg-primary text-black shadow-md'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>Manual / Items</span>
                    </button>
                  </div>

                  {isFetchingInvoice && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-teal-400 bg-teal-500/10 px-3 py-1.5 rounded-xl border border-teal-500/20 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Sincronizando...</span>
                    </div>
                  )}
                </div>

                {/* Status chip */}
                <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                  <span>Pagos registrados:</span>
                  <span className="font-mono font-bold text-text-primary px-2 py-0.5 bg-surface-raised border border-border rounded-lg">
                    {existingPayments.length}
                  </span>
                </div>
              </div>

              {/* Tab Body */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {/* ─── TAB 1: POR ASIENTOS ─── */}
                {activeTab === 'seats' && (
                  <div className="space-y-6 max-w-5xl mx-auto">
                    {seatsData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center bg-surface-raised/40 border border-border/80 rounded-3xl space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center text-text-secondary">
                          <User className="w-7 h-7 opacity-40" />
                        </div>
                        <div className="space-y-1 max-w-sm">
                          <h4 className="text-sm font-bold text-text-primary">Sin asientos configurados</h4>
                          <p className="text-xs text-text-secondary">
                            Esta mesa no tiene asientos asignados. Puedes dividir el total en <strong>Partes Iguales</strong> o cobrar productos por <strong>Manual / Items</strong>.
                          </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setActiveTab('equal')}
                            className="px-4 py-2 bg-primary text-black font-bold text-xs rounded-xl shadow-sm hover:bg-primary-hover cursor-pointer"
                          >
                            Dividir en Partes Iguales
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('manual')}
                            className="px-4 py-2 bg-surface hover:bg-surface-raised border border-border text-text-primary font-bold text-xs rounded-xl cursor-pointer"
                          >
                            Selección Manual
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {seatsData.map(({ seat, items, subtotal, itemIds, isPaid }) => (
                        <div
                          key={seat.id}
                          className={`flex flex-col justify-between p-5 rounded-3xl border transition-all ${
                            isPaid
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-surface-raised/50 border-border/80 hover:border-primary/40'
                          }`}
                        >
                          <div>
                            {/* Seat Card Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-border/60">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border ${
                                  isPaid ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-primary/10 text-primary border-primary/20'
                                }`}>
                                  <User className="w-4 h-4" />
                                </div>
                                <span className="font-bold text-text-primary text-sm">{seat.label}</span>
                              </div>

                              {isPaid ? (
                                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Pagado</span>
                                </span>
                              ) : (
                                <span className="text-xs font-mono font-bold text-text-secondary">
                                  {items.length} {items.length === 1 ? 'item' : 'items'}
                                </span>
                              )}
                            </div>

                            {/* Item List */}
                            <div className="py-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                              {items.length === 0 ? (
                                <p className="text-xs text-text-secondary/60 italic py-2">Sin items asignados</p>
                              ) : (
                                items.map((item) => (
                                  <div key={item.cartItemId || item.id} className="flex items-center justify-between text-xs">
                                    <span className={`text-text-secondary truncate max-w-[170px] ${isPaid ? 'line-through opacity-70' : ''}`}>
                                      {item.quantity}x {item.name}
                                    </span>
                                    <span className="font-mono font-bold text-text-primary shrink-0 ml-2">
                                      ${(item.price * item.quantity).toFixed(2)}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Footer and Cobrar Button */}
                          <div className="pt-3 border-t border-border/60 space-y-3">
                            <div className="flex items-baseline justify-between">
                              <span className="text-xs font-bold text-text-secondary uppercase">Subtotal</span>
                              <span className="text-lg font-black font-mono text-text-primary">
                                {baseCurrency.symbol} {subtotal.toFixed(2)}
                              </span>
                            </div>

                            {!isPaid && items.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayingTarget({
                                    splitMode: 'seats',
                                    amount: subtotal,
                                    seatLabel: seat.label,
                                    coveredItemIds: itemIds,
                                    description: `Cobro de ${seat.label}`
                                  })
                                }}
                                className="w-full py-3 px-4 bg-primary text-black hover:bg-primary-hover font-black text-xs rounded-2xl transition-all shadow-md shadow-primary/10 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                              >
                                <DollarSign className="w-4 h-4" />
                                <span>Cobrar {seat.label} ({baseCurrency.symbol}{subtotal.toFixed(2)})</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                    {/* General Unassigned Pool */}
                    {unassignedItems.length > 0 && (
                      <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-3xl space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-500">
                          <AlertCircle className="w-4 h-4" />
                          <span>Items sin asiento asignado (Pool General)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {unassignedItems.map((item) => (
                            <div
                              key={item.cartItemId || item.id}
                              className="p-3 bg-surface border border-border rounded-xl flex items-center justify-between text-xs"
                            >
                              <span className="font-semibold text-text-primary">
                                {item.quantity}x {item.name}
                              </span>
                              <span className="font-mono font-bold text-primary">
                                ${(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── TAB 2: PARTES IGUALES ─── */}
                {activeTab === 'equal' && (
                  <div className="space-y-8 max-w-4xl mx-auto flex flex-col items-center">
                    {/* Stepper Card */}
                    <div className="p-6 bg-surface-raised border border-border rounded-3xl w-full flex flex-col items-center space-y-4 shadow-sm">
                      <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                        Dividir Total entre Personas
                      </span>

                      <div className="flex items-center gap-6">
                        <button
                          type="button"
                          onClick={() => setEqualPartsCount((prev) => Math.max(2, prev - 1))}
                          disabled={equalPartsCount <= 2}
                          className="w-14 h-14 rounded-2xl bg-surface hover:bg-surface-raised border border-border flex items-center justify-center text-text-primary font-bold text-xl transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-sm"
                        >
                          -
                        </button>

                        <div className="text-center min-w-[120px]">
                          <span className="text-4xl font-black font-mono text-text-primary">
                            {equalPartsCount}
                          </span>
                          <p className="text-xs font-bold text-text-secondary mt-1">Personas</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setEqualPartsCount((prev) => Math.min(20, prev + 1))}
                          disabled={equalPartsCount >= 20}
                          className="w-14 h-14 rounded-2xl bg-surface hover:bg-surface-raised border border-border flex items-center justify-center text-text-primary font-bold text-xl transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-sm"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-center pt-2">
                        <span className="text-xs text-text-secondary">Monto por persona:</span>
                        <div className="text-2xl font-black font-mono text-primary mt-0.5">
                          {baseCurrency.symbol} {(tableTotal / equalPartsCount).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Equal Parts Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
                      {equalParts.map((part) => (
                        <div
                          key={part.partIndex}
                          className={`p-5 rounded-3xl border flex flex-col justify-between space-y-4 transition-all ${
                            part.isPaid
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-surface-raised/60 border-border/80 hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-text-primary text-sm">{part.label}</span>
                            {part.isPaid && (
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                Pagado
                              </span>
                            )}
                          </div>

                          <div className="text-xl font-black font-mono text-text-primary">
                            {baseCurrency.symbol} {part.amount.toFixed(2)}
                          </div>

                          {!part.isPaid && (
                            <button
                              type="button"
                              onClick={() => {
                                setPayingTarget({
                                  splitMode: 'equal',
                                  amount: part.amount,
                                  seatLabel: part.label,
                                  coveredItemIds: part.coveredIds,
                                  description: `Cobro de ${part.label}`
                                })
                              }}
                              className="w-full py-2.5 bg-primary text-black hover:bg-primary-hover font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Cobrar {part.label}</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─── TAB 3: MANUAL / POR ITEMS ─── */}
                {activeTab === 'manual' && (
                  <div className="space-y-4 max-w-4xl mx-auto pb-24">
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-xs font-bold text-text-secondary uppercase">
                        Selecciona los productos a cobrar en este pago
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const selectableIds = unpaidItems.filter((i) => !i.isPaid).map((i) => i.cartItemId || i.id)
                          if (selectedItemIds.length === selectableIds.length) {
                            setSelectedItemIds([])
                          } else {
                            setSelectedItemIds(selectableIds)
                          }
                        }}
                        className="text-xs font-bold text-primary hover:underline cursor-pointer"
                      >
                        {selectedItemIds.length === unpaidItems.filter((i) => !i.isPaid).length
                          ? 'Deseleccionar todos'
                          : 'Seleccionar todos'}
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {unpaidItems.map((item) => {
                        const itemId = item.cartItemId || item.id
                        const isSelected = selectedItemIds.includes(itemId)

                        return (
                          <div
                            key={itemId}
                            onClick={() => {
                              if (item.isPaid) return
                              setSelectedItemIds((prev) =>
                                isSelected ? prev.filter((id) => id !== itemId) : [...prev, itemId]
                              )
                            }}
                            className={`min-h-[52px] p-4 rounded-2xl border flex items-center justify-between transition-all select-none ${
                              item.isPaid
                                ? 'bg-surface/40 border-border/40 opacity-50 cursor-not-allowed'
                                : isSelected
                                ? 'bg-primary/10 border-primary cursor-pointer shadow-md shadow-primary/5 ring-1 ring-primary/30'
                                : 'bg-surface-raised border-border/80 hover:border-border hover:bg-surface cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                                item.isPaid
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : isSelected
                                  ? 'bg-primary text-black border-primary'
                                  : 'bg-surface border-border text-text-secondary'
                              }`}>
                                {item.isPaid ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : isSelected ? (
                                  <CheckSquare className="w-4 h-4" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </div>

                              <div>
                                <h4 className={`text-sm font-bold text-text-primary ${item.isPaid ? 'line-through' : ''}`}>
                                  {item.name}
                                </h4>
                                <span className="text-xs text-text-secondary font-mono">
                                  Cantidad: {item.quantity} × ${item.price.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-sm font-black font-mono text-text-primary">
                                ${(item.price * item.quantity).toFixed(2)}
                              </span>
                              {item.isPaid && (
                                <span className="block text-[10px] font-bold text-emerald-400 uppercase">
                                  Ya pagado
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky Footer for Manual Mode */}
              {activeTab === 'manual' && (
                <div className="p-6 bg-surface-raised/90 border-t border-border backdrop-blur-md flex items-center justify-between px-8">
                  <div>
                    <span className="text-xs font-bold text-text-secondary uppercase">
                      Selección: {selectedItemIds.length} {selectedItemIds.length === 1 ? 'producto' : 'productos'}
                    </span>
                    <div className="text-2xl font-black font-mono text-primary mt-0.5">
                      {baseCurrency.symbol} {manualSelectedTotal.toFixed(2)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedItemIds.length === 0 || manualSelectedTotal <= 0) return
                      setPayingTarget({
                        splitMode: 'manual',
                        amount: manualSelectedTotal,
                        coveredItemIds: selectedItemIds,
                        description: `Cobro manual (${selectedItemIds.length} items)`
                      })
                    }}
                    disabled={selectedItemIds.length === 0 || manualSelectedTotal <= 0}
                    className="py-4 px-8 bg-primary text-black hover:bg-primary-hover font-black text-sm rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]"
                  >
                    <DollarSign className="w-5 h-5" />
                    <span>Cobrar Selección ({baseCurrency.symbol}{manualSelectedTotal.toFixed(2)})</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
