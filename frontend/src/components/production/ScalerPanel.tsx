'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { adminApi, ProductionNeedsResponse, IngredientDeficit } from '@/lib/api'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

interface ScalerPanelProps {
    itemId: string
    targetQty: number
    targetUomId: string
    warehouseId: string
    onValidationChange?: (isValid: boolean) => void
}

export default function ScalerPanel({
    itemId,
    targetQty,
    targetUomId,
    warehouseId,
    onValidationChange
}: ScalerPanelProps) {
    const [loading, setLoading] = useState(false)
    const [needs, setNeeds] = useState<ProductionNeedsResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const calculateNeeds = useCallback(async () => {
        if (!itemId || !targetQty || targetQty <= 0 || !warehouseId) return

        setLoading(true)
        setError(null)
        try {
            const data = await adminApi.calculateProductionNeeds({
                item_id: itemId,
                target_qty: targetQty,
                target_uom_id: targetUomId || null,
                warehouse_id: warehouseId
            })
            setNeeds(data)
            onValidationChange?.(data.status === 'OK')
        } catch (err: any) {
            console.error('Error calculating needs:', err)
            setError(err.message || 'Error al calcular necesidades')
            setNeeds(null)
            onValidationChange?.(false)
        } finally {
            setLoading(false)
        }
    }, [itemId, targetQty, targetUomId, warehouseId, onValidationChange])

    useEffect(() => {
        const timer = setTimeout(() => {
            calculateNeeds()
        }, 500) // Debounce 500ms

        return () => clearTimeout(timer)
    }, [calculateNeeds])

    if (!itemId || !targetQty || targetQty <= 0 || !warehouseId) {
        return (
            <div className="p-4 bg-surface-raised rounded-lg text-center text-text-secondary border border-dashed border-border">
                Selecciona un producto y sede para ver los requerimientos
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">Requerimientos de Producción</h3>
                {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>

            {error && (
                <div className="p-3 bg-error-light text-error rounded-md text-sm border border-error/20">
                    {error}
                </div>
            )}

            {needs && (
                <div className="border border-border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-surface-raised">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">Ingrediente</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary uppercase">Necesario</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary uppercase">Unidad</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary uppercase">Disponible</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-text-secondary uppercase">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="bg-surface divide-y divide-border">
                            {needs.ingredients.map((ing) => (
                                <tr key={ing.item_id}>
                                    <td className="px-4 py-3 text-sm font-medium text-text-primary">{ing.item_name}</td>
                                    <td className="px-4 py-3 text-sm text-right text-text-secondary font-mono">{Number(ing.needed_base_qty).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-xs text-left text-text-secondary uppercase font-bold">{ing.uom_name}</td>
                                    <td className="px-4 py-3 text-sm text-right text-text-secondary font-mono">{Number(ing.available_base_qty).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm text-center">
                                        {ing.deficit_base_qty > 0 ? (
                                            <div className="flex items-center justify-center text-error gap-1">
                                                <AlertCircle className="h-4 w-4" />
                                                <span className="font-semibold font-mono">-{Number(ing.deficit_base_qty).toLocaleString()}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center text-success">
                                                <CheckCircle2 className="h-4 w-4" />
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {needs && needs.status === 'DEFICIT' && (
                <div className="p-3 bg-warning-light text-warning rounded-md text-sm flex gap-2 items-start border border-warning/20">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p>
                        <strong>Atención:</strong> Stock insuficiente para algunos ingredientes. 
                        No se recomienda iniciar la producción hasta completar el inventario.
                    </p>
                </div>
            )}
        </div>
    )
}
