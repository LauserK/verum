'use client'

import React from 'react'
import {
  X,
  Utensils,
  ShoppingBag,
  Bike,
  PackageCheck,
  Wine,
  CheckCircle2,
  Sparkles
} from 'lucide-react'
import { PosMode } from '@/store/posStore'

interface PosModeOption {
  id: PosMode
  label: string
  description: string
  icon: React.ElementType
  color: string
  badgeBg: string
  badgeText: string
}

const MODE_OPTIONS: PosModeOption[] = [
  {
    id: 'tables',
    label: 'Mesas & Salón',
    description: 'Servicio en mesa, comensales, cuentas por asiento y mapa interactivo',
    icon: Utensils,
    color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-500',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-500'
  },
  {
    id: 'takeout',
    label: 'Para Llevar',
    description: 'Venta directa en mostrador o empaque para llevar',
    icon: ShoppingBag,
    color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-500',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-500'
  },
  {
    id: 'delivery',
    label: 'Delivery',
    description: 'Despacho a domicilio con registro de cliente y dirección',
    icon: Bike,
    color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-500',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-500'
  },
  {
    id: 'pickup',
    label: 'Pick-up',
    description: 'Pedidos por encargo para retiro programado en tienda',
    icon: PackageCheck,
    color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-500',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-500'
  },
  {
    id: 'bar',
    label: 'Barra & Bebidas',
    description: 'Atención rápida en barra con comandas independientes y cobro ágil',
    icon: Wine,
    color: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-500',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-500'
  }
]

interface PosModeSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  currentMode: PosMode
  onSelectMode: (mode: PosMode) => void
}

export function PosModeSelectorModal({
  isOpen,
  onClose,
  currentMode,
  onSelectMode
}: PosModeSelectorModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200 p-4">
      <div className="w-full max-w-lg bg-surface border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-surface-raised/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-text-primary tracking-tight">Modo de Venta</h2>
              <p className="text-xs text-text-secondary">Selecciona la modalidad operativa del terminal</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-border hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options Grid */}
        <div className="p-4 sm:p-5 space-y-2.5 max-h-[75vh] overflow-y-auto">
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isSelected = currentMode === opt.id

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelectMode(opt.id)
                  onClose()
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer group active:scale-[0.99] ${
                  isSelected
                    ? 'bg-surface-raised border-primary shadow-md ring-2 ring-primary/20'
                    : 'bg-surface border-border/80 hover:border-primary/40 hover:bg-surface-raised/60'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border bg-gradient-to-br ${opt.color} ${
                      isSelected ? 'scale-105' : ''
                    } transition-transform`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
                        {opt.label}
                      </h3>
                      {isSelected && (
                        <span className={`px-2 py-0.2 rounded-md text-[10px] font-black uppercase tracking-wider ${opt.badgeBg} ${opt.badgeText}`}>
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-1 mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                </div>

                {isSelected ? (
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 ml-2" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-border/80 shrink-0 ml-2 group-hover:border-primary/50" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
