'use client'

import React, { useMemo, useState } from 'react'
import {
  Search,
  X,
  UtensilsCrossed,
  Sparkles,
  Layers,
  ShoppingBag,
  Flame,
  Coffee,
  Wine,
  Pizza,
  Sandwich,
  Cake,
  Plus,
  LayoutGrid,
  ArrowLeft,
  AlertTriangle
} from 'lucide-react'
import { useCategories, useSalesItems, usePosConfig, useStockAvailability, useCurrencies, useBillingConfig } from '@/hooks/useSales'
import { usePosStore } from '@/store/posStore'
import { SaleItem } from '@/lib/api/sales'

// Category icon mapper helper
const getCategoryIcon = (iconName?: string) => {
  switch (iconName?.toLowerCase()) {
    case 'coffee':
    case 'cafe':
      return Coffee
    case 'wine':
      return Wine
    case 'drinks':
      return Wine
    case 'bebidas':
      return Wine
    case 'pizza':
      return Pizza
    case 'sandwich':
    case 'burger':
    case 'hamburguesas':
      return Sandwich
    case 'dessert':
    case 'postres':
    case 'cake':
      return Cake
    case 'flame':
    case 'grill':
    case 'parrilla':
      return Flame
    default:
      return Layers
  }
}

export default function PosCatalog() {
  const { 
    searchQuery, 
    setSearchQuery, 
    selectedCategoryId, 
    setSelectedCategory, 
    posMode, 
    activeTableName,
    setActiveTable,
    addItem,
    activeWorkstationId
  } = usePosStore()
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories()
  const { data: items = [], isLoading: isLoadingItems } = useSalesItems()
  const { data: currencies = [] } = useCurrencies()
  const { data: config } = useBillingConfig()

  // Base Currency resolution
  const baseCurrency = useMemo(() => {
    const fromConfig = currencies.find((c) => c.code === config?.default_currency)
    if (fromConfig) return fromConfig
    const isBase = currencies.find((c) => c.is_base)
    if (isBase) return isBase
    return currencies[0] || { code: 'USD', symbol: '$' }
  }, [currencies, config])

  // Stock resolution
  const { data: posConfig } = usePosConfig(activeWorkstationId || undefined, posMode)
  const { data: stockData } = useStockAvailability(posConfig?.warehouse_id)

  const getStockInfo = (itemId: string) => {
    if (!stockData) return { available: Infinity, allowNeg: false }
    const s = stockData.find((item) => item.sale_item_id === itemId)
    return s
      ? { available: s.available_stock, allowNeg: s.allow_negative_stock }
      : { available: Infinity, allowNeg: false }
  }

  // Track recently clicked item ID for visual pulse micro-animation
  const [clickedItemId, setClickedItemId] = useState<string | null>(null)

  const handleItemClick = (item: SaleItem) => {
    // Add item to cart
    addItem({
      id: item.id,
      name: item.name,
      price: Number(item.sale_price) || 0,
      category_id: item.category_id || undefined,
      tax_id: item.tax_id || null,
      tax_rate: item.tax_rate !== undefined && item.tax_rate !== null ? Number(item.tax_rate) : null,
      tax_included: item.tax_included ?? true,
    })

    // Micro-animation feedback
    setClickedItemId(item.id)
    setTimeout(() => {
      setClickedItemId(null)
    }, 250)
  }

  // Filter items by category and search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!item.is_active) return false

      // Category filter
      if (selectedCategoryId && selectedCategoryId !== 'all') {
        if (item.category_id !== selectedCategoryId) return false
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchName = item.name.toLowerCase().includes(query)
        const matchCode = item.code ? item.code.toLowerCase().includes(query) : false
        const matchDesc = item.description ? item.description.toLowerCase().includes(query) : false
        const matchCat = item.category_name ? item.category_name.toLowerCase().includes(query) : false
        return matchName || matchCode || matchDesc || matchCat
      }

      return true
    })
  }, [items, selectedCategoryId, searchQuery])

  // Active categories only
  const activeCategories = useMemo(() => {
    return categories
      .filter((cat) => cat.is_active)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
  }, [categories])

  const isLoading = isLoadingCategories || isLoadingItems

  return (
    <div className="flex flex-col h-full w-full bg-bg overflow-hidden">
      {/* Sticky Top Filter & Category Bar */}
      <div className="shrink-0 p-4 pb-3 space-y-3 bg-surface/80 backdrop-blur-md border-b border-border/70 z-10">
        {/* Search Input Bar & Table Back Button */}
        <div className="flex items-center gap-3">
          {posMode === 'tables' && activeTableName && (
            <button
              onClick={() => setActiveTable(null, null)}
              className="h-11 px-3.5 rounded-2xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 flex items-center gap-2 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm active:scale-95"
              title="Volver al plano interactivo de mesas"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>{activeTableName} (Cambiar)</span>
            </button>
          )}

          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar producto por nombre, código o descripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-10 rounded-2xl bg-surface-raised border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm text-text-primary placeholder:text-text-secondary/70 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills (Horizontal Scroll) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all duration-200 cursor-pointer ${
              selectedCategoryId === 'all'
                ? 'bg-primary text-text-inverse shadow-md shadow-primary/25 ring-2 ring-primary/30 scale-[1.02]'
                : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-primary/40 hover:bg-surface-raised'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Todos</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              selectedCategoryId === 'all' ? 'bg-black/20 text-text-inverse' : 'bg-surface-raised text-text-secondary'
            }`}>
              {items.filter(i => i.is_active).length}
            </span>
          </button>

          {activeCategories.map((category) => {
            const isSelected = selectedCategoryId === category.id
            const Icon = getCategoryIcon(category.icon)
            const count = items.filter((i) => i.is_active && i.category_id === category.id).length

            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-text-inverse shadow-md shadow-primary/25 ring-2 ring-primary/30 scale-[1.02]'
                    : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-primary/40 hover:bg-surface-raised'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{category.name}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-black/20 text-text-inverse' : 'bg-surface-raised text-text-secondary'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Product Grid Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {isLoading ? (
          // Loading Skeleton Grid
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {Array.from({ length: 15 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-surface border border-border/80 rounded-2xl p-3 flex flex-col justify-between aspect-[4/5] animate-pulse"
              >
                <div className="w-full aspect-square rounded-xl bg-surface-raised/70 mb-3" />
                <div className="space-y-2">
                  <div className="h-4 bg-surface-raised rounded-md w-3/4" />
                  <div className="h-3 bg-surface-raised/60 rounded-md w-1/2" />
                </div>
                <div className="h-5 bg-surface-raised rounded-md w-1/3 mt-2" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          // Empty State
          <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-3xl bg-surface-raised border border-border flex items-center justify-center text-text-secondary mb-4 shadow-sm">
              <ShoppingBag className="w-8 h-8 opacity-60 text-primary" />
            </div>
            <h3 className="text-base font-bold text-text-primary">No se encontraron productos</h3>
            <p className="text-xs text-text-secondary max-w-sm mt-1 mb-5">
              {searchQuery
                ? `No hay coincidencias para "${searchQuery}". Intenta con otro término o limpia los filtros.`
                : 'No hay productos registrados en esta categoría.'}
            </p>
            {(searchQuery || selectedCategoryId !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('all')
                }}
                className="px-4 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-text-primary hover:border-primary hover:text-primary transition-all shadow-sm"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        ) : (
          // Products Grid
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {filteredItems.map((item) => {
              const isClicked = clickedItemId === item.id
              const price = Number(item.sale_price) || 0
              const stock = getStockInfo(item.id)
              const isOutOfStock = stock.available <= 0 && !stock.allowNeg
              const isNegativeWarning = stock.available <= 0 && stock.allowNeg

              return (
                <button
                  key={item.id}
                  disabled={isOutOfStock}
                  onClick={() => handleItemClick(item)}
                  className={`group relative bg-surface border border-border rounded-2xl p-3 flex flex-col justify-between text-left transition-all duration-200 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 active:scale-95 cursor-pointer select-none min-h-[160px] ${
                    isClicked ? 'ring-2 ring-primary border-primary scale-[0.98]' : ''
                  } ${isOutOfStock ? 'opacity-40 grayscale cursor-not-allowed hover:border-border hover:shadow-none hover:translate-y-0' : ''}`}
                >
                  {/* Top: Square Image or Elegant Placeholder */}
                  <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-surface-raised border border-border/50 relative flex items-center justify-center mb-2.5">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface-raised via-surface to-surface-raised text-text-secondary/60 group-hover:text-primary transition-colors">
                        <UtensilsCrossed className="w-6 h-6 stroke-[1.7]" />
                      </div>
                    )}

                    {/* Featured / Badge */}
                    {item.is_featured && (
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-amber-500/90 text-black text-[9px] font-black uppercase tracking-wider shadow-sm">
                        Popular
                      </span>
                    )}

                    {/* Low/Negative stock warning */}
                    {isNegativeWarning && (
                      <span
                        className="absolute top-2 right-2 p-1 rounded-md bg-amber-500/90 text-black shadow-sm"
                        title="Venta sin stock activada (inventario negativo)"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {/* Out of stock overlay badge */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="px-2 py-1 rounded-md bg-error text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                          Sin Stock
                        </span>
                      </div>
                    )}

                    {/* Quick Add overlay button icon */}
                    {!isOutOfStock && (
                      <div className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-surface/90 backdrop-blur-sm border border-border/80 text-text-secondary group-hover:bg-primary group-hover:text-text-inverse group-hover:border-primary flex items-center justify-center transition-all duration-200 shadow-sm">
                        <Plus className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Body: Title & Category */}
                  <div className="flex-1 flex flex-col justify-start">
                    <h4 className="font-bold text-xs sm:text-sm text-text-primary group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {item.name}
                    </h4>
                    {item.category_name && (
                      <p className="text-[10px] text-text-secondary mt-0.5 truncate">
                        {item.category_name}
                      </p>
                    )}
                  </div>

                  {/* Footer: Price & Stock */}
                  <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-black text-primary font-mono tracking-tight">
                      {baseCurrency.symbol}{price.toFixed(2)}
                    </span>
                    {item.has_variants && (
                      <span className="text-[9px] font-medium text-text-secondary bg-surface-raised px-1.5 py-0.5 rounded border border-border">
                        Opciones
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
