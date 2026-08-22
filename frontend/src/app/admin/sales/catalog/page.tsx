'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    Search,
    Plus,
    Tag,
    Utensils,
    Layers,
    Edit2,
    Trash2,
    MoreVertical,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Star,
    Sparkles,
    Filter,
    Percent,
    ArrowUpDown,
    RotateCcw,
    SlidersHorizontal
} from 'lucide-react'
import { salesApi, SaleItem, SaleCategory, SaleModifierGroup } from '@/lib/api/sales'
import CategoryModal from './components/CategoryModal'
import SaleItemModal from './components/SaleItemModal'
import ModifierGroupModal from './components/ModifierGroupModal'
import ConfirmationModal from '@/components/ConfirmationModal'

export default function CatalogAdminPage() {
    // Data states
    const [items, setItems] = useState<SaleItem[]>([])
    const [categories, setCategories] = useState<SaleCategory[]>([])
    const [modifierGroups, setModifierGroups] = useState<SaleModifierGroup[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Filter states
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')

    // Modals state
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<SaleCategory | null>(null)

    const [isItemModalOpen, setIsItemModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<SaleItem | null>(null)

    const [isModifierModalOpen, setIsModifierModalOpen] = useState(false)
    const [editingModifierGroup, setEditingModifierGroup] = useState<SaleModifierGroup | null>(null)

    const [deleteModalState, setDeleteModalState] = useState<{
        isOpen: boolean
        itemId: string | null
        itemName: string | null
    }>({
        isOpen: false,
        itemId: null,
        itemName: null
    })

    // Tab state: 'products' | 'modifiers'
    const [activeTab, setActiveTab] = useState<'products' | 'modifiers'>('products')

    // Fetch catalog data
    const loadCatalogData = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const [catsRes, itemsRes, modRes] = await Promise.all([
                salesApi.getSaleCategories(),
                salesApi.getSaleItems(),
                salesApi.getModifierGroups().catch(() => [])
            ])
            setCategories(catsRes)
            setItems(itemsRes)
            setModifierGroups(modRes)
        } catch (err: unknown) {
            console.error('Error loading catalog data:', err)
            setError(err instanceof Error ? err.message : 'Error al cargar el catálogo de productos')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadCatalogData()
    }, [])

    // Filtered Items
    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            // Category filter
            if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
                return false
            }

            // Active status filter
            if (activeFilter === 'active' && !item.is_active) return false
            if (activeFilter === 'inactive' && item.is_active) return false

            // Search query filter (name, SKU/code, barcode)
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim()
                const nameMatch = item.name.toLowerCase().includes(query)
                const codeMatch = item.code ? item.code.toLowerCase().includes(query) : false
                const barcodeMatch = item.barcode ? item.barcode.toLowerCase().includes(query) : false
                const descMatch = item.description ? item.description.toLowerCase().includes(query) : false
                return nameMatch || codeMatch || barcodeMatch || descMatch
            }

            return true
        })
    }, [items, selectedCategory, activeFilter, searchQuery])

    // KPI stats calculations
    const stats = useMemo(() => {
        const total = items.length
        const active = items.filter(i => i.is_active).length
        const withRecipes = items.filter(i => (i.components && i.components.length > 0) || (i.variants && i.variants.length > 0)).length
        const avgMargin = total > 0
            ? items.reduce((acc, curr) => {
                  const p = Number(curr.sale_price) || 0
                  const c = Number(curr.food_cost) || 0
                  return acc + (p > 0 ? ((p - c) / p) * 100 : 0)
              }, 0) / total
            : 0

        return { total, active, withRecipes, avgMargin }
    }, [items])

    // Category count map
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const item of items) {
            const catId = item.category_id || 'uncategorized'
            counts[catId] = (counts[catId] || 0) + 1
        }
        return counts
    }, [items])

    // Handlers
    const handleOpenCreateCategory = () => {
        setEditingCategory(null)
        setIsCategoryModalOpen(true)
    }

    const handleOpenEditCategory = (cat: SaleCategory) => {
        setEditingCategory(cat)
        setIsCategoryModalOpen(true)
    }

    const handleOpenCreateItem = () => {
        setEditingItem(null)
        setIsItemModalOpen(true)
    }

    const handleOpenEditItem = (item: SaleItem) => {
        setEditingItem(item)
        setIsItemModalOpen(true)
    }

    const handleToggleActiveItem = async (item: SaleItem) => {
        try {
            await salesApi.updateSaleItem(item.id, { is_active: !item.is_active })
            setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i))
            )
        } catch (err) {
            console.error('Error updating item status:', err)
        }
    }

    const confirmDeleteItem = async () => {
        if (!deleteModalState.itemId) return
        try {
            await salesApi.deleteSaleItem(deleteModalState.itemId)
            setDeleteModalState({ isOpen: false, itemId: null, itemName: null })
            setItems((prev) => prev.filter((i) => i.id !== deleteModalState.itemId))
        } catch (err: unknown) {
            console.error('Error deleting item:', err)
            alert(err instanceof Error ? err.message : 'Error al eliminar el producto')
        }
    }

    return (
        <div className="space-y-4 animate-in fade-in pb-8 text-[13px]">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-surface-raised/40 p-4 rounded-xl border border-border">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                            <Utensils className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-text-primary">Catálogo & Menú de Ventas</h1>
                            <p className="text-[11px] text-text-secondary mt-0.5">
                                Configura productos de venta, escandallos (BOM), variantes y grupos de modificadores.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => {
                            setEditingModifierGroup(null)
                            setIsModifierModalOpen(true)
                        }}
                        className="px-3 py-1.5 bg-surface border border-border hover:border-primary text-text-primary rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm whitespace-nowrap"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-primary" /> Modificadores
                    </button>
                    <button
                        onClick={handleOpenCreateCategory}
                        className="px-3 py-1.5 bg-surface border border-border hover:border-primary text-text-primary rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm whitespace-nowrap"
                    >
                        <Tag className="w-3.5 h-3.5 text-primary" /> + Categoría
                    </button>
                    <button
                        onClick={handleOpenCreateItem}
                        className="px-3.5 py-1.5 bg-primary text-text-inverse hover:bg-primary-hover rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-primary/20 whitespace-nowrap"
                    >
                        <Plus className="w-3.5 h-3.5" /> + Producto
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-surface border border-border rounded-xl shadow-sm space-y-0.5">
                    <div className="flex items-center justify-between text-text-secondary">
                        <span className="text-[11px] font-medium">Total Productos</span>
                        <Utensils className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-lg font-bold text-text-primary">{stats.total}</p>
                    <p className="text-[10px] text-text-tertiary">{stats.active} productos activos</p>
                </div>

                <div className="p-4 bg-surface border border-border rounded-xl shadow-sm space-y-0.5">
                    <div className="flex items-center justify-between text-text-secondary">
                        <span className="text-[11px] font-medium">Categorías</span>
                        <Tag className="w-3.5 h-3.5 text-secondary" />
                    </div>
                    <p className="text-lg font-bold text-text-primary">{categories.length}</p>
                    <p className="text-[10px] text-text-tertiary">Familias de menú</p>
                </div>

                <div className="p-3 bg-surface border border-border rounded-xl shadow-sm space-y-0.5">
                    <div className="flex items-center justify-between text-text-secondary">
                        <span className="text-[11px] font-medium">Con Receta / BOM</span>
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <p className="text-lg font-bold text-text-primary">{stats.withRecipes}</p>
                    <p className="text-[10px] text-emerald-400">Descarga automática</p>
                </div>

                <div className="p-3 bg-surface border border-border rounded-xl shadow-sm space-y-0.5">
                    <div className="flex items-center justify-between text-text-secondary">
                        <span className="text-[11px] font-medium">Margen Promedio</span>
                        <Percent className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <p className="text-lg font-bold text-text-primary">{stats.avgMargin.toFixed(0)}%</p>
                    <p className="text-[10px] text-text-tertiary">Margen bruto global</p>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-rose-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                    <button
                        onClick={loadCatalogData}
                        className="ml-auto underline font-semibold text-[11px] hover:text-rose-300"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* Main Tabs (Productos vs Modificadores) */}
            <div className="flex items-center gap-1 border-b border-border">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'products'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Productos de Venta ({items.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab('modifiers')}
                    className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'modifiers'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Grupos de Modificadores ({modifierGroups.length})</span>
                </button>
            </div>

            {activeTab === 'modifiers' ? (
                /* Modifiers Tab View */
                <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-base text-text-primary">Grupos de Modificadores Configurados</h3>
                            <p className="text-xs text-text-secondary">Opciones extras, adicionales y salsas aplicables a los productos.</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingModifierGroup(null)
                                setIsModifierModalOpen(true)
                            }}
                            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" /> Crear Modificador
                        </button>
                    </div>

                    {modifierGroups.length === 0 ? (
                        <div className="p-12 text-center text-text-secondary space-y-3">
                            <SlidersHorizontal className="w-8 h-8 mx-auto opacity-40" />
                            <p className="text-sm">No has creado ningún grupo de modificadores aún.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {modifierGroups.map((group) => (
                                <div
                                    key={group.id}
                                    className="p-4 bg-surface-raised border border-border rounded-2xl hover:border-primary/50 transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-sm text-text-primary">{group.name}</h4>
                                            <button
                                                onClick={() => {
                                                    setEditingModifierGroup(group)
                                                    setIsModifierModalOpen(true)
                                                }}
                                                className="p-1.5 text-text-secondary hover:text-primary hover:bg-surface rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                                            {group.options?.map((opt) => (
                                                <span
                                                    key={opt.id || opt.name}
                                                    className="px-2 py-0.5 bg-surface border border-border rounded-md text-[11px] text-text-primary"
                                                >
                                                    {opt.name} {Number(opt.price) > 0 ? `(+$${opt.price})` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-secondary">
                                        <span>Min: {group.min_selection} | Max: {group.max_selection ?? 'Ilimitado'}</span>
                                        <span className={group.min_selection > 0 ? 'text-amber-400 font-semibold' : ''}>
                                            {group.min_selection > 0 ? 'Obligatorio' : 'Opcional'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* Products Tab View */
                <>
                    {/* Filters Bar */}
                    <div className="space-y-2.5">
                        <div className="flex flex-col md:flex-row gap-2.5 items-center justify-between">
                            {/* Search Bar */}
                            <div className="relative w-full md:w-80">
                                <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar por nombre, SKU..."
                                    className="w-full h-9 pl-8 pr-3 bg-surface border border-border rounded-lg text-text-primary text-xs focus:outline-none focus:border-primary transition-colors placeholder:text-text-secondary/60"
                                />
                            </div>

                            {/* Status Pill Filters */}
                            <div className="flex items-center gap-1 self-start md:self-auto bg-surface p-1 rounded-lg border border-border">
                                <button
                                    onClick={() => setActiveFilter('all')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                        activeFilter === 'all'
                                            ? 'bg-surface-raised text-text-primary shadow-sm'
                                            : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                >
                                    Todos ({items.length})
                                </button>
                                <button
                                    onClick={() => setActiveFilter('active')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                        activeFilter === 'active'
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                >
                                    Activos ({items.filter((i) => i.is_active).length})
                                </button>
                                <button
                                    onClick={() => setActiveFilter('inactive')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                        activeFilter === 'inactive'
                                            ? 'bg-rose-500/10 text-rose-400'
                                            : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                >
                                    Inactivos ({items.filter((i) => !i.is_active).length})
                                </button>
                            </div>
                        </div>

                        {/* Category Filter Pills */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1 items-center">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                    selectedCategory === 'all'
                                        ? 'bg-primary text-text-inverse shadow-sm'
                                        : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-primary/50'
                                }`}
                            >
                                Todas las Categorías ({items.length})
                            </button>

                            {categories.map((cat) => {
                                const count = categoryCounts[cat.id] || 0
                                const isSelected = selectedCategory === cat.id
                                return (
                                    <div
                                        key={cat.id}
                                        className="group relative flex items-center shrink-0"
                                    >
                                        <button
                                            onClick={() => setSelectedCategory(cat.id)}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                                isSelected
                                                    ? 'bg-primary text-text-inverse shadow-md shadow-primary/20'
                                                    : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-primary/50'
                                            }`}
                                        >
                                            <span>{cat.icon || '🏷️'}</span>
                                            <span>{cat.name}</span>
                                            <span
                                                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                                    isSelected
                                                        ? 'bg-white/20 text-text-inverse'
                                                        : 'bg-surface-raised text-text-secondary'
                                                }`}
                                            >
                                                {count}
                                            </span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleOpenEditCategory(cat)
                                            }}
                                            title="Editar Categoría"
                                            className="hidden group-hover:flex items-center justify-center absolute -top-1.5 -right-1.5 w-5 h-5 bg-surface border border-border rounded-full text-text-secondary hover:text-primary transition-colors shadow-sm"
                                        >
                                            <Edit2 className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

            {/* Catalog Table */}
            <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center space-y-3">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-sm text-text-secondary">Cargando catálogo de venta...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="p-16 text-center space-y-4">
                        <div className="w-14 h-14 bg-surface-raised rounded-2xl flex items-center justify-center mx-auto text-text-secondary">
                            <Utensils className="w-7 h-7 opacity-60" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-text-primary">No se encontraron productos</h3>
                            <p className="text-xs text-text-secondary mt-1">
                                {searchQuery || selectedCategory !== 'all' || activeFilter !== 'all'
                                    ? 'Prueba ajustando los filtros o el término de búsqueda'
                                    : 'Comienza creando tu primer producto de venta'}
                            </p>
                        </div>
                        {(searchQuery || selectedCategory !== 'all' || activeFilter !== 'all') && (
                            <button
                                onClick={() => {
                                    setSearchQuery('')
                                    setSelectedCategory('all')
                                    setActiveFilter('all')
                                }}
                                className="px-4 py-2 bg-surface-raised border border-border rounded-xl text-xs font-semibold text-text-primary hover:border-primary transition-colors inline-flex items-center gap-1.5"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> Limpiar Filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border bg-surface-raised/40 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                                    <th className="py-2.5 px-3.5">Producto</th>
                                    <th className="py-2.5 px-3.5">Categoría</th>
                                    <th className="py-2.5 px-3.5">Variantes</th>
                                    <th className="py-2.5 px-3.5 text-right">Precio Venta</th>
                                    <th className="py-2.5 px-3.5 text-right">Food Cost</th>
                                    <th className="py-2.5 px-3.5 text-right">Margen</th>
                                    <th className="py-2.5 px-3.5 text-center">Estado</th>
                                    <th className="py-2.5 px-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-xs">
                                {filteredItems.map((item) => {
                                    const price = Number(item.sale_price) || 0
                                    const cost = Number(item.food_cost) || 0
                                    const margin = price > 0 ? ((price - cost) / price) * 100 : 0
                                    const variantsCount = item.variants ? item.variants.length : 0
                                    const componentsCount = item.components ? item.components.length : 0

                                    return (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-surface-raised/30 transition-colors group"
                                        >
                                            {/* Product Info */}
                                            <td className="py-2.5 px-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-sm shrink-0 font-bold text-primary">
                                                        {item.is_featured ? '⭐' : <Utensils className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-text-primary text-xs">
                                                                {item.name}
                                                            </span>
                                                            {item.is_featured && (
                                                                <span className="px-1 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-semibold">
                                                                    Destacado
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mt-0.5">
                                                            {item.code && (
                                                                <span className="font-mono text-[10px] bg-surface-raised px-1 py-0.2 rounded border border-border">
                                                                    {item.code}
                                                                </span>
                                                            )}
                                                            {item.barcode && (
                                                                <span className="text-[10px]">
                                                                    EAN: {item.barcode}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="py-2.5 px-3.5">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-raised border border-border rounded text-[11px] text-text-primary">
                                                    {item.category_name || 'Sin Categoría'}
                                                </span>
                                            </td>

                                            {/* Variants / BOM indicator */}
                                            <td className="py-2.5 px-3.5">
                                                <div className="flex flex-col gap-0.5">
                                                    {item.has_variants ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                                                            <Layers className="w-3 h-3" />
                                                            {variantsCount} variante(s)
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-text-secondary">Única</span>
                                                    )}
                                                    {componentsCount > 0 && (
                                                        <span className="text-[10px] text-text-secondary flex items-center gap-1">
                                                            <Utensils className="w-2.5 h-2.5 text-emerald-400" />
                                                            {componentsCount} insumos BOM
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Price */}
                                            <td className="py-2.5 px-3.5 text-right">
                                                {item.has_variants && variantsCount > 0 ? (
                                                    <div>
                                                        <span className="font-bold text-text-primary text-xs">
                                                            ${Math.min(...item.variants!.map(v => Number(v.price))).toFixed(2)}
                                                        </span>
                                                        <span className="text-[9px] text-text-secondary block">
                                                            desde
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="font-bold text-text-primary text-xs">
                                                        ${price.toFixed(2)}
                                                    </span>
                                                )}
                                                <span className="text-[9px] text-text-secondary block">
                                                    {item.tax_included ? 'IVA incl.' : '+ IVA'}
                                                </span>
                                            </td>

                                            {/* Food Cost */}
                                            <td className="py-2.5 px-3.5 text-right text-xs font-semibold text-text-secondary">
                                                ${cost.toFixed(2)}
                                            </td>

                                            {/* Gross Margin % */}
                                            <td className="py-2.5 px-3.5 text-right">
                                                <span
                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                                        margin >= 65
                                                            ? 'bg-emerald-500/10 text-emerald-400'
                                                            : margin >= 40
                                                            ? 'bg-amber-500/10 text-amber-400'
                                                            : 'bg-rose-500/10 text-rose-400'
                                                    }`}
                                                >
                                                    {price > 0 ? `${margin.toFixed(0)}%` : '--'}
                                                </span>
                                            </td>

                                            {/* Active Switch */}
                                            <td className="py-2.5 px-3.5 text-center">
                                                <button
                                                    onClick={() => handleToggleActiveItem(item)}
                                                    title={item.is_active ? 'Desactivar' : 'Activar'}
                                                    className="inline-flex items-center"
                                                >
                                                    <div
                                                        className={`w-7 h-4 rounded-full transition-colors relative flex items-center p-0.5 ${
                                                            item.is_active ? 'bg-emerald-500' : 'bg-border'
                                                        }`}
                                                    >
                                                        <div
                                                            className={`w-3 h-3 bg-white rounded-full transition-transform ${
                                                                item.is_active ? 'translate-x-3' : 'translate-x-0'
                                                            }`}
                                                        />
                                                    </div>
                                                </button>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-2.5 px-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleOpenEditItem(item)}
                                                        className="p-1.5 text-text-secondary hover:text-primary hover:bg-surface-raised rounded-lg transition-colors"
                                                        title="Editar producto"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setDeleteModalState({
                                                                isOpen: true,
                                                                itemId: item.id,
                                                                itemName: item.name
                                                            })
                                                        }
                                                        className="p-1.5 text-text-secondary hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                        title="Eliminar producto"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            </>
            )}

            {/* Category Modal */}
            <CategoryModal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                onSuccess={loadCatalogData}
                category={editingCategory}
            />

            {/* Sale Item Multi-Tab Modal */}
            <SaleItemModal
                isOpen={isItemModalOpen}
                onClose={() => setIsItemModalOpen(false)}
                onSuccess={loadCatalogData}
                item={editingItem}
                categories={categories}
            />

            {/* Modifier Group Modal */}
            <ModifierGroupModal
                isOpen={isModifierModalOpen}
                onClose={() => setIsModifierModalOpen(false)}
                onSuccess={loadCatalogData}
                group={editingModifierGroup}
            />

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteModalState.isOpen}
                title="Eliminar Producto"
                message={`¿Estás seguro de que deseas eliminar permanentemente "${deleteModalState.itemName}"? Esta acción no se puede deshacer.`}
                confirmLabel="Eliminar Producto"
                cancelLabel="Cancelar"
                onConfirm={confirmDeleteItem}
                onCancel={() => setDeleteModalState({ isOpen: false, itemId: null, itemName: null })}
            />
        </div>
    )
}
