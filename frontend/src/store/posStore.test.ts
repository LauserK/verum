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
})
