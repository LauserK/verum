'use client'

import React, { useState, useMemo } from 'react'
import {
  Merge,
  X,
  AlertCircle,
  Utensils,
  ArrowRight,
  Plus
} from 'lucide-react'
import { TableItem, TableOrder } from '@/lib/api/sales'
import { useMergeTableOrders } from '@/hooks/useSales'

export interface MergeModalProps {
  isOpen: boolean
  onClose: () => void
  sourceTable: {
    id: string
    name: string
  }
  sourceOrder: TableOrder
  availableTables: TableItem[]
  serverOrdersMap: Map<string, TableOrder>
  onSuccess?: () => void
}

export function MergeModal({
  isOpen,
  onClose,
  sourceTable,
  sourceOrder,
  availableTables,
  serverOrdersMap,
  onSuccess
}: MergeModalProps) {
  const mergeMutation = useMergeTableOrders()

  const [selectedTargetTableId, setSelectedTargetTableId] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Eligible destination tables: must have an active order and not be the source table
  const candidateTables = useMemo(() => {
    return availableTables.filter((t) => {
      if (t.id === sourceTable.id || !t.is_active) return false
      const order = serverOrdersMap.get(t.id)
      return Boolean(order && Array.isArray(order.cart) && order.cart.length > 0)
    })
  }, [availableTables, sourceTable.id, serverOrdersMap])

  const targetTable = candidateTables.find((t) => t.id === selectedTargetTableId)
  const targetOrder = selectedTargetTableId ? serverOrdersMap.get(selectedTargetTableId) : null

  const sourceTotal = Number(sourceOrder.total) || 0
  const targetTotal = targetOrder ? Number(targetOrder.total) || 0 : 0
  const combinedTotal = sourceTotal + targetTotal

  const sourceItemCount = (sourceOrder.cart || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0)
  const targetItemCount = targetOrder ? (targetOrder.cart || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0) : 0

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!selectedTargetTableId) {
      setErrorMsg('Debes seleccionar una mesa activa de destino para unir')
      return
    }

    setErrorMsg(null)

    try {
      await mergeMutation.mutateAsync({
        source_table_id: sourceTable.id,
        target_table_id: selectedTargetTableId,
      })

      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al unir las mesas')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg flex flex-col bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="shrink-0 p-5 bg-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <Merge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Unir Mesas</h3>
              <p className="text-xs text-text-secondary">
                Fusionar la comanda de <strong>{sourceTable.name}</strong> en otra mesa activa
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

          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
            <strong>Atención:</strong> Todos los ítems y comensales de <strong>{sourceTable.name}</strong> se transferirán a la mesa de destino. La mesa de origen quedará libre automáticamente.
          </div>

          {/* Table selector */}
          <div>
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1.5">
              Selecciona la Mesa con la que deseas Unir:
            </label>
            {candidateTables.length === 0 ? (
              <div className="p-6 rounded-2xl bg-surface-raised border border-dashed border-border text-center text-xs text-text-secondary">
                <Utensils className="w-6 h-6 mx-auto mb-2 opacity-40 text-primary" />
                <p className="font-bold text-text-primary">No hay otras mesas ocupadas</p>
                <p className="mt-0.5">Para unir mesas, debe existir al menos otra mesa con una comanda activa.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto p-1">
                {candidateTables.map((table) => {
                  const order = serverOrdersMap.get(table.id)
                  const isSelected = selectedTargetTableId === table.id

                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelectedTargetTableId(table.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 active:scale-95 ${
                        isSelected
                          ? 'bg-indigo-500/15 border-indigo-500 text-indigo-500 font-bold shadow-md ring-2 ring-indigo-500/30'
                          : 'bg-surface-raised border-border text-text-primary hover:border-indigo-500/40 hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-primary">{table.name}</span>
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                      </div>
                      <div className="text-xs font-mono font-bold text-amber-500">
                        ${Number(order?.total || 0).toFixed(2)}
                      </div>
                      <span className="text-[10px] text-text-secondary">
                        {(order?.cart || []).length} productos
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Fusion Summary Preview */}
          {targetTable && targetOrder && (
            <div className="p-4 rounded-2xl bg-surface-raised border border-border space-y-3">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                Resumen de Fusión
              </span>
              
              <div className="grid grid-cols-3 items-center gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-surface border border-border">
                  <div className="text-xs font-bold text-text-primary">{sourceTable.name}</div>
                  <div className="text-xs font-mono font-bold text-amber-500 mt-0.5">${sourceTotal.toFixed(2)}</div>
                  <div className="text-[10px] text-text-secondary">{sourceItemCount} ítems</div>
                </div>

                <div className="flex flex-col items-center justify-center text-indigo-500">
                  <Plus className="w-4 h-4 mb-0.5" />
                  <ArrowRight className="w-4 h-4" />
                </div>

                <div className="p-2.5 rounded-xl bg-surface border border-border">
                  <div className="text-xs font-bold text-text-primary">{targetTable.name}</div>
                  <div className="text-xs font-mono font-bold text-amber-500 mt-0.5">${targetTotal.toFixed(2)}</div>
                  <div className="text-[10px] text-text-secondary">{targetItemCount} ítems</div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/80 flex items-center justify-between text-xs">
                <span className="font-bold text-text-primary">Total Consolidado en {targetTable.name}:</span>
                <span className="text-sm font-mono font-black text-indigo-500">
                  ${combinedTotal.toFixed(2)}
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
            disabled={!selectedTargetTableId || mergeMutation.isPending}
            onClick={handleSubmit}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md min-h-[44px] ${
              !selectedTargetTableId || mergeMutation.isPending
                ? 'opacity-40 bg-surface-raised border border-border text-text-secondary cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25 active:scale-[0.98]'
            }`}
          >
            <Merge className="w-3.5 h-3.5" />
            <span>{mergeMutation.isPending ? 'Uniendo...' : 'Confirmar Fusión'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
