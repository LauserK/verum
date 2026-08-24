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
  MonitorCheck,
  LayoutGrid,
  MapPin
} from 'lucide-react'
import { usePosStore, PosMode } from '@/store/posStore'
import { useProfile } from '@/hooks/useProfile'
import PosCatalog from './components/PosCatalog'
import PosCart from './components/PosCart'
import PosTableMap from './components/PosTableMap'

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
  const { 
    posMode, 
    setPosMode, 
    activeTableId, 
    activeTableName, 
    setActiveTable, 
    activeWorkstationName 
  } = usePosStore()

  const handleModeChange = (newMode: PosMode) => {
    setPosMode(newMode)
    // If switching away from tables mode, reset active table
    if (newMode !== 'tables') {
      setActiveTable(null, null)
    }
  }

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
                onClick={() => handleModeChange(tab.id)}
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

        {/* Right: Cashier profile chip, workstation chip, active table indicator, close session */}
        <div className="flex items-center gap-3">
          {/* Active Workstation indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-raised border border-border text-xs text-text-secondary">
            <MonitorCheck className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-text-primary">{activeWorkstationName || 'Caja Principal'}</span>
          </div>

          {/* Active Table indicator & Map Toggle button if in tables mode */}
          {posMode === 'tables' && (
            <button
              onClick={() => setActiveTable(null, null)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm ${
                activeTableName
                  ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                  : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
              title="Cambiar de mesa o ver mapa general"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{activeTableName ? `Mesa: ${activeTableName} (Cambiar)` : 'Mapa de Mesas'}</span>
            </button>
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

      {/* Main Container */}
      <main className="flex-1 flex overflow-hidden">
        {posMode === 'tables' && !activeTableId ? (
          /* Fullscreen Table Map (100% width) when no table is selected */
          <div className="w-full h-full flex flex-col overflow-hidden">
            <PosTableMap />
          </div>
        ) : (
          /* 70/30 Split Container: Catalog + Minuta */
          <>
            <div className="w-[70%] h-full flex flex-col border-r border-border overflow-hidden">
              <PosCatalog />
            </div>
            <aside className="w-[30%] h-full flex flex-col overflow-hidden">
              <PosCart />
            </aside>
          </>
        )}
      </main>
    </div>
  )
}
