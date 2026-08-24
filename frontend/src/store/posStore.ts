import { create } from 'zustand'

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
  setPosMode: (mode: PosMode) => void
  setActiveTable: (id: string | null, name?: string | null) => void
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

export const usePosStore = create<PosState>((set) => ({
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

  setPosMode: (mode: PosMode) => set({ posMode: mode }),

  setActiveTable: (id: string | null, name?: string | null) =>
    set({ activeTableId: id, activeTableName: name ?? null }),

  setActiveWorkstation: (id: string | null, name?: string | null) =>
    set({ activeWorkstationId: id, activeWorkstationName: name ?? null }),

  setSessionOpening: (balance: number, currency: string, sessionId?: string | null) =>
    set({ openingBalance: balance, openingCurrency: currency, activeSessionId: sessionId ?? null }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setSelectedCategory: (catId: string) => set({ selectedCategoryId: catId }),

  setCustomer: (id: string | null, name: string | null, taxId?: string | null) =>
    set({ customerId: id, customerName: name, customerTaxId: taxId ?? null }),

  clearCustomer: () =>
    set({ customerId: null, customerName: null, customerTaxId: null }),

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

      return {
        cart: newCart,
        total: calculateTotal(newCart),
      }
    })
  },

  removeItem: (cartItemId: string) => {
    set((state) => {
      const newCart = state.cart.filter((item) => item.cartItemId !== cartItemId)
      return {
        cart: newCart,
        total: calculateTotal(newCart),
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
      return {
        cart: newCart,
        total: calculateTotal(newCart),
      }
    })
  },

  clearCart: () => {
    set({
      cart: [],
      total: 0,
    })
  },
}))
