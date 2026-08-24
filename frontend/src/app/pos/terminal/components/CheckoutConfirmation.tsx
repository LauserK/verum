'use client'

import React from 'react'
import { CheckCircle2, Printer, PlusCircle, ArrowRight, FileText, User } from 'lucide-react'

interface CheckoutConfirmationProps {
  invoice: {
    id: string
    document_number: string
    customer_name?: string
    total: number
    status: string
    balance_due?: number
    amount_paid?: number
  }
  onNewOrder: () => void
}

export function CheckoutConfirmation({ invoice, onNewOrder }: CheckoutConfirmationProps) {
  const isCXC = (invoice.balance_due || 0) > 0.01

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 max-w-lg mx-auto space-y-8 animate-in fade-in zoom-in-95">
      {/* Animated Success Badge */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl -z-10" />
      </div>

      <div className="text-center space-y-2">
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
          {isCXC ? 'Venta a Crédito Registrada' : 'Pago Procesado con Éxito'}
        </span>
        <h2 className="text-3xl font-black text-text-primary tracking-tight font-mono">
          {invoice.document_number}
        </h2>
        <p className="text-xs text-text-secondary">
          Cliente: <strong className="text-text-primary">{invoice.customer_name || 'Cliente General'}</strong>
        </p>
      </div>

      {/* Invoice details summary */}
      <div className="w-full p-6 bg-surface-raised border border-border rounded-2xl space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Total Facturado</span>
          <span className="font-bold font-mono text-text-primary">${invoice.total.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Estado</span>
          <span
            className={`font-bold uppercase text-xs px-2.5 py-0.5 rounded-full border ${
              invoice.status === 'paid'
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}
          >
            {invoice.status === 'paid' ? 'Pagada' : 'Pendiente (CXC)'}
          </span>
        </div>
        {isCXC && (
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
            <span className="text-text-secondary">Saldo Pendiente</span>
            <span className="font-bold font-mono text-amber-400">${(invoice.balance_due || 0).toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="w-full space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="py-3 px-4 bg-surface-raised hover:bg-surface border border-border hover:border-primary/40 rounded-xl text-xs font-bold text-text-primary flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-text-secondary" />
            <span>Imprimir Ticket</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="py-3 px-4 bg-surface-raised hover:bg-surface border border-border hover:border-primary/40 rounded-xl text-xs font-bold text-text-primary flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-text-secondary" />
            <span>Factura Fiscal</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onNewOrder}
          className="w-full py-4 bg-primary text-black font-black text-sm rounded-2xl hover:bg-primary-hover shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01]"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Iniciar Nueva Venta</span>
        </button>
      </div>
    </div>
  )
}
