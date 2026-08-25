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
    })
  })

  it('initializes with default values', () => {
    const state = usePosStore.getState()
    expect(state.cart).toEqual([])
    expect(state.total).toBe(0)
    expect(state.posMode).toBe('tables')
    expect(state.activeTableId).toBeNull()
    expect(state.activeTableName).toBeNull()
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
})

