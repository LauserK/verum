import { describe, it, expect, beforeEach } from 'vitest'
import { usePosStore } from './posStore'

describe('usePosStore', () => {
  beforeEach(() => {
    usePosStore.getState().clearCart()
    usePosStore.setState({
      posMode: 'tables',
      activeTableId: null,
      activeTableName: null,
      searchQuery: '',
      selectedCategoryId: 'all',
      activeSeatId: null,
      cartsByContext: {},
    })
  })

  it('initializes with default values', () => {
    const state = usePosStore.getState()
    expect(state.cart).toEqual([])
    expect(state.total).toBe(0)
    expect(state.posMode).toBe('tables')
    expect(state.activeTableId).toBeNull()
    expect(state.activeTableName).toBeNull()
    expect(state.activeSeatId).toBeNull()
  })

  it('adds new item and calculates total', () => {
    const { addItem } = usePosStore.getState()
    addItem({ id: 'p1', name: 'Burger', price: 10.5, category_id: 'cat1' })

    const state = usePosStore.getState()
    expect(state.cart.length).toBe(1)
    expect(state.cart[0].name).toBe('Burger')
    expect(state.cart[0].quantity).toBe(1)
    expect(state.cart[0].cartItemId).toBeDefined()
    expect(state.total).toBe(10.5)
  })

  it('increments quantity when adding existing item', () => {
    const { addItem } = usePosStore.getState()
    addItem({ id: 'p1', name: 'Burger', price: 10.5 })
    addItem({ id: 'p1', name: 'Burger', price: 10.5 })

    const state = usePosStore.getState()
    expect(state.cart.length).toBe(1)
    expect(state.cart[0].quantity).toBe(2)
    expect(state.total).toBe(21)
  })

  it('updates quantity and removes item if qty <= 0', () => {
    const { addItem, updateQuantity } = usePosStore.getState()
    addItem({ id: 'p1', name: 'Burger', price: 10 })
    const cartItemId = usePosStore.getState().cart[0].cartItemId

    updateQuantity(cartItemId, 3)
    expect(usePosStore.getState().cart[0].quantity).toBe(3)
    expect(usePosStore.getState().total).toBe(30)

    updateQuantity(cartItemId, 0)
    expect(usePosStore.getState().cart.length).toBe(0)
    expect(usePosStore.getState().total).toBe(0)
  })

  it('removes item by cartItemId', () => {
    const { addItem, removeItem } = usePosStore.getState()
    addItem({ id: 'p1', name: 'Burger', price: 10 })
    addItem({ id: 'p2', name: 'Fries', price: 5 })

    expect(usePosStore.getState().total).toBe(15)
    const cartItemId = usePosStore.getState().cart[0].cartItemId
    removeItem(cartItemId)

    const state = usePosStore.getState()
    expect(state.cart.length).toBe(1)
    expect(state.cart[0].id).toBe('p2')
    expect(state.total).toBe(5)
  })

  it('updates mode and active table', () => {
    const { setPosMode, setActiveTable, setSearchQuery, setSelectedCategory } = usePosStore.getState()

    setPosMode('takeout')
    expect(usePosStore.getState().posMode).toBe('takeout')

    setActiveTable('tbl-1', 'Table 1')
    expect(usePosStore.getState().activeTableId).toBe('tbl-1')
    expect(usePosStore.getState().activeTableName).toBe('Table 1')

    setSearchQuery('coke')
    expect(usePosStore.getState().searchQuery).toBe('coke')

    setSelectedCategory('drinks')
    expect(usePosStore.getState().selectedCategoryId).toBe('drinks')
  })

  it('isolates tables but preserves direct counter order across bar, takeout, pickup, delivery', () => {
    const { setActiveTable, addItem, setPosMode } = usePosStore.getState()

    // 1. Select Mesa 1 and add 2 items
    setActiveTable('table-1', 'Mesa 1')
    addItem({ id: 'burger', name: 'Burger', price: 10 })
    addItem({ id: 'soda', name: 'Soda', price: 2 })
    expect(usePosStore.getState().cart.length).toBe(2)
    expect(usePosStore.getState().total).toBe(12)

    // 2. Click "Cambiar mesa" (unselect table) -> active cart is empty on table map
    setActiveTable(null, null)
    expect(usePosStore.getState().activeTableId).toBeNull()
    expect(usePosStore.getState().cart).toEqual([])
    expect(usePosStore.getState().total).toBe(0)

    // 3. Switch to Bar mode -> empty cart for new direct order
    setPosMode('bar')
    expect(usePosStore.getState().posMode).toBe('bar')
    expect(usePosStore.getState().cart).toEqual([])
    addItem({ id: 'beer', name: 'Beer', price: 6 })
    addItem({ id: 'peanuts', name: 'Peanuts', price: 4 })
    expect(usePosStore.getState().cart.length).toBe(2)
    expect(usePosStore.getState().total).toBe(10)

    // 4. Switch from Bar to Takeout -> cart is preserved!
    setPosMode('takeout')
    expect(usePosStore.getState().posMode).toBe('takeout')
    expect(usePosStore.getState().cart.length).toBe(2)
    expect(usePosStore.getState().total).toBe(10)

    // 5. Switch from Takeout to Pick-up -> cart is preserved!
    setPosMode('pickup')
    expect(usePosStore.getState().posMode).toBe('pickup')
    expect(usePosStore.getState().cart.length).toBe(2)
    expect(usePosStore.getState().total).toBe(10)

    // 6. Select Mesa 2 -> Mesa 2 is clean ($0)
    setPosMode('tables')
    setActiveTable('table-2', 'Mesa 2')
    expect(usePosStore.getState().cart).toEqual([])
    expect(usePosStore.getState().total).toBe(0)

    // 7. Switch back to Mesa 1 -> restores Mesa 1's 2 items ($12)
    setActiveTable('table-1', 'Mesa 1')
    expect(usePosStore.getState().cart.length).toBe(2)
    expect(usePosStore.getState().total).toBe(12)

    // 8. Switch back to Bar/Takeout -> restores the 2 items ($10)
    setPosMode('bar')
    expect(usePosStore.getState().cart.length).toBe(2)
    expect(usePosStore.getState().cart[0].name).toBe('Beer')
    expect(usePosStore.getState().total).toBe(10)
  })

  describe('Seats management (M4)', () => {
    it('initializes table with default seat-1 and selects it as activeSeatId', () => {
      const { setActiveTable } = usePosStore.getState()
      setActiveTable('table-10', 'Mesa 10')

      const state = usePosStore.getState()
      expect(state.activeSeatId).toBe('seat-1')
      const ctx = state.cartsByContext['table:table-10']
      expect(ctx?.seats).toEqual([{ id: 'seat-1', label: 'Asiento 1' }])
    })

    it('adds new seats and assigns them as activeSeatId', () => {
      const { setActiveTable, addSeat } = usePosStore.getState()
      setActiveTable('table-10', 'Mesa 10')

      addSeat('Pedro')
      let state = usePosStore.getState()
      let ctx = state.cartsByContext['table:table-10']
      expect(ctx?.seats?.length).toBe(2)
      expect(ctx?.seats?.[1].label).toBe('Pedro')
      expect(state.activeSeatId).toBe(ctx?.seats?.[1].id)

      addSeat()
      state = usePosStore.getState()
      ctx = state.cartsByContext['table:table-10']
      expect(ctx?.seats?.length).toBe(3)
      expect(ctx?.seats?.[2].label).toBe('Asiento 3')
      expect(state.activeSeatId).toBe(ctx?.seats?.[2].id)
    })

    it('renames a seat', () => {
      const { setActiveTable, renameSeat } = usePosStore.getState()
      setActiveTable('table-10', 'Mesa 10')

      renameSeat('seat-1', 'Carlos')
      const ctx = usePosStore.getState().cartsByContext['table:table-10']
      expect(ctx?.seats?.[0].label).toBe('Carlos')
    })

    it('removes a seat and reassigns orphan items to fallback seat', () => {
      const { setActiveTable, addSeat, addItem, removeSeat } = usePosStore.getState()
      setActiveTable('table-10', 'Mesa 10')
      addSeat('Maria')

      const state = usePosStore.getState()
      const seat2Id = state.activeSeatId!

      // Add item to seat 2 (Maria)
      addItem({ id: 'pasta', name: 'Pasta', price: 15 })
      expect(usePosStore.getState().cart[0].seat).toBe(seat2Id)

      // Remove seat 2
      removeSeat(seat2Id)
      const afterState = usePosStore.getState()
      const ctx = afterState.cartsByContext['table:table-10']

      expect(ctx?.seats?.length).toBe(1)
      expect(ctx?.seats?.[0].id).toBe('seat-1')
      // Item moved to seat-1
      expect(afterState.cart[0].seat).toBe('seat-1')
      expect(afterState.activeSeatId).toBe('seat-1')
    })

    it('assigns items to activeSeatId in tables mode', () => {
      const { setActiveTable, addSeat, setActiveSeat, addItem } = usePosStore.getState()
      setActiveTable('table-10', 'Mesa 10')

      // In seat-1
      addItem({ id: 'burger', name: 'Burger', price: 10 })
      expect(usePosStore.getState().cart[0].seat).toBe('seat-1')

      // Add seat-2 and add item
      addSeat('Pedro')
      const seat2Id = usePosStore.getState().activeSeatId!
      addItem({ id: 'fries', name: 'Fries', price: 5 })
      expect(usePosStore.getState().cart[1].seat).toBe(seat2Id)

      // When activeSeatId is 'all', assigns to last seat
      setActiveSeat('all')
      addItem({ id: 'soda', name: 'Soda', price: 2 })
      expect(usePosStore.getState().cart[2].seat).toBe(seat2Id)
    })

    it('allows moving an item to another seat', () => {
      const { setActiveTable, addSeat, addItem, moveItemToSeat } = usePosStore.getState()
      setActiveTable('table-10', 'Mesa 10')
      addSeat('Pedro')
      const seat2Id = usePosStore.getState().activeSeatId!

      addItem({ id: 'burger', name: 'Burger', price: 10 })
      const cartItemId = usePosStore.getState().cart[0].cartItemId
      expect(usePosStore.getState().cart[0].seat).toBe(seat2Id)

      moveItemToSeat(cartItemId, 'seat-1')
      expect(usePosStore.getState().cart[0].seat).toBe('seat-1')
    })
  })
})


