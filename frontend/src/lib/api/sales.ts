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
    code: string
    name: string
    type: string
    surcharge_pct: number
    is_active: boolean
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

