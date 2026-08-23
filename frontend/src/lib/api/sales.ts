import { fetchWithAuth } from './core'

export interface Customer {
    id: string
    name: string
    tax_id?: string
    email?: string
    phone?: string
    address?: string
    credit_limit: number
    outstanding_balance: number
    is_active: boolean
    created_at: string
}

export interface Invoice {
    id: string
    invoice_number?: string
    customer_id?: string
    status: 'draft' | 'confirmed' | 'voided' | 'refunded'
    subtotal: number
    tax_total: number
    total_amount: number
    currency?: string
    currency_code?: string
    created_at: string
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
    name: string
    method_type: 'cash' | 'card' | 'bank_transfer' | 'mobile_payment' | 'digital_wallet' | 'crypto' | 'other'
    currency_code?: string | null
    instructions?: string
    is_active: boolean
    requires_reference?: boolean
    position?: number
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
    deleteModifierGroup: (id: string) => fetchWithAuth<{ status: string; id: string }>(`/sales/modifier-groups/${id}`, {
        method: 'DELETE',
    }),
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

