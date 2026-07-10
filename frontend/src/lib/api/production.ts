import { fetchWithAuth } from './core'

export interface OrderCompleteRequest {
    qty_produced_base: number
    ignore_variance?: boolean
    consumptions?: Array<{
        item_id: string
        qty_actual_base: number
    }>
}

export interface RecipeBriefResponse {
    id: string
    item_id: string
    item_name: string
    item_code: string | null
    item_type: string
    uom_name?: string | null
    yield_qty_base: number
    safety_margin?: number
    created_at: string
}

export interface RecipeIngredient {
    item_id: string
    qty_base: number
    presentation_id: string | null
    order_index: number
    notes?: string
    item_name?: string
    presentation_name?: string
}

export interface RecipeStep {
    order_index: number
    description: string
    estimated_time_minutes: number
}

export interface RecipeCreate {
    item_id: string
    yield_qty_base: number
    yield_presentation_id: string | null
    ingredients: RecipeIngredient[]
    steps: RecipeStep[]
    auto_calculate_cost?: boolean
    safety_margin?: number
}

export interface RecipeResponse {
    id: string
    item_id: string
    yield_qty_base: number
    yield_presentation_id: string | null
    ingredients: unknown[]
    steps: unknown[]
    is_active: boolean
    auto_calculate_cost: boolean
    safety_margin?: number
    created_at: string
}

export interface CalculateProductionNeedsRequest {
    item_id: string
    target_qty: number
    target_uom_id: string | null
    warehouse_id: string
}

export interface IngredientDeficit {
    item_id: string
    item_name: string
    uom_name: string
    needed_base_qty: number
    available_base_qty: number
    deficit_base_qty: number
}

export interface ProductionNeedsResponse {
    status: 'OK' | 'DEFICIT'
    ingredients: Array<{
        item_id: string
        item_name: string
        uom_name: string
        needed_base_qty: number
        available_base_qty: number
        deficit_base_qty: number
    }>
    deficits: IngredientDeficit[]
}

export interface ProductionOrderCreate {
    item_id: string
    warehouse_id: string
    qty_ordered_base: number
    presentation_id: string | null
    scheduled_date: string
    priority: string
}

export interface ProductionOrderResponse {
    id: string
    order_number: string
    item_id: string
    recipe_id: string
    warehouse_id: string
    qty_ordered_base: number
    presentation_id: string | null
    status: string
    priority: string
    scheduled_date?: string
    created_at: string
    items?: { 
        name: string, 
        uom_base: { name: string },
        yield_alert_enabled?: boolean,
        yield_alert_threshold_pct?: number,
        shelf_life_days?: number
    }
    warehouses?: { name: string }
    uom_presentations?: { name: string, conversion_factor: number }
}

export interface ProductionOrderDetailResponse extends ProductionOrderResponse {
    started_at?: string
    completed_at?: string
    qty_produced_base?: number
    yield_alert_triggered: boolean
    yield_variance_pct?: number
    notes?: string
    created_by_profile?: { full_name: string }
    assigned_to_profile?: { full_name: string }
    origin_warehouse?: { name: string }
    target_warehouse?: { name: string }
    consumptions: Array<{
        item_id: string
        qty_planned_base: number
        qty_actual_base: number
        items: { name: string, uom_base: { name: string } }
    }>
    produced_lots: Array<{
        id: string
        lot_number: string
        qty_base: number
    }>
}

export interface CateringRequestLine {
    item_id: string
    qty_base: number
    presentation_id?: string | null
    qty_presentation?: number | null
    items?: { name: string, uom_base: { name: string } }
    item_name?: string
    uom_name?: string
}

export interface CateringRequest {
    id: string
    name: string
    event_date: string | null
    status: 'planning' | 'confirmed' | 'completed' | 'cancelled'
    notes: string | null
    tentative_production_date: string | null
    buffer_percentage: number | null
    created_at: string
    lines?: CateringRequestLine[]
}

export interface MRPProductionPlan {
    item_id: string
    item_name: string
    uom_name: string
    qty_to_produce: number
    recipe_id: string
}

export interface MRPPurchaseList {
    item_id: string
    item_name: string
    uom_name: string
    qty_needed: number
    qty_available: number
    qty_deficit: number
}

export interface MRPResultResponse {
    production_plan: MRPProductionPlan[]
    purchase_list: MRPPurchaseList[]
}

export const productionApi = {
    getRecipes: (): Promise<RecipeBriefResponse[]> => fetchWithAuth('/production/recipes'),
    getRecipe: (itemId: string): Promise<RecipeResponse> => fetchWithAuth(`/production/recipes/${itemId}`),

    saveRecipe: (data: RecipeCreate): Promise<RecipeResponse> =>
        fetchWithAuth('/production/recipes', { method: 'POST', body: JSON.stringify(data) }),

    calculateProductionNeeds: (data: CalculateProductionNeedsRequest): Promise<ProductionNeedsResponse> =>
        fetchWithAuth('/production/calculate-needs', { method: 'POST', body: JSON.stringify(data) }),

    createProductionOrder: (data: ProductionOrderCreate): Promise<ProductionOrderResponse> =>
        fetchWithAuth('/production/orders', { method: 'POST', body: JSON.stringify(data) }),

    getKDSOrders: (warehouseId: string): Promise<unknown[]> =>
        fetchWithAuth(`/production/orders/kds?warehouse_id=${warehouseId}`),

    getProductionOrders: (): Promise<unknown[]> =>
        fetchWithAuth('/production/orders'),

    getProductionOrderDetail: (id: string): Promise<ProductionOrderDetailResponse> =>
        fetchWithAuth(`/production/orders/${id}`),

    markLotPrinted: (lotId: string): Promise<unknown> =>
        fetchWithAuth(`/production/lots/${lotId}/printed`, { method: 'PATCH' }),

    updateOrderStatus: (id: string, status: string): Promise<unknown> =>
        fetchWithAuth(`/production/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

    completeProductionOrder: (id: string, data: OrderCompleteRequest): Promise<unknown> =>
        fetchWithAuth(`/production/orders/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),

    // Catering & MRP
    getCateringRequests: (): Promise<CateringRequest[]> =>
        fetchWithAuth('/production/catering'),

    getCateringRequest: (id: string): Promise<CateringRequest> =>
        fetchWithAuth(`/production/catering/${id}`),

    createCateringRequest: (data: unknown): Promise<CateringRequest> =>
        fetchWithAuth('/production/catering', { method: 'POST', body: JSON.stringify(data) }),

    updateCateringRequest: (id: string, data: unknown): Promise<unknown> =>
        fetchWithAuth(`/production/catering/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    updateCateringStatus: (id: string, status: string): Promise<unknown> =>
        fetchWithAuth(`/production/catering/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        }),

    generateMRPPlan: (reqId: string, warehouseId: string): Promise<MRPResultResponse> =>
        fetchWithAuth(`/production/catering/${reqId}/plan`, {
            method: 'POST',
            body: JSON.stringify({ warehouse_id: warehouseId })
        }),

    generateMRPOrders: (reqId: string, data: { warehouse_id: string, target_warehouse_id: string, scheduled_date: string }): Promise<unknown> =>
        fetchWithAuth(`/production/catering/${reqId}/generate-orders`, {
            method: 'POST',
            body: JSON.stringify(data)
        }),
}
