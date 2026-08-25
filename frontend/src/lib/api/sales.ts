import { fetchWithAuth } from './core'

export interface Customer {
    id: string
    name: string
    tax_id?: string
    email?: string
    phone?: string
    address?: string
    notes?: string
    birth_date?: string
    social_media?: string
    credit_limit: number
    outstanding_balance: number
    is_active: boolean
    created_at: string
}

export interface Invoice {
    id: string
    document_number: string
    invoice_number?: string
    document_type?: string
    customer_id?: string
    customer_name?: string
    customer_tax_id?: string
    status: 'draft' | 'confirmed' | 'partial' | 'paid' | 'void' | 'refunded'
    subtotal: number
    discount_amount?: number
    total_tax?: number
    tax_total?: number
    total: number
    total_amount?: number
    amount_paid?: number
    balance_due?: number
    currency_code?: string
    currency?: string
    created_at: string
    date?: string
}

export interface InvoiceLineItem {
    sale_item_id?: string
    description: string
    quantity: number
    unit_price: number
    tax_id?: string
    tax_rate?: number
}

export interface CreateInvoicePayload {
    customer_id?: string
    currency?: string
    currency_code?: string
    document_type?: string
    lines?: InvoiceLineItem[]
    items?: InvoiceLineItem[]
}

export interface TenantBillingConfig {
    id?: string
    org_id?: string
    default_currency: string
    tax_rates?: Array<{ code: string; rate: number; label: string }>
    cash_rounding?: boolean
    cash_rounding_multiple?: number
    cash_rounding_rule?: 'nearest' | 'up' | 'down'
    created_at?: string
    updated_at?: string
}

export interface PaymentMethod {
    id: string
    org_id?: string
    name: string
    method_type: 'cash' | 'card' | 'bank_transfer' | 'mobile_payment' | 'digital_wallet' | 'crypto' | 'other'
    currency_code?: string | null
    instructions?: string
    is_active: boolean
    requires_reference?: boolean
    position?: number
    sync_to_quick?: boolean
    created_at?: string
}

export const salesApi = {
    // Customers
    getCustomers: () => fetchWithAuth<Customer[]>('/sales/customers'),
    getCustomer: (id: string) => fetchWithAuth<Customer>(`/sales/customers/${id}`),
    createCustomer: (data: Partial<Customer>) => fetchWithAuth<Customer>('/sales/customers', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateCustomer: (id: string, data: Partial<Customer>) => fetchWithAuth<Customer>(`/sales/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
    deleteCustomer: (id: string) => fetchWithAuth<void>(`/sales/customers/${id}`, {
        method: 'DELETE',
    }),

    // Invoices
    getInvoices: () => fetchWithAuth<Invoice[]>('/sales/invoices'),
    getInvoice: (id: string) => fetchWithAuth<Invoice>(`/sales/invoices/${id}`),
    createInvoice: (data: CreateInvoicePayload) => fetchWithAuth<Invoice>('/sales/invoices', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    confirmInvoice: (id: string, warehouseId?: string) => fetchWithAuth<{ status: string }>(`/sales/invoices/${id}/confirm${warehouseId ? `?warehouse_id=${warehouseId}` : ''}`, {
        method: 'POST',
    }),
    voidInvoice: (id: string, reason: string) => fetchWithAuth<{ status: string }>(`/sales/invoices/${id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    }),

    // Config
    getConfig: () => fetchWithAuth<TenantBillingConfig>('/sales/config'),
    updateConfig: (data: Partial<TenantBillingConfig>) => fetchWithAuth<TenantBillingConfig>('/sales/config', {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),

    // Payment Methods
    getPaymentMethods: () => fetchWithAuth<PaymentMethod[]>('/sales/payment-methods'),
    createPaymentMethod: (data: Partial<PaymentMethod>) => fetchWithAuth<PaymentMethod>('/sales/payment-methods', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updatePaymentMethod: (id: string, data: Partial<PaymentMethod>) => fetchWithAuth<PaymentMethod>(`/sales/payment-methods/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
    deletePaymentMethod: (id: string) => fetchWithAuth<{ status: string }>(`/sales/payment-methods/${id}`, {
        method: 'DELETE',
    }),

    // Currencies & Exchange Rates
    getCurrencies: () => fetchWithAuth<Currency[]>('/sales/currencies'),
    createCurrency: (data: Partial<Currency>) => fetchWithAuth<Currency>('/sales/currencies', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateCurrency: (id: string, data: Partial<Currency>) => fetchWithAuth<Currency>(`/sales/currencies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
    getExchangeRates: () => fetchWithAuth<ExchangeRate[]>('/sales/exchange-rates'),
    createExchangeRate: (data: Partial<ExchangeRate>) => fetchWithAuth<ExchangeRate>('/sales/exchange-rates', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    // Taxes / Alícuotas
    getTaxes: (activeOnly?: boolean) => fetchWithAuth<Tax[]>(activeOnly ? '/sales/taxes?active_only=true' : '/sales/taxes'),
    createTax: (data: Partial<Tax>) => fetchWithAuth<Tax>('/sales/taxes', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateTax: (id: string, data: Partial<Tax>) => fetchWithAuth<Tax>(`/sales/taxes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
    deleteTax: (id: string) => fetchWithAuth<{ message: string }>(`/sales/taxes/${id}`, {
        method: 'DELETE',
    }),

    // Catalog: Categories
    getSaleCategories: () => fetchWithAuth<SaleCategory[]>('/sales/categories'),
    createSaleCategory: (data: Partial<SaleCategory>) => fetchWithAuth<SaleCategory>('/sales/categories', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateSaleCategory: (id: string, data: Partial<SaleCategory>) => fetchWithAuth<SaleCategory>(`/sales/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),

    // Catalog: Items
    getSaleItems: (categoryId?: string, activeOnly?: boolean) => {
        const params = new URLSearchParams()
        if (categoryId) params.set('category_id', categoryId)
        if (activeOnly) params.set('active_only', 'true')
        const qs = params.toString()
        return fetchWithAuth<SaleItem[]>(`/sales/items${qs ? `?${qs}` : ''}`)
    },
    getSaleItem: (id: string) => fetchWithAuth<SaleItem>(`/sales/items/${id}`),
    createSaleItem: (data: Partial<SaleItem>) => fetchWithAuth<SaleItem>('/sales/items', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateSaleItem: (id: string, data: Partial<SaleItem>) => fetchWithAuth<SaleItem>(`/sales/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
    deleteSaleItem: (id: string) => fetchWithAuth<{ message: string }>(`/sales/items/${id}`, {
        method: 'DELETE',
    }),

    // Catalog: Modifier Groups
    getModifierGroups: () => fetchWithAuth<SaleModifierGroup[]>('/sales/modifier-groups'),
    createModifierGroup: (data: Partial<SaleModifierGroup>) => fetchWithAuth<SaleModifierGroup>('/sales/modifier-groups', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateModifierGroup: (id: string, data: Partial<SaleModifierGroup>) => fetchWithAuth<SaleModifierGroup>(`/sales/modifier-groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
    // Floor Plans & Tables
    getFloorPlans: (venueId?: string) => fetchWithAuth<FloorPlan[]>(`/sales/floor-plans${venueId ? `?venue_id=${venueId}` : ''}`),
    createFloorPlan: (data: Partial<FloorPlan>) => fetchWithAuth<FloorPlan>('/sales/floor-plans', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateFloorPlan: (id: string, data: Partial<FloorPlan>) => fetchWithAuth<FloorPlan>(`/sales/floor-plans/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
    deleteFloorPlan: (id: string) => fetchWithAuth<{ status: string }>(`/sales/floor-plans/${id}`, {
        method: 'DELETE',
    }),
    createTable: (planId: string, data: Partial<TableItem>) => fetchWithAuth<TableItem>(`/sales/floor-plans/${planId}/tables`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateTable: (tableId: string, data: Partial<TableItem>) => fetchWithAuth<TableItem>(`/sales/tables/${tableId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
    deleteTable: (tableId: string) => fetchWithAuth<{ status: string }>(`/sales/tables/${tableId}`, {
        method: 'DELETE',
    }),

    // Workstations (POS Terminals / Cajas)
    getWorkstations: (venueId?: string) => fetchWithAuth<Workstation[]>(`/sales/workstations${venueId ? `?venue_id=${venueId}` : ''}`),
    createWorkstation: (data: Partial<Workstation>) => fetchWithAuth<Workstation>('/sales/workstations', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateWorkstation: (id: string, data: Partial<Workstation>) => fetchWithAuth<Workstation>(`/sales/workstations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
    deleteWorkstation: (id: string) => fetchWithAuth<{ status: string }>(`/sales/workstations/${id}`, {
        method: 'DELETE',
    }),

    // POS Config
    getPosConfig: (workstationId: string, mode: string) =>
        fetchWithAuth<PosConfig>(`/sales/pos-config?workstation_id=${workstationId}&mode=${mode}`),

    // Sale Mode Config
    getModeConfigs: () => fetchWithAuth<SaleModeConfig[]>('/sales/mode-config'),
    createModeConfig: (data: { mode: string; customer_requirement: string }) =>
        fetchWithAuth<SaleModeConfig>('/sales/mode-config', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updateModeConfig: (id: string, data: { customer_requirement: string | null }) =>
        fetchWithAuth<SaleModeConfig>(`/sales/mode-config/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    deleteModeConfig: (id: string) =>
        fetchWithAuth<{ status: string }>(`/sales/mode-config/${id}`, { method: 'DELETE' }),

    // Stock
    reserveStock: (data: { sale_item_id: string; cart_line_id: string; quantity: number; warehouse_id: string; session_id: string }) =>
        fetchWithAuth('/sales/stock/reserve', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    releaseStock: (cartLineId: string, warehouseId: string, saleItemId: string, sessionId: string) =>
        fetchWithAuth(`/sales/stock/reserve/${cartLineId}?warehouse_id=${warehouseId}&sale_item_id=${saleItemId}&session_id=${sessionId}`, {
            method: 'DELETE',
        }),
    getStockAvailability: (warehouseId: string) =>
        fetchWithAuth<StockAvailability[]>(`/sales/stock/availability?warehouse_id=${warehouseId}`),

    // Checkout
    processCheckout: (data: CheckoutPayload) =>
        fetchWithAuth<CheckoutResponse>('/sales/checkout', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // POS Sessions
    openPosSession: (data: { venue_id?: string | null; workstation_id?: string | null; opening_balance: number; opening_currency: string; notes?: string }) =>
        fetchWithAuth<PosSession>('/sales/sessions/open', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getActivePosSession: (workstationId?: string) =>
        fetchWithAuth<PosSession | null>(`/sales/sessions/active${workstationId ? `?workstation_id=${workstationId}` : ''}`),

    // Table Orders (Multi-terminal sync)
    getTableOrders: (venueId?: string) =>
        fetchWithAuth<TableOrder[]>(`/sales/table-orders${venueId ? `?venue_id=${venueId}` : ''}`),
    getTableOrder: (tableId: string) =>
        fetchWithAuth<TableOrder | null>(`/sales/table-orders/${tableId}`),
    syncTableOrder: (tableId: string, data: Partial<TableOrderSyncPayload>) =>
        fetchWithAuth<TableOrder>(`/sales/table-orders/${tableId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    deleteTableOrder: (tableId: string) =>
        fetchWithAuth(`/sales/table-orders/${tableId}`, {
            method: 'DELETE',
        }),
}

export interface TableOrderSyncPayload {
    id?: string
    venue_id?: string | null
    mode?: string
    table_id?: string | null
    table_name?: string | null
    tab_name?: string | null
    customer_id?: string | null
    customer_name?: string | null
    customer_tax_id?: string | null
    cart: any[]
    total: number
    order_number?: number | null
    workstation_id?: string | null
}

export interface TableOrder {
    id: string
    org_id: string
    venue_id?: string | null
    mode?: string
    table_id?: string | null
    table_name?: string | null
    tab_name?: string | null
    customer_id?: string | null
    customer_name?: string | null
    customer_tax_id?: string | null
    cart: any[]
    total: number
    order_number?: number | null
    workstation_id?: string | null
    created_by?: string | null
    status: 'active' | 'billed' | 'cancelled'
    created_at?: string
    updated_at?: string
}

export interface PosSession {
    id: string
    org_id: string
    venue_id?: string | null
    workstation_id?: string | null
    cashier_id?: string | null
    status: 'open' | 'closing' | 'closed'
    opening_balance: number
    opening_currency: string
    closing_balance?: number | null
    expected_balance?: number | null
    difference?: number | null
    notes?: string | null
    opened_at?: string
    closed_at?: string | null
}

export interface Workstation {
    id: string
    org_id?: string
    venue_id?: string | null
    name: string
    warehouse_id?: string | null
    customer_requirement?: 'required' | 'optional' | 'disabled' | null
    is_active: boolean
    allowed_modes?: string[]
    created_at?: string
    updated_at?: string
}

export interface SaleCategory {
    id: string
    org_id: string
    name: string
    icon: string
    image_url?: string | null
    position: number
    is_active: boolean
    created_at?: string
}

export interface SaleItemComponent {
    id?: string
    item_id: string
    item_name?: string
    item_code?: string
    component_type: 'fixed_qty' | 'recipe_proportional'
    quantity: number
    label?: string | null
    position?: number
    recipe_yield?: number | null
    recipe_ingredient_count?: number | null
}

export interface SaleItemVariant {
    id?: string
    sale_item_id?: string
    name: string
    price: number
    food_cost?: number
    external_code?: string | null
    is_default?: boolean
    position?: number
    is_active?: boolean
    components?: SaleItemComponent[]
}

export interface SaleModifierOption {
    id?: string
    group_id?: string
    item_id?: string | null
    name: string
    price: number
    food_cost?: number
    external_code?: string | null
    deduct_qty?: number | null
    is_active?: boolean
    position?: number
}

export interface SaleModifierGroup {
    id: string
    org_id?: string
    name: string
    min_selection: number
    max_selection?: number | null
    is_active: boolean
    position: number
    options?: SaleModifierOption[]
}

export interface SaleItem {
    id: string
    org_id: string
    category_id?: string | null
    category_name?: string | null
    code?: string | null
    name: string
    description?: string
    sale_price?: number | null
    food_cost: number
    tax_id?: string | null
    tax_name?: string | null
    tax_rate?: number | null
    tax_included: boolean
    barcode?: string | null
    image_url?: string | null
    has_variants: boolean
    variant_label?: string
    is_active: boolean
    is_featured: boolean
    allow_negative_stock?: boolean
    position: number
    components?: SaleItemComponent[]
    variants?: SaleItemVariant[]
    modifier_groups?: SaleModifierGroup[]
    modifier_group_ids?: string[]
}

export interface Currency {
    id: string
    code: string
    name: string
    symbol: string
    is_base: boolean
    is_active: boolean
    created_at: string
}

export interface ExchangeRate {
    id: string
    from_currency: string
    to_currency: string
    rate: number
    effective_date: string
    created_at: string
}

export interface Tax {
    id: string
    org_id?: string | null
    name: string
    rate: number
    is_active: boolean
    created_at?: string
}

export interface TableItem {
    id: string
    floor_plan_id: string
    name: string
    shape: 'rectangle' | 'circle'
    x: number
    y: number
    width: number
    height: number
    capacity: number
    is_active: boolean
    created_at?: string
}

export interface FloorPlan {
    id: string
    org_id?: string
    venue_id: string
    name: string
    width: number
    height: number
    tables?: TableItem[]
    created_at?: string
    updated_at?: string
}

// ── Checkout Types ──

export interface PosConfig {
    customer_requirement: 'required' | 'optional' | 'disabled'
    warehouse_id: string
    resolved_from: string
}

export interface SaleModeConfig {
    id: string
    org_id: string
    mode: string
    customer_requirement: 'required' | 'optional' | 'disabled' | null
    created_at: string
    updated_at: string
}

export interface CheckoutItem {
    sale_item_id: string
    variant_id?: string | null
    quantity: number
    unit_price: number
    discount_pct?: number
    tax_id?: string | null
    modifiers?: any[]
    notes?: string | null
}

export interface CheckoutPayment {
    payment_method_id: string
    amount: number
    currency_code: string
    exchange_rate?: number
    reference?: string | null
    cash_tendered?: number | null
}

export interface CheckoutChange {
    amount: number
    currency_code: string
    method: string
}

export interface CheckoutPayload {
    workstation_id: string
    pos_session_id: string
    venue_id?: string | null
    mode: string
    table_id?: string | null
    customer_id?: string | null
    customer_name?: string | null
    customer_tax_id?: string | null
    items: CheckoutItem[]
    payments: CheckoutPayment[]
    change?: CheckoutChange | null
    document_type?: string
    discount_amount?: number
    notes?: string | null
}

export interface CheckoutResponse {
    invoice: Invoice & {
        amount_paid: number
        balance_due: number
    }
}

export interface StockAvailability {
    sale_item_id: string
    available_stock: number
    allow_negative_stock: boolean
}


