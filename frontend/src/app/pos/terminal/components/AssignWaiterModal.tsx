'use client'

import React, { useState } from 'react'
import {
  UserCheck,
  X,
  AlertCircle,
  User,
  Check
} from 'lucide-react'
import { TableOrder } from '@/lib/api/sales'
import { useUpdateTableOrder } from '@/hooks/useSales'

export interface AssignWaiterModalProps {
  isOpen: boolean
  onClose: () => void
  tableId: string
  tableName: string
  currentWaiterId?: string | null
  waiters: { id: string; full_name: string }[]
  onSuccess?: () => void
}

export function AssignWaiterModal({
  isOpen,
  onClose,
  tableId,
  tableName,
  currentWaiterId,
  waiters,
  onSuccess
}: AssignWaiterModalProps) {
  const updateOrderMutation = useUpdateTableOrder()
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>(currentWaiterId || '')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSave = async () => {
    setErrorMsg(null)
    try {
      await updateOrderMutation.mutateAsync({
        tableId,
        data: {
          assigned_to: selectedWaiterId || null,
        }
      })

      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al asignar el mesero')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm flex flex-col bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 p-5 bg-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Asignar Mesero</h3>
              <p className="text-xs text-text-secondary">{tableName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-border hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of Waiters */}
        <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            {/* Unassigned option */}
            <button
              type="button"
              onClick={() => setSelectedWaiterId('')}
              className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                !selectedWaiterId
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 opacity-50" />
                <span>Sin asignar (General)</span>
              </div>
              {!selectedWaiterId && <Check className="w-4 h-4" />}
            </button>

            {waiters.map((waiter) => {
              const isSelected = selectedWaiterId === waiter.id

              return (
                <button
                  key={waiter.id}
                  type="button"
                  onClick={() => setSelectedWaiterId(waiter.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500/15 border-sky-500 text-sky-500 shadow-xs'
                      : 'bg-surface border-border text-text-primary hover:border-sky-500/50 hover:bg-surface-raised'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-surface-raised border border-border flex items-center justify-center font-black text-[11px] text-text-secondary">
                      {waiter.full_name.slice(0, 2).toUpperCase()}
                    </div>
                    <span>{waiter.full_name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-sky-500" />}
                </button>
              )
            })}
          </div>
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
            disabled={updateOrderMutation.isPending}
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/25 transition-all cursor-pointer active:scale-[0.98] min-h-[44px]"
          >
            <span>{updateOrderMutation.isPending ? 'Guardando...' : 'Asignar'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
