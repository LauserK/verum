'use client'

import React, { useState, useEffect } from 'react'
import { adminApi, Warehouse, Profile } from '@/lib/api'
import { useVenue } from '@/components/VenueContext'
import { Loader2, ChefHat, Clock, MapPin, LayoutGrid, Package, X, AlertTriangle } from 'lucide-react'

export default function KDSPage() {
    const { availableVenues } = useVenue()
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [selectedVenueId, setSelectedVenueId] = useState('')
    const [productionWarehouse, setProductionWarehouse] = useState<Warehouse | null>(null)
    const [saving, setSaving] = useState(false)

    // Detail Modal State
    const [selectedOrder, setSelectedOrder] = useState<any>(null)
    const [recipeData, setRecipeData] = useState<any>(null)
    const [recipeLoading, setRecipeLoading] = useState(false)

    // Completion State
    const [completingOrder, setCompletingOrder] = useState<any>(null)
    const [qtyProduced, setQtyProduced] = useState(0)
    const [varianceError, setVarianceError] = useState<any>(null)

    useEffect(() => {
        const storedProfile = localStorage.getItem('profile')
        if (storedProfile) {
            setProfile(JSON.parse(storedProfile))
        }
        
        if (availableVenues.length > 0 && !selectedVenueId) {
            setSelectedVenueId(availableVenues[0].id)
        }
    }, [availableVenues])

    useEffect(() => {
        if (selectedVenueId) {
            loadKDSData()
        }
    }, [selectedVenueId])

    async function loadKDSData() {
        setLoading(true)
        try {
            const whs = await adminApi.getInventoryWarehouses()
            const prodWh = whs.find(w => w.venue_id === selectedVenueId && w.type === 'production')
            setProductionWarehouse(prodWh || null)

            if (prodWh) {
                const kdsOrders = await adminApi.getKDSOrders(prodWh.id)
                setOrders(kdsOrders)
            } else {
                setOrders([])
            }
        } catch (err) {
            console.error('Error loading KDS data:', err)
        } finally {
            setLoading(false)
        }
    }

    async function openDetail(order: any) {
        setSelectedOrder(order)
        setRecipeLoading(true)
        try {
            const data = await adminApi.getRecipe(order.item_id)
            setRecipeData(data)
        } catch (err) {
            console.error('Error loading recipe:', err)
            setRecipeData(null)
        } finally {
            setRecipeLoading(false)
        }
    }

    async function handleAction(order: any) {
        if (order.status === 'pending') {
            setSaving(true)
            try {
                await adminApi.updateOrderStatus(order.id, 'in_progress')
                await loadKDSData()
                setSelectedOrder(null)
            } catch (err) {
                console.error('Error starting order:', err)
            } finally {
                setSaving(false)
            }
        } else if (order.status === 'in_progress') {
            setCompletingOrder(order)
            setQtyProduced(order.qty_ordered_base)
            setVarianceError(null)
        }
    }

    async function handleFinalize(ignoreVariance = false) {
        setSaving(true)
        try {
            await adminApi.completeProductionOrder(completingOrder.id, {
                qty_produced_base: qtyProduced,
                ignore_variance: ignoreVariance
            })
            setCompletingOrder(null)
            setSelectedOrder(null)
            await loadKDSData()
        } catch (err: any) {
            console.error('Error finalizing order:', err)
            // Backend returns error details in message for now
            if (err.message?.includes('VARIANCE_EXCEEDED')) {
                try {
                    const errorDetails = JSON.parse(err.message)
                    setVarianceError(errorDetails)
                } catch {
                    alert('Error de varianza detectado.')
                }
            } else {
                alert(err.message || 'Error al finalizar la producción')
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen bg-bg text-text-primary flex flex-col p-4 md:p-6">
            {/* KDS Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-border mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                        <ChefHat className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">KDS Producción</h1>
                        <div className="flex items-center gap-4 mt-0.5">
                            <select 
                                value={selectedVenueId}
                                onChange={e => setSelectedVenueId(e.target.value)}
                                className="bg-transparent border-none text-sm text-text-secondary font-medium outline-none cursor-pointer hover:text-primary transition-colors p-0"
                            >
                                {availableVenues.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                            <span className="text-border">|</span>
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary uppercase font-bold tracking-widest">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden sm:flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] text-text-secondary uppercase font-black tracking-tighter">Órdenes Activas</p>
                            <p className="text-xl font-bold text-primary">{orders.length}</p>
                        </div>
                        <div className="h-8 w-px bg-border"></div>
                    </div>

                    {profile && (
                        <div className="flex items-center gap-3 bg-surface-raised px-4 py-2 rounded-2xl border border-border shadow-sm">
                            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center font-bold text-text-inverse shadow-lg shadow-primary/20">
                                {profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                            </div>
                            <div className="leading-tight">
                                <p className="font-bold text-sm">{profile.full_name}</p>
                                <p className="text-[10px] text-text-secondary uppercase font-bold">{profile.role}</p>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* KDS Grid Container */}
            <main className="flex-1 overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex flex-center items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
                    </div>
                ) : !productionWarehouse ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-surface border border-border border-dashed rounded-3xl">
                        <MapPin className="w-12 h-12 text-text-secondary mb-4 opacity-20" />
                        <h3 className="text-xl font-bold text-text-primary mb-2">Sin Almacén de Producción</h3>
                        <p className="text-text-secondary max-w-sm">
                            Esta sede no tiene configurado un almacén de tipo 'Producción'. 
                            Configúralo en la sección de Inventario para ver las comandas.
                        </p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-surface border border-border border-dashed rounded-3xl">
                        <LayoutGrid className="w-12 h-12 text-text-secondary mb-4 opacity-20" />
                        <h3 className="text-xl font-bold text-text-primary mb-2">No hay órdenes pendientes</h3>
                        <p className="text-text-secondary max-w-sm">
                            Todo el trabajo de cocina está al día. Las nuevas órdenes aparecerán aquí automáticamente.
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start pb-20">
                        {orders.map(order => (
                            <div 
                                key={order.id} 
                                onClick={() => openDetail(order)}
                                className={`
                                    bg-surface border-2 rounded-3xl p-5 shadow-lg cursor-pointer transition-all hover:scale-[1.02] active:scale-95 flex flex-col h-full
                                    ${order.priority === 'urgent' ? 'border-error/40 bg-error/5 shadow-error/10' : 
                                      order.priority === 'high' ? 'border-warning/40 bg-warning/5 shadow-warning/10' : 
                                      order.status === 'in_progress' ? 'border-primary/40 bg-primary/5 shadow-primary/10' : 'border-border'}
                                `}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`
                                        text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest
                                        ${order.priority === 'urgent' ? 'bg-error text-text-inverse' : 
                                          order.priority === 'high' ? 'bg-warning text-text-inverse' : 'bg-surface-raised text-text-secondary'}
                                    `}>
                                        {order.priority}
                                    </span>
                                    <span className="text-text-secondary font-mono text-[10px]">{order.order_number}</span>
                                </div>

                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-text-primary leading-tight mb-2">{order.items?.name}</h3>
                                    <p className="text-4xl font-black text-text-primary tracking-tighter">
                                        {Number(order.qty_ordered_base).toLocaleString()}
                                        <span className="text-lg text-text-secondary ml-1.5 font-bold uppercase">{order.items?.uom_base?.name}</span>
                                    </p>
                                </div>

                                <div className="mt-6 pt-4 border-t border-border/50 flex justify-between items-center">
                                    {order.status === 'in_progress' ? (
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                                            <span className="text-[10px] font-bold text-success uppercase">En Proceso</span>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] font-bold text-text-secondary uppercase">Pendiente</span>
                                    )}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleAction(order); }}
                                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors ${
                                            order.status === 'in_progress' ? 'bg-success text-text-inverse hover:bg-success-dark' : 'bg-primary text-text-inverse hover:bg-primary-hover'
                                        }`}
                                    >
                                        {order.status === 'in_progress' ? 'COMPLETAR' : 'INICIAR'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface border border-border rounded-[40px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-border flex justify-between items-start bg-surface-raised/50">
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider bg-primary/10 text-primary`}>
                                        {selectedOrder.priority}
                                    </span>
                                    <span className="text-text-secondary font-mono text-sm tracking-widest">{selectedOrder.order_number}</span>
                                </div>
                                <h2 className="text-4xl font-black text-text-primary tracking-tight">{selectedOrder.items?.name}</h2>
                                <p className="text-primary font-black text-2xl mt-2 tracking-tighter uppercase">
                                    OBJETIVO: {Number(selectedOrder.qty_ordered_base).toLocaleString()} {selectedOrder.items?.uom_base?.name}
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedOrder(null)}
                                className="p-3 bg-surface hover:bg-surface-raised border border-border text-text-secondary hover:text-text-primary rounded-2xl transition-all shadow-sm"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-12 flex-1">
                            {/* Ingredients */}
                            <section>
                                <h3 className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                    <Package className="w-4 h-4" /> Ingredientes a Usar
                                </h3>
                                {recipeLoading ? (
                                    <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary opacity-30" /></div>
                                ) : (
                                    <div className="space-y-3">
                                        {(recipeData?.ingredients || []).map((ing: any, i: number) => {
                                            // Scale the ingredient based on order qty vs yield base
                                            const factor = Number(selectedOrder.qty_ordered_base) / Number(recipeData.yield_qty_base);
                                            const scaledQty = Number(ing.qty_base) * factor;
                                            
                                            return (
                                                <div key={i} className="flex justify-between items-center bg-surface-raised p-4 rounded-2xl border border-border/50">
                                                    <span className="font-bold text-text-primary">{ing.items?.name || 'Ingrediente'}</span>
                                                    <span className="font-mono text-primary font-black bg-primary/5 px-3 py-1 rounded-lg">
                                                        {scaledQty.toLocaleString()} {ing.items?.uom_base?.name}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>

                            {/* Steps */}
                            <section>
                                <h3 className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Pasos de Elaboración
                                </h3>
                                {recipeLoading ? (
                                    <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary opacity-30" /></div>
                                ) : (
                                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:h-full before:w-0.5 before:bg-border/50">
                                        {(recipeData?.steps || []).map((step: any, i: number) => (
                                            <div key={i} className="relative pl-10 group">
                                                <div className="absolute left-0 top-0 flex items-center justify-center w-8 h-8 rounded-full border-2 border-primary bg-surface text-primary font-black text-xs z-10">
                                                    {i + 1}
                                                </div>
                                                <div className="bg-surface-raised p-4 rounded-2xl border border-border/50 group-hover:border-primary/30 transition-colors">
                                                    <p className="text-sm font-medium text-text-primary leading-relaxed">{step.description}</p>
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <Clock className="w-3 h-3 text-text-secondary" />
                                                        <span className="text-[10px] text-text-secondary font-black uppercase tracking-wider">{step.estimated_time_minutes} min</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>

                        <div className="p-8 border-t border-border bg-surface-raised/50 flex justify-end">
                            <button 
                                onClick={() => handleAction(selectedOrder)}
                                disabled={saving}
                                className={`
                                    px-12 py-5 rounded-[20px] font-black transition-all text-xl shadow-2xl flex items-center gap-3 disabled:opacity-50
                                    ${selectedOrder.status === 'in_progress' ? 'bg-success text-text-inverse hover:scale-105 shadow-success/30' : 'bg-primary text-text-inverse hover:scale-105 shadow-primary/30'}
                                `}
                            >
                                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                                {selectedOrder.status === 'in_progress' ? 'FINALIZAR PRODUCCIÓN' : 'INICIAR PRODUCCIÓN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
