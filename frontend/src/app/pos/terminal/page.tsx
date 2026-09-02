'use client'

import React, { useState } from 'react'
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
  MapPin,
  Receipt,
  ChevronDown
} from 'lucide-react'
import { usePosStore, PosMode } from '@/store/posStore'
import { useProfile } from '@/hooks/useProfile'
import PosCatalog from './components/PosCatalog'
import PosCart from './components/PosCart'
import PosTableMap from './components/PosTableMap'
import { CustomerSelectorModal } from './components/CustomerSelectorModal'
import { CheckoutModal } from './components/CheckoutModal'
import { OpenOrdersModal } from './components/OpenOrdersModal'
import { PreBillPreview } from './components/PreBillPreview'
import { PosModeSelectorModal } from './components/PosModeSelectorModal'
import { usePosConfig, useWorkstations, useActivePosSession, useSyncTableOrder, useTableOrders, useTeamUsers, useCustomers, useFloorPlans, useCategories, useSalesItems } from '@/hooks/useSales'
import { useVenue } from '@/components/VenueContext'

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
  const { selectedVenueId } = useVenue()

  // Preload team users, customers, floor plans, and product catalog once on POS page initialization
  useTeamUsers()
  useCustomers()
  useFloorPlans(selectedVenueId || undefined)
  useCategories()
  useSalesItems()
  const { data: workstations = [] } = useWorkstations(selectedVenueId || undefined)
  const { 
    cart,
    total,
    posMode, 
    setPosMode, 
    activeTableId, 
    activeTableName, 
    setActiveTable, 
    activeWorkstationId,
    activeWorkstationName,
    setActiveWorkstation,
    activeSessionId,
    setSessionOpening,
    customerId,
    customerName,
    customerTaxId,
    setCustomer,
    showCheckout,
    showCustomerSelector,
    setShowCheckout,
    setShowCustomerSelector,
    orderNumber
  } = usePosStore()

  // Mode Selector Modal State
  const [showModeModal, setShowModeModal] = useState(false)
  // Pre-bill Modal State
  const [showPreBillModal, setShowPreBillModal] = useState(false)

  // Auto-resolve workstation if not set in store
  React.useEffect(() => {
    if (workstations.length > 0 && !activeWorkstationId) {
      const activeOne = workstations.find((w) => w.is_active) || workstations[0]
      if (activeOne) {
        setActiveWorkstation(activeOne.id, activeOne.name)
      }
    }
  }, [workstations, activeWorkstationId, setActiveWorkstation])

  // Auto-fetch and sync active session for this workstation
  const { data: serverSession } = useActivePosSession(activeWorkstationId || undefined)

  React.useEffect(() => {
    if (serverSession && serverSession.status === 'open') {
      if (activeSessionId !== serverSession.id) {
        setSessionOpening(
          serverSession.opening_balance || 0,
          serverSession.opening_currency || 'USD',
          serverSession.id
        )
      }
    }
  }, [serverSession, activeSessionId, setSessionOpening])

  // Open Orders / Cuentas Abiertas Across All Terminals
  const [showOpenOrdersModal, setShowOpenOrdersModal] = useState(false)
  const currentVenueId = selectedVenueId || workstations.find((w) => w.id === activeWorkstationId)?.venue_id || serverSession?.venue_id || null
  const { data: serverTableOrders = [] } = useTableOrders(currentVenueId || undefined)
  const openOrdersCount = serverTableOrders.filter((o) => o.status === 'active' || o.status === 'pre_bill').length

  // Multi-Terminal Real-Time Sync for all active orders (Tables, Bar, Delivery, Takeout, Pickup)
  const syncTableOrderMutation = useSyncTableOrder()

  React.useEffect(() => {
    if (cart.length > 0 || (posMode === 'tables' && activeTableId)) {
      const timer = setTimeout(() => {
        const tabName = activeTableName || (
          posMode === 'bar' ? (customerName ? `Barra - ${customerName}` : 'Barra') :
          posMode === 'delivery' ? (customerName ? `Delivery - ${customerName}` : 'Delivery') :
          posMode === 'takeout' ? (customerName ? `Llevar - ${customerName}` : 'Para Llevar') :
          posMode === 'pickup' ? (customerName ? `Pick-up - ${customerName}` : 'Pick-up') : 'Mesa'
        )

        syncTableOrderMutation.mutate({
          tableId: activeTableId || `direct:${posMode}:${activeWorkstationId || 'default'}`,
          data: {
            venue_id: currentVenueId || null,
            mode: posMode,
            table_id: activeTableId || null,
            table_name: activeTableName || null,
            tab_name: tabName,
            customer_id: customerId || null,
            customer_name: customerName || null,
            customer_tax_id: customerTaxId || null,
            cart: cart,
            total: total,
            order_number: orderNumber,
            workstation_id: activeWorkstationId || null,
            status: 'active',
          }
        })
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [posMode, activeTableId, activeTableName, cart, total, customerId, customerName, customerTaxId, orderNumber, currentVenueId, activeWorkstationId])

  const { data: posConfig } = usePosConfig(activeWorkstationId || undefined, posMode)
  const customerRequirement = posConfig?.customer_requirement || 'optional'

  const handleCheckoutClick = () => {
    if (cart.length === 0) return
    if (customerRequirement === 'required' && !customerId) {
      setShowCustomerSelector(true)
      return
    }
    setShowCheckout(true)
  }

  const handleCustomerSelected = (customer: { id: string | null; name: string; taxId: string | null }) => {
    setCustomer(customer.id, customer.name, customer.taxId)
    setShowCustomerSelector(false)
    if (cart.length > 0 && customerRequirement === 'required') {
      setShowCheckout(true)
    }
  }

  const handleModeChange = (newMode: PosMode) => {
    setPosMode(newMode)
  }

  const currentModeTab = POS_TABS.find((t) => t.id === posMode) || POS_TABS[0]
  const CurrentModeIcon = currentModeTab.icon

  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-text-primary overflow-hidden select-none">
      {/* Top Header (~64px, bg-surface border-b border-border) */}
      <header className="h-16 shrink-0 bg-surface border-b border-border px-3 sm:px-4 flex items-center justify-between z-20 shadow-sm gap-2">
        {/* Left: Logo + "Verum POS" */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-base sm:text-lg shadow-inner">
            V
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs sm:text-sm tracking-tight text-text-primary">VERUM POS</span>
              <span className="hidden sm:inline-block text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-bold">
                v2.0
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-text-secondary truncate max-w-[110px] sm:max-w-none">Punto de Venta</p>
          </div>
        </div>

        {/* Middle: Mode Selector (Compact Dropdown on Tablets < xl, Full Tabs on Desktop xl+) */}
        <div className="flex items-center justify-center">
          {/* Tablet/Mobile Button Selector (< xl) */}
          <button
            onClick={() => setShowModeModal(true)}
            className="xl:hidden flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-raised hover:bg-primary/10 border border-border hover:border-primary/40 text-xs font-bold text-text-primary transition-all cursor-pointer shadow-sm active:scale-95"
            title="Cambiar modo de venta"
          >
            <CurrentModeIcon className="w-4 h-4 text-primary" />
            <span className="font-bold">{currentModeTab.label}</span>
            <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />
          </button>

          {/* Desktop Full Tabs (xl+) */}
          <div className="hidden xl:flex items-center gap-1 bg-surface-raised/80 p-1 rounded-2xl border border-border">
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
        </div>

        {/* Right: Actions, Cuentas Abiertas, Table & User chips */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Active Workstation indicator */}
          <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-raised border border-border text-xs text-text-secondary">
            <MonitorCheck className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-text-primary">{activeWorkstationName || 'Caja'}</span>
          </div>

          {/* Active Table indicator & Map Toggle button if in tables mode */}
          {posMode === 'tables' && (
            <button
              onClick={() => setActiveTable(null, null)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm ${
                activeTableName
                  ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                  : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
              title="Cambiar de mesa o ver mapa general"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{activeTableName ? `Mesa: ${activeTableName}` : 'Mesas'}</span>
            </button>
          )}

          {/* Cuentas Abiertas Button */}
          <button
            onClick={() => setShowOpenOrdersModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-surface-raised hover:bg-primary/10 border border-border hover:border-primary/30 text-xs font-bold text-text-primary transition-all cursor-pointer shadow-sm"
            title="Ver todas las cuentas y comandas abiertas en la sede"
          >
            <Receipt className="w-3.5 h-3.5 text-primary" />
            <span className="hidden md:inline">Cuentas</span>
            {openOrdersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-primary text-black">
                {openOrdersCount}
              </span>
            )}
          </button>

          {/* Cashier Chip */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-raised border border-border text-xs">
            <UserCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-bold text-text-primary max-w-[100px] lg:max-w-[130px] truncate">
              {profile?.full_name || profile?.email || 'Cajero'}
            </span>
          </div>

          {/* Close Session / Back to Session Select */}
          <button
            onClick={() => router.push('/pos/session')}
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-surface-raised hover:bg-error/10 hover:border-error/30 hover:text-error border border-border text-xs font-bold text-text-secondary transition-all cursor-pointer shadow-sm"
            title="Cerrar sesión de terminal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Main Container: 58/42 Split in Tablets, 70/30 in Desktop */}
      <main className="flex-1 flex overflow-hidden">
        {posMode === 'tables' && !activeTableId ? (
          /* Fullscreen Table Map (100% width) when no table is selected */
          <div className="w-full h-full flex flex-col overflow-hidden">
            <PosTableMap />
          </div>
        ) : (
          /* Responsive Split Container: Catalog + Minuta */
          <>
            <div className="w-[58%] xl:w-[68%] 2xl:w-[72%] h-full flex flex-col border-r border-border overflow-hidden">
              <PosCatalog />
            </div>
            <aside className="w-[42%] xl:w-[32%] 2xl:w-[28%] h-full flex flex-col overflow-hidden min-w-[320px]">
              <PosCart 
                onCheckout={handleCheckoutClick} 
                onPreBill={() => setShowPreBillModal(true)}
              />
            </aside>
          </>
        )}
      </main>

      {/* Mode Selector Modal (for compact and tablet screens) */}
      <PosModeSelectorModal
        isOpen={showModeModal}
        onClose={() => setShowModeModal(false)}
        currentMode={posMode}
        onSelectMode={handleModeChange}
      />

      {/* Pre-Bill Preview Modal */}
      <PreBillPreview
        isOpen={showPreBillModal}
        onClose={() => setShowPreBillModal(false)}
        tableId={activeTableId}
        tableName={activeTableName || (posMode === 'bar' ? 'Barra' : posMode === 'delivery' ? 'Delivery' : 'Para Llevar')}
        customerName={customerName}
        customerTaxId={customerTaxId}
        cartItems={cart}
        orderNumber={orderNumber}
        total={total}
      />

      {/* Open Orders Across All Terminals Modal */}
      <OpenOrdersModal
        isOpen={showOpenOrdersModal}
        onClose={() => setShowOpenOrdersModal(false)}
        venueId={currentVenueId}
        orders={serverTableOrders}
      />

      {/* Customer Selector Modal */}
      <CustomerSelectorModal
        isOpen={showCustomerSelector}
        onClose={() => setShowCustomerSelector(false)}
        onSelect={handleCustomerSelected}
        required={customerRequirement === 'required'}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        total={total}
        cartItems={cart}
        customerName={customerName}
        mode={posMode}
        tableName={activeTableName}
        orderNumber={orderNumber}
      />
    </div>
  )
}
