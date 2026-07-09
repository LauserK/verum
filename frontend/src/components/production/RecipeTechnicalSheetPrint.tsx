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
    <div ref={ref} className="p-6 text-black bg-white min-h-screen font-sans relative flex flex-col print:p-4 print:text-xs">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-900 pb-3 mb-4">
        <div>
          <h1 className="text-xl font-black tracking-tighter uppercase mb-0.5">VERUM</h1>
          <h2 className="text-lg font-bold uppercase text-gray-800 leading-tight">{itemName}</h2>
          <div className="flex gap-4 mt-1 text-[10px] text-gray-500 font-mono">
            {itemCode && <span>CÓDIGO: {itemCode}</span>}
            {categoryName && <span>CATEGORÍA: {categoryName}</span>}
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div className="border border-gray-200 p-1 bg-white rounded-lg">
            {recipeUrl && <QRCodeSVG value={recipeUrl} size={55} />}
          </div>
          <p className="text-[10px] font-semibold text-gray-700 mt-1">Fecha: {currentDateStr}</p>
        </div>
      </div>

      {/* Yield & Portions Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 mb-4 flex justify-between items-center text-xs">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Rendimiento Base</p>
          <p className="text-sm font-extrabold text-gray-900 mt-0.5">
            {Number(yieldQty).toFixed(2)} <span className="text-[10px] font-medium text-gray-600 uppercase">{yieldUnitName}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Tipo de Documento</p>
          <p className="text-[10px] font-bold text-gray-700 mt-0.5 uppercase">Ficha Técnica de Producción</p>
        </div>
      </div>

      {/* Grid of Ingredients & Steps Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 print:grid-cols-2 print:gap-6 print:mb-4">
        {/* Ingredients Table */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 border-b border-gray-200 pb-1 mb-2">Ingredientes</h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-[9px] font-bold uppercase text-gray-500">
                <th className="py-1 px-0.5">Ingrediente</th>
                <th className="py-1 px-0.5 text-right w-24">Cant.</th>
                <th className="py-1 px-0.5 text-center w-16">U.M.</th>
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
                  <tr key={idx} className="border-b border-gray-100 text-xs">
                    <td className="py-1.5 px-0.5 font-medium text-gray-900 leading-tight">
                      {name}
                      {ing.notes && <span className="block text-[9px] text-gray-400 italic mt-0.5">{ing.notes}</span>}
                    </td>
                    <td className="py-1.5 px-0.5 text-right font-semibold text-gray-800">
                      {Number(ing.qty_base).toFixed(3)}
                    </td>
                    <td className="py-1.5 px-0.5 text-center text-[10px] font-bold text-gray-500 uppercase">
                      {unitName}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Steps Section */}
        {steps && steps.length > 0 ? (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 border-b border-gray-200 pb-1 mb-2">Procedimiento</h3>
            <div className="space-y-2.5">
              {[...steps]
                .sort((a, b) => a.order_index - b.order_index)
                .map((step, idx) => (
                  <div key={idx} className="flex gap-2 items-start text-xs leading-relaxed">
                    <div className="bg-gray-900 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="space-y-0.5 flex-1">
                      {step.estimated_time_minutes > 0 && (
                        <span className="inline-block text-[8px] font-extrabold text-primary bg-primary/5 px-1 py-0.5 rounded border border-primary/10 uppercase tracking-wide">
                          {step.estimated_time_minutes} min
                        </span>
                      )}
                      <p className="text-gray-800">{step.description}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="text-xs italic text-gray-400">Sin pasos de preparación definidos.</div>
        )}
      </div>

      {/* Print Footer */}
      <div className="mt-auto border-t border-gray-200 pt-3 flex justify-between items-center text-[9px] text-gray-400">
        <p>VERUM ERP - Módulo de Producción</p>
        <p className="font-medium">Ficha Técnica Oficial para Uso Interno</p>
      </div>
    </div>
  )
})

RecipeTechnicalSheetPrint.displayName = 'RecipeTechnicalSheetPrint'
