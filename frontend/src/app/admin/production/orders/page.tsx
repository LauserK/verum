'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from '@/components/I18nProvider'
import { ClipboardList, ChevronLeft, Plus, Loader2, Search, Filter, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'
import { adminApi, ProductionOrderResponse } from '@/lib/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function ProductionOrdersPage() {
    const { t } = useTranslations('production')
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadOrders()
    }, [])

    async function loadOrders() {
        setLoading(true)
        try {
            const allOrders = await adminApi.getProductionOrders()
            setOrders(allOrders)
        } catch (err) {
            console.error('Error loading orders:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredOrders = orders.filter(o => 
        o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.items?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin/production" className="p-2 hover:bg-surface-raised rounded-full transition-colors">
                        <ChevronLeft className="w-5 h-5 text-text-secondary" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary">Órdenes de Producción</h1>
                        <p className="text-sm text-text-secondary">Historial y seguimiento de fabricación</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Link 
                        href="/admin/production/orders/new"
                        className="flex-1 md:flex-none px-6 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Nueva Orden
                    </Link>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <input 
                        type="text"
                        placeholder="Buscar por número u producto..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-surface-raised border border-border rounded-xl pl-10 pr-4 h-11 text-sm outline-none focus:border-primary"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button className="flex-1 md:flex-none px-4 h-11 border border-border rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-surface-raised transition-all text-text-secondary">
                        <Filter className="w-4 h-4" /> Filtros
                    </button>
                    <button onClick={loadOrders} className="p-3 border border-border rounded-xl hover:bg-surface-raised transition-all text-text-secondary">
                        <ArrowUpDown className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Orders Table */}
            <div className="bg-surface rounded-3xl border border-border overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-20 text-center text-text-secondary">
                        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 opacity-20" />
                        Cargando órdenes...
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4 text-text-secondary/20">
                            <ClipboardList className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-text-primary mb-1">No se encontraron órdenes</h3>
                        <p className="text-text-secondary text-sm">Prueba ajustando los filtros o crea una nueva orden.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-surface-raised/50 border-b border-border">
                                    <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Orden</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Producto</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Cant. Objetivo</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Estado</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Programado</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Almacén</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-surface-raised/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="font-mono text-sm font-bold text-text-primary">{order.order_number}</p>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                                order.priority === 'urgent' ? 'bg-error text-text-inverse' : 
                                                order.priority === 'high' ? 'bg-warning text-text-inverse' : 'bg-surface-raised text-text-secondary'
                                            }`}>
                                                {order.priority}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-text-primary">{order.items?.name}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-black text-text-primary">
                                                {Number(order.qty_ordered_base).toLocaleString()}
                                                <span className="text-[10px] text-text-secondary ml-1 uppercase">{order.items?.uom_base?.name}</span>
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                order.status === 'completed' ? 'bg-success/10 text-success' :
                                                order.status === 'in_progress' ? 'bg-primary/10 text-primary' :
                                                order.status === 'cancelled' ? 'bg-error/10 text-error' :
                                                'bg-surface-raised text-text-secondary'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${
                                                    order.status === 'completed' ? 'bg-success' :
                                                    order.status === 'in_progress' ? 'bg-primary animate-pulse' :
                                                    order.status === 'cancelled' ? 'bg-error' :
                                                    'bg-text-secondary'
                                                }`}></span>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-text-primary">{format(new Date(order.scheduled_date || order.created_at), 'dd MMM yyyy', { locale: es })}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs text-text-secondary">{order.warehouses?.name}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
