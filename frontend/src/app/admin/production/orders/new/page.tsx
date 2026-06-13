'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi, Warehouse, InventoryItem, UOMPresentation } from '@/lib/api'
import { useVenue } from '@/components/VenueContext'
import { ArrowLeft, Save, Loader2, Package, Warehouse as WarehouseIcon, Calendar, Search } from 'lucide-react'
import Link from 'next/link'
import ScalerPanel from '@/components/production/ScalerPanel'
import ConfirmationModal from '@/components/ConfirmationModal'
import { format } from 'date-fns'

export default function NewProductionOrderPage() {
    const router = useRouter()
    const { availableVenues } = useVenue()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' })
    const [items, setItems] = useState<InventoryItem[]>([])
    
    // Form state
    const [venueId, setVenueId] = useState('')
    const [warehouseId, setWarehouseId] = useState('')
    const [itemId, setItemId] = useState('')
    const [targetQty, setTargetQty] = useState<number>(1)
    const [targetUomId, setTargetUomId] = useState('')
    const [scheduledDate, setScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [priority, setPriority] = useState('normal')
    
    // Search state
    const [searchQuery, setSearchQuery] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    
    // Derived state
    const [presentations, setPresentations] = useState<UOMPresentation[]>([])
    const [productionWarehouse, setProductionWarehouse] = useState<Warehouse | null>(null)
    const [isStockValid, setIsStockValid] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const itemsData = await adminApi.getInventoryItems()
            setItems(itemsData)
        } catch (err) {
            console.error('Error loading items:', err)
        } finally {
            setLoading(false)
        }
    }

    // Handle venue change to find production warehouse
    useEffect(() => {
        if (venueId) {
            adminApi.getInventoryWarehouses().then(whs => {
                const prodWh = whs.find(w => w.venue_id === venueId && w.type === 'production')
                setProductionWarehouse(prodWh || null)
                if (prodWh) {
                    setWarehouseId(prodWh.id)
                } else {
                    setWarehouseId('')
                }
            })
        } else {
            setProductionWarehouse(null)
            setWarehouseId('')
        }
    }, [venueId])

    // Handle item selection to load presentations
    useEffect(() => {
        if (itemId) {
            adminApi.getItemPresentations(itemId).then(pres => {
                setPresentations(pres)
                // Set default presentation if available, otherwise stay at "" (base unit)
                const def = pres.find(p => p.is_default)
                if (def) setTargetUomId(def.id)
                else setTargetUomId('')
            })
        } else {
            setPresentations([])
            setTargetUomId('')
        }
    }, [itemId])

    const handleItemSelect = (item: InventoryItem) => {
        setItemId(item.id)
        setSearchQuery(item.name)
        setShowSuggestions(false)
    }

    async function handleSave() {
        if (!itemId || !warehouseId || !targetQty || !scheduledDate) {
            setErrorModal({ isOpen: true, message: 'Por favor completa todos los campos obligatorios.' })
            return
        }

        const selectedPres = presentations.find(p => p.id === targetUomId)
        const factor = selectedPres ? selectedPres.conversion_factor : 1
        const qtyBase = targetQty * factor

        setSaving(true)
        try {
            await adminApi.createProductionOrder({
                item_id: itemId,
                warehouse_id: warehouseId,
                qty_ordered_base: qtyBase,
                presentation_id: targetUomId || null,
                scheduled_date: scheduledDate,
                priority: priority
            })
            router.push('/admin/production/orders')
        } catch (err: any) {
            console.error('Error creating production order:', err)
            setErrorModal({ isOpen: true, message: err?.message || 'Error al crear la orden de producción' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20 px-4">
            <ConfirmationModal 
                isOpen={errorModal.isOpen}
                title="Error"
                message={errorModal.message}
                confirmLabel="Entendido"
                cancelLabel=""
                onConfirm={() => setErrorModal({ ...errorModal, isOpen: false })}
                onCancel={() => setErrorModal({ ...errorModal, isOpen: false })}
            />

            <div className="flex items-center gap-4">
                <Link href="/admin/production/orders" className="p-2 hover:bg-surface-raised rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-text-secondary" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Nueva Orden de Producción</h1>
                    <p className="text-sm text-text-secondary">Escalado reactivo basado en recetas</p>
                </div>
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-8">
                {/* Header Section: Venue, Warehouse, Date, Priority */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Sede</label>
                        <select 
                            value={venueId}
                            onChange={e => setVenueId(e.target.value)}
                            className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary appearance-none"
                        >
                            <option value="">Seleccionar Sede</option>
                            {availableVenues.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Almacén de Producción</label>
                        <div className="relative">
                            <WarehouseIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input 
                                type="text"
                                value={productionWarehouse?.name || 'Selecciona sede...'}
                                readOnly
                                className="w-full bg-surface-raised border border-border rounded-xl pl-10 pr-4 h-11 text-sm text-text-primary outline-none"
                            />
                        </div>
                        {venueId && !productionWarehouse && (
                            <p className="text-[10px] text-error mt-1 font-medium">Esta sede no tiene almacén de tipo 'production'</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Fecha Programada</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input 
                                type="date"
                                value={scheduledDate}
                                onChange={e => setScheduledDate(e.target.value)}
                                className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-11 text-sm text-text-primary outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Prioridad</label>
                        <select 
                            value={priority}
                            onChange={e => setPriority(e.target.value)}
                            className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary"
                        >
                            <option value="low">Baja</option>
                            <option value="normal">Normal</option>
                            <option value="high">Alta</option>
                            <option value="urgent">Urgente</option>
                        </select>
                    </div>
                </div>

                {/* Product Section: Search, Qty, UOM */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    <div className="md:col-span-6 relative">
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Producto a Producir</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onFocus={() => setShowSuggestions(true)}
                                onChange={e => {
                                    setSearchQuery(e.target.value)
                                    setShowSuggestions(true)
                                    if (!e.target.value) setItemId('')
                                }}
                                placeholder="Buscar producto con receta..."
                                className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-11 text-sm text-text-primary outline-none focus:border-primary"
                            />
                        </div>
                        
                        {showSuggestions && searchQuery.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                {items
                                    .filter(item => 
                                        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        item.code?.toLowerCase().includes(searchQuery.toLowerCase())
                                    )
                                    .map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleItemSelect(item)}
                                            className="w-full text-left px-4 py-3 hover:bg-surface-raised border-b border-border last:border-0 flex items-center gap-3"
                                        >
                                            <Package className="w-4 h-4 text-primary" />
                                            <div>
                                                <p className="text-sm font-medium text-text-primary">{item.name}</p>
                                                <p className="text-[10px] text-text-secondary uppercase">{item.code} • {item.uom_name}</p>
                                            </div>
                                        </button>
                                    ))
                                }
                            </div>
                        )}
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Cantidad Objetivo</label>
                        <input 
                            type="number"
                            value={targetQty}
                            onChange={e => setTargetQty(parseFloat(e.target.value) || 0)}
                            min="0.01"
                            step="0.01"
                            className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary"
                        />
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Unidad</label>
                        <select 
                            value={targetUomId}
                            onChange={e => setTargetUomId(e.target.value)}
                            className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary appearance-none"
                            disabled={!itemId}
                        >
                            <option value="">{items.find(i => i.id === itemId)?.uom_name || 'Unidad Base'}</option>
                            {presentations.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Reactive Scaler Panel */}
                <div className="pt-4 border-t border-border">
                    <ScalerPanel 
                        itemId={itemId}
                        targetQty={targetQty}
                        targetUomId={targetUomId || presentations.find(p => p.is_default)?.id || ''}
                        warehouseId={warehouseId}
                        onValidationChange={setIsStockValid}
                    />
                </div>

                {/* Footer Actions */}
                <div className="pt-6 border-t border-border flex justify-end gap-3">
                    <Link 
                        href="/admin/production/orders"
                        className="px-6 h-11 border border-border text-text-primary rounded-xl font-bold text-sm hover:bg-surface-raised transition-all flex items-center"
                    >
                        Cancelar
                    </Link>
                    <button 
                        onClick={handleSave}
                        disabled={saving || !itemId || !warehouseId}
                        className="px-8 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Crear Orden de Producción
                    </button>
                </div>
            </div>
        </div>
    )
}
