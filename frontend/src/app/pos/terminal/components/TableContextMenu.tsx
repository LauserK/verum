'use client'

import React, { useEffect, useRef } from 'react'
import {
  FileText,
  ArrowRightLeft,
  Merge,
  UserCheck,
  Receipt,
  CreditCard,
  X,
  Clock,
  User,
  Users
} from 'lucide-react'

export interface TableContextMenuProps {
  isOpen: boolean
  onClose: () => void
  table: {
    id: string
    name: string
    capacity?: number
  }
  order?: {
    id: string
    total: number
    cart: any[]
    seats?: any[]
    assigned_to?: string | null
    status?: string
    opened_at?: string | null
    customer_name?: string | null
  } | null
  position: { x: number; y: number }
  onOpenOrder: () => void
  onTransfer: () => void
  onMerge: () => void
  onChangeWaiter: () => void
  onPreBill: () => void
  onCheckout: () => void
}

export function TableContextMenu({
  isOpen,
  onClose,
  table,
  order,
  position,
  onOpenOrder,
  onTransfer,
  onMerge,
  onChangeWaiter,
  onPreBill,
  onCheckout,
}: TableContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click or escape
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Ensure menu stays inside window boundaries
  const menuWidth = 240
  const menuHeight = 320
  const clampedX = Math.min(position.x, window.innerWidth - menuWidth - 16)
  const clampedY = Math.min(position.y, window.innerHeight - menuHeight - 16)

  const hasActiveOrder = Boolean(order && Array.isArray(order.cart) && order.cart.length > 0)
  const itemCount = order?.cart ? order.cart.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0) : 0

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${Math.max(12, clampedX)}px`,
        top: `${Math.max(12, clampedY)}px`,
        zIndex: 60,
      }}
      className="w-60 bg-surface border border-border/80 rounded-2xl shadow-2xl overflow-hidden p-1.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md select-none"
    >
      {/* Header with Table name & status */}
      <div className="px-3 py-2.5 bg-surface-raised rounded-xl border border-border/60 mb-1 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-black text-xs text-text-primary">{table.name}</span>
            <span className="text-[10px] text-text-secondary">({table.capacity || 4}p)</span>
          </div>
          {hasActiveOrder ? (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono font-bold text-amber-500">
                ${Number(order?.total || 0).toFixed(2)}
              </span>
              <span className="text-[9px] text-text-secondary">
                {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
              </span>
            </div>
          ) : (
            <span className="text-[10px] font-bold text-emerald-500">Mesa Libre</span>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Menu Actions */}
      <div className="space-y-0.5 text-xs font-semibold">
        {/* 1. Ver / Abrir Comanda */}
        <button
          type="button"
          onClick={() => {
            onClose()
            onOpenOrder()
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-text-primary hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer active:scale-[0.98]"
        >
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span>{hasActiveOrder ? 'Ver Comanda' : 'Abrir Mesa'}</span>
        </button>

        {hasActiveOrder && (
          <>
            {/* 2. Transferir Mesa */}
            <button
              type="button"
              onClick={() => {
                onClose()
                onTransfer()
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-text-primary hover:bg-surface-raised transition-colors cursor-pointer active:scale-[0.98]"
            >
              <ArrowRightLeft className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Transferir Mesa</span>
            </button>

            {/* 3. Unir con otra Mesa */}
            <button
              type="button"
              onClick={() => {
                onClose()
                onMerge()
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-text-primary hover:bg-surface-raised transition-colors cursor-pointer active:scale-[0.98]"
            >
              <Merge className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Unir con otra Mesa</span>
            </button>

            {/* 4. Cambiar Mesero */}
            <button
              type="button"
              onClick={() => {
                onClose()
                onChangeWaiter()
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-text-primary hover:bg-surface-raised transition-colors cursor-pointer active:scale-[0.98]"
            >
              <UserCheck className="w-4 h-4 text-sky-500 shrink-0" />
              <span>Cambiar Mesero</span>
            </button>

            {/* Divider */}
            <div className="my-1 border-t border-border/60" />

            {/* 5. Pre-cuenta */}
            <button
              type="button"
              onClick={() => {
                onClose()
                onPreBill()
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-text-primary hover:bg-amber-500/10 hover:text-amber-500 transition-colors cursor-pointer active:scale-[0.98]"
            >
              <Receipt className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Pre-cuenta</span>
            </button>

            {/* 6. Cobrar */}
            <button
              type="button"
              onClick={() => {
                onClose()
                onCheckout()
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-text-inverse font-bold transition-all cursor-pointer active:scale-[0.98]"
            >
              <CreditCard className="w-4 h-4 shrink-0" />
              <span>Cobrar Comanda</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
