import React, { forwardRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { InventoryItem, UOMPresentation, RecipeStep } from '@/lib/api'

interface IngredientLine {
  item_id: string
  item_name?: string
  qty_base: number
  presentation_id: string | null
  presentation_name?: string
  notes?: string
}

interface Props {
  itemId: string
  itemName: string
  itemCode: string | null
  categoryName?: string
  yieldQty: number
  yieldUnitName: string
  ingredients: IngredientLine[]
  steps: RecipeStep[]
  allItems?: InventoryItem[]
  ingredientPresentations?: Record<string, UOMPresentation[]>
}

export const RecipeTechnicalSheetPrint = forwardRef<HTMLDivElement, Props>(({
  itemId,
  itemName,
  itemCode,
  categoryName,
  yieldQty,
  yieldUnitName,
  ingredients,
  steps,
  allItems = [],
  ingredientPresentations = {}
}, ref) => {
  const currentDateStr = format(new Date(), 'dd/MM/yyyy', { locale: es })
  const recipeUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/admin/production/recipes/${itemId}`
    : ''

  return (
    <div ref={ref} className="p-12 text-black bg-white min-h-screen font-sans relative flex flex-col print:p-8">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-900 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">VERUM</h1>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-4">Portal de Gestión Operativa</p>
          <h2 className="text-2xl font-bold uppercase text-gray-800">{itemName}</h2>
          {itemCode && (
            <p className="text-xs font-mono text-gray-500 mt-1">CÓDIGO: {itemCode}</p>
          )}
          {categoryName && (
            <p className="text-xs text-gray-500 mt-1">CATEGORÍA: {categoryName}</p>
          )}
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <div className="border border-gray-300 p-1.5 bg-white rounded-lg">
            {recipeUrl && <QRCodeSVG value={recipeUrl} size={70} />}
          </div>
          <p className="text-[9px] font-mono text-gray-400">Escanea para ver en vivo</p>
          <p className="text-xs font-semibold text-gray-700 mt-2">Generado el: {currentDateStr}</p>
        </div>
      </div>

      {/* Yield & Portions Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 flex justify-between items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Rendimiento Base de la Receta</p>
          <p className="text-lg font-extrabold text-gray-900 mt-0.5">
            {Number(yieldQty).toFixed(2)} <span className="text-sm font-medium text-gray-600 uppercase">{yieldUnitName}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tipo de Producto</p>
          <p className="text-sm font-bold text-gray-700 mt-0.5 uppercase">Ficha Técnica de Producción</p>
        </div>
      </div>

      {/* Grid of Ingredients & Steps */}
      <div className="grid grid-cols-1 gap-8 mb-12">
        {/* Ingredients Table */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 border-b border-gray-300 pb-2 mb-4">Ingredientes</h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-900 text-[10px] font-bold uppercase text-gray-500">
                <th className="py-2 px-1">Ingrediente</th>
                <th className="py-2 px-1 text-right w-32">Cantidad</th>
                <th className="py-2 px-1 text-center w-32">U.M.</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing, idx) => {
                if (!ing.item_id) return null
                const item = allItems?.find(it => it.id === ing.item_id)
                const name = item?.name || ing.item_name || (ing as any).items?.name || 'Artículo Desconocido'
                
                // Get presentation name
                let unitName = 'base'
                if (ing.presentation_id) {
                  const presList = ingredientPresentations?.[ing.item_id] || []
                  const pres = presList.find(p => p.id === ing.presentation_id)
                  unitName = pres ? pres.name : (ing.presentation_name || (ing as any).uom_presentations?.name || 'unidad')
                } else {
                  unitName = item?.uom_name || (ing as any).items?.uom_base?.name || 'un'
                }

                return (
                  <tr key={idx} className="border-b border-gray-100 text-sm">
                    <td className="py-2.5 px-1 font-medium text-gray-900">
                      {name}
                      {ing.notes && <span className="block text-[10px] text-gray-400 italic mt-0.5">{ing.notes}</span>}
                    </td>
                    <td className="py-2.5 px-1 text-right font-semibold text-gray-800">
                      {Number(ing.qty_base).toFixed(3)}
                    </td>
                    <td className="py-2.5 px-1 text-center text-xs font-bold text-gray-500 uppercase">
                      {unitName}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Steps Section */}
        {steps && steps.length > 0 && (
          <div className="mt-4 break-inside-avoid">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 border-b border-gray-300 pb-2 mb-4">Pasos de Preparación</h3>
            <div className="space-y-4">
              {[...steps]
                .sort((a, b) => a.order_index - b.order_index)
                .map((step, idx) => (
                  <div key={idx} className="flex gap-4 items-start text-sm">
                    <div className="bg-gray-900 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="space-y-1">
                      {step.estimated_time_minutes > 0 && (
                        <span className="text-[10px] font-extrabold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 uppercase tracking-wide">
                          {step.estimated_time_minutes} min
                        </span>
                      )}
                      <p className="text-gray-800 leading-relaxed mt-1">{step.description}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Print Footer */}
      <div className="mt-auto border-t border-gray-200 pt-6 flex justify-between items-center text-[9px] text-gray-400">
        <p>VERUM ERP - Módulo de Producción</p>
        <p className="font-medium">Ficha Técnica Oficial para Uso Interno</p>
      </div>
    </div>
  )
})

RecipeTechnicalSheetPrint.displayName = 'RecipeTechnicalSheetPrint'
