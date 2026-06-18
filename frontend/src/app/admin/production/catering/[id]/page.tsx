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
    ArrowRight,
    Edit2,
    Plus,
    Trash2,
    X,
    Search,
    Save
} from 'lucide-react'
import Link from 'next/link'
import { adminApi, CateringRequest, MRPResultResponse, Warehouse, InventoryItem, getProfile, Profile } from '@/lib/api'
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
    const [profile, setProfile] = useState<Profile | null>(null)
    
    // Config States
    const [eventDate, setEventDate] = useState('')
    const [tentativeDate, setTentativeDate] = useState('')
    const [bufferPercent, setBufferPercent] = useState(0)
    const [savingConfig, setSavingConfig] = useState(false)

    // Edit Items State
    const [showEditItemsModal, setShowEditItemsModal] = useState(false)
    const [allItems, setAllItems] = useState<InventoryItem[]>([])
    const [editingLines, setEditingLines] = useState<any[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [savingLines, setSavingLines] = useState(false)

    const formatCeilQty = (val: number): string => {
        const rounded = Math.ceil(val * 100) / 100
        return rounded.toString()
    }

    const handleOpenEditModal = async () => {
        setEditingLines(request?.lines?.map(line => ({
            item_id: line.item_id,
            qty_base: line.qty_base,
            item_name: line.items?.name || line.item_name || '',
            uom_name: line.items?.uom_base?.name || line.uom_name || 'un'
        })) || [])
        setShowEditItemsModal(true)
        if (allItems.length === 0) {
            try {
                const items = await adminApi.getInventoryItems()
                setAllItems(items.filter(i => i.is_active))
            } catch (err) {
                console.error('Error loading items:', err)
            }
        }
    }

    const handleSaveConfig = async () => {
        if (!request) return
        setSavingConfig(true)
        try {
            const payload = {
                name: request.name,
                event_date: eventDate || null,
                notes: request.notes,
                tentative_production_date: tentativeDate || null,
                buffer_percentage: Number(bufferPercent) || 0,
                lines: request.lines?.map(l => ({
                    item_id: l.item_id,
                    qty_base: Number(l.qty_base),
                    presentation_id: l.presentation_id || null,
                    qty_presentation: l.qty_presentation || null
                })) || []
            }
            await adminApi.updateCateringRequest(id as string, payload)
            await loadData()
            setMrpResult(null) // Reset plan since requirements/scale changed
            alert('Configuración guardada exitosamente')
        } catch (err) {
            console.error('Error saving config:', err)
            alert('Error al guardar la configuración: ' + (err as Error).message)
        } finally {
            setSavingConfig(false)
        }
    }

    const handleSaveLines = async () => {
        if (!request) return
        setSavingLines(true)
        try {
            const payload = {
                name: request.name,
                event_date: eventDate || null,
                notes: request.notes,
                tentative_production_date: tentativeDate || null,
                buffer_percentage: Number(bufferPercent) || 0,
                lines: editingLines.map(l => ({
                    item_id: l.item_id,
                    qty_base: Number(l.qty_base),
                    presentation_id: null,
                    qty_presentation: null
                }))
            }
            await adminApi.updateCateringRequest(id as string, payload)
            await loadData()
            setMrpResult(null) // Reset plan since requirements changed
            setShowEditItemsModal(false)
        } catch (err) {
            console.error('Error saving lines:', err)
            alert('Error al guardar los artículos: ' + (err as Error).message)
        } finally {
            setSavingLines(false)
        }
    }

    const handleAddItem = (item: InventoryItem) => {
        if (editingLines.some(l => l.item_id === item.id)) {
            alert('El artículo ya está en la lista')
            return
        }
        setEditingLines([...editingLines, {
            item_id: item.id,
            qty_base: 1.0,
            item_name: item.name,
            uom_name: item.uom_name || 'un'
        }])
    }

    const filteredCatalogItems = allItems.filter(item => {
        const query = searchQuery.toLowerCase()
        return item.name.toLowerCase().includes(query) || (item.code && item.code.toLowerCase().includes(query))
    })
    
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
            const [reqData, whData, profData] = await Promise.all([
                adminApi.getCateringRequest(id as string),
                adminApi.getInventoryWarehouses(),
                getProfile().catch(() => null)
            ])
            setRequest(reqData)
            setEventDate(reqData.event_date || '')
            setTentativeDate(reqData.tentative_production_date || '')
            setBufferPercent(reqData.buffer_percentage || 0)
            setWarehouses(whData)
            setProfile(profData)
            
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
        <div className="max-w-[1500px] mx-auto space-y-6 pb-20 px-4">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-4">
                    <Link href="/admin/production/catering" className="group p-2.5 bg-surface hover:bg-surface-raised border border-border rounded-xl transition-all duration-300">
                        <ChevronLeft className="w-4 h-4 text-text-secondary group-hover:text-primary group-hover:-translate-x-0.5 transition-all" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-text-primary tracking-tight">{request.name}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                request.status === 'confirmed' ? 'bg-success/10 text-success' :
                                request.status === 'cancelled' ? 'bg-error/10 text-error' :
                                'bg-primary/10 text-primary'
                            }`}>
                                {request.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-text-secondary text-xs font-medium">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                {request.event_date ? format(new Date(request.event_date), 'dd MMMM yyyy', { locale: es }) : 'Sin fecha'}
                            </div>
                            {request.notes && <div className="text-xs border-l border-border pl-3 text-text-secondary/80">"{request.notes}"</div>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full lg:w-auto">
                    <div className="flex-1 lg:w-56">
                        <select 
                            value={selectedWarehouseId}
                            onChange={e => setSelectedWarehouseId(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg px-3 h-10 text-xs font-semibold outline-none focus:border-primary transition-all appearance-none"
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
                        className="px-5 h-10 bg-primary text-text-inverse rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:bg-primary-hover shadow-md shadow-primary/10 transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                        {calculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Correr MRP
                    </button>
                </div>
            </div>

            {/* Event Settings Panel */}
            <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-end transition-all duration-300 hover:border-border-raised">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-text-secondary uppercase tracking-wider mb-1.5">Fecha del Evento</label>
                    <input 
                        type="date"
                        value={eventDate}
                        onChange={e => setEventDate(e.target.value)}
                        className="w-full bg-surface-raised/50 border border-border/80 hover:border-border rounded-lg px-3 h-10 text-xs font-semibold outline-none focus:border-primary focus:bg-surface transition-all"
                    />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        Fecha Tentativa Prod.
                    </label>
                    <input 
                        type="date"
                        value={tentativeDate}
                        onChange={e => setTentativeDate(e.target.value)}
                        className="w-full bg-surface-raised/50 border border-border/80 hover:border-border rounded-lg px-3 h-10 text-xs font-semibold outline-none focus:border-primary focus:bg-surface transition-all"
                    />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-black text-text-secondary uppercase tracking-wider mb-1.5">Porcentaje de Respaldo</label>
                    <div className="relative">
                        <input 
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={bufferPercent === 0 ? '' : bufferPercent}
                            onChange={e => setBufferPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-surface-raised/50 border border-border/80 hover:border-border rounded-lg pl-3 pr-8 h-10 text-xs font-bold outline-none focus:border-primary focus:bg-surface transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-secondary">%</span>
                    </div>
                </div>
                <div className="flex-shrink-0">
                    <button 
                        onClick={handleSaveConfig}
                        disabled={savingConfig}
                        className="px-5 h-10 border border-border/80 hover:bg-surface-raised text-text-primary rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                        {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Guardar Configuración
                    </button>
                </div>
            </div>

            {/* Main Console Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Column 1: Base Requirements */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-primary/10 rounded-md text-primary">
                                <Package className="w-4 h-4" />
                            </div>
                            <h2 className="font-bold text-text-primary uppercase tracking-wider text-xs">Requerimientos Base</h2>
                        </div>
                        <span className="text-[8px] font-bold text-text-secondary bg-surface border border-border px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                            {request.lines?.length || 0} Items
                        </span>
                    </div>
                    
                    <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
                        <div className="divide-y divide-border">
                            {[...(request.lines || [])]
                                .sort((a, b) => (a.items?.name || a.item_name || '').localeCompare(b.items?.name || b.item_name || ''))
                                .map((line, idx) => (
                                <div key={idx} className="py-2.5 px-4 grid grid-cols-12 gap-2 items-center hover:bg-surface-raised transition-colors">
                                    <div className="col-span-7 min-w-0">
                                        <p className="font-medium text-xs text-text-primary truncate">{line.items?.name}</p>
                                    </div>
                                    <div className="col-span-2 text-center">
                                        <span className="text-[9px] font-semibold text-text-secondary bg-surface-raised border border-border/40 px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                                            {line.items?.uom_base?.name}
                                        </span>
                                    </div>
                                    <div className="col-span-3 text-right">
                                        <p className="text-xs font-bold text-primary">{line.qty_base}</p>
                                    </div>
                                </div>
                            ))}
                            {(!request.lines || request.lines.length === 0) ? (
                                <div className="p-10 text-center space-y-3">
                                    <p className="text-text-secondary text-xs font-medium">No hay items en este evento</p>
                                    <button 
                                        onClick={handleOpenEditModal}
                                        className="mx-auto px-5 h-9 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Agregar Artículos
                                    </button>
                                </div>
                            ) : (
                                <div className="p-3 bg-surface-raised/20 border-t border-border flex justify-center">
                                    <button 
                                        onClick={handleOpenEditModal}
                                        className="w-full h-9 border border-border hover:bg-surface-raised rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-text-secondary hover:text-text-primary active:scale-[0.98]"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" /> Editar Artículos
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 2: Production Plan */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-warning/10 rounded-md text-warning">
                                <ChefHat className="w-4 h-4" />
                            </div>
                            <h2 className="font-bold text-text-primary uppercase tracking-wider text-xs">Plan de Producción</h2>
                        </div>
                        {mrpResult && (
                            <button 
                                onClick={handleGenerateOrders}
                                disabled={generatingOrders || request.status !== 'planning'}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-success text-text-inverse rounded-full text-[9px] font-bold uppercase tracking-wider hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {generatingOrders ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                Generar OPs
                            </button>
                        )}
                    </div>

                    <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm min-h-[160px]">
                        {!mrpResult ? (
                            <div className="flex flex-col items-center justify-center p-10 text-center space-y-3">
                                <div className="w-12 h-12 bg-surface-raised rounded-xl flex items-center justify-center text-text-secondary/20">
                                    <ChefHat className="w-6 h-6" />
                                </div>
                                <p className="text-xs text-text-secondary font-medium">Corre el MRP para ver qué necesitas cocinar</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {[...(mrpResult.production_plan || [])]
                                    .sort((a, b) => a.item_name.localeCompare(b.item_name))
                                    .map((item, idx) => (
                                    <div key={idx} className="py-2.5 px-4 grid grid-cols-12 gap-2 items-center hover:bg-surface-raised transition-colors">
                                        <div className="col-span-7 min-w-0">
                                            <p className="font-medium text-xs text-text-primary truncate">{item.item_name}</p>
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <span className="text-[9px] font-semibold text-text-secondary bg-surface-raised border border-border/40 px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                                                {item.uom_name}
                                            </span>
                                        </div>
                                        <div className="col-span-3 text-right">
                                            <p className="text-xs font-bold text-warning">{item.qty_to_produce}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 3: Purchase List */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-error/10 rounded-md text-error">
                                <ShoppingCart className="w-4 h-4" />
                            </div>
                            <h2 className="font-bold text-text-primary uppercase tracking-wider text-xs">Lista de Compras</h2>
                        </div>
                        {mrpResult && (
                            <button 
                                onClick={() => handlePrint()}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-text-primary text-text-inverse rounded-full text-[9px] font-bold uppercase tracking-wider hover:bg-text-secondary transition-all active:scale-95"
                            >
                                <Printer className="w-3 h-3" />
                                Exportar PDF
                            </button>
                        )}
                    </div>

                    <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm min-h-[160px]">
                        {!mrpResult ? (
                            <div className="flex flex-col items-center justify-center p-10 text-center space-y-3">
                                <div className="w-12 h-12 bg-surface-raised rounded-xl flex items-center justify-center text-text-secondary/20">
                                    <ShoppingCart className="w-6 h-6" />
                                </div>
                                <p className="text-xs text-text-secondary font-medium">Corre el MRP para ver qué insumos te faltan</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {[...(mrpResult.purchase_list || [])]
                                    .sort((a, b) => a.item_name.localeCompare(b.item_name))
                                    .map((item, idx) => (
                                    <div key={idx} className="p-4 hover:bg-surface-raised transition-colors">
                                        <div className="grid grid-cols-12 gap-2 items-center mb-2">
                                            <div className="col-span-10 min-w-0">
                                                <p className="font-medium text-xs text-text-primary truncate">{item.item_name}</p>
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <span className="text-[9px] font-semibold text-text-secondary bg-surface-raised border border-border/40 px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                                                    {item.uom_name}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <div className="bg-surface-raised p-1.5 px-2 rounded-lg border border-border/40">
                                                <p className="text-[8px] font-bold text-text-secondary uppercase tracking-wider">Stock</p>
                                                <p className="text-xs font-semibold">{formatCeilQty(item.qty_available)}</p>
                                            </div>
                                            <div className="bg-surface-raised p-1.5 px-2 rounded-lg border border-border/40">
                                                <p className="text-[8px] font-bold text-text-secondary uppercase tracking-wider">Necesario</p>
                                                <p className="text-xs font-semibold">{formatCeilQty(item.qty_needed)}</p>
                                            </div>
                                            <div className={`p-1.5 px-2 rounded-lg border ${item.qty_deficit > 0 ? 'bg-error/5 border-error/10' : 'bg-success/5 border-success/10'}`}>
                                                <p className="text-[8px] font-bold text-text-secondary uppercase tracking-wider">Faltante</p>
                                                <p className={`text-xs font-bold ${item.qty_deficit > 0 ? 'text-error' : 'text-success'}`}>{formatCeilQty(item.qty_deficit)}</p>
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
                            tentativeProductionDate: request.tentative_production_date || tentativeDate,
                            purchaseList: [...mrpResult.purchase_list].sort((a, b) => a.item_name.localeCompare(b.item_name)),
                            generatedBy: profile?.full_name || 'Sistema'
                        }}
                    />
                )}
            </div>

            {/* Edit Items Modal */}
            {showEditItemsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-surface border border-border rounded-3xl w-full max-w-4xl h-[75vh] p-8 shadow-2xl relative flex flex-col animate-in zoom-in-95 duration-300">
                        <button 
                            onClick={() => setShowEditItemsModal(false)}
                            className="absolute top-6 right-6 p-2 bg-surface hover:bg-surface-raised border border-border text-text-secondary hover:text-text-primary rounded-xl transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="mb-5 flex-shrink-0">
                            <h2 className="text-xl font-bold text-text-primary tracking-tight">Editar Requerimientos</h2>
                            <p className="text-xs text-text-secondary mt-0.5">Agrega, modifica o elimina los productos de este catering.</p>
                        </div>

                        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                            {/* Left Panel: Current Selection */}
                            <div className="flex flex-col min-h-0 border border-border/80 rounded-2xl p-4 bg-surface-raised/30">
                                <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-3">Artículos Seleccionados ({editingLines.length})</h3>
                                <div className="flex-grow overflow-y-auto space-y-2.5 pr-2">
                                    {editingLines.map((line, idx) => (
                                        <div key={line.item_id} className="flex items-center justify-between p-3 bg-surface border border-border/60 rounded-xl gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-xs text-text-primary truncate">{line.item_name}</p>
                                                <p className="text-[9px] font-medium text-text-secondary uppercase tracking-wider">{line.uom_name}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number"
                                                    value={line.qty_base}
                                                    min="0.01"
                                                    step="any"
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value) || 0
                                                        const newLines = [...editingLines]
                                                        newLines[idx].qty_base = val
                                                        setEditingLines(newLines)
                                                    }}
                                                    className="w-16 bg-bg border border-border rounded-lg px-1.5 h-8 text-center text-xs font-bold outline-none focus:border-primary"
                                                />
                                                <button 
                                                    onClick={() => setEditingLines(editingLines.filter((_, i) => i !== idx))}
                                                    className="p-1.5 bg-error/5 hover:bg-error/10 text-error rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {editingLines.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-6">
                                            <Package className="w-10 h-10 text-text-secondary/20 mb-2.5" />
                                            <p className="text-xs text-text-secondary font-medium">No hay productos seleccionados.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Panel: Catalog Search */}
                            <div className="flex flex-col min-h-0 border border-border/80 rounded-2xl p-4 bg-surface-raised/30">
                                <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-3">Catálogo de Artículos</h3>
                                
                                <div className="relative mb-3 flex-shrink-0">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
                                    <input 
                                        type="text"
                                        placeholder="Buscar por nombre..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 h-8.5 text-xs font-semibold outline-none focus:border-primary/50 transition-all placeholder:text-text-secondary/50"
                                    />
                                </div>

                                <div className="flex-grow overflow-y-auto space-y-1.5 pr-2">
                                    {filteredCatalogItems.map(item => (
                                        <button 
                                            key={item.id}
                                            onClick={() => handleAddItem(item)}
                                            className="w-full flex items-center justify-between p-2.5 bg-surface border border-border/60 hover:border-primary/40 hover:bg-surface-raised rounded-xl text-left transition-all group"
                                        >
                                            <div className="min-w-0 pr-3">
                                                <p className="font-semibold text-xs text-text-primary truncate group-hover:text-primary transition-colors">{item.name}</p>
                                                <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">{item.uom_name || 'un'}</p>
                                            </div>
                                            <div className="p-1 bg-primary/15 text-primary rounded-md group-hover:bg-primary group-hover:text-text-inverse transition-all">
                                                <Plus className="w-3 h-3" />
                                            </div>
                                        </button>
                                    ))}
                                    {filteredCatalogItems.length === 0 && (
                                        <div className="py-6 text-center">
                                            <p className="text-xs text-text-secondary">No se encontraron artículos</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-5 border-t border-border flex justify-end gap-2.5 flex-shrink-0">
                            <button 
                                onClick={() => setShowEditItemsModal(false)}
                                className="px-5 h-10 border border-border rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-surface-raised transition-colors text-text-secondary"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSaveLines}
                                disabled={savingLines}
                                className="px-6 h-10 bg-primary text-text-inverse rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:bg-primary-hover shadow-md shadow-primary/10 transition-all disabled:opacity-50"
                            >
                                {savingLines ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Guardar Requerimientos
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
