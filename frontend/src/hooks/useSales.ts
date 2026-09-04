import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salesApi, Customer, CreateInvoicePayload, TenantBillingConfig, PaymentMethod, Tax, FloorPlan, TableItem, Workstation } from '@/lib/api/sales'
import { settingsApi } from '@/lib/api/settings'

export const salesKeys = {
    all: ['sales'] as const,
    customers: () => [...salesKeys.all, 'customers'] as const,
    invoices: () => [...salesKeys.all, 'invoices'] as const,
    config: () => [...salesKeys.all, 'config'] as const,
    paymentMethods: () => [...salesKeys.all, 'payment-methods'] as const,
    taxes: (activeOnly?: boolean) => [...salesKeys.all, 'taxes', { activeOnly }] as const,
    floorPlans: (venueId?: string) => [...salesKeys.all, 'floor-plans', { venueId }] as const,
    workstations: (venueId?: string) => [...salesKeys.all, 'workstations', { venueId }] as const,
    categories: () => [...salesKeys.all, 'categories'] as const,
    items: (categoryId?: string, activeOnly?: boolean) => [...salesKeys.all, 'items', { categoryId, activeOnly }] as const,
    posConfig: (workstationId?: string, mode?: string) =>
        [...salesKeys.all, 'posConfig', { workstationId, mode }] as const,
    modeConfigs: () => [...salesKeys.all, 'mode-configs'] as const,
    stockAvailability: (warehouseId?: string) =>
        [...salesKeys.all, 'stock-availability', { warehouseId }] as const,
}

// -- Catalog: Categories & Items --
export function useCategories() {
    return useQuery({
        queryKey: salesKeys.categories(),
        queryFn: salesApi.getSaleCategories,
        staleTime: 1000 * 60 * 60 * 2, // 2 hour cache for instantaneous POS rendering
        gcTime: 1000 * 60 * 60 * 4,
        refetchOnWindowFocus: false,
    })
}

export const useSaleCategories = useCategories

export function useSalesItems(categoryId?: string, activeOnly: boolean = true) {
    return useQuery({
        queryKey: salesKeys.items(categoryId, activeOnly),
        queryFn: () => salesApi.getSaleItems(categoryId === 'all' ? undefined : categoryId, activeOnly),
        staleTime: 1000 * 60 * 60 * 2, // 2 hour cache for instantaneous POS rendering
        gcTime: 1000 * 60 * 60 * 4,
        refetchOnWindowFocus: false,
    })
}

export const useSaleItems = useSalesItems

// -- Customers --
export function useCustomers() {
    return useQuery({
        queryKey: salesKeys.customers(),
        queryFn: salesApi.getCustomers,
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false,
    })
}

export function useCreateCustomer() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.createCustomer,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.customers() })
        },
    })
}

// -- Invoices --
export function useInvoices() {
    return useQuery({
        queryKey: salesKeys.invoices(),
        queryFn: salesApi.getInvoices,
    })
}

export function useInvoice(id: string) {
    return useQuery({
        queryKey: [...salesKeys.invoices(), id],
        queryFn: () => salesApi.getInvoice(id),
        enabled: !!id,
    })
}

export function useInvoiceByTableOrder(tableOrderId?: string | null) {
    return useQuery({
        queryKey: ['sales', 'invoices', 'by-table-order', tableOrderId],
        queryFn: () => salesApi.getInvoiceByTableOrder(tableOrderId!),
        enabled: !!tableOrderId,
        staleTime: 10000, // 10 seconds fresh
        refetchInterval: 15000, // Background check every 15s instead of 3s
    })
}

export function useCreateInvoice() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.createInvoice,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.invoices() })
        },
    })
}

export function useVoidInvoice() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => salesApi.voidInvoice(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.invoices() })
        },
    })
}

// -- Config --
export function useBillingConfig() {
    return useQuery({
        queryKey: salesKeys.config(),
        queryFn: salesApi.getConfig,
    })
}

// Alias for backwards compatibility
export const useSalesConfig = useBillingConfig

// -- Payment Methods --
export function usePaymentMethods() {
    return useQuery({
        queryKey: salesKeys.paymentMethods(),
        queryFn: salesApi.getPaymentMethods,
        staleTime: 1000 * 60 * 60 * 9, // 9 hours (aligned with Redis cache)
        gcTime: 1000 * 60 * 60 * 9,
    })
}

export function useCreatePaymentMethod() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.createPaymentMethod,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.paymentMethods() })
        },
    })
}

export function useUpdatePaymentMethod() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<PaymentMethod> }) => salesApi.updatePaymentMethod(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.paymentMethods() })
        },
    })
}

export function useDeletePaymentMethod() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => salesApi.deletePaymentMethod(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.paymentMethods() })
        },
    })
}

// -- Delivery Zones --
export function useDeliveryZones(activeOnly?: boolean) {
    return useQuery({
        queryKey: ['sales', 'delivery-zones', { activeOnly }],
        queryFn: () => salesApi.getDeliveryZones(activeOnly),
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60,
    })
}

export function useCreateDeliveryZone() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.createDeliveryZone,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'delivery-zones'] })
        },
    })
}

export function useUpdateDeliveryZone() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => salesApi.updateDeliveryZone(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'delivery-zones'] })
        },
    })
}

export function useDeleteDeliveryZone() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => salesApi.deleteDeliveryZone(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'delivery-zones'] })
        },
    })
}

// -- Currencies & Exchange Rates --
export const currencyKeys = {
    all: ['currencies'] as const,
    rates: () => ['exchange_rates'] as const,
}

export function useCurrencies() {
    return useQuery({
        queryKey: currencyKeys.all,
        queryFn: salesApi.getCurrencies,
    })
}

export function useCreateCurrency() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.createCurrency,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: currencyKeys.all })
        },
    })
}

export function useExchangeRates() {
    return useQuery({
        queryKey: currencyKeys.rates(),
        queryFn: salesApi.getExchangeRates,
    })
}

export const useLatestExchangeRates = useExchangeRates


export function useCreateExchangeRate() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.createExchangeRate,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: currencyKeys.rates() })
        },
    })
}

// -- Taxes / Alícuotas --
export function useTaxes(activeOnly?: boolean) {
    return useQuery({
        queryKey: salesKeys.taxes(activeOnly),
        queryFn: () => salesApi.getTaxes(activeOnly),
    })
}

export function useCreateTax() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.createTax,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.all })
        },
    })
}

export function useUpdateTax() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Tax> }) => salesApi.updateTax(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.all })
        },
    })
}

export function useDeleteTax() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => salesApi.deleteTax(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.all })
        },
    })
}

// -- Floor Plans & Tables --
export function useFloorPlans(venueId?: string) {
    return useQuery({
        queryKey: salesKeys.floorPlans(venueId),
        queryFn: () => salesApi.getFloorPlans(venueId),
        staleTime: 1000 * 60 * 60 * 2, // 2 hour cache for fast table rendering
        gcTime: 1000 * 60 * 60 * 4,
        refetchOnWindowFocus: false,
    })
}

export function useCreateFloorPlan() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (data: Partial<FloorPlan>) => salesApi.createFloorPlan(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'floor-plans'] })
        },
    })
}

export function useUpdateFloorPlan() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<FloorPlan> }) => salesApi.updateFloorPlan(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'floor-plans'] })
        },
    })
}

export function useDeleteFloorPlan() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => salesApi.deleteFloorPlan(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'floor-plans'] })
        },
    })
}

export function useCreateTable() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ planId, data }: { planId: string; data: Partial<TableItem> }) => salesApi.createTable(planId, data),
        onMutate: async ({ planId, data }) => {
            await queryClient.cancelQueries({ queryKey: ['sales', 'floor-plans'] })
            const previousPlans = queryClient.getQueryData<FloorPlan[]>(['sales', 'floor-plans'])

            const tempId = `temp-${Date.now()}`
            const optimisticTable: TableItem = {
                id: tempId,
                floor_plan_id: planId,
                name: data.name || 'Mesa',
                shape: data.shape || 'rectangle',
                x: data.x || 0,
                y: data.y || 0,
                width: data.width || 80,
                height: data.height || 80,
                capacity: data.capacity || 4,
                is_active: data.is_active ?? true,
                created_at: new Date().toISOString(),
            }

            queryClient.setQueriesData<FloorPlan[]>({ queryKey: ['sales', 'floor-plans'] }, (old) => {
                if (!old) return old
                return old.map((plan) => {
                    if (plan.id === planId) {
                        return {
                            ...plan,
                            tables: [...(plan.tables || []), optimisticTable],
                        }
                    }
                    return plan
                })
            })

            return { previousPlans, tempId }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousPlans) {
                queryClient.setQueriesData({ queryKey: ['sales', 'floor-plans'] }, context.previousPlans)
            }
        },
        onSuccess: (newTable, { planId }, context) => {
            // Replace temporary optimistic table with actual database record
            queryClient.setQueriesData<FloorPlan[]>({ queryKey: ['sales', 'floor-plans'] }, (old) => {
                if (!old) return old
                return old.map((plan) => {
                    if (plan.id === planId) {
                        const filtered = (plan.tables || []).filter((t) => t.id !== context?.tempId)
                        return {
                            ...plan,
                            tables: [...filtered, newTable],
                        }
                    }
                    return plan
                })
            })
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'floor-plans'] })
        },
    })
}

export function useUpdateTable() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ tableId, data }: { tableId: string; data: Partial<TableItem> }) => salesApi.updateTable(tableId, data),
        onMutate: async ({ tableId, data }) => {
            await queryClient.cancelQueries({ queryKey: ['sales', 'floor-plans'] })
            const previousPlans = queryClient.getQueryData<FloorPlan[]>(['sales', 'floor-plans'])

            queryClient.setQueriesData<FloorPlan[]>({ queryKey: ['sales', 'floor-plans'] }, (old) => {
                if (!old) return old
                return old.map((plan) => ({
                    ...plan,
                    tables: (plan.tables || []).map((t) => (t.id === tableId ? { ...t, ...data } : t)),
                }))
            })

            return { previousPlans }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousPlans) {
                queryClient.setQueriesData({ queryKey: ['sales', 'floor-plans'] }, context.previousPlans)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'floor-plans'] })
        },
    })
}

export function useDeleteTable() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (tableId: string) => salesApi.deleteTable(tableId),
        onMutate: async (tableId) => {
            await queryClient.cancelQueries({ queryKey: ['sales', 'floor-plans'] })
            const previousPlans = queryClient.getQueryData<FloorPlan[]>(['sales', 'floor-plans'])

            queryClient.setQueriesData<FloorPlan[]>({ queryKey: ['sales', 'floor-plans'] }, (old) => {
                if (!old) return old
                return old.map((plan) => ({
                    ...plan,
                    tables: (plan.tables || []).filter((t) => t.id !== tableId),
                }))
            })

            return { previousPlans }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousPlans) {
                queryClient.setQueriesData({ queryKey: ['sales', 'floor-plans'] }, context.previousPlans)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'floor-plans'] })
        },
    })
}

// -- Workstations (POS Terminals / Cajas) --
export function useWorkstations(venueId?: string) {
    return useQuery({
        queryKey: salesKeys.workstations(venueId),
        queryFn: () => salesApi.getWorkstations(venueId),
        staleTime: 1000 * 60 * 60 * 9, // 9 hours
        gcTime: 1000 * 60 * 60 * 9,
    })
}

export function useCreateWorkstation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (data: Partial<Workstation>) => salesApi.createWorkstation(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'workstations'] })
        },
    })
}

export function useUpdateWorkstation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Workstation> }) => salesApi.updateWorkstation(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'workstations'] })
        },
    })
}

export function useDeleteWorkstation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => salesApi.deleteWorkstation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'workstations'] })
        },
    })
}

// -- POS Sessions --
export function useActivePosSession(workstationId?: string) {
    return useQuery({
        queryKey: ['sales', 'sessions', 'active', workstationId],
        queryFn: () => salesApi.getActivePosSession(workstationId),
        staleTime: 1000 * 60 * 10, // 10 minutes (requested by user)
        gcTime: 1000 * 60 * 10,
    })
}

export function useOpenPosSession() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (data: { venue_id?: string | null; workstation_id?: string | null; opening_balance: number; opening_currency: string; notes?: string }) =>
            salesApi.openPosSession(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'sessions'] })
        },
    })
}

// ── POS Table Orders (Multi-Terminal Sync) ──

export function useTableOrders(venueId?: string) {
    return useQuery({
        queryKey: ['sales', 'table-orders', venueId],
        queryFn: () => salesApi.getTableOrders(venueId),
        refetchInterval: 5000, // Poll every 5 seconds for real-time multi-terminal status
    })
}

export function useTableOrder(tableId?: string) {
    return useQuery({
        queryKey: ['sales', 'table-orders', 'single', tableId],
        queryFn: () => salesApi.getTableOrder(tableId!),
        enabled: !!tableId,
    })
}

export function useSyncTableOrder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ tableId, data }: { tableId: string; data: any }) =>
            salesApi.syncTableOrder(tableId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'table-orders'] })
        },
    })
}

export function useUpdateTableOrder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ tableId, data }: { tableId: string; data: Partial<any> }) =>
            salesApi.updateTableOrder(tableId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'table-orders'] })
        },
    })
}

export function useTransferTableOrder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.transferTableOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'table-orders'] })
        },
    })
}

export function useMergeTableOrders() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.mergeTableOrders,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'table-orders'] })
        },
    })
}

export function useDeleteTableOrder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (tableId: string) => salesApi.deleteTableOrder(tableId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'table-orders'] })
        },
    })
}


// ── POS Config ──

export function usePosConfig(workstationId?: string, mode?: string) {
    return useQuery({
        queryKey: salesKeys.posConfig(workstationId, mode),
        queryFn: () => salesApi.getPosConfig(workstationId!, mode!),
        enabled: !!workstationId && !!mode,
        staleTime: 32400000, // 9 hours - matches Redis TTL
    })
}

// ── Sale Mode Config ──

export function useModeConfigs() {
    return useQuery({
        queryKey: salesKeys.modeConfigs(),
        queryFn: salesApi.getModeConfigs,
    })
}

export function useCreateModeConfig() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.createModeConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.modeConfigs() })
            queryClient.invalidateQueries({ queryKey: ['sales', 'posConfig'] })
        },
    })
}

export function useUpdateModeConfig() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { customer_requirement: string | null } }) =>
            salesApi.updateModeConfig(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.modeConfigs() })
            queryClient.invalidateQueries({ queryKey: ['sales', 'posConfig'] })
        },
    })
}

export function useDeleteModeConfig() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => salesApi.deleteModeConfig(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.modeConfigs() })
            queryClient.invalidateQueries({ queryKey: ['sales', 'posConfig'] })
        },
    })
}

// ── Stock Availability ──

export function useStockAvailability(warehouseId?: string) {
    return useQuery({
        queryKey: salesKeys.stockAvailability(warehouseId),
        queryFn: () => salesApi.getStockAvailability(warehouseId!),
        enabled: !!warehouseId,
        refetchInterval: 30000, // Poll every 30s
    })
}

// ── Checkout ──

export function useCheckout() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.processCheckout,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.invoices() })
            queryClient.invalidateQueries({ queryKey: ['sales', 'sessions'] })
        },
    })
}

// ── Team Users / Waiters ──

export function useTeamUsers() {
    return useQuery({
        queryKey: ['team', 'users'],
        queryFn: () => settingsApi.getUsers(),
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    })
}



