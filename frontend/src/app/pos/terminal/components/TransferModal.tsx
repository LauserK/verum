'use client'

import React, { useState, useMemo } from 'react'
import {
  ArrowRightLeft,
  X,
  AlertCircle,
  CheckCircle2,
  Utensils,
  Layers,
  ArrowRight,
  User
} from 'lucide-react'
import { TableItem, TableOrder } from '@/lib/api/sales'
import { useTransferTableOrder } from '@/hooks/useSales'

export interface TransferModalProps {
  isOpen: boolean
  onClose: () => void
  sourceTable: {
    id: string
    name: string
  }
  sourceOrder: TableOrder
  availableTables: TableItem[]
  onSuccess?: () => void
}

export function TransferModal({
  isOpen,
  onClose,
  sourceTable,
  sourceOrder,
  availableTables,
  onSuccess
}: TransferModalProps) {
  const transferMutation = useTransferTableOrder()

  const [transferType, setTransferType] = useState<'full' | 'seat' | 'items'>('full')
  const [selectedTargetTableId, setSelectedTargetTableId] = useState<string>('')
  const [selectedSeatId, setSelectedSeatId] = useState<string>('')
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Candidate destination tables (exclude source table)
  const candidateTables = useMemo(() => {
    return availableTables.filter((t) => t.id !== sourceTable.id && t.is_active)
  }, [availableTables, sourceTable.id])

  const targetTable = candidateTables.find((t) => t.id === selectedTargetTableId)

  // Seats in source order
  const seats = useMemo(() => {
    if (Array.isArray(sourceOrder.seats) && sourceOrder.seats.length > 0) {
      return sourceOrder.seats
    }
    return [{ id: 'seat-1', label: 'Asiento 1' }]
  }, [sourceOrder.seats])

  const cartItems = sourceOrder.cart || []

  // Items to move based on type
  const itemsToMove = useMemo(() => {
    if (transferType === 'full') return cartItems
    if (transferType === 'seat') {
      return cartItems.filter((i: any) => String(i.seat) === selectedSeatId)
    }
    return cartItems.filter((i: any) => selectedItemIds.includes(String(i.cartItemId || i.id)))
  }, [transferType, cartItems, selectedSeatId, selectedItemIds])

  const transferTotal = itemsToMove.reduce(
    (s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1),
    0
  )

  if (!isOpen) return null

  const handleToggleItem = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    )
  }

  const handleSubmit = async () => {
    if (!selectedTargetTableId) {
      setErrorMsg('Debes seleccionar una mesa de destino')
      return
    }

    if (transferType === 'seat' && !selectedSeatId) {
      setErrorMsg('Debes seleccionar el asiento a transferir')
      return
    }

    if (transferType === 'items' && selectedItemIds.length === 0) {
      setErrorMsg('Debes seleccionar al menos un ítem para transferir')
      return
    }

    setErrorMsg(null)

    try {
      await transferMutation.mutateAsync({
        source_table_id: sourceTable.id,
        target_table_id: selectedTargetTableId,
        transfer_type: transferType,
        seat_id: transferType === 'seat' ? selectedSeatId : null,
        item_ids: transferType === 'items' ? selectedItemIds : [],
      })

      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al realizar la transferencia de mesa')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg flex flex-col bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="shrink-0 p-5 bg-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Transferir Mesa</h3>
              <p className="text-xs text-text-secondary">
                Mover comanda completa, asiento o ítems específicos desde <strong>{sourceTable.name}</strong>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Modal Transfer Mode Selector */}
          <div>
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1.5">
              Tipo de Transferencia
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'full', label: 'Mesa Completa', desc: 'Todo el pedido' },
                { id: 'seat', label: 'Por Asiento', desc: 'Un comensal' },
                { id: 'items', label: 'Por Ítems', desc: 'Selección manual' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTransferType(m.id as any)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    transferType === m.id
                      ? 'bg-amber-500/10 border-amber-500/60 text-amber-500 ring-2 ring-amber-500/20'
                      : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary hover:bg-surface'
                  }`}
                >
                  <span className="text-xs font-bold text-text-primary">{m.label}</span>
                  <span className="text-[10px] opacity-70 mt-0.5">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Seat Picker (if transferType === 'seat') */}
          {transferType === 'seat' && (
            <div className="p-3.5 rounded-2xl bg-surface-raised border border-border space-y-2">
              <label className="text-xs font-bold text-text-primary block">
                Selecciona el Asiento a Mover:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {seats.map((seat: any) => {
                  const seatItems = cartItems.filter((i: any) => String(i.seat) === String(seat.id))
                  const seatTotal = seatItems.reduce(
                    (s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1),
                    0
                  )
                  const isSelected = selectedSeatId === seat.id

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => setSelectedSeatId(seat.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-amber-500 font-bold shadow-xs'
                          : 'bg-surface border-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-text-primary">{seat.label}</div>
                        <div className="text-[10px] text-text-secondary">{seatItems.length} ítems</div>
                      </div>
                      <div className="text-xs font-mono font-bold text-amber-500">
                        ${seatTotal.toFixed(2)}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Items Checklist (if transferType === 'items') */}
          {transferType === 'items' && (
            <div className="p-3.5 rounded-2xl bg-surface-raised border border-border space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-primary">
                  Selecciona los productos a mover:
                </label>
                <span className="text-[10px] text-text-secondary">
                  {selectedItemIds.length} seleccionados
                </span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {cartItems.map((item: any, idx: number) => {
                  const itemId = String(item.cartItemId || item.id || idx)
                  const isChecked = selectedItemIds.includes(itemId)

                  return (
                    <label
                      key={itemId}
                      onClick={() => handleToggleItem(itemId)}
                      className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-amber-500/10 border-amber-500/60 text-text-primary'
                          : 'bg-surface border-border text-text-secondary hover:bg-surface-raised'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 pointer-events-none"
                        />
                        <span className="text-xs font-bold text-text-primary">
                          {item.quantity}x {item.name}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-text-primary">
                        ${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* 2. Destination Table Picker */}
          <div>
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1.5">
              Mesa de Destino
            </label>
            {candidateTables.length === 0 ? (
              <div className="p-4 rounded-2xl bg-surface-raised border border-border text-center text-xs text-text-secondary">
                No hay otras mesas configuradas en esta sede.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                {candidateTables.map((table) => {
                  const isSelected = selectedTargetTableId === table.id

                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelectedTargetTableId(table.id)}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 active:scale-95 ${
                        isSelected
                          ? 'bg-primary text-text-inverse border-primary shadow-md ring-2 ring-primary/30'
                          : 'bg-surface-raised border-border text-text-primary hover:border-primary/60 hover:bg-surface'
                      }`}
                    >
                      <Utensils className={`w-4 h-4 ${isSelected ? 'text-text-inverse' : 'text-primary'}`} />
                      <span className="text-xs font-bold">{table.name}</span>
                      <span className="text-[9px] opacity-70">Cap: {table.capacity || 4}p</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 3. Transfer Summary Callout */}
          {targetTable && (
            <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-text-primary">{sourceTable.name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-primary" />
                <span className="font-bold text-primary">{targetTable.name}</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-primary">
                  ${transferTotal.toFixed(2)}
                </span>
                <span className="text-[10px] text-text-secondary block">
                  {itemsToMove.length} items
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3 bg-surface border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border hover:bg-surface-raised font-bold text-xs text-text-secondary hover:text-text-primary cursor-pointer transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedTargetTableId || itemsToMove.length === 0 || transferMutation.isPending}
            onClick={handleSubmit}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md min-h-[44px] ${
              !selectedTargetTableId || itemsToMove.length === 0 || transferMutation.isPending
                ? 'opacity-40 bg-surface-raised border border-border text-text-secondary cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/25 active:scale-[0.98]'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{transferMutation.isPending ? 'Transfiriendo...' : 'Confirmar Transferencia'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
