'use client'

import React, { useMemo, useState, useEffect } from 'react'
import {
  Receipt,
  Trash2,
  Plus,
  Minus,
  ChefHat,
  CreditCard,
  Utensils,
  ShoppingBag,
  Bike,
  PackageCheck,
  Wine,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  User
} from 'lucide-react'
import { usePosStore, CartItem, PosMode } from '@/store/posStore'
import { useBillingConfig, useCurrencies, useExchangeRates, useTaxes } from '@/hooks/useSales'

const MODE_BADGES: Record<PosMode, { label: string; icon: React.ElementType; color: string }> = {
  tables: { label: 'Mesa', icon: Utensils, color: 'bg-primary/10 text-primary border-primary/20' },
  takeout: { label: 'Para Llevar', icon: ShoppingBag, color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  delivery: { label: 'Delivery', icon: Bike, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  pickup: { label: 'Pick-up', icon: PackageCheck, color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  bar: { label: 'Barra', icon: Wine, color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
}

interface PosCartProps {
  onCheckout?: () => void
  onSendToKitchen?: () => void
}

export default function PosCart({ onCheckout, onSendToKitchen }: PosCartProps) {
  const {
    cart,
    total,
    posMode,
    activeTableName,
    orderNumber,
    customerId,
    customerName,
    setShowCustomerSelector,
    updateQuantity,
    removeItem,
    clearCart,
    addItem
  } = usePosStore()

  const { data: config } = useBillingConfig()
  const { data: currencies = [] } = useCurrencies()
  const { data: rates = [] } = useExchangeRates()
  const { data: taxes = [] } = useTaxes(true)

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

  // Undo toast state after clearCart
  const [deletedBackup, setDeletedBackup] = useState<CartItem[] | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'info' | 'success'>('info')

  const totalSecondary = useMemo(() => {
    const validTotal = typeof total === 'number' && !isNaN(total) ? total : 0
    if (!hasSecondary) return 0
    const v = validTotal * exchangeRate
    return isNaN(v) ? 0 : v
  }, [total, exchangeRate, hasSecondary])

  // Subtotal & Tax breakdown calculated item by item
  const { subtotal, taxAmount, weightedTaxRate } = useMemo(() => {
    if (!cart || cart.length === 0) {
      return { subtotal: 0, taxAmount: 0, weightedTaxRate: 0 }
    }

    let calculatedSubtotal = 0
    let calculatedTax = 0

    cart.forEach((item) => {
      const itemPrice = typeof item.price === 'number' ? item.price : parseFloat(item.price as any) || 0
      const itemQty = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity as any) || 0
      const lineTotal = itemPrice * itemQty

      // If product has specific tax_rate or tax_id
      let rate = 0
      if (item.tax_rate !== undefined && item.tax_rate !== null) {
        let r = Number(item.tax_rate)
        if (r > 0 && r <= 1.0) r = r * 100
        rate = r
      } else if (item.tax_id && Array.isArray(taxes)) {
        const found = taxes.find((t) => t.id === item.tax_id)
        if (found) {
          let r = typeof found.rate === 'number' ? found.rate : parseFloat(found.rate as any) || 0
          if (r > 0 && r <= 1.0) r = r * 100
          rate = r
        }
      }

      if (rate > 0) {
        const itemSub = lineTotal / (1 + rate / 100)
        calculatedSubtotal += itemSub
        calculatedTax += (lineTotal - itemSub)
      } else {
        // Exempt / 0% Tax
        calculatedSubtotal += lineTotal
      }
    })

    const effectiveRate = calculatedSubtotal > 0 ? (calculatedTax / calculatedSubtotal) * 100 : 0

    return {
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      taxAmount: Math.round(calculatedTax * 100) / 100,
      weightedTaxRate: Math.round(effectiveRate * 10) / 10,
    }
  }, [cart, taxes])

  const handleClearCart = () => {
    if (cart.length === 0) return
    setDeletedBackup([...cart])
    clearCart()
    setToastMessage('Minuta vaciada')
    setToastType('info')

    setTimeout(() => {
      setDeletedBackup(null)
      setToastMessage(null)
    }, 5000)
  }

  const handleUndoClear = () => {
    if (deletedBackup && deletedBackup.length > 0) {
      deletedBackup.forEach((item) => {
        for (let i = 0; i < item.quantity; i++) {
          addItem({
            id: item.id,
            name: item.name,
            price: item.price,
            category_id: item.category_id,
          })
        }
      })
      setDeletedBackup(null)
      setToastMessage(null)
    }
  }

  const handleSendToKitchen = () => {
    if (cart.length === 0) return
    if (onSendToKitchen) {
      onSendToKitchen()
    } else {
      setToastMessage('Comanda enviada a cocina')
      setToastType('success')
      setTimeout(() => setToastMessage(null), 3000)
    }
  }

  const handleCobrar = () => {
    if (cart.length === 0) return
    if (onCheckout) {
      onCheckout()
    }
  }

  const modeBadge = MODE_BADGES[posMode] || MODE_BADGES.tables
  const ModeIcon = modeBadge.icon
  const modeText = posMode === 'tables' && activeTableName ? `Mesa ${activeTableName}` : modeBadge.label

  return (
    <div className="flex flex-col h-full w-full bg-surface border-l border-border/80 select-none overflow-hidden relative">
      {/* 1. Header Area (~56px) */}
      <div className="h-14 shrink-0 px-4 border-b border-border/70 flex items-center justify-between bg-surface/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-text-primary">
                Orden #{orderNumber || 1}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${modeBadge.color}`}>
                <ModeIcon className="w-3 h-3" />
                {modeText}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Customer Button */}
          <button
            type="button"
            onClick={() => setShowCustomerSelector(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              customerId
                ? 'border-primary/40 text-primary bg-primary/10'
                : 'border-border text-text-secondary hover:border-primary/30 hover:text-text-primary bg-surface-raised/40'
            }`}
            title={customerId ? `Cliente: ${customerName}` : 'Asignar cliente'}
          >
            <User className="w-3.5 h-3.5" />
            <span className="truncate max-w-[110px]">
              {customerId ? customerName : 'Cliente'}
            </span>
          </button>

          {/* Clear Button */}
          {cart.length > 0 && (
            <button
              onClick={handleClearCart}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-text-secondary hover:text-error hover:bg-error/10 border border-transparent hover:border-error/20 transition-all cursor-pointer flex items-center gap-1.5"
              title="Vaciar comanda"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vaciar</span>
            </button>
          )}
        </div>
      </div>

      {/* Undo Toast Overlay */}
      {toastMessage && (
        <div className="absolute top-16 left-4 right-4 z-30 p-2.5 rounded-xl bg-surface-raised border border-border shadow-lg flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            {toastType === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-primary" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            )}
            <span className="font-medium text-text-primary">{toastMessage}</span>
          </div>
          {deletedBackup && (
            <button
              onClick={handleUndoClear}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary font-bold text-[11px] hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Deshacer
            </button>
          )}
        </div>
      )}

      {/* 2. Cart Items Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        {cart.length === 0 ? (
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-3xl bg-surface-raised border border-border flex items-center justify-center mb-3 shadow-inner">
              <Receipt className="w-8 h-8 opacity-30 text-primary" />
            </div>
            <h4 className="text-sm font-bold text-text-primary">Minuta vacía</h4>
            <p className="text-xs text-text-secondary mt-1 max-w-[220px] leading-relaxed">
              Agrega productos desde el catálogo para iniciar la comanda.
            </p>
          </div>
        ) : (
          cart.map((item) => {
            const lineTotal = item.price * item.quantity

            return (
              <div
                key={item.cartItemId}
                className="group bg-surface-raised/60 hover:bg-surface-raised border border-border/80 hover:border-border rounded-2xl p-3 transition-all duration-150 flex flex-col gap-2 shadow-sm"
              >
                {/* Item Name & Line Price */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-text-primary leading-tight line-clamp-2">
                      {item.name}
                    </h5>
                    <p className="text-[11px] font-mono text-text-secondary mt-0.5">
                      {baseCurrency.symbol}{item.price.toFixed(2)} c/u
                    </p>
                  </div>
                  <span className="text-xs font-black text-text-primary font-mono tracking-tight shrink-0">
                    {baseCurrency.symbol}{lineTotal.toFixed(2)}
                  </span>
                </div>

                {/* Notes or Modifiers if any */}
                {item.notes && (
                  <div className="text-[10px] text-amber-500/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-medium">
                    Nota: {item.notes}
                  </div>
                )}

                {/* Quantity Controls Stepper */}
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-[10px] text-text-secondary font-medium">
                    Cantidad
                  </span>

                  <div className="flex items-center gap-1.5 bg-surface border border-border rounded-xl p-0.5 shadow-inner">
                    {/* Decrement or Remove */}
                    <button
                      onClick={() => {
                        if (item.quantity === 1) {
                          removeItem(item.cartItemId)
                        } else {
                          updateQuantity(item.cartItemId, item.quantity - 1)
                        }
                      }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                        item.quantity === 1
                          ? 'text-error/70 hover:text-error hover:bg-error/10'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
                      }`}
                      title={item.quantity === 1 ? 'Eliminar de la orden' : 'Reducir cantidad'}
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="w-3.5 h-3.5" />
                      ) : (
                        <Minus className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Quantity Display */}
                    <span className="w-6 text-center text-xs font-bold font-mono text-text-primary">
                      {item.quantity}
                    </span>

                    {/* Increment */}
                    <button
                      onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-all cursor-pointer active:scale-90"
                      title="Aumentar cantidad"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 3. Footer & Totals Area */}
      <div className="shrink-0 p-4 border-t border-border/80 bg-surface-raised/80 backdrop-blur-md space-y-3">
        {/* Breakdown lines */}
        <div className="space-y-1.5 text-xs text-text-secondary font-medium pb-2 border-b border-border/60">
          <div className="flex justify-between items-center">
            <span>Subtotal</span>
            <span className="font-mono text-text-primary font-bold">
              {baseCurrency.symbol} {(Number(subtotal) || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span>
              {weightedTaxRate > 0 ? `IVA (${weightedTaxRate}%)` : 'IVA (Exento / 0%)'}
            </span>
            <span className="font-mono text-text-primary font-bold">
              {baseCurrency.symbol} {(Number(taxAmount) || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Dual-Currency TOTAL Display */}
        <div className="flex items-end justify-between pt-0.5">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-text-secondary">
              Total a Pagar
            </span>
            <div className="text-2xl font-black text-primary font-mono tracking-tight leading-none mt-1">
              {baseCurrency.symbol} {(Number(total) || 0).toFixed(2)}
            </div>
          </div>
          {hasSecondary && (
            <div className="text-right">
              <span className="text-[10px] text-text-secondary/70 font-mono">
                Tasa: {(Number(exchangeRate) || 1).toFixed(2)} {secondaryCurrency?.code}/{baseCurrency.code}
              </span>
              <div className="text-sm font-bold text-text-secondary font-mono tracking-tight">
                {secondaryCurrency?.symbol} {(Number(totalSecondary) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {secondaryCurrency?.code}
              </div>
            </div>
          )}
        </div>

        {/* 4. Action Buttons (Grid 2-columns) */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {/* Enviar a Cocina */}
          <button
            disabled={cart.length === 0}
            onClick={handleSendToKitchen}
            className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs font-bold border transition-all duration-150 select-none ${
              cart.length === 0
                ? 'opacity-40 border-border text-text-secondary cursor-not-allowed bg-surface'
                : 'border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/50 active:scale-[0.98] cursor-pointer shadow-sm'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span className="truncate">A Cocina</span>
          </button>

          {/* Cobrar */}
          <button
            disabled={cart.length === 0}
            onClick={handleCobrar}
            className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs font-black transition-all duration-150 select-none ${
              cart.length === 0
                ? 'opacity-40 bg-surface-raised text-text-secondary border border-border cursor-not-allowed'
                : 'bg-primary text-text-inverse shadow-lg shadow-primary/25 hover:brightness-110 active:scale-[0.98] cursor-pointer'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Cobrar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
