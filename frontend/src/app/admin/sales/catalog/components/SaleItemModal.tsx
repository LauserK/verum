'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    X,
    Save,
    AlertCircle,
    Plus,
    Trash2,
    Layers,
    Utensils,
    SlidersHorizontal,
    Info,
    Percent,
    DollarSign,
    Check,
    HelpCircle,
    ArrowUpRight
} from 'lucide-react'
import {
    salesApi,
    SaleItem,
    SaleCategory,
    SaleItemVariant,
    SaleItemComponent,
    SaleModifierGroup,
    Tax
} from '@/lib/api/sales'
import { inventoryApi, InventoryItem } from '@/lib/api/inventory'

interface SaleItemModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    item?: SaleItem | null
    categories: SaleCategory[]
}

type TabType = 'general' | 'variants' | 'bom' | 'modifiers'

export default function SaleItemModal({
    isOpen,
    onClose,
    onSuccess,
    item,
    categories
}: SaleItemModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('general')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Dependencies
    const [taxes, setTaxes] = useState<Tax[]>([])
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
    const [modifierGroups, setModifierGroups] = useState<SaleModifierGroup[]>([])

    // General form state
    const [name, setName] = useState('')
    const [code, setCode] = useState('')
    const [barcode, setBarcode] = useState('')
    const [categoryId, setCategoryId] = useState<string>('')
    const [description, setDescription] = useState('')
    const [salePrice, setSalePrice] = useState<number | string>('')
    const [foodCost, setFoodCost] = useState<number | string>(0)
    const [taxId, setTaxId] = useState<string>('')
    const [taxIncluded, setTaxIncluded] = useState<boolean>(true)
    const [isActive, setIsActive] = useState<boolean>(true)
    const [isFeatured, setIsFeatured] = useState<boolean>(false)
    const [position, setPosition] = useState<number>(0)
    const [hasVariants, setHasVariants] = useState<boolean>(false)
    const [variantLabel, setVariantLabel] = useState<string>('Presentación')

    // Variants state
    const [variants, setVariants] = useState<SaleItemVariant[]>([])

    // BOM / Escandallo components state
    const [components, setComponents] = useState<SaleItemComponent[]>([])

    // Modifiers state
    const [selectedModifierGroupIds, setSelectedModifierGroupIds] = useState<string[]>([])

    // Fetch initial supporting data
    useEffect(() => {
        if (!isOpen) return

        const fetchSupportData = async () => {
            try {
                const [taxesRes, invRes, modRes] = await Promise.all([
                    salesApi.getTaxes(true).catch(() => []),
                    inventoryApi.getInventoryItems().catch(() => []),
                    salesApi.getModifierGroups().catch(() => [])
                ])
                setTaxes(taxesRes)
                setInventoryItems(invRes)
                setModifierGroups(modRes)
            } catch (err) {
                console.error('Error fetching supporting catalog data:', err)
            }
        }

        fetchSupportData()
    }, [isOpen])

    // Hydrate form when item changes
    useEffect(() => {
        if (!isOpen) return

        if (item) {
            setName(item.name || '')
            setCode(item.code || '')
            setBarcode(item.barcode || '')
            setCategoryId(item.category_id || '')
            setDescription(item.description || '')
            setSalePrice(item.sale_price !== null && item.sale_price !== undefined ? item.sale_price : '')
            setFoodCost(item.food_cost ?? 0)
            setTaxId(item.tax_id || '')
            setTaxIncluded(item.tax_included ?? true)
            setIsActive(item.is_active ?? true)
            setIsFeatured(item.is_featured ?? false)
            setPosition(item.position || 0)
            setHasVariants(item.has_variants ?? false)
            setVariantLabel(item.variant_label || 'Presentación')

            // Variants
            if (item.variants && item.variants.length > 0) {
                setVariants(item.variants.map((v, idx) => ({
                    id: v.id,
                    name: v.name,
                    price: Number(v.price) || 0,
                    food_cost: Number(v.food_cost) || 0,
                    external_code: v.external_code || '',
                    is_default: v.is_default ?? idx === 0,
                    position: v.position ?? idx,
                    is_active: v.is_active ?? true,
                    components: v.components || []
                })))
            } else {
                setVariants([])
            }

            // BOM
            if (item.components && item.components.length > 0) {
                setComponents(item.components.map((c, idx) => ({
                    id: c.id,
                    item_id: c.item_id,
                    item_name: c.item_name,
                    item_code: c.item_code,
                    component_type: c.component_type || 'fixed_qty',
                    quantity: Number(c.quantity) || 1,
                    label: c.label || '',
                    position: c.position ?? idx
                })))
            } else {
                setComponents([])
            }

            // Modifiers
            if (item.modifier_groups && item.modifier_groups.length > 0) {
                setSelectedModifierGroupIds(item.modifier_groups.map(g => g.id))
            } else if (item.modifier_group_ids) {
                setSelectedModifierGroupIds(item.modifier_group_ids)
            } else {
                setSelectedModifierGroupIds([])
            }
        } else {
            // New item defaults
            setName('')
            setCode('')
            setBarcode('')
            setCategoryId(categories[0]?.id || '')
            setDescription('')
            setSalePrice('')
            setFoodCost(0)
            setTaxId('')
            setTaxIncluded(true)
            setIsActive(true)
            setIsFeatured(false)
            setPosition(0)
            setHasVariants(false)
            setVariantLabel('Presentación')
            setVariants([])
            setComponents([])
            setSelectedModifierGroupIds([])
        }

        setActiveTab('general')
        setError(null)
    }, [item, isOpen, categories])

    // Calculate BOM Total Cost
    const bomCalculatedCost = useMemo(() => {
        let total = 0
        for (const comp of components) {
            const inv = inventoryItems.find(i => i.id === comp.item_id)
            const unitCost = Number(inv?.last_purchase_cost) || Number(inv?.production_cost) || 0
            const qty = Number(comp.quantity) || 0
            total += unitCost * qty
        }
        return total
    }, [components, inventoryItems])

    // Current price and cost for margin calculation
    const numPrice = Number(salePrice) || 0
    const numCost = Number(foodCost) || 0
    const grossMarginPct = useMemo(() => {
        if (numPrice <= 0) return 0
        return ((numPrice - numCost) / numPrice) * 100
    }, [numPrice, numCost])

    if (!isOpen) return null

    // Handlers for Variants
    const addVariant = () => {
        setVariants(prev => [
            ...prev,
            {
                name: '',
                price: numPrice,
                food_cost: numCost,
                external_code: '',
                is_default: prev.length === 0,
                position: prev.length,
                is_active: true
            }
        ])
    }

    const removeVariant = (index: number) => {
        setVariants(prev => prev.filter((_, i) => i !== index))
    }

    const updateVariant = (index: number, field: keyof SaleItemVariant, val: any) => {
        setVariants(prev => {
            const updated = [...prev]
            if (field === 'is_default' && val === true) {
                // Unset default on all others
                updated.forEach((v, i) => {
                    v.is_default = i === index
                })
            } else {
                updated[index] = { ...updated[index], [field]: val }
            }
            return updated
        })
    }

    // Handlers for BOM
    const addComponent = () => {
        if (inventoryItems.length === 0) return
        const firstInv = inventoryItems[0]
        setComponents(prev => [
            ...prev,
            {
                item_id: firstInv.id,
                item_name: firstInv.name,
                item_code: firstInv.code || undefined,
                component_type: 'fixed_qty',
                quantity: 1,
                position: prev.length
            }
        ])
    }

    const removeComponent = (index: number) => {
        setComponents(prev => prev.filter((_, i) => i !== index))
    }

    const updateComponent = (index: number, field: keyof SaleItemComponent, val: any) => {
        setComponents(prev => {
            const updated = [...prev]
            if (field === 'item_id') {
                const inv = inventoryItems.find(i => i.id === val)
                updated[index] = {
                    ...updated[index],
                    item_id: val,
                    item_name: inv?.name,
                    item_code: inv?.code || undefined
                }
            } else {
                updated[index] = { ...updated[index], [field]: val }
            }
            return updated
        })
    }

    const applyBomCostToItem = () => {
        setFoodCost(Number(bomCalculatedCost.toFixed(2)))
    }

    // Handlers for Modifiers
    const toggleModifierGroup = (groupId: string) => {
        setSelectedModifierGroupIds(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        )
    }

    // Save Form
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            setError('El nombre del producto es obligatorio')
            setActiveTab('general')
            return
        }

        if (hasVariants && variants.length === 0) {
            setError('Has activado variantes, debes agregar al menos una variante')
            setActiveTab('variants')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const payload: any = {
                name: name.trim(),
                code: code.trim() || null,
                barcode: barcode.trim() || null,
                category_id: categoryId || null,
                description: description.trim(),
                sale_price: salePrice !== '' ? Number(salePrice) : null,
                food_cost: Number(foodCost) || 0,
                tax_id: taxId || null,
                tax_included: taxIncluded,
                is_active: isActive,
                is_featured: isFeatured,
                position: Number(position) || 0,
                has_variants: hasVariants,
                variant_label: variantLabel.trim() || 'Presentación',
                modifier_group_ids: selectedModifierGroupIds,
                components: components.map((c, idx) => ({
                    item_id: c.item_id,
                    component_type: c.component_type,
                    quantity: Number(c.quantity) || 1,
                    label: c.label || null,
                    position: idx
                })),
                variants: hasVariants
                    ? variants.map((v, idx) => ({
                          name: v.name.trim(),
                          price: Number(v.price) || 0,
                          food_cost: Number(v.food_cost) || 0,
                          external_code: v.external_code?.trim() || null,
                          is_default: Boolean(v.is_default),
                          position: idx,
                          components: []
                      }))
                    : []
            }

            if (item) {
                await salesApi.updateSaleItem(item.id, payload)
            } else {
                await salesApi.createSaleItem(payload)
            }

            onSuccess()
            onClose()
        } catch (err: unknown) {
            console.error('Error saving sale item:', err)
            setError(err instanceof Error ? err.message : 'Error al guardar el producto')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-raised/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                            <Utensils className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-text-primary">
                                {item ? `Editar Producto: ${item.name}` : 'Nuevo Producto de Venta'}
                            </h2>
                            <p className="text-xs text-text-secondary">
                                Configura precio, variantes, receta/insumos (BOM) y modificadores
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b border-border bg-surface px-6 shrink-0 gap-1 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('general')}
                        className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                            activeTab === 'general'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        <Info className="w-4 h-4" />
                        General y Precios
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('variants')}
                        className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                            activeTab === 'variants'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        <Layers className="w-4 h-4" />
                        Variantes {hasVariants && `(${variants.length})`}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('bom')}
                        className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                            activeTab === 'bom'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        <Utensils className="w-4 h-4" />
                        Escandallo / Receta ({components.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('modifiers')}
                        className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                            activeTab === 'modifiers'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        Modificadores ({selectedModifierGroupIds.length})
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {error && (
                            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-400">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* TAB 1: GENERAL */}
                        {activeTab === 'general' && (
                            <div className="space-y-5 animate-in fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Name */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                                            Nombre del Producto <span className="text-rose-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Ej. Hamburguesa Clásica con Queso"
                                            required
                                            className="w-full h-11 px-3.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                                            Categoría
                                        </label>
                                        <select
                                            value={categoryId}
                                            onChange={(e) => setCategoryId(e.target.value)}
                                            className="w-full h-11 px-3.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                                        >
                                            <option value="">Sin Categoría</option>
                                            {categories.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.icon ? `${c.icon} ` : ''}{c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* SKU / Code */}
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                                            Código Interno / SKU
                                        </label>
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            placeholder="Ej. HAMB-001"
                                            className="w-full h-11 px-3.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                                        />
                                    </div>

                                    {/* Barcode */}
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                                            Código de Barras (EAN/UPC)
                                        </label>
                                        <input
                                            type="text"
                                            value={barcode}
                                            onChange={(e) => setBarcode(e.target.value)}
                                            placeholder="Ej. 750100123456"
                                            className="w-full h-11 px-3.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                                        />
                                    </div>

                                    {/* Tax / Alícuota */}
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                                            Impuesto / Alícuota
                                        </label>
                                        <select
                                            value={taxId}
                                            onChange={(e) => setTaxId(e.target.value)}
                                            className="w-full h-11 px-3.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                                        >
                                            <option value="">Exento (0.00%)</option>
                                            {taxes.map((t) => {
                                                const rateNum = Number(t.rate)
                                                // Handle if rate is stored as decimal 0.16 vs 16.0
                                                const percentage = rateNum <= 1 && rateNum > 0 ? (rateNum * 100).toFixed(2) : rateNum.toFixed(2)
                                                return (
                                                    <option key={t.id} value={t.id}>
                                                        {t.name} ({percentage}%)
                                                    </option>
                                                )
                                            })}
                                        </select>
                                    </div>
                                </div>

                                {/* Pricing Card & Margin Analysis */}
                                <div className="p-4 bg-surface-raised/60 border border-border rounded-2xl space-y-4">
                                    <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                                        <DollarSign className="w-4 h-4 text-primary" /> Estructura de Precios y Costos
                                    </h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-text-secondary mb-1">
                                                Precio de Venta Base ($)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={salePrice}
                                                onChange={(e) => setSalePrice(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full h-11 px-3.5 bg-surface border border-border rounded-xl text-text-primary text-sm font-semibold focus:outline-none focus:border-primary transition-colors"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-text-secondary mb-1">
                                                Costo de Alimento (Food Cost $)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={foodCost}
                                                onChange={(e) => setFoodCost(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full h-11 px-3.5 bg-surface border border-border rounded-xl text-text-primary text-sm font-semibold focus:outline-none focus:border-primary transition-colors"
                                            />
                                        </div>

                                        <div className="flex flex-col justify-end">
                                            <div className="h-11 px-3.5 bg-surface border border-border rounded-xl flex items-center justify-between">
                                                <span className="text-xs text-text-secondary">Margen Bruto</span>
                                                <span
                                                    className={`text-sm font-bold ${
                                                        grossMarginPct >= 65
                                                            ? 'text-emerald-400'
                                                            : grossMarginPct >= 40
                                                            ? 'text-amber-400'
                                                            : 'text-rose-400'
                                                    }`}
                                                >
                                                    {numPrice > 0 ? `${grossMarginPct.toFixed(1)}%` : '--'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tax Included Switch */}
                                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                        <div className="text-xs text-text-secondary">
                                            <p className="font-semibold text-text-primary">Impuesto incluido en el precio</p>
                                            <p className="text-[11px]">Si está activo, el desglose de IVA/Tax se calcula hacia atrás</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={taxIncluded}
                                                onChange={(e) => setTaxIncluded(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                        </label>
                                    </div>
                                </div>

                                {/* Variants Toggle Section */}
                                <div className="p-4 bg-surface-raised/40 border border-border rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-text-primary">¿Este producto tiene Variantes?</p>
                                            <p className="text-xs text-text-secondary">
                                                Activa si ofreces presentaciones o tamaños (ej. Pequeño / Grande / Combo)
                                            </p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={hasVariants}
                                                onChange={(e) => {
                                                    const checked = e.target.checked
                                                    setHasVariants(checked)
                                                    if (checked && variants.length === 0) {
                                                        setVariants([
                                                            {
                                                                name: 'Regular',
                                                                price: numPrice,
                                                                food_cost: numCost,
                                                                external_code: '',
                                                                is_default: true,
                                                                position: 0,
                                                                is_active: true
                                                            }
                                                        ])
                                                    }
                                                }}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                        </label>
                                    </div>

                                    {hasVariants && (
                                        <div className="pt-2">
                                            <label className="block text-xs font-semibold text-text-secondary mb-1">
                                                Etiqueta de la Variante (ej. Tamaño, Sabor, Presentación)
                                            </label>
                                            <input
                                                type="text"
                                                value={variantLabel}
                                                onChange={(e) => setVariantLabel(e.target.value)}
                                                placeholder="Ej. Tamaño"
                                                className="w-full sm:w-1/2 h-10 px-3 bg-surface border border-border rounded-xl text-text-primary text-xs focus:outline-none focus:border-primary transition-colors"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                                        Descripción / Notas en Menú
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Carne de res 100%, queso cheddar fundido, lechuga, tomate y salsa especial..."
                                        className="w-full p-3 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                                    />
                                </div>

                                {/* Status Switches */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-3 bg-surface-raised border border-border rounded-xl flex items-center justify-between">
                                        <span className="text-xs font-semibold text-text-primary">Producto Activo en POS</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isActive}
                                                onChange={(e) => setIsActive(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                        </label>
                                    </div>

                                    <div className="p-3 bg-surface-raised border border-border rounded-xl flex items-center justify-between">
                                        <span className="text-xs font-semibold text-text-primary">Destacado / Favorito ⭐</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isFeatured}
                                                onChange={(e) => setIsFeatured(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: VARIANTS */}
                        {activeTab === 'variants' && (
                            <div className="space-y-4 animate-in fade-in">
                                {!hasVariants ? (
                                    <div className="text-center py-10 bg-surface-raised/30 rounded-2xl border border-dashed border-border p-6">
                                        <Layers className="w-10 h-10 text-text-secondary mx-auto mb-3 opacity-60" />
                                        <p className="text-sm font-bold text-text-primary">Variantes desactivadas</p>
                                        <p className="text-xs text-text-secondary mt-1 mb-4">
                                            Para agregar múltiples opciones o tamaños de este producto, activa la casilla de variantes en la pestaña General.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHasVariants(true)
                                                if (variants.length === 0) {
                                                    setVariants([
                                                        {
                                                            name: 'Regular',
                                                            price: numPrice,
                                                            food_cost: numCost,
                                                            external_code: '',
                                                            is_default: true,
                                                            position: 0,
                                                            is_active: true
                                                        }
                                                    ])
                                                }
                                            }}
                                            className="px-4 py-2 bg-primary text-text-inverse rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors"
                                        >
                                            Activar Variantes Ahora
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-bold text-text-primary">
                                                    Variantes de {variantLabel || 'Presentación'}
                                                </h3>
                                                <p className="text-xs text-text-secondary">
                                                    Cada variante define su propio precio de venta y costo de elaboración
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={addVariant}
                                                className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Añadir Variante
                                            </button>
                                        </div>

                                        <div className="border border-border rounded-xl overflow-hidden bg-surface">
                                            <div className="grid grid-cols-12 gap-2 p-3 bg-surface-raised text-[11px] font-bold text-text-secondary uppercase tracking-wider border-b border-border">
                                                <div className="col-span-4">Nombre Variante</div>
                                                <div className="col-span-2 text-right">Precio ($)</div>
                                                <div className="col-span-2 text-right">Costo ($)</div>
                                                <div className="col-span-2">Código Ext.</div>
                                                <div className="col-span-1 text-center">Default</div>
                                                <div className="col-span-1 text-center">Acción</div>
                                            </div>

                                            <div className="divide-y divide-border">
                                                {variants.map((v, idx) => (
                                                    <div key={idx} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-surface-raised/40 transition-colors">
                                                        <div className="col-span-4">
                                                            <input
                                                                type="text"
                                                                value={v.name}
                                                                onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                                                                placeholder="Ej. Mediana / Grande"
                                                                required
                                                                className="w-full h-9 px-2.5 bg-surface-raised border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={v.price}
                                                                onChange={(e) => updateVariant(idx, 'price', Number(e.target.value))}
                                                                placeholder="0.00"
                                                                required
                                                                className="w-full h-9 px-2.5 bg-surface-raised border border-border rounded-lg text-xs font-semibold text-right text-text-primary focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={v.food_cost ?? 0}
                                                                onChange={(e) => updateVariant(idx, 'food_cost', Number(e.target.value))}
                                                                placeholder="0.00"
                                                                className="w-full h-9 px-2.5 bg-surface-raised border border-border rounded-lg text-xs text-right text-text-primary focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input
                                                                type="text"
                                                                value={v.external_code || ''}
                                                                onChange={(e) => updateVariant(idx, 'external_code', e.target.value)}
                                                                placeholder="SKU-VAR"
                                                                className="w-full h-9 px-2.5 bg-surface-raised border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 text-center">
                                                            <input
                                                                type="radio"
                                                                name="default_variant"
                                                                checked={Boolean(v.is_default)}
                                                                onChange={() => updateVariant(idx, 'is_default', true)}
                                                                className="w-4 h-4 text-primary cursor-pointer accent-primary"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeVariant(idx)}
                                                                disabled={variants.length <= 1}
                                                                className="p-1.5 text-text-secondary hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-30"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* TAB 3: ESCANDALLO / BOM */}
                        {activeTab === 'bom' && (
                            <div className="space-y-5 animate-in fade-in">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                            <Utensils className="w-4 h-4 text-primary" /> Receta de Insumos (Bill of Materials)
                                        </h3>
                                        <p className="text-xs text-text-secondary">
                                            Selecciona los insumos de inventario que se descuentan al vender este producto
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addComponent}
                                        className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Añadir Insumo / Receta
                                    </button>
                                </div>

                                {components.length === 0 ? (
                                    <div className="text-center py-10 bg-surface-raised/30 rounded-2xl border border-dashed border-border p-6">
                                        <Utensils className="w-10 h-10 text-text-secondary mx-auto mb-3 opacity-60" />
                                        <p className="text-sm font-bold text-text-primary">Sin insumos asignados</p>
                                        <p className="text-xs text-text-secondary mt-1 mb-4">
                                            Si configuras la receta, el sistema podrá descontar inventario automáticamente y calcular el costo exacto.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={addComponent}
                                            className="px-4 py-2 bg-surface-raised border border-border hover:border-primary text-text-primary rounded-xl text-xs font-semibold transition-colors"
                                        >
                                            Añadir Primer Insumo
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border border-border rounded-xl overflow-hidden bg-surface">
                                        <div className="grid grid-cols-12 gap-2 p-3 bg-surface-raised text-[11px] font-bold text-text-secondary uppercase tracking-wider border-b border-border">
                                            <div className="col-span-5">Insumo de Inventario</div>
                                            <div className="col-span-3">Tipo Descuento</div>
                                            <div className="col-span-2 text-right">Cant. Base</div>
                                            <div className="col-span-1 text-right">Costo Estim.</div>
                                            <div className="col-span-1 text-center">Acción</div>
                                        </div>

                                        <div className="divide-y divide-border">
                                            {components.map((comp, idx) => {
                                                const inv = inventoryItems.find(i => i.id === comp.item_id)
                                                const uCost = Number(inv?.last_purchase_cost) || Number(inv?.production_cost) || 0
                                                const lineCost = uCost * Number(comp.quantity || 0)

                                                return (
                                                    <div key={idx} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-surface-raised/40 transition-colors">
                                                        <div className="col-span-5">
                                                            <select
                                                                value={comp.item_id}
                                                                onChange={(e) => updateComponent(idx, 'item_id', e.target.value)}
                                                                className="w-full h-9 px-2.5 bg-surface-raised border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-primary"
                                                            >
                                                                {inventoryItems.map((item) => (
                                                                    <option key={item.id} value={item.id}>
                                                                        {item.name} {item.code ? `(${item.code})` : ''} - {item.uom_name || 'UOM'}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="col-span-3">
                                                            <select
                                                                value={comp.component_type}
                                                                onChange={(e) => updateComponent(idx, 'component_type', e.target.value)}
                                                                className="w-full h-9 px-2 bg-surface-raised border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-primary"
                                                            >
                                                                <option value="fixed_qty">Cantidad Fija (Directo)</option>
                                                                <option value="recipe_proportional">Proporcional (Receta)</option>
                                                            </select>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input
                                                                type="number"
                                                                step="0.001"
                                                                min="0.001"
                                                                value={comp.quantity}
                                                                onChange={(e) => updateComponent(idx, 'quantity', Number(e.target.value))}
                                                                placeholder="1.0"
                                                                required
                                                                className="w-full h-9 px-2.5 bg-surface-raised border border-border rounded-lg text-xs text-right font-semibold text-text-primary focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 text-right text-xs font-semibold text-text-primary">
                                                            ${lineCost.toFixed(2)}
                                                        </div>
                                                        <div className="col-span-1 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeComponent(idx)}
                                                                className="p-1.5 text-text-secondary hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Summary calculation bar */}
                                {components.length > 0 && (
                                    <div className="p-4 bg-surface-raised border border-border rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div>
                                            <p className="text-xs text-text-secondary">Costo Total Calculado por Escandallo:</p>
                                            <p className="text-lg font-bold text-text-primary">
                                                ${bomCalculatedCost.toFixed(2)}{' '}
                                                <span className="text-xs font-normal text-text-secondary">
                                                    (Food Cost actual en producto: ${numCost.toFixed(2)})
                                                </span>
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={applyBomCostToItem}
                                            className="px-3.5 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                                        >
                                            <Check className="w-4 h-4" /> Aplicar ${bomCalculatedCost.toFixed(2)} al Costo del Producto
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 4: MODIFIERS */}
                        {activeTab === 'modifiers' && (
                            <div className="space-y-4 animate-in fade-in">
                                <div>
                                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                        <SlidersHorizontal className="w-4 h-4 text-primary" /> Grupos de Modificadores Asociados
                                    </h3>
                                    <p className="text-xs text-text-secondary">
                                        Asigna los modificadores (ej. Término de la carne, Salsas, Toppings extras) que se mostrarán en el POS al ordenar
                                    </p>
                                </div>

                                {modifierGroups.length === 0 ? (
                                    <div className="text-center py-10 bg-surface-raised/30 rounded-2xl border border-dashed border-border p-6">
                                        <SlidersHorizontal className="w-10 h-10 text-text-secondary mx-auto mb-3 opacity-60" />
                                        <p className="text-sm font-bold text-text-primary">No hay grupos de modificadores creados</p>
                                        <p className="text-xs text-text-secondary mt-1">
                                            Puedes configurar modificadores globales en la sección correspondiente de ventas.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {modifierGroups.map((group) => {
                                            const isSelected = selectedModifierGroupIds.includes(group.id)
                                            return (
                                                <div
                                                    key={group.id}
                                                    onClick={() => toggleModifierGroup(group.id)}
                                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'bg-primary/10 border-primary shadow-sm'
                                                            : 'bg-surface-raised/40 border-border hover:border-text-secondary/50'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <p className="text-sm font-bold text-text-primary">{group.name}</p>
                                                            <p className="text-xs text-text-secondary mt-0.5">
                                                                Mín: {group.min_selection} | Máx: {group.max_selection ?? 'Ilimitado'}
                                                            </p>
                                                        </div>
                                                        <div
                                                            className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                                                                isSelected
                                                                    ? 'bg-primary border-primary text-text-inverse'
                                                                    : 'border-border bg-surface'
                                                            }`}
                                                        >
                                                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                        </div>
                                                    </div>

                                                    {group.options && group.options.length > 0 && (
                                                        <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-wrap gap-1">
                                                            {group.options.map((opt) => (
                                                                <span
                                                                    key={opt.id || opt.name}
                                                                    className="px-2 py-0.5 bg-surface text-[10px] rounded text-text-secondary"
                                                                >
                                                                    {opt.name} {Number(opt.price) > 0 ? `(+$${opt.price})` : ''}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface-raised/50 shrink-0">
                        <div className="text-xs text-text-secondary hidden sm:block">
                            {hasVariants
                                ? `${variants.length} variante(s) configurada(s)`
                                : salePrice !== '' ? `Precio: $${Number(salePrice).toFixed(2)}` : 'Sin precio base'}
                        </div>
                        <div className="flex gap-3 ml-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="px-5 h-11 bg-surface-raised hover:bg-border/30 text-text-secondary hover:text-text-primary rounded-xl font-semibold text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-6 h-11 bg-primary text-text-inverse hover:bg-primary-hover rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {isLoading ? 'Guardando...' : item ? 'Actualizar Producto' : 'Crear Producto'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
