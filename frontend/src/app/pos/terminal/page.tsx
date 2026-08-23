'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { 
  Utensils, 
  ShoppingBag, 
  Bike, 
  PackageCheck, 
  Wine, 
  LogOut, 
  UserCircle2,
  Receipt,
  ArrowLeft
} from 'lucide-react'
import { usePosStore, PosMode } from '@/store/posStore'
import { useProfile } from '@/hooks/useProfile'
import PosCatalog from './components/PosCatalog'

interface PosModeTab {
  id: PosMode
  label: string
  icon: React.ElementType
}

const POS_TABS: PosModeTab[] = [
  { id: 'tables', label: 'Mesas', icon: Utensils },
  { id: 'takeout', label: 'Para Llevar', icon: ShoppingBag },
  { id: 'delivery', label: 'Delivery', icon: Bike },
  { id: 'pickup', label: 'Pick-up', icon: PackageCheck },
  { id: 'bar', label: 'Barra', icon: Wine },
]

export default function PosTerminalPage() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const { posMode, setPosMode, activeTableName } = usePosStore()

  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-text-primary overflow-hidden select-none">
      {/* Top Header (~64px, bg-surface border-b border-border) */}
      <header className="h-16 shrink-0 bg-surface border-b border-border px-4 flex items-center justify-between z-20 shadow-sm">
        {/* Left: Logo + "Verum POS" */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-lg shadow-inner">
            V
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-tight text-text-primary">VERUM POS</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-bold">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-text-secondary">Terminal Punto de Venta</p>
          </div>
        </div>

        {/* Middle: Mode Selector Tabs */}
        <div className="flex items-center gap-1 bg-surface-raised/80 p-1 rounded-2xl border border-border">
          {POS_TABS.map((tab) => {
            const isActive = posMode === tab.id
            const Icon = tab.icon

            return (
              <button
                key={tab.id}
                onClick={() => setPosMode(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-surface text-primary border border-border/80 shadow-sm ring-1 ring-primary/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Right: Cashier profile chip, active table indicator, close session */}
        <div className="flex items-center gap-3">
          {/* Active Table indicator if in tables mode */}
          {posMode === 'tables' && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/25 text-xs text-primary font-bold">
              <Utensils className="w-3.5 h-3.5" />
              <span>{activeTableName ? `Mesa: ${activeTableName}` : 'Sin mesa asignada'}</span>
            </div>
          )}

          {/* Cashier Chip */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-raised border border-border text-xs">
            <UserCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span className="font-bold text-text-primary max-w-[120px] truncate">
              {profile?.full_name || profile?.email || 'Cajero'}
            </span>
          </div>

          {/* Close Session / Back to Session Select */}
          <button
            onClick={() => router.push('/pos/session')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-raised hover:bg-error/10 hover:border-error/30 hover:text-error border border-border text-xs font-bold text-text-secondary transition-all cursor-pointer shadow-sm"
            title="Cerrar sesión de terminal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {/* Main 70/30 Split Container */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left (70% width): PosCatalog */}
        <div className="w-[70%] h-full flex flex-col border-r border-border overflow-hidden">
          <PosCatalog />
        </div>

        {/* Right (30% width): Placeholder aside for Minuta/Cart (Task 4) */}
        <aside className="w-[30%] h-full flex flex-col bg-surface border-l border-border/50 overflow-hidden">
          {/* Cart Header */}
          <div className="h-14 shrink-0 px-4 border-b border-border flex items-center justify-between bg-surface/50">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-text-primary">Comanda / Minuta</h3>
            </div>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-surface-raised border border-border text-text-secondary">
              Ticket #1
            </span>
          </div>

          {/* Cart Body Placeholder */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-text-secondary">
            <div className="w-12 h-12 rounded-2xl bg-surface-raised border border-border flex items-center justify-center mb-3">
              <Receipt className="w-6 h-6 opacity-40 text-primary" />
            </div>
            <p className="text-xs font-bold text-text-primary">Orden Vacía</p>
            <p className="text-[11px] text-text-secondary mt-1 max-w-[200px]">
              Selecciona productos del catálogo a la izquierda para agregarlos al ticket.
            </p>
          </div>

          {/* Cart Footer Placeholder */}
          <div className="p-4 border-t border-border bg-surface-raised/40 space-y-3">
            <div className="flex justify-between items-center text-xs text-text-secondary">
              <span>Total Estimado</span>
              <span className="text-lg font-black text-primary font-mono">$0.00</span>
            </div>
            <button
              disabled
              className="w-full py-3 rounded-xl bg-primary/40 text-text-inverse font-bold text-xs cursor-not-allowed text-center"
            >
              Cobrar Orden
            </button>
          </div>
        </aside>
      </main>
    </div>
  )
}
