import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salesApi, Customer, CreateInvoicePayload, TenantBillingConfig, PaymentMethod, Tax, FloorPlan, TableItem } from '@/lib/api/sales'

export const salesKeys = {
    all: ['sales'] as const,
    customers: () => [...salesKeys.all, 'customers'] as const,
    invoices: () => [...salesKeys.all, 'invoices'] as const,
    config: () => [...salesKeys.all, 'config'] as const,
    paymentMethods: () => [...salesKeys.all, 'payment-methods'] as const,
    taxes: (activeOnly?: boolean) => [...salesKeys.all, 'taxes', { activeOnly }] as const,
    floorPlans: (venueId?: string) => [...salesKeys.all, 'floor-plans', { venueId }] as const,
}

// -- Customers --
export function useCustomers() {
    return useQuery({
        queryKey: salesKeys.customers(),
        queryFn: salesApi.getCustomers,
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
