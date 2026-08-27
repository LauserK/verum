'use client'

import React, { useEffect } from 'react'
import {
  FileText,
  Printer,
  X,
  Clock,
  User,
  Users,
  UtensilsCrossed,
  CheckCircle2
} from 'lucide-react'
import { useCurrencies, useLatestExchangeRates, useTaxes, useUpdateTableOrder } from '@/hooks/useSales'
import { Seat } from '@/store/posStore'

export interface PreBillPreviewProps {
  isOpen: boolean
  onClose: () => void
  tableId?: string | null
  tableName?: string | null
  customerName?: string | null
  customerTaxId?: string | null
  cartItems: any[]
  seats?: Seat[]
  openedAt?: string | null
  waiterName?: string | null
  orderNumber?: number | null
  total: number
}

export function PreBillPreview({
  isOpen,
  onClose,
  tableId,
  tableName,
  customerName,
  customerTaxId,
  cartItems = [],
  seats = [],
  openedAt,
  waiterName,
  orderNumber,
  total,
}: PreBillPreviewProps) {
  const { data: currencies = [] } = useCurrencies()
  const { data: rates = [] } = useLatestExchangeRates()
  const { data: taxes = [] } = useTaxes(true)
  const updateOrderMutation = useUpdateTableOrder()

  const baseCurrency = currencies.find((c) => c.is_base) || { code: 'USD', symbol: '$' }
  const secondaryCurrency = currencies.find((c) => !c.is_base && c.is_active)
  const directRate = rates.find(
    (r) =>
      (r.from_currency === baseCurrency.code && r.to_currency === secondaryCurrency?.code) ||
      (r.to_currency === secondaryCurrency?.code)
  )
  const exchangeRate = directRate?.rate ? Number(directRate.rate) : 1.0
  const hasSecondary = Boolean(secondaryCurrency && exchangeRate > 0)
  const totalSecondary = total * exchangeRate

  // Automatically mark order as 'pre_bill' when opening preview for a table order
  useEffect(() => {
    if (isOpen && tableId && !tableId.startsWith('direct:')) {
      updateOrderMutation.mutate({
        tableId,
        data: {
          status: 'pre_bill',
          pre_bill_requested_at: new Date().toISOString(),
        }
      })
    }
  }, [isOpen, tableId])

  if (!isOpen) return null

  // Calculate tax and subtotal
  let calculatedSubtotal = 0
  let calculatedTax = 0

  cartItems.forEach((item) => {
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

  // Group items by seats
  const groupedSeats: { seat: Seat; items: any[]; subtotal: number }[] = seats.map((seat) => {
    const items = cartItems.filter((i) => String(i.seat) === String(seat.id))
    const seatTotal = items.reduce((acc, i) => acc + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
    return { seat, items, subtotal: seatTotal }
  })

  const unassignedItems = cartItems.filter((i) => !i.seat || !seats.some((s) => String(s.id) === String(i.seat)))
  if (unassignedItems.length > 0) {
    const unassignedTotal = unassignedItems.reduce((acc, i) => acc + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
    groupedSeats.push({
      seat: { id: 'unassigned', label: 'Sin Asiento' },
      items: unassignedItems,
      subtotal: unassignedTotal,
    })
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Thermal Print Specific Stylesheet Injection */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #prebill-thermal-ticket,
          #prebill-thermal-ticket * {
            visibility: visible !important;
          }
          #prebill-thermal-ticket {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
            color: #000 !important;
            font-family: monospace !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="shrink-0 p-4 bg-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">Vista Previa de Pre-cuenta</h3>
              <p className="text-[11px] text-text-secondary">
                {tableName || 'Comanda'} • Formato Térmico 80mm
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-border hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal 80mm Receipt Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-900/40 flex items-center justify-center">
          <div
            id="prebill-thermal-ticket"
            className="w-full max-w-[340px] bg-white text-black p-5 rounded-2xl shadow-xl font-mono text-xs select-text relative overflow-hidden"
          >
            {/* Watermark: DOCUMENTO NO FISCAL */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06] select-none rotate-[-35deg]">
              <span className="text-3xl font-black uppercase text-black tracking-widest text-center leading-tight">
                DOCUMENTO<br />NO FISCAL<br />PRE-CUENTA
              </span>
            </div>

            {/* Receipt Header */}
            <div className="text-center pb-3 border-b-2 border-dashed border-neutral-300">
              <h2 className="text-base font-black tracking-tight text-neutral-900">VERUM RESTAURANT</h2>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">
                *** PRE-CUENTA DE CONSUMO ***
              </p>
              <div className="mt-1.5 inline-block px-2 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-[9px] font-bold text-neutral-700 uppercase">
                NO VÁLIDO COMO FACTURA FISCAL
              </div>
            </div>

            {/* Metadata Rows */}
            <div className="py-2.5 border-b border-dashed border-neutral-300 space-y-1 text-[11px] text-neutral-700">
              <div className="flex justify-between">
                <span>MESA / UBICACIÓN:</span>
                <span className="font-bold text-black">{tableName || 'Mesa'}</span>
              </div>
              {orderNumber && (
                <div className="flex justify-between">
                  <span>ORDEN #:</span>
                  <span className="font-bold text-black">{orderNumber}</span>
                </div>
              )}
              {customerName && (
                <div className="flex justify-between">
                  <span>CLIENTE:</span>
                  <span className="font-bold text-black">{customerName}</span>
                </div>
              )}
              {customerTaxId && (
                <div className="flex justify-between">
                  <span>RIF / C.I.:</span>
                  <span className="font-bold text-black">{customerTaxId}</span>
                </div>
              )}
              {waiterName && (
                <div className="flex justify-between">
                  <span>MESERO:</span>
                  <span className="font-bold text-black">{waiterName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>FECHA / HORA:</span>
                <span>{new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            </div>

            {/* Items Breakdown (by Seat) */}
            <div className="py-3 border-b-2 border-dashed border-neutral-300 space-y-3">
              {groupedSeats.map((group) => {
                if (group.items.length === 0) return null

                return (
                  <div key={group.seat.id} className="space-y-1">
                    {seats.length > 1 && (
                      <div className="flex justify-between items-center text-[10px] font-bold text-neutral-800 bg-neutral-100 px-1.5 py-0.5 rounded">
                        <span>--- {group.seat.label.toUpperCase()} ---</span>
                        <span>${group.subtotal.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="space-y-1 pt-0.5">
                      {group.items.map((item: any, idx: number) => {
                        const itemQty = Number(item.quantity) || 1
                        const itemPrice = Number(item.price) || 0
                        const lineTotal = itemPrice * itemQty

                        return (
                          <div key={idx} className="flex justify-between text-[11px] leading-tight">
                            <span className="text-neutral-800">
                              {itemQty}x {item.name}
                            </span>
                            <span className="font-bold text-black">
                              ${lineTotal.toFixed(2)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Subtotal & Taxes */}
            <div className="py-2.5 border-b border-dashed border-neutral-300 space-y-1 text-[11px] text-neutral-700">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span className="font-bold text-black">${calculatedSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA / IMPUESTOS:</span>
                <span className="font-bold text-black">${calculatedTax.toFixed(2)}</span>
              </div>
            </div>

            {/* Total Section (Dual Currency) */}
            <div className="pt-3 text-center space-y-1.5">
              <div className="flex justify-between items-baseline text-sm font-black text-black">
                <span>TOTAL A PAGAR:</span>
                <span className="text-base font-black">
                  {baseCurrency.symbol} {total.toFixed(2)}
                </span>
              </div>

              {hasSecondary && (
                <div className="p-2 bg-neutral-100 rounded-xl text-center space-y-0.5">
                  <span className="text-[10px] text-neutral-600 block">
                    TOTAL EN {secondaryCurrency?.code}:
                  </span>
                  <div className="text-sm font-bold text-neutral-900 font-mono">
                    {secondaryCurrency?.symbol} {totalSecondary.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {secondaryCurrency?.code}
                  </div>
                  <span className="text-[9px] text-neutral-500 block">
                    (Tasa oficial: {exchangeRate.toFixed(2)} {secondaryCurrency?.code}/{baseCurrency.code})
                  </span>
                </div>
              )}

              <p className="text-[10px] text-neutral-500 uppercase tracking-widest pt-2">
                ¡Gracias por su visita!
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 p-4 bg-surface border-t border-border flex items-center justify-between gap-3">
          <div className="text-xs text-text-secondary">
            Estado de mesa: <span className="font-bold text-amber-500">Cuenta Pedida (pre_bill)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border hover:bg-surface-raised font-bold text-xs text-text-secondary hover:text-text-primary cursor-pointer transition-all"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black bg-primary text-text-inverse shadow-md shadow-primary/25 hover:brightness-110 active:scale-[0.98] cursor-pointer transition-all min-h-[44px]"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Pre-cuenta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
