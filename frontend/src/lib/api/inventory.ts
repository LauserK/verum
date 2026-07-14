import { fetchWithAuth } from './core'

export interface Asset {
    id: string
    name: string
    venue_id: string
    category_id: string
    status: string
    qr_code: string
    serial?: string | null
    brand?: string | null
    model?: string | null
    asset_categories?: { name: string }
}

export interface UtensilCategory {
    id: string
    org_id: string
    name: string
    description?: string | null
}

export interface Utensil {
    id: string
    org_id: string
    category_id: string | null
    name: string
    unit: string
    min_stock: number
    is_active: boolean
    created_at: string
    utensil_categories?: { name: string }
}

export interface UtensilCount {
    id: string;
    org_id: string;
    venue_id: string;
    profile_id: string;
    status: 'pending' | 'confirmed';
    created_at: string;
    confirmed_at: string | null;
    profiles?: {
        full_name: string;
    };
}

export interface CountSchedule {
    id: string
    org_id: string
    venue_id: string
    assigned_to: string | null
    name: string
    frequency: string
    scope: string
    category_id: string | null
    next_due: string
    last_completed_at: string | null
    is_active: boolean
    created_at: string
    item_ids?: string[]
    venues?: { name: string }
    profiles?: { full_name: string }
}

export interface Warehouse {
    id: string
    org_id: string
    venue_id: string | null
    name: string
    type: 'production' | 'storage' | 'point_of_sale' | 'transit'
    is_active: boolean
}

export interface StockMovement {
    id: string
    movement_type: string
    warehouse_id: string
    item_id: string
    qty_base: number
    unit_cost_base: number | null
    total_cost: number | null
    reference_id: string | null
    reference_type: string | null
    notes: string | null
    created_at: string
}

export interface PurchaseReceiptLine {
    item_id: string
    qty_presentation: number
    presentation_id: string | null
    unit_cost_presentation: number
    expiry_date?: string
    lot_number?: string
}

export interface PurchaseReceipt {
    id: string
    warehouse_id: string
    supplier: string | null
    receipt_number: string | null
    date?: string
    status: string
    lines: PurchaseReceiptLine[]
    created_at: string
}

export interface IssueDocument {
    id: string
    warehouse_id: string
    reason: string
    notes: string | null
    status: string
    lines: Array<{
        item_id: string
        qty_presentation: number
        presentation_id: string | null
    }>
    created_at: string
}

export interface LowStockAlertItem {
    item_id: string
    item_name: string
    item_code: string | null
    uom_code: string
    warehouse_name: string
    qty_base: number
    qty_reserved: number
    qty_available: number
    min_stock: number
}

export interface StockSnapshotItem {
    item_id: string
    item_name: string
    item_code: string | null
    uom_name: string | null
    warehouse_id: string
    warehouse_name: string
    qty_on_hand: number
    valuation: number
}

export interface StockSnapshotResponse {
    date: string
    valuation_method: string
    items: StockSnapshotItem[]
    total_valuation: number
}

export interface StockValuationLotDetail {
    id?: string
    lot_id: string
    lot_number: string | null
    qty_base: number
    unit_cost_base: number
    valuation: number
    production_date: string | null
    expiry_date: string | null
    received_at: string
}

export interface StockValuationItem {
    item_id: string
    item_name: string
    item_code: string | null
    uom_name: string | null
    warehouse_id: string
    warehouse_name: string
    qty_on_hand: number
    valuation: number
    lots_detail: StockValuationLotDetail[]
}

export interface StockValuationResponse {
    items: StockValuationItem[]
    total_valuation: number
}

export interface StockAdjustItem {
    item_code: string
    qty_counted: number
}

export interface StockAdjustResult {
    item_code: string
    status: 'success' | 'error'
    error_message?: string
    qty_expected?: number
    qty_counted?: number
    difference?: number
}

export interface BulkStockAdjustResponse {
    results: StockAdjustResult[]
}

export interface UOMBase {
    id: string
    code: string
    name: string
}

export interface UOMPresentation {
    id: string
    org_id: string
    name: string
    base_uom_id: string
    conversion_factor: number
    is_default: boolean
}

export interface ItemCategory {
    id: string
    org_id: string
    name: string
    description: string | null
    is_active: boolean
}

export interface InventoryItem {
    id: string
    org_id: string
    code: string | null
    name: string
    type: 'raw_material' | 'semi_finished' | 'finished' | 'packaging' | 'supply'
    category_id: string | null
    base_uom_id: string
    uom_name?: string
    last_purchase_cost: number | null
    last_purchase_cost_updated_at: string | null
    is_active: boolean
    created_at: string
    yield_alert_enabled?: boolean
    yield_alert_threshold_pct?: number | null
    min_stock?: number
    margin_multiplier?: number
    yield_factor?: number
    production_cost?: number | null
    tax_id?: string | null
    tax_rate?: number
}

export interface InventoryDashboardSummary {
    asset_stats: {
        total: number;
        operativo: number;
        en_reparacion: number;
        baja: number;
    };
    active_tickets: RepairTicket[];
    pending_counts: unknown[];
    due_schedules: CountSchedule[];
}

export interface RepairTicket {
    id: string;
    asset_id: string;
    title: string;
    issue_description: string | null;
    status: string;
    opened_at: string;
    closed_at: string | null;
    assets?: {
        name: string;
    };
}

export function getDueSchedules(venueId: string): Promise<CountSchedule[]> {
    return fetchWithAuth(`/count-schedules/due?venue_id=${venueId}`)
}

export const inventoryApi = {
    // Assets CRUD
    getAssets: (filters?: { venue_id?: string; status?: string; category_id?: string; include_archived?: boolean }): Promise<Asset[]> => {
        const params = new URLSearchParams()
        if (filters?.venue_id) params.set('venue_id', filters.venue_id)
        if (filters?.status) params.set('status', filters.status)
        if (filters?.category_id) params.set('category_id', filters.category_id)
        if (filters?.include_archived) params.set('include_archived', 'true')
        const qs = params.toString()
        return fetchWithAuth(`/assets${qs ? `?${qs}` : ''}`)
    },

    createAsset: (data: { org_id: string; venue_id: string; category_id: string; name: string; serial?: string | null; brand?: string | null; model?: string | null }): Promise<Asset> =>
        fetchWithAuth('/assets', { method: 'POST', body: JSON.stringify(data) }),

    updateAsset: (id: string, data: Partial<Asset>): Promise<Asset> =>
        fetchWithAuth(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    getAssetCategories: (): Promise<unknown[]> =>
        fetchWithAuth('/asset-categories'),

    createAssetCategory: (data: { org_id: string; name: string; icon?: string; review_interval_days?: number }): Promise<unknown> =>
        fetchWithAuth('/asset-categories', { method: 'POST', body: JSON.stringify(data) }),

    updateAssetCategory: (id: string, data: { name?: string; icon?: string; review_interval_days?: number }): Promise<unknown> =>
        fetchWithAuth(`/asset-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    getAssetByQR: (qrCode: string): Promise<unknown> =>
        fetchWithAuth(`/assets/qr/${qrCode}`),

    getAssetTickets: (assetId: string): Promise<unknown[]> =>
        fetchWithAuth(`/assets/${assetId}/tickets`),

    createAssetTicket: (assetId: string, data: { title: string; priority: string; description: string }): Promise<unknown> =>
        fetchWithAuth(`/assets/${assetId}/tickets`, { method: 'POST', body: JSON.stringify(data) }),

    reviewAsset: (assetId: string, data: { notes: string; photo_url: string | null }): Promise<unknown> =>
        fetchWithAuth(`/assets/${assetId}/review`, { method: 'POST', body: JSON.stringify(data) }),

    // Utensils
    getUtensilCategories: (orgId: string): Promise<UtensilCategory[]> =>
        fetchWithAuth(`/utensil-categories?org_id=${orgId}`),

    createUtensilCategory: (data: { org_id: string; name: string; description?: string }): Promise<UtensilCategory> =>
        fetchWithAuth('/utensil-categories', { method: 'POST', body: JSON.stringify(data) }),

    updateUtensilCategory: (id: string, data: Partial<UtensilCategory>): Promise<UtensilCategory> =>
        fetchWithAuth(`/utensil-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    getUtensils: (filters?: { org_id?: string; category_id?: string; include_archived?: boolean }): Promise<Utensil[]> => {
        const params = new URLSearchParams()
        if (filters?.org_id) params.set('org_id', filters.org_id)
        if (filters?.category_id) params.set('category_id', filters.category_id)
        if (filters?.include_archived) params.set('include_archived', 'true')
        const qs = params.toString()
        return fetchWithAuth(`/utensils${qs ? `?${qs}` : ''}`)
    },

    createUtensil: (data: { org_id: string; category_id: string; name: string; unit?: string; min_stock?: number }): Promise<Utensil> =>
        fetchWithAuth('/utensils', { method: 'POST', body: JSON.stringify(data) }),

    updateUtensil: (id: string, data: Partial<Utensil>): Promise<Utensil> =>
        fetchWithAuth(`/utensils/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    recordUtensilMovement: (data: { 
        utensil_id: string; 
        type: 'entry' | 'exit' | 'transfer' | 'adjustment'; 
        quantity: number; 
        from_venue_id?: string; 
        to_venue_id?: string; 
        notes?: string 
    }): Promise<unknown> =>
        fetchWithAuth('/utensil-movements', { method: 'POST', body: JSON.stringify(data) }),

    createUtensilCount: (data: {
        venue_id: string;
        items: Array<{ utensil_id: string; count: number }>;
        schedule_id?: string;
    }): Promise<{ id: string; status: string }> =>
        fetchWithAuth('/utensil-counts', { method: 'POST', body: JSON.stringify(data) }),

    getUtensilsCounts: (venueId?: string): Promise<UtensilCount[]> =>
        fetchWithAuth(`/utensil-counts${venueId ? `?venue_id=${venueId}` : ''}`),

    getUtensilCountDetail: (countId: string): Promise<UtensilCount & { items: unknown[] }> =>
        fetchWithAuth(`/utensil-counts/${countId}`),

    confirmUtensilCount: (countId: string, items: Array<{ utensil_id: string; confirmed_count: number }>): Promise<unknown> =>
        fetchWithAuth(`/utensil-counts/${countId}/confirm`, { method: 'PATCH', body: JSON.stringify({ items }) }),

    // Count Schedules
    getSchedules: (venueId?: string): Promise<CountSchedule[]> =>
        fetchWithAuth(`/count-schedules${venueId ? `?venue_id=${venueId}` : ''}`),

    createSchedule: (data: Record<string, unknown>): Promise<CountSchedule> =>
        fetchWithAuth('/count-schedules', { method: 'POST', body: JSON.stringify(data) }),

    updateSchedule: (id: string, data: Record<string, unknown>): Promise<unknown> =>
        fetchWithAuth(`/count-schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    // Inventory Dashboard
    getInventoryDashboard: (venueId?: string): Promise<InventoryDashboardSummary> =>
        fetchWithAuth(`/inventory/dashboard/summary${venueId ? `?venue_id=${venueId}` : ''}`),

    // M16: Production & Inventory
    getInventoryItems: (): Promise<InventoryItem[]> =>
        fetchWithAuth('/inventory/items'),

    createInventoryItem: (data: Partial<InventoryItem>): Promise<InventoryItem> =>
        fetchWithAuth('/inventory/items', { method: 'POST', body: JSON.stringify(data) }),

    getInventoryWarehouses: (): Promise<Warehouse[]> =>
        fetchWithAuth('/inventory/warehouses'),

    createInventoryWarehouse: (data: Partial<Warehouse>): Promise<Warehouse> =>
        fetchWithAuth('/inventory/warehouses', { method: 'POST', body: JSON.stringify(data) }),

    updateInventoryWarehouse: (id: string, data: Partial<Warehouse>): Promise<Warehouse> =>
        fetchWithAuth(`/inventory/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    getUOMBase: (): Promise<UOMBase[]> =>
        fetchWithAuth('/inventory/uom-base'),

    getKardex: (filters?: { item_id?: string; warehouse_id?: string; start_date?: string; end_date?: string; movement_type?: string }): Promise<StockMovement[]> => {
        const params = new URLSearchParams()
        if (filters?.item_id) params.set('item_id', filters.item_id)
        if (filters?.warehouse_id) params.set('warehouse_id', filters.warehouse_id)
        if (filters?.start_date) params.set('start_date', filters.start_date)
        if (filters?.end_date) params.set('end_date', filters.end_date)
        if (filters?.movement_type) params.set('movement_type', filters.movement_type)
        const qs = params.toString()
        return fetchWithAuth(`/inventory/kardex${qs ? `?${qs}` : ''}`)
    },

    getInventorySnapshot: (date: string, warehouse_id?: string, valuation_method?: string): Promise<StockSnapshotResponse> => {
        const params = new URLSearchParams({ date })
        if (warehouse_id) params.set('warehouse_id', warehouse_id)
        if (valuation_method) params.set('valuation_method', valuation_method)
        return fetchWithAuth(`/inventory/snapshot?${params.toString()}`)
    },

    getInventoryValuation: (warehouse_id?: string): Promise<StockValuationResponse> => {
        const params = new URLSearchParams()
        if (warehouse_id) params.set('warehouse_id', warehouse_id)
        const qs = params.toString()
        return fetchWithAuth(`/inventory/valuation${qs ? `?${qs}` : ''}`)
    },

    getLowStockAlerts: (warehouse_id?: string): Promise<LowStockAlertItem[]> => {
        const params = new URLSearchParams()
        if (warehouse_id) params.set('warehouse_id', warehouse_id)
        const qs = params.toString()
        return fetchWithAuth(`/inventory/alerts/low-stock${qs ? `?${qs}` : ''}`)
    },

    createPurchaseReceipt: (data: Partial<PurchaseReceipt>): Promise<PurchaseReceipt> =>
        fetchWithAuth('/inventory/purchase-receipts', { method: 'POST', body: JSON.stringify(data) }),

    getPurchaseReceipts: (): Promise<unknown[]> =>
        fetchWithAuth('/inventory/purchase-receipts'),

    getIssueDocuments: (): Promise<unknown[]> =>
        fetchWithAuth('/inventory/issue-documents'),

    createIssueDocument: (data: Partial<IssueDocument>): Promise<IssueDocument> =>
        fetchWithAuth('/inventory/issue-documents', { method: 'POST', body: JSON.stringify(data) }),

    getPurchaseReceipt: (id: string): Promise<{ header: unknown; lines: unknown[] }> =>
        fetchWithAuth(`/inventory/purchase-receipts/${id}`),

    getIssueDocument: (id: string): Promise<{ header: unknown; lines: unknown[] }> =>
        fetchWithAuth(`/inventory/issue-documents/${id}`),

    createTransfer: (data: unknown): Promise<unknown> =>
        fetchWithAuth('/inventory/transfers', { method: 'POST', body: JSON.stringify(data) }),

    confirmTransfer: (id: string, data: unknown): Promise<unknown> =>
        fetchWithAuth(`/inventory/transfers/${id}/confirm`, { method: 'PATCH', body: JSON.stringify(data) }),

    getPendingTransfers: (warehouseId?: string): Promise<unknown[]> => {
        const url = warehouseId ? `/inventory/transfers/pending?warehouse_id=${warehouseId}` : '/inventory/transfers/pending';
        return fetchWithAuth(url);
    },

    getTransfers: (): Promise<unknown[]> =>
        fetchWithAuth('/inventory/transfers'),

    getTransferDetail: (id: string): Promise<unknown> =>
        fetchWithAuth(`/inventory/transfers/${id}`),

    createInventoryDocument: (data: unknown): Promise<unknown> =>
        fetchWithAuth('/inventory/documents', { method: 'POST', body: JSON.stringify(data) }),

    getInventoryDocuments: (type?: string, status?: string): Promise<unknown[]> => {
        const params = new URLSearchParams()
        if (type) params.set('type', type)
        if (status) params.set('status', status)
        const qs = params.toString()
        return fetchWithAuth(`/inventory/documents${qs ? `?${qs}` : ''}`)
    },

    getInventoryDocument: (id: string): Promise<unknown> =>
        fetchWithAuth(`/inventory/documents/${id}`),

    processInventoryDocument: (id: string): Promise<unknown> =>
        fetchWithAuth(`/inventory/documents/${id}/process`, { method: 'POST' }),

    receiveTransferDocument: (id: string, data: unknown): Promise<unknown> =>
        fetchWithAuth(`/inventory/documents/${id}/receive`, { method: 'POST', body: JSON.stringify(data) }),

    cancelInventoryDocument: (id: string): Promise<unknown> =>
        fetchWithAuth(`/inventory/documents/${id}/cancel`, { method: 'POST' }),

    getMovementsByReference: (referenceId: string): Promise<StockMovement[]> =>
        fetchWithAuth(`/inventory/movements/reference/${referenceId}`),

    getItemCategories: (): Promise<ItemCategory[]> =>
        fetchWithAuth('/inventory/item-categories'),

    createItemCategory: (data: Partial<ItemCategory>): Promise<ItemCategory> =>
        fetchWithAuth('/inventory/item-categories', { method: 'POST', body: JSON.stringify(data) }),

    deleteItemCategory: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/item-categories/${id}`, { method: 'DELETE' }),

    updateInventoryItem: (id: string, data: Partial<InventoryItem>): Promise<InventoryItem> =>
        fetchWithAuth(`/inventory/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    deleteInventoryItem: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/items/${id}`, { method: 'DELETE' }),

    getInventoryItem: (id: string): Promise<InventoryItem> =>
        fetchWithAuth(`/inventory/items/${id}`),

    getItemStock: (itemId: string): Promise<unknown[]> =>
        fetchWithAuth(`/inventory/items/${itemId}/stock`),

    associateWarehouseToItem: (itemId: string, warehouseId: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/items/${itemId}/stock`, { method: 'POST', body: JSON.stringify({ warehouse_id: warehouseId }) }),

    getUOMPresentations: (): Promise<UOMPresentation[]> =>
        fetchWithAuth('/inventory/uom-presentations'),

    createUOMPresentation: (data: Partial<UOMPresentation>): Promise<UOMPresentation> =>
        fetchWithAuth('/inventory/uom-presentations', { method: 'POST', body: JSON.stringify(data) }),

    deleteUOMPresentation: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/uom-presentations/${id}`, { method: 'DELETE' }),

    getItemPresentations: (itemId: string): Promise<UOMPresentation[]> =>
        fetchWithAuth(`/inventory/items/${itemId}/presentations`),

    enableItemPresentation: (itemId: string, presId: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/items/${itemId}/presentations/${presId}`, { method: 'POST' }),

    disableItemPresentation: (itemId: string, presId: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/items/${itemId}/presentations/${presId}`, { method: 'DELETE' }),

    updateItemCategory: (id: string, data: Partial<ItemCategory>): Promise<ItemCategory> =>
        fetchWithAuth(`/inventory/item-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    // M39: Physical Inventory Count API Client
    getPhysicalInventories: (): Promise<unknown[]> => 
        fetchWithAuth('/inventory/physical-inventories'),

    getPhysicalInventoryDetail: (id: string): Promise<unknown> => 
        fetchWithAuth(`/inventory/physical-inventories/${id}`),

    createPhysicalInventory: (data: unknown): Promise<unknown> => 
        fetchWithAuth('/inventory/physical-inventories', { method: 'POST', body: JSON.stringify(data) }),

    updatePhysicalInventory: (id: string, data: unknown): Promise<unknown> => 
        fetchWithAuth(`/inventory/physical-inventories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    processPhysicalInventory: (id: string): Promise<unknown> => 
        fetchWithAuth(`/inventory/physical-inventories/${id}/process`, { method: 'POST' }),

    resolveLotNumber: (lotNumber: string): Promise<unknown> =>
        fetchWithAuth(`/inventory/lots/resolve/${encodeURIComponent(lotNumber)}`),

    bulkAdjustStock: (warehouseId: string, adjustments: StockAdjustItem[]): Promise<BulkStockAdjustResponse> =>
        fetchWithAuth('/inventory/bulk-adjust-stock', {
            method: 'POST',
            body: JSON.stringify({ warehouse_id: warehouseId, adjustments })
        }),

    getTickets: (filters?: { venue_id?: string; status?: string; priority?: string }): Promise<unknown[]> => {
        const params = new URLSearchParams()
        if (filters?.venue_id) params.set('venue_id', filters.venue_id)
        if (filters?.status) params.set('status', filters.status)
        if (filters?.priority) params.set('priority', filters.priority)
        const qs = params.toString()
        return fetchWithAuth(`/tickets${qs ? `?${qs}` : ''}`)
    },

    getTicket: (id: string): Promise<unknown> =>
        fetchWithAuth(`/tickets/${id}`),

    createTicketEntry: (id: string, data: unknown): Promise<unknown> =>
        fetchWithAuth(`/tickets/${id}/entries`, { method: 'POST', body: JSON.stringify(data) }),

    closeTicket: (id: string, data: unknown): Promise<unknown> =>
        fetchWithAuth(`/tickets/${id}/close`, { method: 'PATCH', body: JSON.stringify(data) }),
}
