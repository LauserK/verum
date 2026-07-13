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
}

export interface POApprovalConfigUpdate {
    creator_can_approve_own?: boolean
    require_approval_above?: number
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
}
