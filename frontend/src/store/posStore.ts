import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartItem {
  cartItemId: string
  id: string
  name: string
  price: number
  quantity: number
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
  customerId: string | null
  customerName: string | null
  customerTaxId: string | null
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
  showCheckout: boolean
  showCustomerSelector: boolean
  cartsByContext: Record<string, PosCartContext>

  setPosMode: (mode: PosMode) => void
  setActiveTable: (id: string | null, name?: string | null) => void
  loadTableOrder: (id: string, name: string, data: PosCartContext) => void
  setActiveWorkstation: (id: string | null, name?: string | null) => void
  setSessionOpening: (balance: number, currency: string, sessionId?: string | null) => void
  setSearchQuery: (query: string) => void
  setSelectedCategory: (catId: string) => void
  setCustomer: (id: string | null, name: string | null, taxId?: string | null) => void
  clearCustomer: () => void
  setShowCheckout: (show: boolean) => void
  setShowCustomerSelector: (show: boolean) => void
  addItem: (item: {
    id: string
    name: string
    price: number
    category_id?: string
    tax_id?: string | null
    tax_rate?: number | null
    tax_included?: boolean
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
      showCheckout: false,
      showCustomerSelector: false,
      cartsByContext: {},

      setPosMode: (mode: PosMode) => {
        set((state) => {
          if (state.posMode === mode) return state

          // 1. Save current active cart into previous context
          const prevKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (prevKey !== 'tables:map') {
            updatedCarts[prevKey] = {
              cart: state.cart,
              total: state.total,
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
          }
        })
      },

      setActiveTable: (id: string | null, name?: string | null) => {
        set((state) => {
          // 1. Save current active table cart
          const prevKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (prevKey !== 'tables:map') {
            updatedCarts[prevKey] = {
              cart: state.cart,
              total: state.total,
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

          return {
            activeTableId: id,
            activeTableName: name ?? null,
            cartsByContext: updatedCarts,
            cart: existing.cart,
            total: existing.total,
            customerId: existing.customerId,
            customerName: existing.customerName,
            customerTaxId: existing.customerTaxId,
          }
        })
      },

      loadTableOrder: (id: string, name: string, data: PosCartContext) => {
        set((state) => {
          const currentKey = `table:${id}`
          const updatedCarts = { ...state.cartsByContext, [currentKey]: data }
          return {
            posMode: 'tables',
            activeTableId: id,
            activeTableName: name,
            cartsByContext: updatedCarts,
            cart: data.cart || [],
            total: data.total || 0,
            customerId: data.customerId || null,
            customerName: data.customerName || null,
            customerTaxId: data.customerTaxId || null,
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

      setShowCheckout: (show: boolean) => set({ showCheckout: show }),

      setShowCustomerSelector: (show: boolean) => set({ showCustomerSelector: show }),

      addItem: (item: {
        id: string
        name: string
        price: number
        category_id?: string
        tax_id?: string | null
        tax_rate?: number | null
        tax_included?: boolean
      }) => {
        const cleanPrice = typeof item.price === 'number' && !isNaN(item.price) ? item.price : parseFloat(item.price as any) || 0

        set((state) => {
          const existingIndex = state.cart.findIndex((i) => i.id === item.id)
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
              category_id: item.category_id,
              tax_id: item.tax_id ?? null,
              tax_rate: item.tax_rate ?? null,
              tax_included: item.tax_included ?? true,
            }
            newCart = [...state.cart, newItem]
          }

          const newTotal = calculateTotal(newCart)
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (currentKey !== 'tables:map') {
            updatedCarts[currentKey] = {
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

      removeItem: (cartItemId: string) => {
        set((state) => {
          const newCart = state.cart.filter((item) => item.cartItemId !== cartItemId)
          const newTotal = calculateTotal(newCart)
          const currentKey = getContextKey(state.posMode, state.activeTableId)
          const updatedCarts = { ...state.cartsByContext }
          if (currentKey !== 'tables:map') {
            updatedCarts[currentKey] = {
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
            updatedCarts[currentKey] = {
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
        cartsByContext: state.cartsByContext,
      }),
    }
  )
)
