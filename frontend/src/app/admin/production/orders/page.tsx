'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from '@/components/I18nProvider'
import { ClipboardList, ChevronLeft, Plus, Loader2, Search, Filter, ArrowUpDown, X, Clock, User, Package, History, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { adminApi, ProductionOrderResponse, ProductionOrderDetailResponse } from '@/lib/api'
import { format, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'

export default function ProductionOrdersPage() {
    const { t } = useTranslations('production')
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    
    // Detail Modal State
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
    const [detailData, setDetailData] = useState<ProductionOrderDetailResponse | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

    useEffect(() => {
        loadOrders()
    }, [])

    useEffect(() => {
        if (selectedOrderId) {
            fetchOrderDetail(selectedOrderId)
        } else {
            setDetailData(null)
        }
    }, [selectedOrderId])

    async function fetchOrderDetail(id: string) {
        setLoadingDetail(true)
        try {
            const detail = await adminApi.getProductionOrderDetail(id)
            setDetailData(detail)
        } catch (err) {
            console.error('Error loading order detail:', err)
        } finally {
            setLoadingDetail(false)
        }
    }

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
        <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4 relative">
            {/* Detail Modal */}
            {selectedOrderId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface border border-border rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                        {loadingDetail ? (
                            <div className="p-20 text-center flex flex-col items-center gap-4">
                                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                <p className="text-sm font-bold text-text-secondary uppercase tracking-widest">Cargando Auditoría...</p>
                            </div>
                        ) : detailData ? (
                            <>
                                {/* Modal Header */}
                                <div className="p-8 border-b border-border flex justify-between items-start bg-surface-raised/30">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                                detailData.priority === 'urgent' ? 'bg-error text-text-inverse' : 
                                                detailData.priority === 'high' ? 'bg-warning text-text-inverse' : 'bg-surface-raised text-text-secondary'
                                            }`}>
                                                {detailData.priority}
                                            </span>
                                            <span className="text-text-secondary font-mono text-sm tracking-tighter">{detailData.order_number}</span>
                                        </div>
                                        <h2 className="text-3xl font-black text-text-primary tracking-tight">{detailData.items?.name}</h2>
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary uppercase">
                                                <History className="w-3.5 h-3.5" /> {detailData.status}
                                            </div>
                                            {detailData.completed_at && (
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-success uppercase">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Completada el {format(new Date(detailData.completed_at), 'dd MMM, HH:mm', { locale: es })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedOrderId(null)}
                                        className="p-3 bg-surface hover:bg-surface-raised border border-border text-text-secondary hover:text-text-primary rounded-2xl transition-all shadow-sm"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                                    {/* Left Column: Stats & Meta */}
                                    <div className="lg:col-span-4 space-y-6">
                                        <div className="bg-surface-raised p-6 rounded-3xl border border-border space-y-4">
                                            <div>
                                                <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Rendimiento Real</p>
                                                <p className="text-3xl font-black text-text-primary tracking-tighter">
                                                    {detailData.qty_produced_base !== null && detailData.qty_produced_base !== undefined ? Number(detailData.qty_produced_base).toLocaleString() : '---'}
                                                    <span className="text-lg text-text-secondary ml-1 font-bold">{detailData.items?.uom_base?.name}</span>
                                                </p>
                                                <p className="text-xs text-text-secondary mt-1">Objetivo: {Number(detailData.qty_ordered_base).toLocaleString()} {detailData.items?.uom_base?.name}</p>
                                            </div>

                                            {detailData.yield_variance_pct !== null && (
                                                <div className={`p-3 rounded-2xl flex items-center justify-between ${detailData.yield_alert_triggered ? 'bg-error/10 text-error border border-error/20' : 'bg-success/10 text-success border border-success/20'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {detailData.yield_alert_triggered ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                                        <span className="text-xs font-bold uppercase">Varianza</span>
                                                    </div>
                                                    <span className="font-black">{detailData.yield_variance_pct?.toFixed(2)}%</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4 px-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-surface-raised rounded-xl flex items-center justify-center border border-border">
                                                    <User className="w-4 h-4 text-text-secondary" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-text-secondary uppercase">Procesado por</p>
                                                    <p className="text-sm font-bold text-text-primary">{detailData.assigned_to_profile?.full_name || 'Desconocido'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-surface-raised rounded-xl flex items-center justify-center border border-border">
                                                    <Clock className="w-4 h-4 text-text-secondary" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-text-secondary uppercase">Tiempo de Proceso</p>
                                                    <p className="text-sm font-bold text-text-primary">
                                                        {detailData.started_at && detailData.completed_at ? 
                                                            `${differenceInMinutes(new Date(detailData.completed_at), new Date(detailData.started_at))} minutos` : 
                                                            'Tiempo no disponible'
                                                        }
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-surface-raised rounded-xl flex items-center justify-center border border-border">
                                                    <Package className="w-4 h-4 text-text-secondary" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-text-secondary uppercase">Almacén Destino</p>
                                                    <p className="text-sm font-bold text-text-primary">{detailData.target_warehouse?.name || detailData.origin_warehouse?.name}</p>
                                                </div>
                                            </div>

                                            {detailData.produced_lots.length > 0 && (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                                                        <span className="text-[10px] font-black text-primary">LOT</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-text-secondary uppercase">Lote Generado</p>
                                                        <p className="text-sm font-mono font-bold text-primary">{detailData.produced_lots[0].lot_number}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Column: Consumptions */}
                                    <div className="lg:col-span-8 space-y-4">
                                        <h3 className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <Package className="w-4 h-4" /> Insumos Consumidos
                                        </h3>
                                        <div className="bg-surface-raised rounded-3xl border border-border overflow-hidden">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-bg/50 border-b border-border">
                                                    <tr>
                                                        <th className="px-6 py-3 font-bold text-text-secondary uppercase text-[10px]">Ingrediente</th>
                                                        <th className="px-6 py-3 font-bold text-text-secondary uppercase text-[10px] text-right">Planificado</th>
                                                        <th className="px-6 py-3 font-bold text-text-secondary uppercase text-[10px] text-right text-primary">Real (Est.)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/50">
                                                    {detailData.consumptions.map((c, i) => (
                                                        <tr key={i} className="hover:bg-bg/30 transition-colors">
                                                            <td className="px-6 py-4 font-bold text-text-primary">{c.items?.name}</td>
                                                            <td className="px-6 py-4 font-mono text-right text-text-secondary">
                                                                {Number(c.qty_planned_base).toLocaleString()} {c.items?.uom_base?.name}
                                                            </td>
                                                            <td className="px-6 py-4 font-mono text-right font-black text-primary">
                                                                {Number(c.qty_planned_base).toLocaleString()} {c.items?.uom_base?.name}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {detailData.notes && (
                                            <div className="mt-6 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Notas de Producción</p>
                                                <p className="text-sm text-text-primary leading-relaxed">{detailData.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="p-20 text-center text-error">No se pudo cargar el detalle.</div>
                        )}
                    </div>
                </div>
            )}

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
                                    <tr 
                                        key={order.id} 
                                        onClick={() => setSelectedOrderId(order.id)}
                                        className="hover:bg-surface-raised/30 transition-colors group cursor-pointer"
                                    >
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
