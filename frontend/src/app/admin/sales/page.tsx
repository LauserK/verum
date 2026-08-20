'use client'

import { ShoppingBag, Users, FileText, Settings, ArrowRight, BarChart } from 'lucide-react'
import Link from 'next/link'
import { useVenue } from '@/components/VenueContext'

export default function SalesDashboardPage() {
  const { availableVenues } = useVenue()

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Módulo de Ventas</h1>
          <p className="text-sm text-text-secondary mt-1">Gestión administrativa de ventas, clientes y configuración</p>
        </div>
      </div>

      {/* Submenu Redirection Links */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        <Link href="/admin/sales/invoices" className="px-4 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold hover:border-primary transition-colors flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Histórico de Facturas
        </Link>
        <Link href="/admin/sales/customers" className="px-4 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold hover:border-primary transition-colors flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Clientes
        </Link>
        <Link href="/admin/sales/config" className="px-4 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold hover:border-primary transition-colors flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> Configuración POS
        </Link>
        <Link href="/pos/session" className="px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-bold hover:bg-primary/20 transition-all flex items-center gap-2 ml-auto">
          <ShoppingBag className="w-4 h-4" /> Abrir POS
        </Link>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-border">
        {/* Quick Actions */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm col-span-1">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChart className="w-4 h-4" /> Accesos Rápidos
            </h2>
            <div className="space-y-3">
                <Link href="/admin/sales/invoices/new" className="flex justify-between items-center p-3 bg-surface-raised rounded-xl border border-border hover:border-primary transition-colors group">
                    <span className="text-sm font-medium">Crear Factura Manual (B2B)</span>
                    <ArrowRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
                </Link>
                <Link href="/admin/sales/customers" className="flex justify-between items-center p-3 bg-surface-raised rounded-xl border border-border hover:border-primary transition-colors group">
                    <span className="text-sm font-medium">Alta de Nuevo Cliente</span>
                    <ArrowRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
                </Link>
            </div>
        </div>

        {/* Placeholder for Stats */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm lg:col-span-2 flex items-center justify-center min-h-[200px]">
             <div className="text-center">
                 <ShoppingBag className="w-8 h-8 text-border mx-auto mb-3" />
                 <p className="text-text-secondary text-sm">Los gráficos de ventas diarios aparecerán aquí una vez que haya suficiente información de los terminales POS.</p>
             </div>
        </div>
      </section>
    </div>
  )
}
