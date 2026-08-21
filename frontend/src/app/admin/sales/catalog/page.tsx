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
    RotateCcw
} from 'lucide-react'
import { salesApi, SaleItem, SaleCategory } from '@/lib/api/sales'
import CategoryModal from './components/CategoryModal'
import SaleItemModal from './components/SaleItemModal'
import ConfirmationModal from '@/components/ConfirmationModal'

export default function CatalogAdminPage() {
    // Data states
    const [items, setItems] = useState<SaleItem[]>([])
    const [categories, setCategories] = useState<SaleCategory[]>([])
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

    const [deleteModalState, setDeleteModalState] = useState<{
        isOpen: boolean
        itemId: string | null
        itemName: string | null
    }>({
        isOpen: false,
        itemId: null,
        itemName: null
    })

    // Fetch catalog data
    const loadCatalogData = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const [catsRes, itemsRes] = await Promise.all([
                salesApi.getSaleCategories(),
                salesApi.getSaleItems()
            ])
            setCategories(catsRes)
            setItems(itemsRes)
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
        <div className="space-y-6 animate-in fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Catálogo de Productos</h1>
                    <p className="text-sm text-text-secondary mt-1">
                        Gestión de artículos de venta, precios, variantes, recetas (BOM) y categorías
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    <button
                        onClick={handleOpenCreateCategory}
                        className="px-4 py-2.5 bg-surface border border-border hover:border-primary text-text-primary rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Tag className="w-4 h-4 text-primary" /> + Nueva Categoría
                    </button>
                    <button
                        onClick={handleOpenCreateItem}
                        className="px-4 py-2.5 bg-primary text-text-inverse hover:bg-primary-hover rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" /> + Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                    <button
                        onClick={loadCatalogData}
                        className="ml-auto underline font-semibold text-xs hover:text-rose-300"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* Filters Bar */}
            <div className="space-y-3">
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                    {/* Search Bar */}
                    <div className="relative w-full md:w-96">
                        <Search className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por nombre, SKU o código de barras..."
                            className="w-full h-11 pl-10 pr-4 bg-surface border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-text-secondary/60"
                        />
                    </div>

                    {/* Status Pill Filters */}
                    <div className="flex items-center gap-1.5 self-start md:self-auto bg-surface p-1 rounded-xl border border-border">
                        <button
                            onClick={() => setActiveFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                activeFilter === 'all'
                                    ? 'bg-surface-raised text-text-primary shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            Todos ({items.length})
                        </button>
                        <button
                            onClick={() => setActiveFilter('active')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                activeFilter === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            Activos ({items.filter((i) => i.is_active).length})
                        </button>
                        <button
                            onClick={() => setActiveFilter('inactive')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
                <div className="flex gap-2 overflow-x-auto pb-1 items-center">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                            selectedCategory === 'all'
                                ? 'bg-primary text-text-inverse shadow-md shadow-primary/20'
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
                                <tr className="border-b border-border bg-surface-raised/40 text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Producto</th>
                                    <th className="py-3.5 px-4">Categoría</th>
                                    <th className="py-3.5 px-4">Variantes</th>
                                    <th className="py-3.5 px-4 text-right">Precio Venta</th>
                                    <th className="py-3.5 px-4 text-right">Food Cost</th>
                                    <th className="py-3.5 px-4 text-right">Margen</th>
                                    <th className="py-3.5 px-4 text-center">Estado</th>
                                    <th className="py-3.5 px-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-sm">
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
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-base shrink-0 font-bold text-primary">
                                                        {item.is_featured ? '⭐' : <Utensils className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-text-primary">
                                                                {item.name}
                                                            </span>
                                                            {item.is_featured && (
                                                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-semibold">
                                                                    Destacado
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                                                            {item.code && (
                                                                <span className="font-mono text-[11px] bg-surface-raised px-1.5 py-0.5 rounded border border-border">
                                                                    {item.code}
                                                                </span>
                                                            )}
                                                            {item.barcode && (
                                                                <span className="text-[11px]">
                                                                    EAN: {item.barcode}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="py-3.5 px-4">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-raised border border-border rounded-lg text-xs text-text-primary">
                                                    {item.category_name || 'Sin Categoría'}
                                                </span>
                                            </td>

                                            {/* Variants / BOM indicator */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex flex-col gap-1">
                                                    {item.has_variants ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                                                            <Layers className="w-3.5 h-3.5" />
                                                            {variantsCount} variante(s)
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-text-secondary">Única</span>
                                                    )}
                                                    {componentsCount > 0 && (
                                                        <span className="text-[11px] text-text-secondary flex items-center gap-1">
                                                            <Utensils className="w-3 h-3 text-emerald-400" />
                                                            {componentsCount} insumos BOM
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Price */}
                                            <td className="py-3.5 px-4 text-right">
                                                {item.has_variants && variantsCount > 0 ? (
                                                    <div>
                                                        <span className="font-bold text-text-primary">
                                                            ${Math.min(...item.variants!.map(v => Number(v.price))).toFixed(2)}
                                                        </span>
                                                        <span className="text-[10px] text-text-secondary block">
                                                            desde
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="font-bold text-text-primary">
                                                        ${price.toFixed(2)}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-text-secondary block">
                                                    {item.tax_included ? 'IVA incl.' : '+ IVA'}
                                                </span>
                                            </td>

                                            {/* Food Cost */}
                                            <td className="py-3.5 px-4 text-right text-xs font-semibold text-text-secondary">
                                                ${cost.toFixed(2)}
                                            </td>

                                            {/* Gross Margin % */}
                                            <td className="py-3.5 px-4 text-right">
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${
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
                                            <td className="py-3.5 px-4 text-center">
                                                <button
                                                    onClick={() => handleToggleActiveItem(item)}
                                                    title={item.is_active ? 'Desactivar' : 'Activar'}
                                                    className="inline-flex items-center"
                                                >
                                                    <div
                                                        className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 ${
                                                            item.is_active ? 'bg-emerald-500' : 'bg-border'
                                                        }`}
                                                    >
                                                        <div
                                                            className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                                                                item.is_active ? 'translate-x-3.5' : 'translate-x-0'
                                                            }`}
                                                        />
                                                    </div>
                                                </button>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEditItem(item)}
                                                        className="p-2 text-text-secondary hover:text-primary hover:bg-surface-raised rounded-xl transition-colors"
                                                        title="Editar producto"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setDeleteModalState({
                                                                isOpen: true,
                                                                itemId: item.id,
                                                                itemName: item.name
                                                            })
                                                        }
                                                        className="p-2 text-text-secondary hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                                                        title="Eliminar producto"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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
