'use client'

import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'
import { salesApi, SaleCategory } from '@/lib/api/sales'

interface CategoryModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    category?: SaleCategory | null
}

const PRESET_ICONS = ['🍔', '🍕', '☕', '🍹', '🍺', '🍰', '🥗', '🍣', '🥩', '🥖', '🍲', '🍦', '🍿', '🍳', '🥪', '🍷', '🏷️', '📦']

export default function CategoryModal({
    isOpen,
    onClose,
    onSuccess,
    category
}: CategoryModalProps) {
    const [name, setName] = useState('')
    const [icon, setIcon] = useState('🍔')
    const [position, setPosition] = useState(0)
    const [isActive, setIsActive] = useState(true)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (category) {
            setName(category.name || '')
            setIcon(category.icon || '🍔')
            setPosition(category.position || 0)
            setIsActive(category.is_active ?? true)
        } else {
            setName('')
            setIcon('🍔')
            setPosition(0)
            setIsActive(true)
        }
        setError(null)
    }, [category, isOpen])

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            setError('El nombre de la categoría es obligatorio')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const payload = {
                name: name.trim(),
                icon: icon.trim() || '🍔',
                position: Number(position) || 0,
                is_active: isActive,
            }

            if (category) {
                await salesApi.updateSaleCategory(category.id, payload)
            } else {
                await salesApi.createSaleCategory(payload)
            }

            onSuccess()
            onClose()
        } catch (err: unknown) {
            console.error('Error saving category:', err)
            setError(err instanceof Error ? err.message : 'Error al guardar la categoría')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border bg-surface-raised/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
                            {icon || '🏷️'}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-text-primary">
                                {category ? 'Editar Categoría' : 'Nueva Categoría'}
                            </h2>
                            <p className="text-xs text-text-secondary">
                                {category ? 'Modifica los datos de la categoría' : 'Crea una categoría para organizar tus productos'}
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
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-400">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                            Nombre <span className="text-rose-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. Hamburguesas, Bebidas, Postres..."
                            required
                            className="w-full h-11 px-3.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    {/* Icon / Emoji Selector */}
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Ícono / Emoji</span>
                            <span className="text-[10px] text-text-secondary lowercase font-normal">Puedes escribir cualquier emoji</span>
                        </label>
                        <div className="flex gap-2 items-center mb-2">
                            <input
                                type="text"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                maxLength={8}
                                placeholder="🍔"
                                className="w-16 h-11 text-center text-xl bg-surface-raised border border-border rounded-xl text-text-primary focus:outline-none focus:border-primary transition-colors"
                            />
                            <div className="text-xs text-text-secondary">
                                Selecciona un acceso rápido o escribe tu emoji favorito
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 p-2 bg-surface-raised/40 rounded-xl border border-border/50 max-h-24 overflow-y-auto">
                            {PRESET_ICONS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setIcon(preset)}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-surface-raised transition-all ${
                                        icon === preset ? 'bg-primary/20 ring-2 ring-primary' : 'bg-surface'
                                    }`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Position & Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                                Orden / Posición
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={position}
                                onChange={(e) => setPosition(Number(e.target.value))}
                                className="w-full h-11 px-3.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                                Estado
                            </label>
                            <div className="h-11 flex items-center px-3.5 bg-surface-raised border border-border rounded-xl">
                                <label className="relative flex items-center gap-3 cursor-pointer w-full">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                    <span className="text-xs font-medium text-text-primary">
                                        {isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-3 pt-3 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 h-11 bg-surface-raised hover:bg-border/30 text-text-secondary hover:text-text-primary rounded-xl font-semibold text-sm transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 h-11 bg-primary text-text-inverse hover:bg-primary-hover rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {isLoading ? 'Guardando...' : category ? 'Actualizar' : 'Crear'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
