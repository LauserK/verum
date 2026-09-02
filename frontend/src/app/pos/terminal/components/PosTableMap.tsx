'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { 
  Utensils, 
  Users, 
  MapPin, 
  LayoutGrid, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Plus, 
  Clock,
  ArrowRight,
  Bell,
  User,
  Receipt,
  RotateCw
} from 'lucide-react'
import { useVenue } from '@/components/VenueContext'
import { useFloorPlans, useTableOrders, useWorkstations, useSyncTableOrder, usePosConfig, useTeamUsers } from '@/hooks/useSales'
import { usePosStore } from '@/store/posStore'
import { TableContextMenu } from './TableContextMenu'
import { TransferModal } from './TransferModal'
import { MergeModal } from './MergeModal'
import { AssignWaiterModal } from './AssignWaiterModal'
import { PreBillPreview } from './PreBillPreview'
import { OpenTableModal } from './OpenTableModal'
import { TableItem, TableOrder } from '@/lib/api/sales'

export default function PosTableMap() {
  const { selectedVenueId, selectedVenueName } = useVenue()
  const { 
    activeTableId, 
    setActiveTable, 
    openTableOrder,
    loadTableOrder, 
    cartsByContext, 
    cart, 
    total, 
    activeWorkstationId,
    setShowCheckout
  } = usePosStore()

  const { data: workstations = [] } = useWorkstations(selectedVenueId || undefined)
  const currentVenueId = selectedVenueId || workstations.find((w) => w.id === activeWorkstationId)?.venue_id || null

  const { data: floorPlans = [], isLoading } = useFloorPlans(currentVenueId || undefined)
  const { data: serverTableOrders = [], refetch: refetchOrders } = useTableOrders(currentVenueId || undefined)
  const { data: teamUsers = [] } = useTeamUsers()
  const { data: posConfig } = usePosConfig(activeWorkstationId || undefined, 'tables')
  const syncTableOrderMutation = useSyncTableOrder()

  const [openTableModalState, setOpenTableModalState] = useState<{
    isOpen: boolean
    table: TableItem | null
  }>({
    isOpen: false,
    table: null,
  })

  const [selectedPlanId, setSelectedPlanId] = useState<string>('')

  // Live timer tick for table elapsed times (updates every 15s)
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNowTimestamp(Date.now()), 15000)
    return () => clearInterval(interval)
  }, [])

  // Modals and Context Menu State
  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean
    table: TableItem | null
    order: TableOrder | null
    position: { x: number; y: number }
  }>({
    isOpen: false,
    table: null,
    order: null,
    position: { x: 0, y: 0 },
  })

  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [assignWaiterModalOpen, setAssignWaiterModalOpen] = useState(false)
  const [preBillModalOpen, setPreBillModalOpen] = useState(false)
  const [selectedTableForAction, setSelectedTableForAction] = useState<TableItem | null>(null)
  const [selectedOrderForAction, setSelectedOrderForAction] = useState<TableOrder | null>(null)

  // Map of active/pre_bill orders from backend
  const serverOrdersMap = useMemo(() => {
    const map = new Map<string, TableOrder>()
    for (const order of serverTableOrders) {
      if ((order.status === 'active' || order.status === 'pre_bill') && order.table_id) {
        map.set(order.table_id, order)
      }
    }
    return map
  }, [serverTableOrders])

  // Derive current active plan cleanly without extra state updates
  const currentPlan = useMemo(() => {
    if (selectedPlanId) {
      const found = floorPlans.find((p) => p.id === selectedPlanId)
      if (found) return found
    }
    return floorPlans[0] || null
  }, [floorPlans, selectedPlanId])

  const currentTables = useMemo(() => {
    return currentPlan?.tables?.filter((t) => t.is_active) || []
  }, [currentPlan])

  const allVenueTables = useMemo(() => {
    const tables: TableItem[] = []
    for (const p of floorPlans) {
      if (p.tables) {
        tables.push(...p.tables.filter((t) => t.is_active))
      }
    }
    return tables
  }, [floorPlans])

  const handleSelectTable = (table: TableItem) => {
    const serverOrder = serverOrdersMap.get(table.id)
    const tableCtx = cartsByContext[`table:${table.id}`]
    const isOccupied = Boolean(
      (serverOrder && (serverOrder.status === 'active' || serverOrder.status === 'pre_bill')) ||
      (tableCtx && (tableCtx.isOpen || (tableCtx.cart && tableCtx.cart.length > 0)))
    )

    if (isOccupied) {
      if (serverOrder) {
        loadTableOrder(table.id, serverOrder.tab_name || serverOrder.table_name || table.name, {
          cart: serverOrder.cart || [],
          total: Number(serverOrder.total) || 0,
          customerId: serverOrder.customer_id || null,
          customerName: serverOrder.customer_name || null,
          customerTaxId: serverOrder.customer_tax_id || null,
          customName: serverOrder.tab_name || null,
          assignedTo: serverOrder.assigned_to || null,
          guestsCount: (serverOrder as any).guests_count || null,
          isOpen: true,
        })
      } else if (tableCtx) {
        loadTableOrder(table.id, tableCtx.customName || table.name, {
          ...tableCtx,
          isOpen: true,
        })
      } else {
        setActiveTable(table.id, table.name)
      }
    } else {
      // Table is free - Open modal to start service
      setOpenTableModalState({
        isOpen: true,
        table,
      })
    }
  }

  const handleConfirmOpenTable = async (data: {
    customName?: string | null
    customerId?: string | null
    customerName?: string | null
    customerTaxId?: string | null
    assignedTo?: string | null
    assignedToName?: string | null
    guestsCount?: number
  }) => {
    const table = openTableModalState.table
    if (!table) return

    // 1. Open in local POS store
    openTableOrder(table.id, table.name, data)

    // 2. Sync active order in backend
    try {
      await syncTableOrderMutation.mutateAsync({
        tableId: table.id,
        data: {
          venue_id: currentVenueId || null,
          mode: 'tables',
          table_id: table.id,
          table_name: table.name,
          tab_name: data.customName || table.name,
          customer_id: data.customerId || null,
          customer_name: data.customerName || null,
          customer_tax_id: data.customerTaxId || null,
          assigned_to: data.assignedTo || null,
          cart: [],
          total: 0,
          workstation_id: activeWorkstationId || null,
          status: 'active',
        }
      })
      refetchOrders()
    } catch (e) {
      console.warn('Backend sync on table open (offline fallback):', e)
    }

    setOpenTableModalState({ isOpen: false, table: null })
  }

  // Right-click context menu trigger
  const handleContextMenu = (e: React.MouseEvent, table: TableItem) => {
    e.preventDefault()
    e.stopPropagation()
    const order = serverOrdersMap.get(table.id) || null
    setContextMenuState({
      isOpen: true,
      table,
      order,
      position: { x: e.clientX, y: e.clientY },
    })
    setSelectedTableForAction(table)
    setSelectedOrderForAction(order)
  }

  // Long-press detection for touch tablets
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const handleTouchStart = (e: React.TouchEvent, table: TableItem) => {
    const touch = e.touches[0]
    const posX = touch.clientX
    const posY = touch.clientY

    touchTimerRef.current = setTimeout(() => {
      const order = serverOrdersMap.get(table.id) || null
      setContextMenuState({
        isOpen: true,
        table,
        order,
        position: { x: posX, y: posY },
      })
      setSelectedTableForAction(table)
      setSelectedOrderForAction(order)
    }, 600)
  }

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }

  const formatElapsedTime = (openedAtStr?: string | null) => {
    if (!openedAtStr) return null
    try {
      const opened = new Date(openedAtStr).getTime()
      if (isNaN(opened)) return null
      const diffMinutes = Math.max(0, Math.floor((nowTimestamp - opened) / 60000))
      if (diffMinutes < 60) {
        return `${diffMinutes}m`
      }
      const hrs = Math.floor(diffMinutes / 60)
      const mins = diffMinutes % 60
      return `${hrs}h ${mins}m`
    } catch {
      return null
    }
  }

  // Only show full loading spinner during initial load when there is no cached data
  if (isLoading && floorPlans.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-bg">
        <div className="w-12 h-12 rounded-2xl bg-surface-raised animate-pulse mb-3" />
        <p className="text-xs text-text-secondary">Cargando plano de mesas...</p>
      </div>
    )
  }

  // Fallback if no floor plans are configured for this venue
  if (floorPlans.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-bg select-none">
        <div className="w-16 h-16 rounded-3xl bg-surface border border-border flex items-center justify-center text-primary mb-4 shadow-sm">
          <LayoutGrid className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-text-primary">No hay planos de mesas registrados</h3>
        <p className="text-xs text-text-secondary max-w-sm mt-1 mb-6">
          Aún no se han configurado planos ni salones para la sede <strong>{selectedVenueName || 'actual'}</strong>. Puedes seleccionar mesas rápidas o diseñar el plano en el panel administrativo.
        </p>

        {/* Quick Tables Grid */}
        <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-5 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center justify-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-primary" /> Mesas Rápidas
          </span>
          <div className="grid grid-cols-4 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => {
              const tableId = `quick-table-${i + 1}`
const tableNum = `Mesa ${i + 1}`
              const serverOrder = serverOrdersMap.get(tableId)
              const tableCtx = cartsByContext[`table:${tableId}`]
              const hasItems = (serverOrder && Array.isArray(serverOrder.cart) && serverOrder.cart.length > 0) || (tableCtx?.cart?.length || 0) > 0 || (activeTableId === tableId && cart.length > 0)
              const tableTotal = activeTableId === tableId ? total : (serverOrder ? Number(serverOrder.total) : (tableCtx?.total || 0))
              const isPreBill = serverOrder?.status === 'pre_bill'
              return (
                <button
                  key={i}
                  onClick={() => handleSelectTable({
                    id: tableId,
                    name: tableNum,
                    floor_plan_id: 'quick',
                    x: 0,
                    y: 0,
                    width: 80,
                    height: 80,
                    shape: 'rectangle',
                    capacity: 4,
                    is_active: true
                  })}
                  className={`p-3.5 rounded-2xl border transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-sm min-h-[48px] ${
                    isPreBill
                      ? 'bg-amber-400/20 border-amber-400 text-amber-600 dark:text-amber-300'
                      : hasItems
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-500 hover:bg-amber-500/25'
                      : 'bg-surface-raised border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/5 text-text-primary'
                  }`}
                >
                  <Utensils className={`w-4 h-4 ${isPreBill ? 'text-amber-400' : hasItems ? 'text-amber-500' : 'text-emerald-500'}`} />
                  <span className="text-xs font-bold text-text-primary">{tableNum}</span>
                  {hasItems && (
                    <span className="text-[9px] font-mono font-bold text-amber-500">
                      ${tableTotal.toFixed(2)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full bg-bg overflow-hidden select-none relative">
      {/* Top Header / Zone Selector Tabs */}
      <div className="shrink-0 p-4 pb-3 flex items-center justify-between bg-surface/80 backdrop-blur-md border-b border-border/70 z-10">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary mr-2 flex items-center gap-1.5 shrink-0">
            <Layers className="w-3.5 h-3.5 text-primary" /> Salones:
          </span>
          {floorPlans.map((plan) => {
            const isSelected = (selectedPlanId || floorPlans[0]?.id) === plan.id
            const tableCount = plan.tables?.filter((t) => t.is_active).length || 0

            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer min-h-[40px] ${
                  isSelected
                    ? 'bg-primary text-text-inverse shadow-md shadow-primary/25 ring-2 ring-primary/30'
                    : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-raised'
                }`}
              >
                <span>{plan.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-black/20 text-text-inverse' : 'bg-surface-raised text-text-secondary'
                  }`}
                >
                  {tableCount}
                </span>
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-4 text-[11px] text-text-secondary font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
            <span>Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
            <span>Ocupada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-xs animate-pulse" />
            <span>Cuenta Pedida</span>
          </div>
        </div>
      </div>

      {/* 2D Canvas / Table Grid Area */}
      <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-radial from-surface/20 to-bg relative">
        {currentTables.length === 0 ? (
          <div className="text-center p-8 bg-surface border border-dashed border-border rounded-3xl max-w-sm">
            <Utensils className="w-8 h-8 text-text-secondary mx-auto mb-2 opacity-50" />
            <h4 className="font-bold text-sm text-text-primary">Salón sin mesas</h4>
            <p className="text-xs text-text-secondary mt-1">
              No hay mesas configuradas en {currentPlan?.name || 'este salón'}.
            </p>
          </div>
        ) : (
          <div
            className="relative bg-surface/50 border border-border/70 rounded-3xl shadow-xl overflow-hidden"
            style={{
              width: `${currentPlan?.width || 800}px`,
              height: `${currentPlan?.height || 600}px`,
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            {currentTables.map((table) => {
              const isSelected = activeTableId === table.id
              const isCircle = table.shape === 'circle'
              const serverOrder = serverOrdersMap.get(table.id)
              const tableCtx = cartsByContext[`table:${table.id}`]
              const isOccupied = Boolean(
                (serverOrder && (serverOrder.status === 'active' || serverOrder.status === 'pre_bill')) ||
                (tableCtx && (tableCtx.isOpen || (tableCtx.cart && tableCtx.cart.length > 0))) ||
                (isSelected && cart.length > 0)
              )
              const tableTotal = isSelected ? total : (serverOrder ? Number(serverOrder.total) : (tableCtx?.total || 0))
              const isPreBill = serverOrder?.status === 'pre_bill'

              const cartList = isSelected ? cart : (serverOrder?.cart || tableCtx?.cart || [])
              const itemCount = cartList.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0)
              const hasKitchenItems = cartList.some((i: any) => i.sentToKitchen === true)

              const elapsedDisplay = formatElapsedTime(serverOrder?.opened_at || tableCtx?.openedAt || serverOrder?.created_at)
              const preBillTimer = formatElapsedTime(serverOrder?.pre_bill_requested_at)
              const tableDisplayName = serverOrder?.tab_name || tableCtx?.customName || table.name
              const assignedWaiterId = serverOrder?.assigned_to || tableCtx?.assignedTo
              const assignedWaiter = teamUsers.find((u) => u.id === assignedWaiterId)

              return (
                <button
                  key={table.id}
                  onClick={() => handleSelectTable(table)}
                  onContextMenu={(e) => handleContextMenu(e, table)}
                  onTouchStart={(e) => handleTouchStart(e, table)}
                  onTouchEnd={handleTouchEnd}
                  style={{
                    left: `${table.x}px`,
                    top: `${table.y}px`,
                    width: `${table.width}px`,
                    height: `${table.height}px`,
                  }}
                  className={`absolute transition-all duration-150 flex flex-col items-center justify-between text-center p-2 cursor-pointer shadow-md select-none group active:scale-95 hover:z-20 min-h-[48px] min-w-[48px] ${
                    isCircle ? 'rounded-full' : 'rounded-2xl'
                  } ${
                    isSelected
                      ? 'bg-primary text-text-inverse ring-4 ring-primary/30 border-2 border-primary shadow-lg shadow-primary/30 scale-105 z-10'
                      : isPreBill
                      ? 'bg-amber-400/25 border-2 border-amber-400 text-amber-500 shadow-amber-400/20 shadow-md ring-2 ring-amber-400/30'
                      : isOccupied
                      ? 'bg-amber-500/15 border-2 border-amber-500/70 text-amber-500 hover:bg-amber-500/25 hover:border-amber-500 hover:shadow-lg'
                      : 'bg-surface border-2 border-emerald-500/40 hover:border-emerald-500 hover:bg-emerald-500/5 hover:shadow-lg'
                  }`}
                >
                  {/* Top badges (Elapsed time / Kitchen Bell / Pre-bill tag) */}
                  <div className="w-full flex items-center justify-between px-1 shrink-0">
                    {/* Elapsed Time Ticker */}
                    {isOccupied && !isSelected ? (
                      <span className="text-[9px] font-mono font-bold opacity-80 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {isPreBill ? `Pre: ${preBillTimer || '0m'}` : (elapsedDisplay || '0m')}
                      </span>
                    ) : (
                      <div className="flex items-center gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Libre</span>
                      </div>
                    )}

                    {/* Kitchen Bell or Waiter Avatar Badge */}
                    <div className="flex items-center gap-1">
                      {hasKitchenItems && !isSelected && (
                        <span className="p-0.5 rounded-full bg-amber-500 text-black shadow-xs" title="Comanda enviada a cocina">
                          <Bell className="w-2.5 h-2.5 fill-black" />
                        </span>
                      )}
                      {assignedWaiter && !isSelected && (
                        <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-500 border border-sky-500/40 flex items-center justify-center text-[8px] font-bold" title={`Mesero: ${assignedWaiter.full_name}`}>
                          <User className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Table Name */}
                  <div className="my-auto flex flex-col items-center">
                    <span className={`font-black text-xs sm:text-sm tracking-tight leading-tight line-clamp-1 ${
                      isSelected ? 'text-text-inverse' : isPreBill ? 'text-amber-500 font-black' : isOccupied ? 'text-amber-500 font-black' : 'text-text-primary'
                    }`}>
                      {tableDisplayName}
                    </span>

                    {/* Live Accumulated Amount or Capacity */}
                    {isOccupied && !isSelected ? (
                      <span className="text-[10px] font-mono font-black text-amber-500 mt-0.5">
                        ${tableTotal.toFixed(2)}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-text-secondary mt-0.5">
                        <Users className="w-2.5 h-2.5" />
                        <span>{table.capacity || 4}p</span>
                      </div>
                    )}
                  </div>

                  {/* Status footer pill */}
                  <div className="shrink-0 text-[9px] font-bold">
                    {isPreBill && !isSelected ? (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black font-black uppercase text-[8px]">
                        Cuenta Pedida
                      </span>
                    ) : isOccupied && !isSelected ? (
                      <span className="text-[9px] opacity-80">
                        {itemCount > 0 ? `${itemCount} ${itemCount === 1 ? 'ítem' : 'ítems'}` : 'En servicio'}
                      </span>
                    ) : (
                      <span className="text-[9px] opacity-60">
                        Cap: {table.capacity || 4}p
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom Bar Info */}
      <div className="shrink-0 px-6 py-3 bg-surface/80 backdrop-blur-md border-t border-border/70 flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold text-text-primary">
            {selectedVenueName || 'Sucursal Principal'}
          </span>
          <span className="text-text-secondary">·</span>
          <span>{currentPlan?.name || 'Salón Principal'}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-text-primary">
              {currentTables.length}
            </span>
            <span>mesas totales</span>
          </div>
          <span className="text-text-secondary">·</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-amber-500">
              {serverOrdersMap.size}
            </span>
            <span>activas</span>
          </div>
          <button
            type="button"
            onClick={() => refetchOrders()}
            className="p-1 hover:bg-surface-raised rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer ml-1"
            title="Refrescar estado de mesas"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table Right-Click / Long-Press Context Menu */}
      {contextMenuState.isOpen && contextMenuState.table && (
        <TableContextMenu
          isOpen={contextMenuState.isOpen}
          position={contextMenuState.position}
          table={contextMenuState.table}
          order={contextMenuState.order}
          onClose={() => setContextMenuState((prev) => ({ ...prev, isOpen: false }))}
          onOpenOrder={() => {
            if (contextMenuState.table) {
              handleSelectTable(contextMenuState.table)
            }
          }}
          onTransfer={() => {
            setSelectedTableForAction(contextMenuState.table)
            setSelectedOrderForAction(contextMenuState.order)
            setTransferModalOpen(true)
          }}
          onMerge={() => {
            setSelectedTableForAction(contextMenuState.table)
            setSelectedOrderForAction(contextMenuState.order)
            setMergeModalOpen(true)
          }}
          onChangeWaiter={() => {
            setSelectedTableForAction(contextMenuState.table)
            setSelectedOrderForAction(contextMenuState.order)
            setAssignWaiterModalOpen(true)
          }}
          onPreBill={() => {
            setSelectedTableForAction(contextMenuState.table)
            setSelectedOrderForAction(contextMenuState.order)
            setPreBillModalOpen(true)
          }}
          onCheckout={() => {
            if (contextMenuState.table) {
              handleSelectTable(contextMenuState.table)
              setShowCheckout(true)
            }
          }}
        />
      )}

      {/* Open Table Modal */}
      {openTableModalState.isOpen && openTableModalState.table && (
        <OpenTableModal
          isOpen={openTableModalState.isOpen}
          onClose={() => setOpenTableModalState({ isOpen: false, table: null })}
          table={openTableModalState.table}
          customerRequirement={(posConfig?.customer_requirement as any) || 'optional'}
          teamUsers={teamUsers}
          onConfirm={handleConfirmOpenTable}
          isSubmitting={syncTableOrderMutation.isPending}
        />
      )}

      {/* Transfer Modal */}
      {transferModalOpen && selectedTableForAction && selectedOrderForAction && (
        <TransferModal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          sourceTable={selectedTableForAction}
          sourceOrder={selectedOrderForAction}
          availableTables={allVenueTables}
          onSuccess={() => refetchOrders()}
        />
      )}

      {/* Merge Modal */}
      {mergeModalOpen && selectedTableForAction && selectedOrderForAction && (
        <MergeModal
          isOpen={mergeModalOpen}
          onClose={() => setMergeModalOpen(false)}
          sourceTable={selectedTableForAction}
          sourceOrder={selectedOrderForAction}
          availableTables={allVenueTables}
          serverOrdersMap={serverOrdersMap}
          onSuccess={() => refetchOrders()}
        />
      )}

      {/* Assign Waiter Modal */}
      {assignWaiterModalOpen && selectedTableForAction && (
        <AssignWaiterModal
          isOpen={assignWaiterModalOpen}
          onClose={() => setAssignWaiterModalOpen(false)}
          tableId={selectedTableForAction.id}
          tableName={selectedTableForAction.name}
          currentWaiterId={selectedOrderForAction?.assigned_to}
          waiters={teamUsers.map((u) => ({ id: u.id, full_name: u.full_name }))}
          onSuccess={() => refetchOrders()}
        />
      )}

      {/* PreBill Preview Modal (triggered from Context Menu) */}
      {preBillModalOpen && selectedTableForAction && selectedOrderForAction && (
        <PreBillPreview
          isOpen={preBillModalOpen}
          onClose={() => setPreBillModalOpen(false)}
          tableId={selectedTableForAction.id}
          tableName={selectedTableForAction.name}
          customerName={selectedOrderForAction.customer_name}
          customerTaxId={selectedOrderForAction.customer_tax_id}
          cartItems={selectedOrderForAction.cart || []}
          seats={selectedOrderForAction.seats || []}
          openedAt={selectedOrderForAction.opened_at || selectedOrderForAction.created_at}
          orderNumber={selectedOrderForAction.order_number}
          total={Number(selectedOrderForAction.total) || 0}
        />
      )}
    </div>
  )
}
