import React, { forwardRef } from 'react'
import { RecipeTechnicalSheetPrint } from './RecipeTechnicalSheetPrint'

interface Props {
  recipes: any[] // Array of RecipeResponse joined from database
  categories: any[]
}

export const RecipeBundlePrint = forwardRef<HTMLDivElement, Props>(({ recipes, categories }, ref) => {
  return (
    <div ref={ref} className="bg-white text-black min-h-screen font-sans">
      {recipes.map((recipe, idx) => {
        const item = recipe.items || {}
        const itemName = item.name || 'Receta Sin Nombre'
        const itemCode = item.code || null
        
        // Find category name
        const cat = categories.find(c => c.id === item.category_id)
        const categoryName = cat ? cat.name : undefined

        const yieldUnitName = recipe.yield_presentation?.name || item.uom_base?.name || 'un'

        return (
          <div key={recipe.id} className={idx < recipes.length - 1 ? 'print-page-break' : ''}>
            <RecipeTechnicalSheetPrint
              itemId={recipe.item_id}
              itemName={itemName}
              itemCode={itemCode}
              categoryName={categoryName}
              yieldQty={recipe.yield_qty_base}
              yieldUnitName={yieldUnitName}
              ingredients={recipe.ingredients || []}
              steps={recipe.steps || []}
            />
          </div>
        )
      })}
      
      {/* Style block for print page break */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .print-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `}} />
    </div>
  )
})

RecipeBundlePrint.displayName = 'RecipeBundlePrint'
