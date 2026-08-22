import React, { useState, useEffect, useMemo } from 'react'
import {
    X,
    Save,
    AlertCircle,
    Plus,
    Trash2,
    SlidersHorizontal,
    CheckCircle2,
    Loader2,
    Search,
    ChevronDown,
    Check
} from 'lucide-react'
import { salesApi, SaleModifierGroup, SaleModifierOption } from '@/lib/api/sales'
import { inventoryApi, InventoryItem } from '@/lib/api/inventory'

// Searchable Autocomplete Select for Inventory Items
function InventoryItemSearchSelect({
    items,
    selectedId,
    onSelect
}: {
    items: InventoryItem[]
    selectedId?: string | null
    onSelect: (item: InventoryItem | null) => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')

    const selectedItem = useMemo(() => {
        return items.find(i => i.id === selectedId) || null
    }, [items, selectedId])

    const filtered = useMemo(() => {
        if (!search.trim()) return items.slice(0, 50)
        const q = search.toLowerCase().trim()
        return items.filter(i => 
            i.name.toLowerCase().includes(q) || 
            (i.code && i.code.toLowerCase().includes(q))
        ).slice(0, 50)
    }, [items, search])

    return (
        <div className="relative w-full">
            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen)
                    setSearch('')
                }}
                className="w-full h-8 px-2.5 bg-surface border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-primary flex items-center justify-between gap-1.5 text-left truncate hover:border-primary/50 transition-colors"
            >
                <span className="truncate">
                    {selectedItem ? (
                        <>
                            <span className="font-semibold text-text-primary">{selectedItem.name}</span>{' '}
                            {selectedItem.code && <span className="text-text-secondary font-mono text-[10px]">({selectedItem.code})</span>}
                        </>
                    ) : (
                        <span className="text-text-secondary text-[11px]">🔍 Descontar Insumo de Inventario...</span>
                    )}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                    {selectedItem && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onSelect(null)
                            }}
                            className="text-text-tertiary hover:text-error text-xs p-0.5"
                            title="Quitar insumo"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[80]" onClick={() => setIsOpen(false)} />
                    <div className="absolute left-0 top-full mt-1.5 w-96 max-w-[92vw] bg-surface border border-border rounded-xl shadow-2xl z-[90] overflow-hidden animate-in fade-in-50 zoom-in-95">
                        <div className="p-2.5 border-b border-border bg-surface-raised/80">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    autoFocus
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Escribe el nombre del artículo o SKU..."
                                    className="w-full h-8 pl-8 pr-2.5 bg-surface border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto divide-y divide-border/30 p-1 custom-scrollbar">
                            {filtered.length === 0 ? (
                                <div className="p-4 text-center text-xs text-text-secondary space-y-1">
                                    <p className="font-semibold text-text-primary">No se encontraron insumos</p>
                                    <p className="text-[11px]">Prueba con otro término de búsqueda</p>
                                </div>
                            ) : (
                                filtered.map(item => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(item)
                                            setIsOpen(false)
                                        }}
                                        className={`w-full p-2 text-left text-xs rounded-lg flex items-center justify-between hover:bg-primary/10 hover:text-primary transition-colors ${
                                            item.id === selectedId ? 'bg-primary/15 text-primary font-bold' : 'text-text-primary'
                                        }`}
                                    >
                                        <div className="truncate pr-2">
                                            <div className="truncate font-semibold">{item.name}</div>
                                            <div className="text-[10px] text-text-secondary flex items-center gap-2 mt-0.5">
                                                {item.code && <span className="font-mono bg-surface-raised px-1 rounded border border-border">{item.code}</span>}
                                                {item.uom_name && <span className="text-text-tertiary">UOM: {item.uom_name}</span>}
                                            </div>
                                        </div>
                                        {item.id === selectedId && <Check className="w-4 h-4 text-primary shrink-0" />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

interface ModifierGroupModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    group?: SaleModifierGroup | null
}

export default function ModifierGroupModal({
    isOpen,
    onClose,
    onSuccess,
    group
}: ModifierGroupModalProps) {
    const [name, setName] = useState('')
    const [minSelection, setMinSelection] = useState<number | string>(0)
    const [maxSelection, setMaxSelection] = useState<number | string>('')
    const [isActive, setIsActive] = useState(true)
    const [position, setPosition] = useState<number>(0)
    const [options, setOptions] = useState<SaleModifierOption[]>([])

    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSaveSuccess, setIsSaveSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) return
        inventoryApi.getInventoryItems().then(setInventoryItems).catch(() => [])
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) return
        if (group) {
            setName(group.name || '')
            setMinSelection(group.min_selection ?? 0)
            setMaxSelection(group.max_selection != null && group.max_selection > 0 ? group.max_selection : '')
            setIsActive(Boolean(group.is_active))
            setPosition(group.position || 0)
            setOptions(group.options ? group.options.map(o => ({ ...o })) : [])
        } else {
            setName('')
            setMinSelection(0)
            setMaxSelection('')
            setIsActive(true)
            setPosition(0)
            setOptions([
                { name: '', price: 0, food_cost: 0, is_active: true, position: 0 }
            ])
        }
        setError(null)
        setIsSaveSuccess(false)
    }, [isOpen, group])

    const handleAddOption = () => {
        setOptions(prev => [
            ...prev,
            { name: '', price: 0, food_cost: 0, is_active: true, position: prev.length }
        ])
    }

    const handleRemoveOption = (index: number) => {
        setOptions(prev => prev.filter((_, i) => i !== index))
    }

    const handleOptionChange = (index: number, field: keyof SaleModifierOption, value: any) => {
        setOptions(prev => {
            const copy = [...prev]
            copy[index] = { ...copy[index], [field]: value }
            return copy
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            setError('El nombre del grupo es obligatorio.')
            return
        }

        const validOptions = options.filter(o => o.name.trim())
        if (validOptions.length === 0) {
            setError('Debes agregar al menos una opción con nombre.')
            return
        }

        try {
            setIsLoading(true)
            setError(null)

            const parsedMax = maxSelection === '' || maxSelection === null || Number(maxSelection) === 0 ? null : Number(maxSelection)

            const payload: any = {
                name: name.trim(),
                min_selection: Number(minSelection) || 0,
                max_selection: parsedMax,
                is_active: isActive,
                position: Number(position) || 0,
                options: validOptions.map((opt, idx) => ({
                    name: opt.name.trim(),
                    price: Number(opt.price) || 0,
                    food_cost: Number(opt.food_cost) || 0,
                    item_id: opt.item_id || null,
                    deduct_qty: opt.deduct_qty ? Number(opt.deduct_qty) : null,
                    is_active: Boolean(opt.is_active ?? true),
                    position: idx
                }))
            }

            if (group) {
                const updatedGroup = await salesApi.updateModifierGroup(group.id, payload)
                setIsSaveSuccess(true)
                if (updatedGroup) {
                    setName(updatedGroup.name || '')
                    setMinSelection(updatedGroup.min_selection ?? 0)
                    setMaxSelection(updatedGroup.max_selection != null && updatedGroup.max_selection > 0 ? updatedGroup.max_selection : '')
                    setIsActive(Boolean(updatedGroup.is_active))
                    setPosition(updatedGroup.position || 0)
                    setOptions(updatedGroup.options ? updatedGroup.options.map(o => ({ ...o })) : [])
                }
                setTimeout(() => {
                    setIsSaveSuccess(false)
                }, 3000)
            } else {
                await salesApi.createModifierGroup(payload)
                onClose()
            }

            onSuccess()
        } catch (err: unknown) {
            console.error('Error saving modifier group:', err)
            setError(err instanceof Error ? err.message : 'Error al guardar grupo de modificadores')
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-3xl max-h-[95vh] min-h-[500px] flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200 text-[13px]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-raised/40">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <SlidersHorizontal className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-text-primary">
                                {group ? 'Editar Grupo de Modificadores' : 'Nuevo Grupo de Modificadores'}
                            </h3>
                            <p className="text-xs text-text-secondary">
                                Agrega opciones adicionales, extras, salsas o personalizaciones
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                        {error && (
                            <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                                    Nombre del Grupo <span className="text-error">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej: Tipo de Salsa, Extras de Queso, Término de Carne"
                                    className="w-full h-10 px-3.5 bg-surface-raised border border-border rounded-xl focus:outline-none focus:border-primary text-text-primary text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                                    Mínimo a Seleccionar
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={minSelection}
                                    onChange={(e) => setMinSelection(Number(e.target.value))}
                                    className="w-full h-10 px-3.5 bg-surface-raised border border-border rounded-xl focus:outline-none focus:border-primary text-text-primary text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1.5 flex items-center justify-between">
                                    <span>Máximo a Seleccionar</span>
                                    <span className="text-[10px] text-text-tertiary font-normal">(Vacío o 0 = Ilimitado)</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={maxSelection}
                                    onChange={(e) => setMaxSelection(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder="Ilimitado"
                                    className="w-full h-10 px-3.5 bg-surface-raised border border-border rounded-xl focus:outline-none focus:border-primary text-text-primary text-xs"
                                />
                            </div>

                            <div className="sm:col-span-2 flex items-center justify-between p-3 bg-surface-raised border border-border rounded-xl">
                                <div>
                                    <p className="text-xs font-semibold text-text-primary">¿Grupo Activo?</p>
                                    <p className="text-[11px] text-text-secondary">Disponible para seleccionar en los productos</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>

                        {/* Options Section */}
                        <div className="pt-3 border-t border-border space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                                    Opciones del Modificador ({options.length})
                                </h4>
                                <button
                                    type="button"
                                    onClick={handleAddOption}
                                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Agregar Opción
                                </button>
                            </div>

                            <div className="space-y-2.5">
                                {options.map((opt, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 bg-surface-raised/70 border border-border rounded-xl space-y-2.5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                required
                                                value={opt.name}
                                                onChange={(e) => handleOptionChange(idx, 'name', e.target.value)}
                                                placeholder={`Nombre de opción (Ej: Salsa BBQ, Extra Queso)`}
                                                className="flex-1 h-9 px-3 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary text-xs"
                                            />
                                            <div className="w-28 relative">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-xs">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={opt.price}
                                                    onChange={(e) => handleOptionChange(idx, 'price', e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full h-9 pl-6 pr-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary text-xs"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveOption(idx)}
                                                className="p-2 text-text-tertiary hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Optional Inventory Deduction */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/40 items-center">
                                            <div>
                                                <InventoryItemSearchSelect
                                                    items={inventoryItems}
                                                    selectedId={opt.item_id}
                                                    onSelect={(item) => {
                                                        handleOptionChange(idx, 'item_id', item ? item.id : null)
                                                        if (item && !opt.deduct_qty) {
                                                            handleOptionChange(idx, 'deduct_qty', 1)
                                                        }
                                                    }}
                                                />
                                            </div>
                                            {opt.item_id && (() => {
                                                const selectedInv = inventoryItems.find(i => i.id === opt.item_id)
                                                const uomLabel = selectedInv?.uom_name || 'U'

                                                return (
                                                    <div className="flex items-center gap-1.5 animate-in fade-in">
                                                        <span className="text-[11px] text-text-secondary font-medium">Descontar:</span>
                                                        <div className="relative flex items-center">
                                                            <input
                                                                type="number"
                                                                step="0.001"
                                                                min="0.001"
                                                                value={opt.deduct_qty ?? 1}
                                                                onChange={(e) => handleOptionChange(idx, 'deduct_qty', Number(e.target.value))}
                                                                className="w-24 h-8 pl-2.5 pr-2 bg-surface border border-border rounded-lg text-text-primary text-xs font-semibold focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                        <span
                                                            title="Unidad de Medida del Artículo de Inventario (Bloqueada)"
                                                            className="h-8 px-2.5 bg-surface-raised border border-border rounded-lg text-text-secondary text-xs font-mono flex items-center select-none shrink-0"
                                                        >
                                                            {uomLabel}
                                                        </span>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface-raised/50 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 h-10 bg-surface-raised hover:bg-border/30 text-text-secondary hover:text-text-primary rounded-xl font-semibold text-xs transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || isSaveSuccess}
                            className={`px-5 h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                                isSaveSuccess
                                    ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                                    : 'bg-primary text-text-inverse hover:bg-primary-hover shadow-primary/20'
                            }`}
                        >
                            {isSaveSuccess ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 text-white stroke-[2.5]" />
                                    <span>¡Guardado con Éxito!</span>
                                </>
                            ) : isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>{group ? 'Actualizar Grupo' : 'Crear Grupo'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
