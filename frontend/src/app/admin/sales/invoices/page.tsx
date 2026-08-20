'use client'

import { useState } from 'react'
import { useInvoices } from '@/hooks/useSales'
import Link from 'next/link'
import { FileText, Plus, Search, Filter, MoreVertical } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function InvoicesPage() {
  const { data: invoices, isLoading } = useInvoices()
  const [searchTerm, setSearchTerm] = useState('')

  const filteredInvoices = invoices?.filter(inv => 
    (inv.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Histórico de Facturas
          </h1>
          <p className="text-sm text-text-secondary mt-1">Gestión de facturas emitidas por POS o manualmente</p>
        </div>
        <Link href="/admin/sales/invoices/new" className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 shrink-0 active:scale-95">
          <Plus className="w-4 h-4" /> Nueva Factura
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input 
                    type="text"
                    placeholder="Buscar por número..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface-raised border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:border-primary outline-none transition-colors"
                />
            </div>
            <button className="p-2 border border-border rounded-xl text-text-secondary hover:text-primary hover:border-primary transition-colors">
                <Filter className="w-4 h-4" />
            </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-[10px] font-black uppercase tracking-wider text-text-secondary">
                <th className="pb-3 pl-2">Fecha</th>
                <th className="pb-3">Número</th>
                <th className="pb-3">Cliente</th>
                <th className="pb-3 text-right">Subtotal</th>
                <th className="pb-3 text-right">Impuestos</th>
                <th className="pb-3 text-right">Total</th>
                <th className="pb-3 text-center">Estado</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {isLoading ? (
                <tr>
                    <td colSpan={8} className="py-8 text-center text-text-secondary animate-pulse">Cargando facturas...</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                    <td colSpan={8} className="py-8 text-center text-text-secondary">No se encontraron facturas.</td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-raised/50 transition-colors group">
                    <td className="py-3 pl-2 text-text-secondary">
                        {format(new Date(inv.created_at), "dd MMM, yyyy", { locale: es })}
                    </td>
                    <td className="py-3 font-mono text-xs font-bold text-text-primary">
                        {inv.invoice_number}
                    </td>
                    <td className="py-3 text-text-primary">
                        {inv.customer_id || 'Consumidor Final'}
                    </td>
                    <td className="py-3 text-right font-mono text-text-secondary">
                        {inv.subtotal.toFixed(2)} {inv.currency}
                    </td>
                    <td className="py-3 text-right font-mono text-text-secondary">
                        {inv.tax_total.toFixed(2)} {inv.currency}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-text-primary">
                        {inv.total_amount.toFixed(2)} {inv.currency}
                    </td>
                    <td className="py-3 text-center">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            inv.status === 'confirmed' ? 'bg-success/10 text-success border border-success/20' :
                            inv.status === 'voided' ? 'bg-error/10 text-error border border-error/20' :
                            'bg-surface-raised text-text-secondary border border-border'
                        }`}>
                            {inv.status}
                        </span>
                    </td>
                    <td className="py-3 text-right pr-2">
                        <button className="p-1 text-text-secondary hover:text-primary transition-colors rounded">
                            <MoreVertical className="w-4 h-4" />
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
