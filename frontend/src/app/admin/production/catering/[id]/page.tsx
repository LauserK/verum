'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from '@/components/I18nProvider'
import { 
    ChevronLeft, 
    Loader2, 
    Play, 
    Printer, 
    Package, 
    ChefHat, 
    ShoppingCart, 
    AlertTriangle, 
    CheckCircle2, 
    Calendar,
    ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { adminApi, CateringRequest, MRPResultResponse, Warehouse } from '@/lib/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useReactToPrint } from 'react-to-print'
import { MRPPurchaseListPrint } from '@/components/production/MRPPurchaseListPrint'

export default function MRPConsolePage() {
    const { id } = useParams()
    const router = useRouter()
    const { t } = useTranslations('production')
    
    const [request, setRequest] = useState<CateringRequest | null>(null)
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
    const [loading, setLoading] = useState(true)
    const [calculating, setCalculating] = useState(false)
    const [generatingOrders, setGeneratingOrders] = useState(false)
    const [mrpResult, setMrpResult] = useState<MRPResultResponse | null>(null)
    
    // Printing
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `MRP-${request?.name || 'Catering'}`
    })

    useEffect(() => {
        loadData()
    }, [id])

    async function loadData() {
        setLoading(true)
        try {
            const [reqData, whData] = await Promise.all([
                adminApi.getCateringRequest(id as string),
                adminApi.getInventoryWarehouses()
            ])
            setRequest(reqData)
            setWarehouses(whData)
            
            // Auto-select first production warehouse
            const prodWh = whData.find(w => w.type === 'production')
            if (prodWh) setSelectedWarehouseId(prodWh.id)
            else if (whData.length > 0) setSelectedWarehouseId(whData[0].id)
            
        } catch (err) {
            console.error('Error loading data:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleRunMRP() {
        if (!selectedWarehouseId) return
        setCalculating(true)
        try {
            const result = await adminApi.generateMRPPlan(id as string, selectedWarehouseId)
            setMrpResult(result)
        } catch (err) {
            console.error('Error running MRP:', err)
        } finally {
            setCalculating(false)
        }
    }

    async function handleGenerateOrders() {
        if (!selectedWarehouseId || !request) return
        setGeneratingOrders(true)
        try {
            await adminApi.generateMRPOrders(id as string, {
                warehouse_id: selectedWarehouseId,
                target_warehouse_id: selectedWarehouseId, // For now, same
                scheduled_date: request.event_date || format(new Date(), 'yyyy-MM-dd')
            })
            // Reload request to see status change
            const updated = await adminApi.getCateringRequest(id as string)
            setRequest(updated)
            alert('Órdenes de producción generadas exitosamente')
        } catch (err) {
            console.error('Error generating orders:', err)
            alert('Error al generar órdenes: ' + (err as Error).message)
        } finally {
            setGeneratingOrders(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="w-12 h-12 animate-spin text-primary opacity-40 mb-4" />
                <p className="text-xs font-black uppercase tracking-widest text-text-secondary">Cargando Consola MRP...</p>
            </div>
        )
    }

    if (!request) {
        return (
            <div className="p-12 text-center">
                <p className="text-text-secondary">Evento no encontrado</p>
                <Link href="/admin/production/catering" className="text-primary font-bold mt-4 inline-block">Volver a la lista</Link>
            </div>
        )
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-20 px-4">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-5">
                    <Link href="/admin/production/catering" className="group p-3 bg-surface hover:bg-surface-raised border border-border rounded-2xl transition-all duration-300">
                        <ChevronLeft className="w-5 h-5 text-text-secondary group-hover:text-primary group-hover:-translate-x-0.5 transition-all" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black text-text-primary tracking-tight">{request.name}</h1>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                request.status === 'confirmed' ? 'bg-success/10 text-success' :
                                request.status === 'cancelled' ? 'bg-error/10 text-error' :
                                'bg-primary/10 text-primary'
                            }`}>
                                {request.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-text-secondary font-medium">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                {request.event_date ? format(new Date(request.event_date), 'dd MMMM yyyy', { locale: es }) : 'Sin fecha'}
                            </div>
                            {request.notes && <div className="text-sm border-l border-border pl-4 italic">"{request.notes}"</div>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="flex-1 lg:w-64">
                        <select 
                            value={selectedWarehouseId}
                            onChange={e => setSelectedWarehouseId(e.target.value)}
                            className="w-full bg-surface border border-border rounded-xl px-4 h-12 text-sm font-bold outline-none focus:border-primary transition-all appearance-none"
                        >
                            <option value="">Seleccionar Almacén...</option>
                            {warehouses.map(wh => (
                                <option key={wh.id} value={wh.id}>{wh.name} ({wh.type})</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={handleRunMRP}
                        disabled={calculating || !selectedWarehouseId}
                        className="px-8 h-12 bg-primary text-text-inverse rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                    >
                        {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Correr MRP
                    </button>
                </div>
            </div>

            {/* Main Console Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Column 1: Base Requirements */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Package className="w-5 h-5" />
                            </div>
                            <h2 className="font-black text-text-primary uppercase tracking-widest text-sm">Requerimientos Base</h2>
                        </div>
                        <span className="text-[10px] font-black text-text-secondary bg-surface border border-border px-2 py-1 rounded-md uppercase tracking-widest">
                            {request.lines?.length || 0} Items
                        </span>
                    </div>
                    
                    <div className="bg-surface border border-border rounded-[32px] overflow-hidden">
                        <div className="divide-y divide-border">
                            {request.lines?.map((line, idx) => (
                                <div key={idx} className="p-5 flex items-center justify-between hover:bg-surface-raised transition-colors">
                                    <div>
                                        <p className="font-black text-text-primary">{line.items?.name}</p>
                                        <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{line.items?.uom_base?.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-primary">{line.qty_base}</p>
                                    </div>
                                </div>
                            ))}
                            {(!request.lines || request.lines.length === 0) && (
                                <div className="p-12 text-center">
                                    <p className="text-text-secondary text-sm font-medium">No hay items en este evento</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 2: Production Plan */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-warning/10 rounded-lg text-warning">
                                <ChefHat className="w-5 h-5" />
                            </div>
                            <h2 className="font-black text-text-primary uppercase tracking-widest text-sm">Plan de Producción</h2>
                        </div>
                        {mrpResult && (
                            <button 
                                onClick={handleGenerateOrders}
                                disabled={generatingOrders || request.status !== 'planning'}
                                className="flex items-center gap-2 px-3 py-1.5 bg-success text-text-inverse rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                            >
                                {generatingOrders ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                Generar OPs
                            </button>
                        )}
                    </div>

                    <div className="bg-surface border border-border rounded-[32px] overflow-hidden min-h-[200px]">
                        {!mrpResult ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                                <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center text-text-secondary/20">
                                    <ChefHat className="w-8 h-8" />
                                </div>
                                <p className="text-sm text-text-secondary font-medium">Corre el MRP para ver qué necesitas cocinar</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {mrpResult.production_plan.map((item, idx) => (
                                    <div key={idx} className="p-5 flex items-center justify-between hover:bg-surface-raised transition-colors">
                                        <div>
                                            <p className="font-black text-text-primary">{item.item_name}</p>
                                            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{item.uom_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-black text-warning">{item.qty_to_produce}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 3: Purchase List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-error/10 rounded-lg text-error">
                                <ShoppingCart className="w-5 h-5" />
                            </div>
                            <h2 className="font-black text-text-primary uppercase tracking-widest text-sm">Lista de Compras</h2>
                        </div>
                        {mrpResult && (
                            <button 
                                onClick={() => handlePrint()}
                                className="flex items-center gap-2 px-3 py-1.5 bg-text-primary text-text-inverse rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-text-secondary transition-all"
                            >
                                <Printer className="w-3 h-3" />
                                Exportar PDF
                            </button>
                        )}
                    </div>

                    <div className="bg-surface border border-border rounded-[32px] overflow-hidden min-h-[200px]">
                        {!mrpResult ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                                <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center text-text-secondary/20">
                                    <ShoppingCart className="w-8 h-8" />
                                </div>
                                <p className="text-sm text-text-secondary font-medium">Corre el MRP para ver qué insumos te faltan</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {mrpResult.purchase_list.map((item, idx) => (
                                    <div key={idx} className="p-5 hover:bg-surface-raised transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-black text-text-primary">{item.item_name}</p>
                                            <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">{item.uom_name}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-surface-raised p-2 rounded-xl border border-border/50">
                                                <p className="text-[8px] font-black text-text-secondary uppercase tracking-tighter">Stock</p>
                                                <p className="text-xs font-black">{item.qty_available}</p>
                                            </div>
                                            <div className="bg-surface-raised p-2 rounded-xl border border-border/50">
                                                <p className="text-[8px] font-black text-text-secondary uppercase tracking-tighter">Necesario</p>
                                                <p className="text-xs font-black">{item.qty_needed}</p>
                                            </div>
                                            <div className={`p-2 rounded-xl border ${item.qty_deficit > 0 ? 'bg-error/10 border-error/20' : 'bg-success/10 border-success/20'}`}>
                                                <p className="text-[8px] font-black text-text-secondary uppercase tracking-tighter">Faltante</p>
                                                <p className={`text-xs font-black ${item.qty_deficit > 0 ? 'text-error' : 'text-success'}`}>{item.qty_deficit}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Hidden Print Component */}
            <div className="hidden">
                {mrpResult && (
                    <MRPPurchaseListPrint 
                        ref={printRef}
                        data={{
                            eventName: request.name,
                            eventDate: request.event_date,
                            purchaseList: mrpResult.purchase_list
                        }}
                    />
                )}
            </div>
        </div>
    )
}
