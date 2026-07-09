'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Save, ChevronLeft, Search, Loader2, Package, Pencil } from 'lucide-react'
import { adminApi, InventoryItem, UOMPresentation, RecipeIngredient, RecipeStep, RecipeCreate, RecipeResponse } from '@/lib/api'
import { useRouter } from 'next/navigation'
import ConfirmationModal from '@/components/ConfirmationModal'

interface RecipeEditorProps {
  itemId: string
  initialData?: RecipeResponse
  itemName: string
}

export default function RecipeEditor({ itemId, initialData, itemName }: RecipeEditorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' })
  
  // Yield state
  const [yieldQty, setYieldQty] = useState(initialData?.yield_qty_base || 1)
  const [yieldPresentationId, setYieldPresentationId] = useState(initialData?.yield_presentation_id || '')
  const [autoCalculateCost, setAutoCalculateCost] = useState(initialData?.auto_calculate_cost ?? true)
  
  // Ingredients and Steps state
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(initialData?.ingredients || [])
  const [steps, setSteps] = useState<RecipeStep[]>(initialData?.steps || [])
  
  // Catalog data
  const [allItems, setAllItems] = useState<InventoryItem[]>([])
  const [mainItemPresentations, setMainItemPresentations] = useState<UOMPresentation[]>([])
  const [ingredientPresentations, setIngredientPresentations] = useState<Record<string, UOMPresentation[]>>({})

  // Ingredient search UI state
  const [focusedLineIndex, setFocusedLineIndex] = useState<number | null>(null)
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({})


  // Cost calculation
  const { recipeCost, itemsWithoutPrice } = useMemo(() => {
    let total = 0
    let withoutPriceCount = 0
    ingredients.forEach(ing => {
      if (!ing.item_id) return
      const item = allItems.find(it => it.id === ing.item_id)
      if (item) {
        const cost = item.production_cost !== null && item.production_cost !== undefined ? item.production_cost : item.last_purchase_cost
        if (cost !== null && cost !== undefined) {
          const pres = ingredientPresentations[ing.item_id] || []
          const selectedPres = pres.find(p => p.id === ing.presentation_id)
          const factor = selectedPres ? selectedPres.conversion_factor : 1
          total += cost * (ing.qty_base || 0) * factor
        } else {
          withoutPriceCount++
        }
      }
    })
    return { recipeCost: total, itemsWithoutPrice: withoutPriceCount }
  }, [ingredients, allItems, ingredientPresentations])

  const switchToSearchMode = (index: number) => {
    const currentIng = ingredients[index]
    setSearchQueries(prev => ({ ...prev, [index]: currentIng.item_name || '' }))
    updateIngredient(index, {
      item_id: '',
      item_name: '',
      presentation_id: '',
      presentation_name: ''
    })
    setFocusedLineIndex(index)
  }

  useEffect(() => {
    fetchCatalogs()
  }, [])

  const fetchCatalogs = async () => {
    setLoading(true)
    try {
      const [items, mainPres] = await Promise.all([
        adminApi.getInventoryItems(),
        adminApi.getItemPresentations(itemId)
      ])
      setAllItems(items)
      setMainItemPresentations(mainPres)
      
      if (!yieldPresentationId) {
        const defaultPres = mainPres.find(p => p.is_default)
        setYieldPresentationId(defaultPres ? defaultPres.id : '')
      }

      if (initialData?.ingredients) {
        const uniqueItemIds = Array.from(new Set(initialData.ingredients.map(i => i.item_id)))
        const presPromises = uniqueItemIds.map(id => adminApi.getItemPresentations(id))
        const results = await Promise.all(presPromises)
        
        const newPresMap: Record<string, UOMPresentation[]> = {}
        uniqueItemIds.forEach((id, idx) => {
          newPresMap[id] = results[idx]
        })
        setIngredientPresentations(newPresMap)

        setIngredients(prev => prev.map(ing => {
          let qty = ing.qty_base
          if (ing.presentation_id) {
            const pres = newPresMap[ing.item_id] || []
            const selectedPres = pres.find(p => p.id === ing.presentation_id)
            if (selectedPres && selectedPres.conversion_factor > 0) {
              qty = qty / selectedPres.conversion_factor
            }
          }
          const foundItem = items.find(it => it.id === ing.item_id)
          return { ...ing, qty_base: qty, item_name: foundItem?.name || ing.item_name }
        }))
      }
    } catch (error) {
      console.error('Error fetching catalogs:', error)
    } finally {
      setLoading(false)
    }
  }

  const addIngredientLine = () => {
    const newIng: RecipeIngredient = {
      item_id: '',
      item_name: '',
      qty_base: 0,
      presentation_id: '',
      order_index: ingredients.length
    }
    setIngredients([...ingredients, newIng])
  }

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const updateIngredient = (index: number, updates: Partial<RecipeIngredient>) => {
    const newIngredients = [...ingredients]
    newIngredients[index] = { ...newIngredients[index], ...updates }
    setIngredients(newIngredients)
  }

  const handleItemSelect = async (index: number, item: InventoryItem) => {
    setFocusedLineIndex(null)
    setSearchQueries(prev => ({ ...prev, [index]: item.name }))
    
    // Load presentations
    if (!ingredientPresentations[item.id]) {
      try {
        const pres = await adminApi.getItemPresentations(item.id)
        setIngredientPresentations(prev => ({ ...prev, [item.id]: pres }))
        const defaultPres = pres.find(p => p.is_default)
        updateIngredient(index, {
          item_id: item.id,
          item_name: item.name,
          presentation_id: defaultPres?.id || '',
          presentation_name: defaultPres?.name || ''
        })
      } catch (error) {
        console.error('Error loading presentations:', error)
      }
    } else {
      const pres = ingredientPresentations[item.id]
      const defaultPres = pres.find(p => p.is_default)
      updateIngredient(index, {
        item_id: item.id,
        item_name: item.name,
        presentation_id: defaultPres?.id || '',
        presentation_name: defaultPres?.name || ''
      })
    }
  }

  const addStep = () => {
    const newStep: RecipeStep = {
      order_index: steps.length,
      description: '',
      estimated_time_minutes: 0
    }
    setSteps([...steps, newStep])
  }

  const removeStep = (index: number) => {
    const newSteps = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, order_index: i }))
    setSteps(newSteps)
  }

  const updateStep = (index: number, updates: Partial<RecipeStep>) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], ...updates }
    setSteps(newSteps)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const recipeData: RecipeCreate = {
        item_id: itemId,
        yield_qty_base: yieldQty,
        yield_presentation_id: yieldPresentationId || null,
        auto_calculate_cost: autoCalculateCost,
        ingredients: ingredients
          .filter(ing => ing.item_id && ing.qty_base > 0)
          .map((ing, idx) => ({
            item_id: ing.item_id,
            qty_base: ing.qty_base,
            presentation_id: ing.presentation_id || null,
            order_index: idx,
            notes: ing.notes
          })),
        steps: steps.map((step, idx) => ({
          order_index: idx,
          description: step.description,
          estimated_time_minutes: step.estimated_time_minutes
        }))
      }
      
      await adminApi.saveRecipe(recipeData)
      router.back()
    } catch (error: any) {
      console.error('Error saving recipe:', error)
      setErrorModal({ isOpen: true, message: error?.message || 'Error al guardar la receta' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ConfirmationModal 
        isOpen={errorModal.isOpen}
        title="Error"
        message={errorModal.message}
        confirmLabel="Entendido"
        cancelLabel=""
        onConfirm={() => setErrorModal({ ...errorModal, isOpen: false })}
        onCancel={() => setErrorModal({ ...errorModal, isOpen: false })}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Receta: {itemName}</h1>
            <p className="text-sm text-text-secondary">Configure los ingredientes y pasos de producción</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar Receta
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Yield Section */}
          <div className="bg-surface p-6 rounded-2xl border border-border">
            <h2 className="text-lg font-semibold mb-4">Rendimiento de la Receta</h2>
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Cantidad Objetivo</label>
                <input
                  type="number"
                  value={yieldQty}
                  onChange={(e) => setYieldQty(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 h-11 bg-surface border border-border rounded-xl focus:border-primary outline-none transition-all text-text-primary text-sm font-medium"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Unidad</label>
                <select
                  value={yieldPresentationId}
                  onChange={(e) => setYieldPresentationId(e.target.value)}
                  className="w-full p-2.5 h-11 bg-surface border border-border rounded-xl focus:border-primary outline-none transition-all text-text-primary text-sm"
                >
                  <option value="">{allItems.find(i => i.id === itemId)?.uom_name || 'Unidad Base'}</option>
                  {mainItemPresentations.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Auto Calculate Cost Toggle */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-text-primary">Calcular costo automáticamente</label>
                <p className="text-[11px] text-text-secondary">El costo de compra del artículo se actualizará automáticamente a partir de la receta.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCalculateCost}
                  onChange={(e) => setAutoCalculateCost(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>

          {/* Ingredients Section - Unified Style */}
          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Ingredientes (BOM)</h2>
              <button
                onClick={addIngredientLine}
                className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-bold hover:bg-primary/20 transition-all uppercase tracking-wider"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Ingrediente
              </button>
            </div>

            <div className="space-y-4">
              {ingredients.length === 0 ? (
                <div className="py-12 text-center text-text-secondary italic border-2 border-dashed border-border rounded-2xl">
                  No hay ingredientes. Haz clic en "Agregar Ingrediente" para comenzar.
                </div>
              ) : (
                <div className="space-y-3">
                  {ingredients.map((ing, idx) => {
                    const isSelected = !!ing.item_id;
                    const item = isSelected ? allItems.find(it => it.id === ing.item_id) : null;
                    const itemCost = item?.production_cost !== null && item?.production_cost !== undefined ? item.production_cost : item?.last_purchase_cost;
                    const hasCost = itemCost !== null && itemCost !== undefined;
                    
                    const pres = ingredientPresentations[ing.item_id] || [];
                    const selectedPres = pres.find(p => p.id === ing.presentation_id);
                    const factor = selectedPres ? selectedPres.conversion_factor : 1;
                    const lineSubtotal = hasCost ? (itemCost * (ing.qty_base || 0) * factor) : 0;

                    return (
                      <div 
                        key={idx} 
                        className={`grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-2xl border transition-all duration-200 relative group ${
                          isSelected 
                            ? 'border-border bg-surface-raised border-l-4 border-l-primary' 
                            : 'border-dashed border-border bg-surface/50'
                        }`}
                      >
                        {/* LEFT AREA: Search or Item Info */}
                        <div className="md:col-span-4 relative flex flex-col justify-center">
                          {!isSelected ? (
                            <>
                              <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1 tracking-wider">Artículo</label>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                                <input 
                                  type="text"
                                  value={(searchQueries[idx] ?? ing.item_name) || ''}
                                  onFocus={() => setFocusedLineIndex(idx)}
                                  onChange={e => {
                                      setSearchQueries(prev => ({ ...prev, [idx]: e.target.value }))
                                      setFocusedLineIndex(idx)
                                      if (!e.target.value) updateIngredient(idx, { item_id: '', item_name: '' })
                                  }}
                                  placeholder="Buscar artículo..."
                                  className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-11 text-sm text-text-primary outline-none focus:border-primary"
                                />
                              </div>

                              {focusedLineIndex === idx && (searchQueries[idx] || '').length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                    {allItems
                                        .filter(item => 
                                            item.id !== itemId &&
                                            (item.name.toLowerCase().includes((searchQueries[idx] || '').toLowerCase()) ||
                                            item.code?.toLowerCase().includes((searchQueries[idx] || '').toLowerCase()))
                                        )
                                        .slice(0, 8)
                                        .map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => handleItemSelect(idx, item)}
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
                            </>
                          ) : (
                            <div className="flex flex-col justify-center min-h-[44px]">
                              <p className="text-sm font-bold text-text-primary">{ing.item_name}</p>
                              <div className="flex gap-2 items-center mt-0.5">
                                {item?.code && (
                                  <span className="text-[10px] bg-surface border border-border px-1.5 py-0.5 rounded text-text-secondary font-mono">
                                    {item.code}
                                  </span>
                                )}
                                <span className="text-[10px] text-text-secondary uppercase">
                                  Base: {item?.uom_name || 'U.M.'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* MIDDLE AREA: Qty and Presentation (Always editable but visual representation changes when not selected) */}
                        <div className={`md:col-span-5 flex gap-2 transition-opacity duration-200 ${!isSelected ? 'opacity-40 pointer-events-none' : ''}`}>
                          <div className="flex-1">
                              <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1 tracking-wider">Cantidad</label>
                              <input 
                                  type="number"
                                  value={ing.qty_base || ''}
                                  onChange={e => updateIngredient(idx, { qty_base: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-surface border border-border rounded-xl px-3 h-11 text-sm outline-none focus:border-primary text-text-primary font-medium"
                                  placeholder="0"
                                  disabled={!isSelected}
                              />
                          </div>
                          <div className="flex-1">
                              <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1 tracking-wider">Unidad</label>
                              <select 
                                  value={ing.presentation_id || ''}
                                  onChange={e => updateIngredient(idx, { presentation_id: e.target.value })}
                                  className="w-full bg-surface border border-border rounded-xl px-3 h-11 text-sm outline-none focus:border-primary text-text-primary appearance-none cursor-pointer"
                                  disabled={!isSelected}
                              >
                                  <option value="">{allItems.find(it => it.id === ing.item_id)?.uom_name || 'Unidad Base'}</option>
                                  {(ingredientPresentations[ing.item_id] || []).map(p => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                              </select>
                          </div>
                        </div>

                        {/* RIGHT AREA: Prices/Costs (Only shown when selected) */}
                        <div className="md:col-span-2 flex flex-col justify-center items-end px-2 min-h-[44px]">
                          {isSelected && (
                            <div className="text-right">
                              <span className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-0.5">Subtotal</span>
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-primary">
                                  {hasCost ? `$${lineSubtotal.toFixed(2)}` : '—'}
                                </span>
                                <span className="text-[10px] text-text-secondary mt-0.5">
                                  {hasCost ? `$${itemCost.toFixed(2)} / ${item?.uom_name || 'U.M.'}` : 'Sin precio'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* ACTIONS AREA: Change Item (Pencil) & Delete */}
                        <div className="md:col-span-1 flex items-end justify-center gap-1 pb-0.5">
                          {isSelected && (
                            <button 
                                onClick={() => switchToSearchMode(idx)}
                                title="Cambiar artículo"
                                className="h-11 w-11 flex items-center justify-center text-text-secondary hover:bg-surface-raised hover:text-text-primary rounded-xl transition-colors"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                              onClick={() => removeIngredient(idx)}
                              title="Eliminar ingrediente"
                              className="h-11 w-11 flex items-center justify-center text-error hover:bg-error/10 rounded-xl transition-colors"
                          >
                              <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cost Total Footer */}
              {ingredients.some(ing => ing.item_id) && (
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {itemsWithoutPrice > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 px-2.5 py-1 rounded-lg font-medium border border-amber-200 dark:border-amber-900/30">
                        ⚠ {itemsWithoutPrice} {itemsWithoutPrice === 1 ? 'ingrediente sin precio' : 'ingredientes sin precio'}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-text-secondary uppercase font-bold tracking-wider mr-2">Costo Total Receta:</span>
                    <span className="text-xl font-black text-primary">${recipeCost.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Steps Column */}
        <div className="space-y-6 h-full">
          <div className="bg-surface p-6 rounded-2xl border border-border flex flex-col min-h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Pasos</h2>
              <button
                onClick={addStep}
                className="flex items-center gap-1 text-xs text-primary font-bold hover:underline uppercase tracking-wider"
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir Paso
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {steps.length === 0 ? (
                <div className="py-8 text-center text-text-secondary italic border-2 border-dashed border-border rounded-xl">
                  Sin pasos.
                </div>
              ) : (
                steps.map((step, idx) => (
                  <div key={idx} className="bg-surface-raised p-4 rounded-xl border border-border space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded">PASO {idx + 1}</span>
                      <button
                        onClick={() => removeStep(idx)}
                        className="text-error opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <textarea
                      placeholder="Instrucciones..."
                      value={step.description}
                      onChange={(e) => updateStep(idx, { description: e.target.value })}
                      className="w-full p-3 bg-surface border border-border rounded-xl text-sm text-text-primary min-h-[70px] outline-none focus:border-primary transition-all resize-none"
                    />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-text-secondary uppercase">Minutos:</span>
                      <input
                        type="number"
                        value={step.estimated_time_minutes}
                        onChange={(e) => updateStep(idx, { estimated_time_minutes: parseInt(e.target.value) || 0 })}
                        className="w-16 p-1.5 bg-surface border border-border rounded-lg text-xs text-center text-text-primary font-bold"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
