import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Seat {
  id: string
  label: string
}

export interface CartItem {
  cartItemId: string
  id: string
  name: string
  price: number
  quantity: number
  seat?: string | null
  sentToKitchen?: boolean
  tax_id?: string | null
  tax_rate?: number | null
  tax_included?: boolean
  notes?: string
  category_id?: string
}

export type PosMode = 'tables' | 'takeout' | 'delivery' | 'pickup' | 'bar'

export interface PosCartContext {
  cart: CartItem[]
  total: number
  seats?: Seat[]
  customerId: string | null
  customerName: string | null
  customerTaxId: string | null
  customName?: string | null
  assignedTo?: string | null
  assignedToName?: string | null
  guestsCount?: number | null
  isOpen?: boolean
  openedAt?: string | null
  deliveryZoneId?: string | null
  deliveryZoneName?: string | null
  deliveryCost?: number
  deliveryAddress?: string | null
  deliveryNotes?: string | null
}

export interface PosState {
  cart: CartItem[]
  total: number
  posMode: PosMode
  activeTableId?: string | null
  activeTableName?: string | null
  activeWorkstationId?: string | null
  activeWorkstationName?: string | null
  activeSessionId?: string | null
  openingBalance: number
  openingCurrency: string
  orderNumber: number
  searchQuery: string
  selectedCategoryId: string
  customerId: string | null
  customerName: string | null
  customerTaxId: string | null
  customName?: string | null
  assignedTo?: string | null
  assignedToName?: string | null
  guestsCount?: number | null
  deliveryZoneId: string | null
  deliveryZoneName: string | null
  deliveryCost: number
  deliveryAddress: string | null
  deliveryNotes: string | null
  showCheckout: boolean
  showCustomerSelector: boolean
  cartsByContext: Record<string, PosCartContext>
  activeSeatId: string | null

  setPosMode: (mode: PosMode) => void
  setActiveTable: (id: string | null, name?: string | null) => void
  openTableOrder: (
    id: string,
    name: string,
    options?: {
      customName?: string | null
      customerId?: string | null
      customerName?: string | null
      customerTaxId?: string | null
      assignedTo?: string | null
      assignedToName?: string | null
      guestsCount?: number | null
    }
  ) => void
  loadTableOrder: (id: string, name: string, data: PosCartContext) => void
  setActiveWorkstation: (id: string | null, name?: string | null) => void
  setSessionOpening: (balance: number, currency: string, sessionId?: string | null) => void
  setSearchQuery: (query: string) => void
  setSelectedCategory: (catId: string) => void
  setCustomer: (id: string | null, name: string | null, taxId?: string | null) => void
  clearCustomer: () => void
  setDeliveryZone: (zoneId: string | null, zoneName: string | null, cost: number) => void
  setDeliveryInfo: (info: { address?: string | null; notes?: string | null }) => void
  clearDelivery: () => void
  setShowCheckout: (show: boolean) => void
  setShowCustomerSelector: (show: boolean) => void
  setActiveSeat: (seatId: string | null) => void
  addSeat: (label?: string) => void
  removeSeat: (seatId: string) => void
  renameSeat: (seatId: string, label: string) => void
  moveItemToSeat: (cartItemId: string, targetSeatId: string | null) => void
  addItem: (item: {
    id: string
    name: string
    price: number
    category_id?: string
    tax_id?: string | null
    tax_rate?: number | null
    tax_included?: boolean
    seat?: string | null
    sentToKitchen?: boolean
  }) => void
  removeItem: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, qty: number) => void
  clearCart: () => void
}

const calculateTotal = (cart: CartItem[]): number => {
  const sum = cart.reduce((acc, item) => {
    const p = typeof item.price === 'number' ? item.price : parseFloat(item.price as any) || 0
    const q = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity as any) || 0
    return acc + (isNaN(p) ? 0 : p) * (isNaN(q) ? 0 : q)
  }, 0)
  return isNaN(sum) ? 0 : Math.round(sum * 100) / 100
}

const getContextKey = (posMode: PosMode, activeTableId?: string | null): string => {
  if (posMode === 'tables') {
    return activeTableId ? `table:${activeTableId}` : 'tables:map'
  }
  // All direct counter modes (bar, takeout, pickup, delivery) share the active direct counter order
  return 'direct:counter'
}

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      cart: [],
      total: 0,
      posMode: 'tables',
      activeTableId: null,
      activeTableName: null,
      activeWorkstationId: null,
      activeWorkstationName: null,
      activeSessionId: null,
      openingBalance: 0,
      openingCurrency: 'USD',
      orderNumber: 1,
      searchQuery: '',
      selectedCategoryId: 'all',
      customerId: null,
      customerName: null,
      customerTaxId: null,
      deliveryZoneId: null,
      deliveryZoneName: null,
      deliveryCost: 0,
      deliveryAddress: null,
      deliveryNotes: null,
      showCheckout: false,
      showCustomerSelector: false,
      cartsByContext: {},
      activeSeatId: null,

      setPosMode: (mode: PosMode) => {
        set((state) => {
          if (state.posMode === mode) return state

          // 1. Save current active cart into previous context
          const prevKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (prevKey !== 'tables:map') {
            const prevCtx = updatedCarts[prevKey]
            updatedCarts[prevKey] = {
              cart: state.cart,
              total: state.total,
              seats: prevCtx?.seats,
              customerId: state.customerId,
              customerName: state.customerName,
              customerTaxId: state.customerTaxId,
            }
          }

          // 2. Next context
          const nextTableId = mode === 'tables' ? state.activeTableId : null
          const nextTableName = mode === 'tables' ? state.activeTableName : null
          const nextKey = getContextKey(mode, nextTableId)

          let nextCtx: PosCartContext = {
            cart: [],
            total: 0,
            customerId: null,
            customerName: null,
            customerTaxId: null,
          }

          if (nextKey !== 'tables:map' && updatedCarts[nextKey]) {
            nextCtx = updatedCarts[nextKey]
          }

          let nextActiveSeatId: string | null = null
          if (mode === 'tables' && nextTableId) {
            const tableSeats = nextCtx.seats && nextCtx.seats.length > 0
              ? nextCtx.seats
              : []
            nextCtx = { ...nextCtx, seats: tableSeats }
            updatedCarts[nextKey] = nextCtx
            nextActiveSeatId = tableSeats.length > 0 ? tableSeats[0].id : null
          }

          return {
            posMode: mode,
            activeTableId: nextTableId,
            activeTableName: nextTableName,
            cartsByContext: updatedCarts,
            cart: nextCtx.cart,
            total: nextCtx.total,
            customerId: nextCtx.customerId,
            customerName: nextCtx.customerName,
            customerTaxId: nextCtx.customerTaxId,
            activeSeatId: nextActiveSeatId,
          }
        })
      },

      setActiveTable: (id: string | null, name?: string | null) => {
        set((state) => {
          // 1. Save current active table cart
          const prevKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (prevKey !== 'tables:map') {
            const prevCtx = updatedCarts[prevKey]
            updatedCarts[prevKey] = {
              cart: state.cart,
              total: state.total,
              seats: prevCtx?.seats,
              customerId: state.customerId,
              customerName: state.customerName,
              customerTaxId: state.customerTaxId,
            }
          }

          // 2. If unselecting table (going back to map)
          if (!id) {
            return {
              activeTableId: null,
              activeTableName: null,
              cartsByContext: updatedCarts,
              cart: [],
              total: 0,
              customerId: null,
              customerName: null,
              customerTaxId: null,
              activeSeatId: null,
            }
          }

          // 3. Load or initialize selected table context
          const nextKey = `table:${id}`
          const existing = updatedCarts[nextKey] || {
            cart: [],
            total: 0,
            customerId: null,
            customerName: null,
            customerTaxId: null,
          }

          const tableSeats = existing.seats && existing.seats.length > 0
            ? existing.seats
            : []

          const initializedCtx: PosCartContext = {
            ...existing,
            seats: tableSeats,
          }
          updatedCarts[nextKey] = initializedCtx

          return {
            activeTableId: id,
            activeTableName: name ?? null,
            cartsByContext: updatedCarts,
            cart: initializedCtx.cart,
            total: initializedCtx.total,
            customerId: initializedCtx.customerId,
            customerName: initializedCtx.customerName,
            customerTaxId: initializedCtx.customerTaxId,
            activeSeatId: tableSeats.length > 0 ? tableSeats[0].id : null,
          }
        })
      },

      openTableOrder: (id: string, name: string, options = {}) => {
        set((state) => {
          // 1. Save previous active table if needed
          const prevKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (prevKey !== 'tables:map') {
            const prevCtx = updatedCarts[prevKey]
            updatedCarts[prevKey] = {
              cart: state.cart,
              total: state.total,
              seats: prevCtx?.seats,
              customerId: state.customerId,
              customerName: state.customerName,
              customerTaxId: state.customerTaxId,
              customName: prevCtx?.customName,
              assignedTo: prevCtx?.assignedTo,
              assignedToName: prevCtx?.assignedToName,
              guestsCount: prevCtx?.guestsCount,
              isOpen: prevCtx?.isOpen,
              openedAt: prevCtx?.openedAt,
            }
          }

          const currentKey = `table:${id}`
          const orderData: PosCartContext = {
            cart: [],
            total: 0,
            seats: [],
            customerId: options.customerId || null,
            customerName: options.customerName || null,
            customerTaxId: options.customerTaxId || null,
            customName: options.customName || null,
            assignedTo: options.assignedTo || null,
            assignedToName: options.assignedToName || null,
            guestsCount: options.guestsCount || null,
            isOpen: true,
            openedAt: new Date().toISOString(),
          }
          updatedCarts[currentKey] = orderData

          return {
            posMode: 'tables',
            activeTableId: id,
            activeTableName: options.customName || name,
            cartsByContext: updatedCarts,
            cart: [],
            total: 0,
            customerId: orderData.customerId,
            customerName: orderData.customerName,
            customerTaxId: orderData.customerTaxId,
            customName: orderData.customName,
            assignedTo: orderData.assignedTo,
            assignedToName: orderData.assignedToName,
            guestsCount: orderData.guestsCount,
            activeSeatId: null,
          }
        })
      },

      loadTableOrder: (id: string, name: string, data: PosCartContext) => {
        set((state) => {
          const currentKey = `table:${id}`
          const seats = data.seats && data.seats.length > 0
            ? data.seats
            : []
          const orderData: PosCartContext = {
            ...data,
            seats,
            isOpen: true,
          }
          const updatedCarts = { ...state.cartsByContext, [currentKey]: orderData }
          return {
            posMode: 'tables',
            activeTableId: id,
            activeTableName: data.customName || name,
            cartsByContext: updatedCarts,
            cart: orderData.cart || [],
            total: orderData.total || 0,
            customerId: orderData.customerId || null,
            customerName: orderData.customerName || null,
            customerTaxId: orderData.customerTaxId || null,
            customName: orderData.customName || null,
            assignedTo: orderData.assignedTo || null,
            assignedToName: orderData.assignedToName || null,
            guestsCount: orderData.guestsCount || null,
            activeSeatId: seats.length > 0 ? seats[0].id : null,
          }
        })
      },

      setActiveWorkstation: (id: string | null, name?: string | null) =>
        set({ activeWorkstationId: id, activeWorkstationName: name ?? null }),

      setSessionOpening: (balance: number, currency: string, sessionId?: string | null) =>
        set({ openingBalance: balance, openingCurrency: currency, activeSessionId: sessionId ?? null }),

      setSearchQuery: (query: string) => set({ searchQuery: query }),

      setSelectedCategory: (catId: string) => set({ selectedCategoryId: catId }),

      setCustomer: (id: string | null, name: string | null, taxId?: string | null) => {
        set((state) => {
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (currentKey !== 'tables:map') {
            updatedCarts[currentKey] = {
              ...(updatedCarts[currentKey] || { cart: state.cart, total: state.total }),
              customerId: id,
              customerName: name,
              customerTaxId: taxId ?? null,
            }
          }
          return {
            customerId: id,
            customerName: name,
            customerTaxId: taxId ?? null,
            cartsByContext: updatedCarts,
          }
        })
      },

      clearCustomer: () => {
        set((state) => {
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (currentKey !== 'tables:map') {
            updatedCarts[currentKey] = {
              ...(updatedCarts[currentKey] || { cart: state.cart, total: state.total }),
              customerId: null,
              customerName: null,
              customerTaxId: null,
            }
          }
          return {
            customerId: null,
            customerName: null,
            customerTaxId: null,
            cartsByContext: updatedCarts,
          }
        })
      },

      setDeliveryZone: (zoneId: string | null, zoneName: string | null, cost: number) => {
        set((state) => {
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (currentKey !== 'tables:map') {
            updatedCarts[currentKey] = {
              ...(updatedCarts[currentKey] || { cart: state.cart, total: state.total }),
              deliveryZoneId: zoneId,
              deliveryZoneName: zoneName,
              deliveryCost: cost,
            }
          }
          return {
            deliveryZoneId: zoneId,
            deliveryZoneName: zoneName,
            deliveryCost: cost,
            cartsByContext: updatedCarts,
          }
        })
      },

      setDeliveryInfo: (info: { address?: string | null; notes?: string | null }) => {
        set((state) => {
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          const newAddress = info.address !== undefined ? info.address : state.deliveryAddress
          const newNotes = info.notes !== undefined ? info.notes : state.deliveryNotes

          if (currentKey !== 'tables:map') {
            updatedCarts[currentKey] = {
              ...(updatedCarts[currentKey] || { cart: state.cart, total: state.total }),
              deliveryAddress: newAddress,
              deliveryNotes: newNotes,
            }
          }
          return {
            deliveryAddress: newAddress,
            deliveryNotes: newNotes,
            cartsByContext: updatedCarts,
          }
        })
      },

      clearDelivery: () => {
        set((state) => {
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (currentKey !== 'tables:map') {
            updatedCarts[currentKey] = {
              ...(updatedCarts[currentKey] || { cart: state.cart, total: state.total }),
              deliveryZoneId: null,
              deliveryZoneName: null,
              deliveryCost: 0,
              deliveryAddress: null,
              deliveryNotes: null,
            }
          }
          return {
            deliveryZoneId: null,
            deliveryZoneName: null,
            deliveryCost: 0,
            deliveryAddress: null,
            deliveryNotes: null,
            cartsByContext: updatedCarts,
          }
        })
      },

      setShowCheckout: (show: boolean) => set({ showCheckout: show }),

      setShowCustomerSelector: (show: boolean) => set({ showCustomerSelector: show }),

      setActiveSeat: (seatId: string | null) => set({ activeSeatId: seatId }),

      addSeat: (label?: string) => {
        set((state) => {
          const currentKey = state.posMode === 'tables' && state.activeTableId ? `table:${state.activeTableId}` : 'tables:map'
          if (currentKey === 'tables:map') return state

          const ctx = state.cartsByContext[currentKey] || {
            cart: state.cart,
            total: state.total,
            customerId: state.customerId,
            customerName: state.customerName,
            customerTaxId: state.customerTaxId,
            seats: [],
          }
          const currentSeats = ctx.seats || []
          const nextIndex = currentSeats.length + 1
          const newSeatId = `seat-${Date.now()}-${Math.floor(Math.random() * 1000)}`
          const newSeat: Seat = {
            id: newSeatId,
            label: label?.trim() ? label.trim() : `Asiento ${nextIndex}`,
          }
          const updatedSeats = [...currentSeats, newSeat]
          const updatedCarts = {
            ...state.cartsByContext,
            [currentKey]: {
              ...ctx,
              seats: updatedSeats,
            },
          }

          return {
            cartsByContext: updatedCarts,
            activeSeatId: newSeatId,
          }
        })
      },

      removeSeat: (seatId: string) => {
        set((state) => {
          const currentKey = state.posMode === 'tables' && state.activeTableId ? `table:${state.activeTableId}` : 'tables:map'
          if (currentKey === 'tables:map') return state

          const ctx = state.cartsByContext[currentKey] || {
            cart: state.cart,
            total: state.total,
            customerId: state.customerId,
            customerName: state.customerName,
            customerTaxId: state.customerTaxId,
            seats: [],
          }
          const currentSeats = ctx.seats || []
          const updatedSeats = currentSeats.filter((s) => s.id !== seatId)
          const fallbackSeatId = updatedSeats.length > 0 ? updatedSeats[0].id : null

          // Reassign orphan items that had the removed seat to the first available seat (or null)
          const updatedCart = (ctx.cart || state.cart).map((item) =>
            item.seat === seatId ? { ...item, seat: fallbackSeatId } : item
          )

          let nextActiveSeatId = state.activeSeatId
          if (state.activeSeatId === seatId) {
            nextActiveSeatId = fallbackSeatId
          }

          const updatedCarts = {
            ...state.cartsByContext,
            [currentKey]: {
              ...ctx,
              cart: updatedCart,
              seats: updatedSeats,
            },
          }

          return {
            cart: updatedCart,
            cartsByContext: updatedCarts,
            activeSeatId: nextActiveSeatId,
          }
        })
      },

      renameSeat: (seatId: string, label: string) => {
        set((state) => {
          const currentKey = state.posMode === 'tables' && state.activeTableId ? `table:${state.activeTableId}` : 'tables:map'
          if (currentKey === 'tables:map') return state

          const ctx = state.cartsByContext[currentKey] || {
            cart: state.cart,
            total: state.total,
            customerId: state.customerId,
            customerName: state.customerName,
            customerTaxId: state.customerTaxId,
            seats: [],
          }
          const currentSeats = ctx.seats || []
          const updatedSeats = currentSeats.map((s) =>
            s.id === seatId ? { ...s, label: label.trim() || s.label } : s
          )

          const updatedCarts = {
            ...state.cartsByContext,
            [currentKey]: {
              ...ctx,
              seats: updatedSeats,
            },
          }

          return {
            cartsByContext: updatedCarts,
          }
        })
      },

      moveItemToSeat: (cartItemId: string, targetSeatId: string | null) => {
        set((state) => {
          const updatedCart = state.cart.map((item) =>
            item.cartItemId === cartItemId ? { ...item, seat: targetSeatId } : item
          )
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (currentKey !== 'tables:map') {
            const ctx = updatedCarts[currentKey] || {
              cart: state.cart,
              total: state.total,
              customerId: state.customerId,
              customerName: state.customerName,
              customerTaxId: state.customerTaxId,
            }
            updatedCarts[currentKey] = {
              ...ctx,
              cart: updatedCart,
            }
          }

          return {
            cart: updatedCart,
            cartsByContext: updatedCarts,
          }
        })
      },

      addItem: (item: {
        id: string
        name: string
        price: number
        category_id?: string
        tax_id?: string | null
        tax_rate?: number | null
        tax_included?: boolean
        seat?: string | null
        sentToKitchen?: boolean
      }) => {
        const cleanPrice = typeof item.price === 'number' && !isNaN(item.price) ? item.price : parseFloat(item.price as any) || 0

        set((state) => {
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          let assignedSeatId: string | null = null
          let updatedSeats = state.cartsByContext[currentKey]?.seats

          if (state.posMode === 'tables') {
            if (item.seat !== undefined) {
              assignedSeatId = item.seat
            } else if (state.activeSeatId && state.activeSeatId !== 'all') {
              assignedSeatId = state.activeSeatId
            } else {
              // activeSeatId === 'all' or not explicitly set
              if (updatedSeats && updatedSeats.length > 0) {
                assignedSeatId = updatedSeats[updatedSeats.length - 1].id
              } else {
                assignedSeatId = null
              }
            }
          }

          // Match by id AND seat if in tables mode, or just id otherwise
          const existingIndex = state.cart.findIndex(
            (i) => i.id === item.id && (state.posMode !== 'tables' || i.seat === assignedSeatId)
          )
          let newCart: CartItem[]

          if (existingIndex > -1) {
            newCart = state.cart.map((cartItem, idx) =>
              idx === existingIndex
                ? { ...cartItem, quantity: (cartItem.quantity || 0) + 1 }
                : cartItem
            )
          } else {
            const newItem: CartItem = {
              cartItemId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
              id: item.id,
              name: item.name,
              price: cleanPrice,
              quantity: 1,
              seat: assignedSeatId,
              sentToKitchen: item.sentToKitchen ?? false,
              category_id: item.category_id,
              tax_id: item.tax_id ?? null,
              tax_rate: item.tax_rate ?? null,
              tax_included: item.tax_included ?? true,
            }
            newCart = [...state.cart, newItem]
          }

          const newTotal = calculateTotal(newCart)
          const updatedCarts = { ...state.cartsByContext }
          if (currentKey !== 'tables:map') {
            const existingCtx = updatedCarts[currentKey] || {
              cart: state.cart,
              total: state.total,
              customerId: state.customerId,
              customerName: state.customerName,
              customerTaxId: state.customerTaxId,
            }
            updatedCarts[currentKey] = {
              ...existingCtx,
              cart: newCart,
              total: newTotal,
              seats: updatedSeats || existingCtx.seats,
              customerId: state.customerId,
              customerName: state.customerName,
              customerTaxId: state.customerTaxId,
            }
          }

          return {
            cart: newCart,
            total: newTotal,
            cartsByContext: updatedCarts,
          }
        })
      },

      removeItem: (cartItemId: string) => {
        set((state) => {
          const newCart = state.cart.filter((item) => item.cartItemId !== cartItemId)
          const newTotal = calculateTotal(newCart)
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (currentKey !== 'tables:map') {
            const existingCtx = updatedCarts[currentKey]
            updatedCarts[currentKey] = {
              ...existingCtx,
              cart: newCart,
              total: newTotal,
              customerId: state.customerId,
              customerName: state.customerName,
              customerTaxId: state.customerTaxId,
            }
          }
          return {
            cart: newCart,
            total: newTotal,
            cartsByContext: updatedCarts,
          }
        })
      },

      updateQuantity: (cartItemId: string, qty: number) => {
        set((state) => {
          let newCart: CartItem[]
          if (qty <= 0) {
            newCart = state.cart.filter((item) => item.cartItemId !== cartItemId)
          } else {
            newCart = state.cart.map((item) =>
              item.cartItemId === cartItemId ? { ...item, quantity: qty } : item
            )
          }
          const newTotal = calculateTotal(newCart)
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (currentKey !== 'tables:map') {
            const existingCtx = updatedCarts[currentKey]
            updatedCarts[currentKey] = {
              ...existingCtx,
              cart: newCart,
              total: newTotal,
              customerId: state.customerId,
              customerName: state.customerName,
              customerTaxId: state.customerTaxId,
            }
          }
          return {
            cart: newCart,
            total: newTotal,
            cartsByContext: updatedCarts,
          }
        })
      },

      clearCart: () => {
        set((state) => {
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (currentKey !== 'tables:map') {
            delete updatedCarts[currentKey]
          }
          return {
            cart: [],
            total: 0,
            customerId: null,
            customerName: null,
            customerTaxId: null,
            activeSeatId: null,
            cartsByContext: updatedCarts,
          }
        })
      },
    }),
    {
      name: 'verum_pos_store',
      partialize: (state) => ({
        activeWorkstationId: state.activeWorkstationId,
        activeWorkstationName: state.activeWorkstationName,
        activeSessionId: state.activeSessionId,
        openingBalance: state.openingBalance,
        openingCurrency: state.openingCurrency,
        posMode: state.posMode,
        cart: state.cart,
        total: state.total,
        activeTableId: state.activeTableId,
        activeTableName: state.activeTableName,
        customerId: state.customerId,
        customerName: state.customerName,
        customerTaxId: state.customerTaxId,
        activeSeatId: state.activeSeatId,
        cartsByContext: state.cartsByContext,
      }),
    }
  )
)

