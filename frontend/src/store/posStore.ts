import { create } from 'zustand'

export interface CartItem {
  cartItemId: string
  id: string
  name: string
  price: number
  quantity: number
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
  setPosMode: (mode: PosMode) => void
  setActiveTable: (id: string | null, name?: string | null) => void
  setActiveWorkstation: (id: string | null, name?: string | null) => void
  setSessionOpening: (balance: number, currency: string, sessionId?: string | null) => void
  setSearchQuery: (query: string) => void
  setSelectedCategory: (catId: string) => void
  addItem: (item: { id: string; name: string; price: number; category_id?: string }) => void
  removeItem: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, qty: number) => void
  clearCart: () => void
}

const calculateTotal = (cart: CartItem[]): number => {
  const sum = cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
  return Math.round(sum * 100) / 100
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

  setPosMode: (mode: PosMode) => set({ posMode: mode }),

  setActiveTable: (id: string | null, name?: string | null) =>
    set({ activeTableId: id, activeTableName: name ?? null }),

  setActiveWorkstation: (id: string | null, name?: string | null) =>
    set({ activeWorkstationId: id, activeWorkstationName: name ?? null }),

  setSessionOpening: (balance: number, currency: string, sessionId?: string | null) =>
    set({ openingBalance: balance, openingCurrency: currency, activeSessionId: sessionId ?? null }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setSelectedCategory: (catId: string) => set({ selectedCategoryId: catId }),

  addItem: (item: { id: string; name: string; price: number; category_id?: string }) => {
    set((state) => {
      const existingIndex = state.cart.findIndex((i) => i.id === item.id)
      let newCart: CartItem[]

      if (existingIndex > -1) {
        newCart = state.cart.map((cartItem, idx) =>
          idx === existingIndex
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      } else {
        const newItem: CartItem = {
          cartItemId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          category_id: item.category_id,
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
