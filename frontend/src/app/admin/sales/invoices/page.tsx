'use client'

import { useState, useMemo, useEffect } from 'react'
import { useInvoices } from '@/hooks/useSales'
import Link from 'next/link'
import { FileText, Plus, Search, Filter, MoreVertical, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100, 150]

export default function InvoicesPage() {
  const { data: invoices, isLoading } = useInvoices()
  const [searchTerm, setSearchTerm] = useState('')
  const [pageSize, setPageSize] = useState<number>(15)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Reset to page 1 when searching or changing page size
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, pageSize])

  const filteredInvoices = useMemo(() => {
    if (!invoices) return []
    const q = searchTerm.toLowerCase().trim()
    if (!q) return invoices
    return invoices.filter(inv => {
      const num = inv.document_number || inv.invoice_number || ''
      const cust = inv.customer_name || ''
      return num.toLowerCase().includes(q) || cust.toLowerCase().includes(q)
    })
  }, [invoices, searchTerm])

  const totalItems = filteredInvoices.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Ensure currentPage is within range
  const validCurrentPage = Math.min(currentPage, totalPages)

  const paginatedInvoices = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize
    return filteredInvoices.slice(start, start + pageSize)
  }, [filteredInvoices, validCurrentPage, pageSize])

  const startIndex = totalItems === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1
  const endIndex = Math.min(validCurrentPage * pageSize, totalItems)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (validCurrentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages)
      } else if (validCurrentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, '...', validCurrentPage - 1, validCurrentPage, validCurrentPage + 1, '...', totalPages)
      }
    }
    return pages
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Pagada</span>
      case 'confirmed':
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">Confirmada</span>
      case 'partial':
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">Parcial</span>
      case 'draft':
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-raised text-text-secondary border border-border">Borrador</span>
      case 'void':
      case 'voided':
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">Anulada</span>
      default:
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-raised text-text-secondary border border-border">{status}</span>
    }
  }

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
        <div className="flex gap-2 items-center max-w-md">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input 
                    type="text"
                    placeholder="Buscar por número o cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface-raised border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:border-primary outline-none transition-colors"
                />
            </div>
            <button className="p-2 border border-border rounded-xl text-text-secondary hover:text-primary hover:border-primary transition-colors shrink-0">
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
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                    <td colSpan={8} className="py-8 text-center text-text-secondary">No se encontraron facturas.</td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => {
                  const docNum = inv.document_number || inv.invoice_number || 'S/N'
                  const custName = inv.customer_name || 'Consumidor Final'
                  const curr = inv.currency_code || inv.currency || 'USD'
                  const sub = Number(inv.subtotal || 0)
                  const tax = Number(inv.total_tax ?? inv.tax_total ?? 0)
                  const tot = Number(inv.total ?? inv.total_amount ?? 0)
                  
                  return (
                    <tr key={inv.id} className="hover:bg-surface-raised/50 transition-colors group">
                      <td className="py-3 pl-2 text-text-secondary whitespace-nowrap">
                          {inv.created_at ? format(new Date(inv.created_at), "dd MMM, yyyy HH:mm", { locale: es }) : '-'}
                      </td>
                      <td className="py-3 font-mono text-xs font-bold text-text-primary">
                          {docNum}
                      </td>
                      <td className="py-3 text-text-primary font-medium">
                          {custName}
                      </td>
                      <td className="py-3 text-right font-mono text-text-secondary">
                          {sub.toFixed(2)} {curr}
                      </td>
                      <td className="py-3 text-right font-mono text-text-secondary">
                          {tax.toFixed(2)} {curr}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-text-primary">
                          {tot.toFixed(2)} {curr}
                      </td>
                      <td className="py-3 text-center">
                          {getStatusBadge(inv.status)}
                      </td>
                      <td className="py-3 text-right pr-2">
                          <button className="p-1 text-text-secondary hover:text-primary transition-colors rounded">
                              <MoreVertical className="w-4 h-4" />
                          </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Barra de Paginación */}
        {!isLoading && totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              <div>
                Mostrando <span className="font-semibold text-text-primary">{startIndex}</span> a <span className="font-semibold text-text-primary">{endIndex}</span> de <span className="font-semibold text-text-primary">{totalItems}</span> facturas
              </div>

              <div className="flex items-center gap-2 border-l border-border pl-3">
                <span>Por página:</span>
                <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-surface-raised border border-border rounded-lg px-2 py-1 text-xs font-semibold text-text-primary outline-none cursor-pointer focus:border-primary transition-colors"
                >
                    {PAGE_SIZE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Primera Página */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={validCurrentPage === 1}
                title="Primera página"
                className="p-2 rounded-lg border border-border bg-surface hover:bg-surface-raised disabled:opacity-40 disabled:pointer-events-none transition-colors text-text-secondary hover:text-text-primary"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Página Anterior */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={validCurrentPage === 1}
                title="Página anterior"
                className="p-2 rounded-lg border border-border bg-surface hover:bg-surface-raised disabled:opacity-40 disabled:pointer-events-none transition-colors text-text-secondary hover:text-text-primary"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Botones numéricos de página */}
              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) => {
                  if (page === '...') {
                    return (
                      <span key={`dots-${idx}`} className="px-2 py-1 text-xs text-text-disabled select-none">
                        ...
                      </span>
                    )
                  }
                  const pageNum = Number(page)
                  const isActive = pageNum === validCurrentPage
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-primary text-text-inverse shadow-sm'
                          : 'border border-border bg-surface hover:bg-surface-raised text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              {/* Página Siguiente */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={validCurrentPage === totalPages}
                title="Página siguiente"
                className="p-2 rounded-lg border border-border bg-surface hover:bg-surface-raised disabled:opacity-40 disabled:pointer-events-none transition-colors text-text-secondary hover:text-text-primary"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Última Página */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={validCurrentPage === totalPages}
                title="Última página"
                className="p-2 rounded-lg border border-border bg-surface hover:bg-surface-raised disabled:opacity-40 disabled:pointer-events-none transition-colors text-text-secondary hover:text-text-primary"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

