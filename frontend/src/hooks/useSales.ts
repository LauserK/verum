import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salesApi, Customer, CreateInvoicePayload, TenantBillingConfig, PaymentMethod, Tax } from '@/lib/api/sales'

export const salesKeys = {
    all: ['sales'] as const,
    customers: () => [...salesKeys.all, 'customers'] as const,
    invoices: () => [...salesKeys.all, 'invoices'] as const,
    config: () => [...salesKeys.all, 'config'] as const,
    paymentMethods: () => [...salesKeys.all, 'payment-methods'] as const,
    taxes: (activeOnly?: boolean) => [...salesKeys.all, 'taxes', { activeOnly }] as const,
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
