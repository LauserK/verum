import { fetchWithAuth } from './core'

export interface SupplierContactCreate {
    name: string
    role?: string
    email?: string
    phone?: string
    is_primary?: boolean
}

export interface SupplierContactResponse extends SupplierContactCreate {
    id: string
    supplier_id: string
}

export interface SupplierCreate {
    name: string
    code?: string
    tax_id?: string
    email?: string
    phone?: string
    address?: string
    payment_terms_days?: number
    credit_limit?: number
    currency?: string
    status?: string
    notes?: string
    contacts?: SupplierContactCreate[]
}

export interface SupplierResponse {
    id: string
    org_id: string
    code: string | null
    name: string
    tax_id: string | null
    email: string | null
    phone: string | null
    address: string | null
    payment_terms_days: number
    credit_limit: number | null
    currency: string
    status: string
    score: number | null
    notes: string | null
    created_at: string
    contacts: SupplierContactResponse[]
}

export interface SupplierUpdate {
    name?: string
    code?: string
    tax_id?: string
    email?: string
    phone?: string
    address?: string
    payment_terms_days?: number
    credit_limit?: number
    currency?: string
    status?: string
    notes?: string
}

export interface SupplierItemCreate {
    item_id: string
    supplier_sku?: string
    lead_time_days?: number
    is_preferred?: boolean
}

export interface SupplierItemResponse extends SupplierItemCreate {
    supplier_id: string
    item_name?: string
}

export interface SupplierPriceListItemCreate {
    item_id: string
    unit_cost_base: number
    presentation_id?: string | null
    unit_cost_presentation?: number | null
    min_qty_base?: number | null
    notes?: string
}

export interface SupplierPriceListItemResponse extends SupplierPriceListItemCreate {
    id: string
    price_list_id: string
}

export interface SupplierPriceListCreate {
    name: string
    valid_from: string // YYYY-MM-DD
    valid_until?: string | null // YYYY-MM-DD
    is_active?: boolean
    items: SupplierPriceListItemCreate[]
}

export interface SupplierPriceListResponse {
    id: string
    supplier_id: string
    name: string
    valid_from: string
    valid_until: string | null
    is_active: boolean
    created_at: string
    items: SupplierPriceListItemResponse[]
}

export interface POApprovalLimitCreate {
    role_id: string
    max_amount?: number | null
}

export interface POApprovalLimitResponse extends POApprovalLimitCreate {
    id: string
    org_id: string
}

export interface POApprovalConfigResponse {
    id: string
    org_id: string
    creator_can_approve_own: boolean
    require_approval_above: number
    matching_tolerance_pct: number
}

export interface POApprovalConfigUpdate {
    creator_can_approve_own?: boolean
    require_approval_above?: number
    matching_tolerance_pct?: number
}

export const purchasingApi = {
    getSuppliers: (): Promise<SupplierResponse[]> =>
        fetchWithAuth('/suppliers'),

    getSupplier: (id: string): Promise<SupplierResponse> =>
        fetchWithAuth(`/suppliers/${id}`),

    createSupplier: (data: SupplierCreate): Promise<SupplierResponse> =>
        fetchWithAuth('/suppliers', { method: 'POST', body: JSON.stringify(data) }),

    updateSupplier: (id: string, data: SupplierUpdate): Promise<SupplierResponse> =>
        fetchWithAuth(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    linkSupplierItem: (supplierId: string, data: SupplierItemCreate): Promise<SupplierItemResponse> =>
        fetchWithAuth(`/suppliers/${supplierId}/items`, { method: 'POST', body: JSON.stringify(data) }),

    getSupplierItems: (supplierId: string): Promise<SupplierItemResponse[]> =>
        fetchWithAuth(`/suppliers/${supplierId}/items`),

    getSupplierPriceLists: (supplierId: string): Promise<SupplierPriceListResponse[]> =>
        fetchWithAuth(`/suppliers/${supplierId}/price-lists`),

    createPriceList: (supplierId: string, data: SupplierPriceListCreate): Promise<SupplierPriceListResponse> =>
        fetchWithAuth(`/suppliers/${supplierId}/price-lists`, { method: 'POST', body: JSON.stringify(data) }),

    getPOApprovalLimits: (): Promise<POApprovalLimitResponse[]> =>
        fetchWithAuth('/po-approval-limits'),

    updatePOApprovalLimit: (data: POApprovalLimitCreate): Promise<POApprovalLimitResponse> =>
        fetchWithAuth('/po-approval-limits', { method: 'PUT', body: JSON.stringify(data) }),

    getPOApprovalConfig: (orgId: string): Promise<POApprovalConfigResponse> =>
        fetchWithAuth(`/po-approval-config/${orgId}`),

    updatePOApprovalConfig: (orgId: string, data: POApprovalConfigUpdate): Promise<POApprovalConfigResponse> =>
        fetchWithAuth(`/po-approval-config/${orgId}`, { method: 'PUT', body: JSON.stringify(data) }),

    getPurchaseOrders: (filters?: { status?: string; supplier_id?: string }): Promise<PurchaseOrderResponse[]> => {
        const params = new URLSearchParams()
        if (filters?.status) params.append('status', filters.status)
        if (filters?.supplier_id) params.append('supplier_id', filters.supplier_id)
        const query = params.toString() ? `?${params.toString()}` : ''
        return fetchWithAuth(`/purchase-orders${query}`)
    },

    getPurchaseOrder: (id: string): Promise<PurchaseOrderResponse> =>
        fetchWithAuth(`/purchase-orders/${id}`),

    createPurchaseOrder: (data: PurchaseOrderCreate): Promise<PurchaseOrderResponse> =>
        fetchWithAuth('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),

    updatePurchaseOrder: (id: string, data: PurchaseOrderUpdate): Promise<PurchaseOrderResponse> =>
        fetchWithAuth(`/purchase-orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    submitPurchaseOrder: (id: string): Promise<PurchaseOrderResponse> =>
        fetchWithAuth(`/purchase-orders/${id}/submit`, { method: 'POST' }),

    approvePurchaseOrder: (id: string, data?: POApprovalAction): Promise<PurchaseOrderResponse> =>
        fetchWithAuth(`/purchase-orders/${id}/approve`, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),

    rejectPurchaseOrder: (id: string, data: POApprovalAction): Promise<PurchaseOrderResponse> =>
        fetchWithAuth(`/purchase-orders/${id}/reject`, { method: 'POST', body: JSON.stringify(data) }),

    cancelPurchaseOrder: (id: string): Promise<PurchaseOrderResponse> =>
        fetchWithAuth(`/purchase-orders/${id}/cancel`, { method: 'POST' }),

    sendPurchaseOrder: (id: string): Promise<PurchaseOrderResponse> =>
        fetchWithAuth(`/purchase-orders/${id}/send`, { method: 'POST' }),

    createSupplierInvoice: (data: SupplierInvoiceCreate): Promise<SupplierInvoiceResponse> =>
        fetchWithAuth('/supplier-invoices', { method: 'POST', body: JSON.stringify(data) }),

    getSupplierInvoices: (filters?: { supplier_id?: string; payment_status?: string }): Promise<SupplierInvoiceResponse[]> => {
        const params = new URLSearchParams()
        if (filters?.supplier_id) params.append('supplier_id', filters.supplier_id)
        if (filters?.payment_status) params.append('payment_status', filters.payment_status)
        const query = params.toString() ? `?${params.toString()}` : ''
        return fetchWithAuth(`/supplier-invoices${query}`)
    },

    getSupplierInvoice: (id: string): Promise<SupplierInvoiceResponse> =>
        fetchWithAuth(`/supplier-invoices/${id}`),

    markInvoiceExported: (id: string): Promise<SupplierInvoiceResponse> =>
        fetchWithAuth(`/supplier-invoices/${id}/mark-exported`, { method: 'PATCH' }),

    markInvoicePaid: (id: string): Promise<SupplierInvoiceResponse> =>
        fetchWithAuth(`/supplier-invoices/${id}/mark-paid`, { method: 'PATCH' }),

    getSupplierReturns: (filters?: { supplier_id?: string; status?: string }): Promise<SupplierReturnResponse[]> => {
        const params = new URLSearchParams()
        if (filters?.supplier_id) params.append('supplier_id', filters.supplier_id)
        if (filters?.status) params.append('status', filters.status)
        const query = params.toString() ? `?${params.toString()}` : ''
        return fetchWithAuth(`/supplier-returns${query}`)
    },

    getSupplierReturn: (id: string): Promise<SupplierReturnResponse> =>
        fetchWithAuth(`/supplier-returns/${id}`),

    createSupplierReturn: (data: SupplierReturnCreate): Promise<SupplierReturnResponse> =>
        fetchWithAuth('/supplier-returns', { method: 'POST', body: JSON.stringify(data) }),

    sendSupplierReturn: (id: string): Promise<SupplierReturnResponse> =>
        fetchWithAuth(`/supplier-returns/${id}/send`, { method: 'PATCH' }),

    createCreditNote: (returnId: string, data: SupplierCreditNoteCreate): Promise<SupplierCreditNoteResponse> =>
        fetchWithAuth(`/supplier-returns/${returnId}/credit-note`, { method: 'POST', body: JSON.stringify(data) }),

    getSupplierMetrics: (id: string, from?: string, to?: string): Promise<SupplierMetricsResponse> => {
        const params = new URLSearchParams()
        if (from) params.append('from_date', from)
        if (to) params.append('to_date', to)
        const query = params.toString() ? `?${params.toString()}` : ''
        return fetchWithAuth(`/suppliers/${id}/metrics${query}`)
    },

    createSupplierEvaluation: (id: string, data: SupplierEvaluationCreate): Promise<SupplierEvaluationResponse> =>
        fetchWithAuth(`/suppliers/${id}/evaluations`, { method: 'POST', body: JSON.stringify(data) }),

    getSupplierEvaluations: (id: string): Promise<SupplierEvaluationResponse[]> =>
        fetchWithAuth(`/suppliers/${id}/evaluations`),

    getPurchasingTaxes: (): Promise<any[]> =>
        fetchWithAuth('/purchasing/taxes'),
}

export interface SupplierInvoiceLineCreate {
    po_line_id?: string | null
    item_id: string
    qty_invoiced_base: number
    unit_cost_base: number
    line_total: number
}

export interface SupplierInvoiceLineResponse {
    id: string
    invoice_id: string
    po_line_id: string | null
    item_id: string
    qty_invoiced_base: number
    unit_cost_base: number
    line_total: number
    diff_vs_po_base?: number | null
    diff_vs_receipt_base?: number | null
    item_name?: string | null
}

export interface SupplierInvoiceCreate {
    supplier_id: string
    po_id?: string | null
    receipt_id?: string | null
    invoice_number: string
    invoice_date: string
    due_date?: string | null
    currency?: string
    subtotal: number
    tax_amount?: number
    total: number
    pdf_url?: string | null
    lines: SupplierInvoiceLineCreate[]
}

export interface SupplierInvoiceResponse {
    id: string
    org_id: string
    supplier_id: string
    po_id: string | null
    receipt_id: string | null
    invoice_number: string
    invoice_date: string
    due_date: string | null
    currency: string
    subtotal: number
    tax_amount: number
    total: number
    matching_status: 'pending' | 'matched' | 'partial_match' | 'mismatch'
    matching_notes: string | null
    payment_status: 'unpaid' | 'exported' | 'paid'
    exported_at: string | null
    pdf_url: string | null
    created_by: string | null
    created_at: string
    lines: SupplierInvoiceLineResponse[]
    supplier_name?: string | null
    po_number?: string | null
}

export interface PurchaseOrderLineCreate {
    item_id: string
    qty_ordered_base: number
    presentation_id?: string | null
    qty_ordered_presentation?: number | null
    unit_cost_base: number
    unit_cost_presentation?: number | null
}

export interface PurchaseOrderLineResponse {
    id: string
    po_id: string
    item_id: string
    qty_ordered_base: number
    presentation_id: string | null
    qty_ordered_presentation: number | null
    qty_received_base: number
    qty_pending_base: number
    unit_cost_base: number
    unit_cost_presentation: number | null
    line_total: number
    status: string
    item_name?: string | null
    uom_name?: string | null
    display_qty: number
    display_unit_cost: number
}

export interface PurchaseOrderCreate {
    supplier_id: string
    price_list_id?: string | null
    origin_type?: string
    catering_request_id?: string | null
    requested_date?: string | null
    promised_date?: string | null
    currency?: string
    payment_terms_days?: number
    warehouse_id: string
    notes?: string | null
    lines: PurchaseOrderLineCreate[]
}

export interface POApprovalResponse {
    id: string
    po_id: string
    action: string
    approver_id: string | null
    notes: string | null
    created_at: string
    approver_name?: string | null
}

export interface PurchaseOrderResponse {
    id: string
    org_id: string
    po_number: string
    supplier_id: string
    price_list_id: string | null
    origin_type: string
    catering_request_id: string | null
    requested_date: string | null
    promised_date: string | null
    currency: string
    subtotal: number
    tax_amount: number
    total: number
    payment_terms_days: number
    status: string
    sent_at: string | null
    sent_by: string | null
    sent_to_email: string | null
    warehouse_id: string
    notes: string | null
    created_by: string
    created_at: string
    lines: PurchaseOrderLineResponse[]
    approvals: POApprovalResponse[]
    supplier_name?: string | null
    warehouse_name?: string | null
    created_by_name?: string | null
    org_name?: string | null
    org_tax_id?: string | null
    org_address?: string | null
    org_phone?: string | null
    org_email?: string | null
}

export interface PurchaseOrderUpdate {
    requested_date?: string | null
    promised_date?: string | null
    payment_terms_days?: number
    notes?: string | null
    lines?: PurchaseOrderLineCreate[]
}

export interface POApprovalAction {
    notes?: string | null
}

export interface SupplierReturnLineCreate {
    item_id: string
    qty_base: number
    lot_id?: string | null
    unit_cost_base?: number | null
    reason?: string | null
}

export interface SupplierReturnLineResponse {
    id: string
    return_id: string
    item_id: string
    lot_id: string | null
    qty_base: number
    unit_cost_base: number | null
    line_total: number | null
    reason: string | null
    item_name?: string | null
    uom_name?: string | null
    tax_rate?: number | null
}

export interface SupplierReturnCreate {
    receipt_id: string
    supplier_id: string
    po_id?: string | null
    reason: 'damaged' | 'wrong_item' | 'excess_qty' | 'quality' | 'expired'
    notes?: string | null
    lines: SupplierReturnLineCreate[]
}

export interface SupplierReturnResponse {
    id: string
    org_id: string
    return_number: string
    receipt_id: string | null
    supplier_id: string
    po_id: string | null
    reason: string
    status: 'pending' | 'sent' | 'credit_note_received' | 'closed'
    notes: string | null
    created_by: string | null
    created_at: string
    lines: SupplierReturnLineResponse[]
    supplier_name?: string | null
    receipt_number?: string | null
}

export interface SupplierCreditNoteCreate {
    credit_note_number?: string | null
    amount: number
    issue_date?: string | null
    applied_to_invoice_id?: string | null
}

export interface SupplierCreditNoteResponse {
    id: string
    return_id: string
    supplier_id: string
    credit_note_number: string | null
    amount: number
    issue_date: string | null
    applied_to_invoice_id: string | null
    status: 'pending' | 'applied' | 'refunded'
    created_at: string
}

export interface SupplierMetricsResponse {
    auto_on_time_pct: number
    auto_qty_accuracy_pct: number
    auto_return_rate_pct: number
    auto_score: number
}

export interface SupplierEvaluationCreate {
    period_start: string
    period_end: string
    manual_quality: number
    manual_communication: number
    manual_flexibility: number
    notes?: string | null
}

export interface SupplierEvaluationResponse {
    id: string
    supplier_id: string
    period_start: string
    period_end: string
    auto_on_time_pct: number
    auto_qty_accuracy_pct: number
    auto_return_rate_pct: number
    auto_score: number
    manual_quality: number
    manual_communication: number
    manual_flexibility: number
    manual_score: number
    final_score: number
    evaluator_id: string | null
    notes: string | null
    created_at: string
}
