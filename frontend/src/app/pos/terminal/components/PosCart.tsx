'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
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
  User,
  Users,
  Check,
  Edit2,
  X,
  ArrowRightLeft,
  FileText,
  Lock
} from 'lucide-react'
import { usePosStore, CartItem, PosMode, Seat } from '@/store/posStore'
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
  onPreBill?: () => void
}

export default function PosCart({ onCheckout, onSendToKitchen, onPreBill }: PosCartProps) {
  const {
    cart,
    total,
    posMode,
    activeTableId,
    activeTableName,
    orderNumber,
    customerId,
    customerName,
    setShowCustomerSelector,
    updateQuantity,
    removeItem,
    clearCart,
    addItem,
    cartsByContext,
    activeSeatId,
    setActiveSeat,
    addSeat,
    removeSeat,
    renameSeat,
    moveItemToSeat
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

  // 3. Resolve Seats for the current table context
  const currentKey = posMode === 'tables' && activeTableId ? `table:${activeTableId}` : 'tables:map'
  const tableContext = cartsByContext[currentKey]
  const seats: Seat[] = useMemo(() => {
    if (posMode !== 'tables') return []
    return tableContext?.seats && tableContext.seats.length > 0
      ? tableContext.seats
      : []
  }, [posMode, tableContext])

  // Inline editing state for seats
  const [editingSeatId, setEditingSeatId] = useState<string | null>(null)
  const [editingSeatLabel, setEditingSeatLabel] = useState<string>('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingSeatId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingSeatId])

  // Move item seat picker popover state
  const [movingItem, setMovingItem] = useState<CartItem | null>(null)
  const [seatDeleteConfirm, setSeatDeleteConfirm] = useState<{ seatId: string; label: string; count: number } | null>(null)

  // Undo toast state after clearCart or other actions
  const [deletedBackup, setDeletedBackup] = useState<CartItem[] | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'info' | 'success' | 'warning'>('info')

  const showToast = (msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToastMessage(msg)
    setToastType(type)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

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

  // Filtered items based on active seat selection
  const displayedItems = useMemo(() => {
    if (posMode !== 'tables' || !activeSeatId || activeSeatId === 'all') {
      return cart
    }
    return cart.filter((item) => item.seat === activeSeatId)
  }, [cart, posMode, activeSeatId])

  // Grouped items by seat for the "Todos" view
  const groupedSeats = useMemo(() => {
    if (posMode !== 'tables') return []

    // Map existing seats
    const groups: { seat: Seat; items: CartItem[]; subtotal: number }[] = seats.map((seat) => {
      const items = cart.filter((i) => i.seat === seat.id)
      const seatTotal = items.reduce((acc, i) => acc + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
      return { seat, items, subtotal: seatTotal }
    })

    // Items with no seat or unknown seat
    const unassignedItems = cart.filter((i) => !i.seat || !seats.some((s) => s.id === i.seat))
    if (unassignedItems.length > 0) {
      const unassignedTotal = unassignedItems.reduce((acc, i) => acc + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
      groups.push({
        seat: { id: 'unassigned', label: 'Sin Asiento' },
        items: unassignedItems,
        subtotal: unassignedTotal
      })
    }

    return groups
  }, [cart, seats, posMode])

  const handleClearCart = () => {
    if (cart.length === 0) return
    setDeletedBackup([...cart])
    clearCart()
    showToast('Comanda vaciada', 'info')
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
            tax_id: item.tax_id,
            tax_rate: item.tax_rate,
            tax_included: item.tax_included,
            seat: item.seat,
            sentToKitchen: item.sentToKitchen
          })
        }
      })
      setDeletedBackup(null)
      setToastMessage(null)
    }
  }

  const handleSendToKitchen = () => {
    if (cart.length === 0) return

    // Mark non-sent items as sentToKitchen in the current cart state
    const currentTableContextKey = getContextKey(posMode, activeTableId)
    usePosStore.setState((state) => {
      const updatedCart = state.cart.map((i) => ({ ...i, sentToKitchen: true }))
      const updatedCarts = { ...state.cartsByContext }
      if (currentTableContextKey !== 'tables:map') {
        const ctx = updatedCarts[currentTableContextKey] || {
          cart: state.cart,
          total: state.total,
          seats: state.cartsByContext[currentTableContextKey]?.seats
        }
        updatedCarts[currentTableContextKey] = {
          ...ctx,
          cart: updatedCart
        }
      }
      return {
        cart: updatedCart,
        cartsByContext: updatedCarts
      }
    })

    if (onSendToKitchen) {
      onSendToKitchen()
    }
    showToast('Comanda enviada a cocina', 'success')
  }

  const handleCobrar = () => {
    if (cart.length === 0) return
    if (onCheckout) {
      onCheckout()
    }
  }

  const handlePreBillClick = () => {
    if (cart.length === 0) return
    if (onPreBill) {
      onPreBill()
    } else {
      showToast('Pre-cuenta solicitada', 'info')
    }
  }

  // Seat management handlers
  const handleAddSeat = () => {
    addSeat()
    showToast('Nuevo asiento agregado', 'info')
  }

  const handleStartRename = (seat: Seat, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSeatId(seat.id)
    setEditingSeatLabel(seat.label)
  }

  const handleSaveRename = (seatId: string) => {
    if (editingSeatLabel.trim()) {
      renameSeat(seatId, editingSeatLabel.trim())
    }
    setEditingSeatId(null)
  }

  const handleDeleteSeatClick = (seat: Seat, e: React.MouseEvent) => {
    e.stopPropagation()
    const itemsInSeat = cart.filter((i) => i.seat === seat.id)
    if (seats.length <= 1) {
      showToast('Debe haber al menos un asiento', 'warning')
      return
    }
    if (itemsInSeat.length > 0) {
      setSeatDeleteConfirm({
        seatId: seat.id,
        label: seat.label,
        count: itemsInSeat.length
      })
    } else {
      removeSeat(seat.id)
      showToast(`${seat.label} eliminado`, 'info')
    }
  }

  const handleConfirmDeleteSeat = () => {
    if (seatDeleteConfirm) {
      removeSeat(seatDeleteConfirm.seatId)
      showToast(`${seatDeleteConfirm.label} eliminado (items reasignados)`, 'info')
      setSeatDeleteConfirm(null)
    }
  }

  const modeBadge = MODE_BADGES[posMode] || MODE_BADGES.tables
  const ModeIcon = modeBadge.icon
  const modeText = posMode === 'tables' && activeTableName ? `Mesa ${activeTableName}` : modeBadge.label

  // Helper function to render a single cart item card
  const renderItemCard = (item: CartItem) => {
    const lineTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0)
    const isSent = item.sentToKitchen === true
    const assignedSeat = seats.find((s) => s.id === item.seat)

    return (
      <div
        key={item.cartItemId}
        className={`group relative rounded-2xl p-3 transition-all duration-150 flex flex-col gap-2 shadow-sm border ${
          isSent
            ? 'bg-surface-raised/40 border-border/50 opacity-90'
            : 'bg-surface-raised/80 hover:bg-surface-raised border-border/80 hover:border-border'
        }`}
      >
        {/* Item Header: Name, Sent Badge, Seat badge (in all view), Line Price */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Sent to kitchen indicator badge */}
              {isSent && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20"
                  title="Enviado a cocina (bloqueado para edición directa)"
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  Enviado
                </span>
              )}

              {/* Seat Badge (in 'all' view or when multiple seats exist) */}
              {posMode === 'tables' && seats.length > 1 && (
                <button
                  type="button"
                  onClick={() => setMovingItem(item)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface border border-border text-text-secondary hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                  title="Mover item a otro asiento"
                >
                  <ArrowRightLeft className="w-2.5 h-2.5" />
                  <span>{assignedSeat ? assignedSeat.label : 'Sin Asiento'}</span>
                </button>
              )}
            </div>

            <h5 className="text-xs font-bold text-text-primary leading-tight line-clamp-2 mt-1">
              {item.name}
            </h5>
            <p className="text-[11px] font-mono text-text-secondary mt-0.5">
              {baseCurrency.symbol}{(Number(item.price) || 0).toFixed(2)} c/u
            </p>
          </div>

          <span className="text-xs font-black text-text-primary font-mono tracking-tight shrink-0">
            {baseCurrency.symbol}{lineTotal.toFixed(2)}
          </span>
        </div>

        {/* Notes or Modifiers if any */}
        {item.notes && (
          <div className="text-[10px] text-amber-500/90 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-medium">
            Nota: {item.notes}
          </div>
        )}

        {/* Quantity Controls Stepper */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-secondary font-medium">
              Cantidad
            </span>
            {isSent && (
              <span title="Item enviado a cocina">
                <Lock className="w-3 h-3 text-text-secondary/60" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-0.5 shadow-inner">
            {/* Decrement or Remove (Disabled if sent to kitchen) */}
            <button
              disabled={isSent}
              onClick={() => {
                if (isSent) return
                if (item.quantity === 1) {
                  removeItem(item.cartItemId)
                } else {
                  updateQuantity(item.cartItemId, item.quantity - 1)
                }
              }}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all min-w-[28px] min-h-[28px] ${
                isSent
                  ? 'opacity-30 cursor-not-allowed text-text-secondary'
                  : item.quantity === 1
                  ? 'text-error/70 hover:text-error hover:bg-error/10 cursor-pointer active:scale-90'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised cursor-pointer active:scale-90'
              }`}
              title={isSent ? 'Item ya enviado a cocina' : item.quantity === 1 ? 'Eliminar de la orden' : 'Reducir cantidad'}
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

            {/* Increment (Always permitted, adds more units) */}
            <button
              onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-all cursor-pointer active:scale-90 min-w-[28px] min-h-[28px]"
              title="Aumentar cantidad"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

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
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer min-h-[36px] ${
              customerId
                ? 'border-primary/40 text-primary bg-primary/10'
                : 'border-border text-text-secondary hover:border-primary/30 hover:text-text-primary bg-surface-raised/40'
            }`}
            title={customerId ? `Cliente: ${customerName}` : 'Asignar cliente'}
          >
            <User className="w-3.5 h-3.5" />
            <span className="truncate max-w-[100px]">
              {customerId ? customerName : 'Cliente'}
            </span>
          </button>

          {/* Add Seat Button when in tables mode and no seats exist yet */}
          {posMode === 'tables' && seats.length === 0 && (
            <button
              type="button"
              onClick={handleAddSeat}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 border border-primary/20 hover:border-primary/40 transition-all cursor-pointer min-h-[36px]"
              title="Dividir comanda por asientos"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Asiento</span>
            </button>
          )}

          {/* Clear Button */}
          {cart.length > 0 && (
            <button
              onClick={handleClearCart}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-text-secondary hover:text-error hover:bg-error/10 border border-transparent hover:border-error/20 transition-all cursor-pointer flex items-center gap-1.5 min-h-[36px]"
              title="Vaciar comanda"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vaciar</span>
            </button>
          )}
        </div>
      </div>

      {/* Seat Tabs (Visible only in 'tables' mode when seats exist) */}
      {posMode === 'tables' && seats.length > 0 && (
        <div className="shrink-0 bg-surface-raised/40 border-b border-border/70 px-3 py-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
            {/* "Todos" Tab */}
            <button
              type="button"
              onClick={() => setActiveSeat('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 shrink-0 cursor-pointer min-h-[36px] ${
                activeSeatId === 'all'
                  ? 'bg-primary text-text-inverse shadow-sm'
                  : 'bg-surface hover:bg-surface-raised text-text-secondary hover:text-text-primary border border-border/80'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Todos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                activeSeatId === 'all' ? 'bg-black/20 text-white' : 'bg-surface-raised text-text-secondary'
              }`}>
                {cart.length}
              </span>
            </button>

            {/* Individual Seat Tabs */}
            {seats.map((seat) => {
              const isActive = activeSeatId === seat.id
              const isEditing = editingSeatId === seat.id
              const seatItemsCount = cart.filter((i) => i.seat === seat.id).length

              if (isEditing) {
                return (
                  <div
                    key={seat.id}
                    className="flex items-center gap-1 bg-surface border border-primary px-2 py-1 rounded-xl shrink-0 shadow-sm"
                  >
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingSeatLabel}
                      onChange={(e) => setEditingSeatLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(seat.id)
                        if (e.key === 'Escape') setEditingSeatId(null)
                      }}
                      className="bg-transparent text-xs font-bold text-text-primary w-24 outline-none px-1"
                      placeholder="Nombre..."
                      maxLength={25}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRename(seat.id)}
                      className="p-1 text-primary hover:bg-primary/10 rounded cursor-pointer"
                      title="Guardar nombre"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSeatId(null)}
                      className="p-1 text-text-secondary hover:bg-surface-raised rounded cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              }

              return (
                <div
                  key={seat.id}
                  onClick={() => setActiveSeat(seat.id)}
                  onDoubleClick={(e) => handleStartRename(seat, e)}
                  className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 shrink-0 cursor-pointer min-h-[36px] border ${
                    isActive
                      ? 'bg-primary text-text-inverse border-primary shadow-sm'
                      : 'bg-surface hover:bg-surface-raised text-text-secondary hover:text-text-primary border-border/80'
                  }`}
                  title={`${seat.label} (Doble clic para editar)`}
                >
                  <span className="truncate max-w-[90px]">{seat.label}</span>

                  {/* Seat item count */}
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                    isActive ? 'bg-black/20 text-white' : 'bg-surface-raised text-text-secondary'
                  }`}>
                    {seatItemsCount}
                  </span>

                  {/* Quick Edit & Delete icons on hover / active */}
                  <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5">
                    <button
                      type="button"
                      onClick={(e) => handleStartRename(seat, e)}
                      className={`p-0.5 rounded hover:bg-black/10 cursor-pointer ${
                        isActive ? 'text-text-inverse' : 'text-text-secondary hover:text-text-primary'
                      }`}
                      title="Renombrar asiento"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>
                    {seats.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSeatClick(seat, e)}
                        className={`p-0.5 rounded hover:bg-error/20 cursor-pointer ${
                          isActive ? 'text-text-inverse hover:text-error' : 'text-text-secondary hover:text-error'
                        }`}
                        title="Eliminar asiento"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Add Seat Button */}
            <button
              type="button"
              onClick={handleAddSeat}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-surface hover:bg-primary/10 text-primary border border-border/80 hover:border-primary/30 transition-all shrink-0 cursor-pointer shadow-sm active:scale-95"
              title="Agregar nuevo asiento (+)"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Undo / Info Toast Overlay */}
      {toastMessage && (
        <div className="absolute top-16 left-4 right-4 z-30 p-3 rounded-xl bg-surface-raised border border-border shadow-xl flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            {toastType === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            ) : toastType === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
            )}
            <span className="font-semibold text-text-primary">{toastMessage}</span>
          </div>
          {deletedBackup && (
            <button
              onClick={handleUndoClear}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Deshacer
            </button>
          )}
        </div>
      )}

      {/* 2. Cart Items Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
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
        ) : posMode === 'tables' && seats.length > 0 && activeSeatId === 'all' ? (
          /* "Todos" View: Grouped by Seats with Separators & Subtotals */
          groupedSeats.map((group) => {
            if (group.items.length === 0) return null

            return (
              <div key={group.seat.id} className="space-y-2">
                {/* Seat Header / Separator */}
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-surface-raised/50 border border-border/40 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-text-primary">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span>{group.seat.label}</span>
                    <span className="text-[11px] font-normal text-text-secondary font-mono">
                      ({group.items.length} items)
                    </span>
                  </div>
                  <div className="font-mono font-bold text-xs text-primary">
                    {baseCurrency.symbol}{group.subtotal.toFixed(2)}
                  </div>
                </div>

                {/* Items in this seat */}
                <div className="space-y-2">
                  {group.items.map((item) => renderItemCard(item))}
                </div>
              </div>
            )
          })
        ) : (
          /* Filtered View (Single Seat or Direct Counter Mode) */
          displayedItems.length === 0 ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6">
              <p className="text-xs text-text-secondary">
                No hay productos en este asiento. Agrega items del catálogo.
              </p>
            </div>
          ) : (
            displayedItems.map((item) => renderItemCard(item))
          )
        )}
      </div>

      {/* Popover / Dialog: Move Item to Seat */}
      {movingItem && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-border rounded-2xl p-4 w-full max-w-xs shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h4 className="text-xs font-black text-text-primary">Mover a otro asiento</h4>
              <button
                onClick={() => setMovingItem(null)}
                className="p-1 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-text-secondary truncate">
              {movingItem.name}
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {seats.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    moveItemToSeat(movingItem.cartItemId, s.id)
                    setMovingItem(null)
                    showToast(`Item movido a ${s.label}`, 'info')
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    movingItem.seat === s.id
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-surface border-border text-text-primary hover:border-primary/40'
                  }`}
                >
                  <span>{s.label}</span>
                  {movingItem.seat === s.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Seat Confirmation Prompt */}
      {seatDeleteConfirm && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-border rounded-2xl p-4 w-full max-w-xs shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>¿Eliminar {seatDeleteConfirm.label}?</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Este asiento contiene <strong>{seatDeleteConfirm.count} item(s)</strong>. Si lo eliminas, los items se reasignarán automáticamente al primer asiento.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setSeatDeleteConfirm(null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-surface border border-border text-text-secondary hover:text-text-primary cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteSeat}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-error text-text-inverse hover:brightness-110 cursor-pointer shadow-sm"
              >
                Reasignar y Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* 4. Action Buttons (Pre-cuenta, A Cocina, Cobrar) */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {/* Pre-cuenta Button */}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={handlePreBillClick}
            className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs font-bold border transition-all duration-150 select-none min-h-[48px] ${
              cart.length === 0
                ? 'opacity-40 border-border text-text-secondary cursor-not-allowed bg-surface'
                : 'border-border hover:border-primary/40 text-text-primary bg-surface hover:bg-surface-raised active:scale-[0.98] cursor-pointer shadow-sm'
            }`}
            title="Generar e imprimir pre-cuenta"
          >
            <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">Pre-cuenta</span>
          </button>

          {/* Enviar a Cocina */}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={handleSendToKitchen}
            className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs font-bold border transition-all duration-150 select-none min-h-[48px] ${
              cart.length === 0
                ? 'opacity-40 border-border text-text-secondary cursor-not-allowed bg-surface'
                : 'border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/50 active:scale-[0.98] cursor-pointer shadow-sm'
            }`}
            title="Enviar comanda a cocina"
          >
            <ChefHat className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">A Cocina</span>
          </button>

          {/* Cobrar */}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={handleCobrar}
            className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs font-black transition-all duration-150 select-none min-h-[48px] ${
              cart.length === 0
                ? 'opacity-40 bg-surface-raised text-text-secondary border border-border cursor-not-allowed'
                : 'bg-primary text-text-inverse shadow-lg shadow-primary/25 hover:brightness-110 active:scale-[0.98] cursor-pointer'
            }`}
            title="Proceder al cobro de la comanda"
          >
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            <span>Cobrar</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper context key generator
function getContextKey(posMode: PosMode, activeTableId?: string | null): string {
  if (posMode === 'tables') {
    return activeTableId ? `table:${activeTableId}` : 'tables:map'
  }
  return 'direct:counter'
}
