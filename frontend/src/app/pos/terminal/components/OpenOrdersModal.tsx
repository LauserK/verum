'use client'

import React, { useState, useMemo } from 'react'
import {
  X,
  Receipt,
  Utensils,
  Wine,
  Truck,
  ShoppingBag,
  Package,
  Search,
  Clock,
  User,
  ArrowRight,
  Trash2,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { TableOrder } from '@/lib/api/sales'
import { PosMode, usePosStore } from '@/store/posStore'
import { useTableOrders, useDeleteTableOrder } from '@/hooks/useSales'
import { useVenue } from '@/components/VenueContext'

interface OpenOrdersModalProps {
  isOpen: boolean
  onClose: () => void
  venueId?: string | null
  orders?: TableOrder[]
}

export function OpenOrdersModal({ isOpen, onClose, venueId, orders: passedOrders }: OpenOrdersModalProps) {
  const { selectedVenueId } = useVenue()
  const effectiveVenueId = venueId !== undefined ? venueId : selectedVenueId
  const { data: fetchedOrders = [], isLoading, refetch, isRefetching } = useTableOrders(effectiveVenueId || undefined)
  const openOrders = passedOrders || fetchedOrders
  const deleteOrderMutation = useDeleteTableOrder()
  const { loadTableOrder, setPosMode } = usePosStore()

  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Filter active orders
  const activeOrders = useMemo(() => {
    return openOrders.filter((o) => o.status === 'active' || o.status === 'pre_bill')
  }, [openOrders])

  const filteredOrders = useMemo(() => {
    return activeOrders.filter((o) => {
      // Tab filter
      if (activeTab !== 'all') {
        const orderMode = o.mode || (o.table_id ? 'tables' : 'takeout')
        if (orderMode !== activeTab) return false
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchTable = (o.table_name || '').toLowerCase().includes(term)
        const matchTab = (o.tab_name || '').toLowerCase().includes(term)
        const matchCustomer = (o.customer_name || '').toLowerCase().includes(term)
        const matchItems = (o.cart || []).some((item: any) =>
          (item.name || '').toLowerCase().includes(term)
        )
        if (!matchTable && !matchTab && !matchCustomer && !matchItems) return false
      }

      return true
    })
  }, [activeOrders, activeTab, searchTerm])

  if (!isOpen) return null

  const handleOpenOrder = (order: TableOrder) => {
    const orderMode = (order.mode || (order.table_id ? 'tables' : 'takeout')) as PosMode

    if (order.table_id) {
      loadTableOrder(order.table_id, order.table_name || 'Mesa', {
        cart: order.cart || [],
        total: Number(order.total) || 0,
        customerId: order.customer_id || null,
        customerName: order.customer_name || null,
        customerTaxId: order.customer_tax_id || null,
      })
    } else {
      setPosMode(orderMode)
      usePosStore.setState({
        cart: order.cart || [],
        total: Number(order.total) || 0,
        customerId: order.customer_id || null,
        customerName: order.customer_name || null,
        customerTaxId: order.customer_tax_id || null,
      })
    }

    onClose()
  }

  const handleDeleteOrder = (order: TableOrder, e: React.MouseEvent) => {
    e.stopPropagation()
    const targetId = order.table_id || order.id
    if (confirm('¿Estás seguro de liberar/cancelar la cuenta ' + (order.tab_name || order.table_name || 'Cuenta') + '?')) {
      deleteOrderMutation.mutate(targetId)
    }
  }

  const getModeIcon = (mode?: string) => {
    switch (mode) {
      case 'tables':
        return <Utensils className="w-3.5 h-3.5" />
      case 'bar':
        return <Wine className="w-3.5 h-3.5" />
      case 'delivery':
        return <Truck className="w-3.5 h-3.5" />
      case 'pickup':
        return <Package className="w-3.5 h-3.5" />
      case 'takeout':
      default:
        return <ShoppingBag className="w-3.5 h-3.5" />
    }
  }

  const getModeLabel = (mode?: string) => {
    switch (mode) {
      case 'tables':
        return 'Mesa'
      case 'bar':
        return 'Barra'
      case 'delivery':
        return 'Delivery'
      case 'pickup':
        return 'Pick-up'
      case 'takeout':
      default:
        return 'Para Llevar'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[88vh] flex flex-col bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="shrink-0 p-5 bg-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-primary">Cuentas Abiertas en la Sede</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {activeOrders.length} activas
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Accede, continúa o cobra comandas abiertas desde cualquier terminal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="p-2 rounded-xl border border-border hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-all cursor-pointer"
              title="Actualizar cuentas"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin text-primary' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-border hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="shrink-0 px-5 pt-3 pb-3 bg-surface border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Todas', count: activeOrders.length },
              { id: 'tables', label: 'Mesas', count: activeOrders.filter((o) => (o.mode || (o.table_id ? 'tables' : 'takeout')) === 'tables').length },
              { id: 'bar', label: 'Barra', count: activeOrders.filter((o) => o.mode === 'bar').length },
              { id: 'takeout', label: 'Para Llevar', count: activeOrders.filter((o) => o.mode === 'takeout').length },
              { id: 'delivery', label: 'Delivery', count: activeOrders.filter((o) => o.mode === 'delivery').length },
              { id: 'pickup', label: 'Pick-up', count: activeOrders.filter((o) => o.mode === 'pickup').length },
            ].map((tab) => {
              const isSelected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-primary text-text-inverse shadow-xs'
                      : 'bg-surface-raised border border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1 rounded-full font-mono ${isSelected ? 'bg-black/20' : 'bg-surface'}`}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
            <input
              type="text"
              placeholder="Buscar comanda, mesa o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-xl bg-surface-raised border border-border focus:border-primary focus:outline-hidden text-text-primary placeholder:text-text-secondary/50"
            />
          </div>
        </div>

        {/* Orders List Area */}
        <div className="flex-1 overflow-y-auto p-5 bg-bg space-y-3">
          {isLoading && openOrders.length === 0 ? (
            <div className="py-16 text-center text-xs text-text-secondary flex flex-col items-center justify-center">
              <RefreshCw className="w-6 h-6 text-primary animate-spin mb-2" />
              <span>Consultando comandas abiertas...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-text-secondary flex flex-col items-center justify-center bg-surface border border-dashed border-border rounded-3xl">
              <Receipt className="w-8 h-8 opacity-40 mb-2 text-primary" />
              <p className="text-sm font-bold text-text-primary">No hay cuentas abiertas</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {searchTerm ? 'No se encontraron comandas con ese término de búsqueda' : 'Todas las comandas de la sede han sido cobradas o cerradas'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredOrders.map((order) => {
                const totalItems = (order.cart || []).reduce((acc: number, item: any) => acc + (item.quantity || 0), 0)
                const title = order.table_name || order.tab_name || 'Comanda Abierta'
                const mode = order.mode || (order.table_id ? 'tables' : 'takeout')

                return (
                  <div
                    key={order.id}
                    onClick={() => handleOpenOrder(order)}
                    className="p-4 rounded-2xl bg-surface border border-border hover:border-primary/60 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between gap-3 group relative overflow-hidden active:scale-[0.99]"
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                          {getModeIcon(mode)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-text-primary group-hover:text-primary transition-colors">
                              {title}
                            </h4>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-surface-raised border border-border text-text-secondary font-medium">
                              {getModeLabel(mode)}
                            </span>
                            {order.payment_pending && (
                              <span className="text-[9px] px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/40 text-rose-500 font-black tracking-wide uppercase animate-pulse">
                                💳 Pendiente de Pago
                              </span>
                            )}
                          </div>
                          {order.customer_name && (
                            <p className="text-xs text-text-secondary flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3 text-text-secondary/70" />
                              <span className="font-medium text-text-primary">{order.customer_name}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Total Amount Badge */}
                      <div className="text-right shrink-0">
                        <span className="text-sm font-mono font-black text-primary">
                          ${Number(order.total || 0).toFixed(2)}
                        </span>
                        <p className="text-[10px] text-text-secondary font-medium">{totalItems} {totalItems === 1 ? 'ítem' : 'ítems'}</p>
                      </div>
                    </div>

                    {/* Cart Items Preview */}
                    <div className="flex flex-wrap gap-1.5 max-h-14 overflow-hidden">
                      {(order.cart || []).slice(0, 4).map((item: any, idx: number) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2 py-0.5 rounded-lg bg-surface-raised border border-border/80 text-text-secondary"
                        >
                          {item.quantity}x {item.name}
                        </span>
                      ))}
                      {(order.cart || []).length > 4 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md text-text-secondary/70 font-mono">
                          +{order.cart.length - 4} más...
                        </span>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-text-secondary">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Clock className="w-3 h-3 text-text-secondary/70" />
                        <span>
                          {order.updated_at ? new Date(order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteOrder(order, e)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-text-secondary hover:text-rose-500 transition-colors"
                          title="Liberar cuenta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenOrder(order)
                            usePosStore.getState().setShowCheckout(true)
                          }}
                          className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-text-inverse text-[11px] font-bold transition-all cursor-pointer shadow-xs"
                        >
                          Cobrar
                        </button>
                        <span className="text-xs font-bold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          <span>Atender</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 px-6 py-3 bg-surface border-t border-border flex items-center justify-between text-xs text-text-secondary">
          <span>Las órdenes se sincronizan automáticamente entre todas las cajas y comandas de la sede.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-border hover:bg-surface-raised font-bold text-text-primary cursor-pointer transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
