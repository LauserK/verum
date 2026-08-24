'use client'

import React, { useState, useMemo } from 'react'
import { Coins, Check, ArrowRight } from 'lucide-react'
import { CheckoutChange } from '@/lib/api/sales'
import { useCurrencies, useBillingConfig, useExchangeRates } from '@/hooks/useSales'

interface ChangeRegistrationProps {
  changeAmount: number
  vesRate?: number
  onConfirm: (change: CheckoutChange) => void
}

export function ChangeRegistration({
  changeAmount,
  onConfirm
}: ChangeRegistrationProps) {
  const { data: currencies = [] } = useCurrencies()
  const { data: config } = useBillingConfig()
  const { data: rates = [] } = useExchangeRates()

  // 1. Resolve Base Currency
  const baseCurrency = useMemo(() => {
    const fromConfig = currencies.find((c) => c.code === config?.default_currency)
    if (fromConfig) return fromConfig
    const isBase = currencies.find((c) => c.is_base)
    if (isBase) return isBase
    return currencies[0] || { code: 'USD', symbol: '$', name: 'Dólar' }
  }, [currencies, config])

  // 2. Resolve Secondary Currency & Active Exchange Rate
  const { secondaryCurrency, exchangeRate } = useMemo(() => {
    const sec = currencies.find((c) => c.id !== baseCurrency.id && c.is_active)
    if (!sec) {
      return { secondaryCurrency: null, exchangeRate: 1.0 }
    }

    const directRate = rates.find(
      (r) =>
        (r.from_currency === baseCurrency.code && r.to_currency === sec.code) ||
        (r.to_currency === sec.code)
    )

    const rVal = directRate?.rate ? Number(directRate.rate) : 1.0
    return {
      secondaryCurrency: sec,
      exchangeRate: rVal > 0 ? rVal : 1.0
    }
  }, [currencies, baseCurrency, rates])

  const hasSecondary = Boolean(secondaryCurrency && exchangeRate > 0)

  const [currency, setCurrency] = useState<string>(baseCurrency.code)
  const [method, setMethod] = useState<'cash' | 'mobile_payment'>('cash')

  const changeInSelectedCurrency =
    currency === baseCurrency.code ? changeAmount : changeAmount * exchangeRate

  const handleConfirm = () => {
    onConfirm({
      amount: changeInSelectedCurrency,
      currency_code: currency,
      method: method
    })
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 max-w-lg mx-auto space-y-6 animate-in fade-in zoom-in-95">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
        <Coins className="w-8 h-8" />
      </div>

      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-black text-text-primary">Registrar Vuelto / Cambio</h2>
        <p className="text-xs text-text-secondary">
          Selecciona la moneda y método utilizado para entregar el cambio al cliente.
        </p>
      </div>

      <div className="w-full p-6 bg-surface-raised border border-border rounded-2xl text-center space-y-2">
        <span className="text-xs font-bold text-text-secondary uppercase">Monto a Entregar</span>
        <div className="text-3xl font-black font-mono text-amber-400">
          {currency === baseCurrency.code ? baseCurrency.symbol : secondaryCurrency?.symbol}{' '}
          {changeInSelectedCurrency.toFixed(2)}
        </div>
        {hasSecondary && (
          <div className="text-xs font-mono text-text-secondary">
            Equivalente:{' '}
            {currency === baseCurrency.code
              ? `${secondaryCurrency?.symbol} ${(changeAmount * exchangeRate).toFixed(2)} ${secondaryCurrency?.code}`
              : `${baseCurrency.symbol} ${changeAmount.toFixed(2)} ${baseCurrency.code}`}
          </div>
        )}
      </div>

      <div className="w-full space-y-4">
        {hasSecondary && (
          <div>
            <label className="text-xs font-bold text-text-secondary uppercase mb-2 block">
              Moneda del Vuelto
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCurrency(baseCurrency.code)}
                className={`py-3 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                  currency === baseCurrency.code
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {baseCurrency.name} ({baseCurrency.code})
              </button>
              {secondaryCurrency && (
                <button
                  type="button"
                  onClick={() => setCurrency(secondaryCurrency.code)}
                  className={`py-3 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                    currency === secondaryCurrency.code
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {secondaryCurrency.name} ({secondaryCurrency.code})
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-text-secondary uppercase mb-2 block">
            Forma de Entrega
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMethod('cash')}
              className={`py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                method === 'cash'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              Efectivo en Caja
            </button>
            <button
              type="button"
              onClick={() => setMethod('mobile_payment')}
              className={`py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                method === 'mobile_payment'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              Pago Móvil / Transf.
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        className="w-full py-3.5 bg-primary text-black font-black text-sm rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <Check className="w-5 h-5" />
        <span>Confirmar Entrega de Cambio</span>
      </button>
    </div>
  )
}
