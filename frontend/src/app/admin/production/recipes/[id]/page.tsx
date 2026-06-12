'use client'

import React, { useEffect, useState, use } from 'react'
import { adminApi, InventoryItem, RecipeResponse } from '@/lib/api'
import RecipeEditor from '@/components/production/RecipeEditor'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [recipe, setRecipe] = useState<RecipeResponse | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const itemData = await adminApi.getInventoryItem(id)
      setItem(itemData)
      
      try {
        const recipeData = await adminApi.getRecipe(id)
        setRecipe(recipeData)
      } catch (err: any) {
        // If it's a 404, it's fine, it means there's no recipe yet
        console.log('No existing recipe found for this item')
      }
    } catch (err: any) {
      console.error('Error fetching recipe data:', err)
      setError('No se pudo cargar la información del artículo')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-gray-500 font-medium">Cargando editor de receta...</p>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 bg-surface rounded-2xl border border-border text-center">
        <h2 className="text-xl font-bold text-red-500 mb-2">Error</h2>
        <p className="text-gray-600 mb-6">{error || 'Artículo no encontrado'}</p>
        <Link 
          href="/admin/production/recipes" 
          className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la lista
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/production" className="hover:text-primary transition-colors">Producción</Link>
        <span>/</span>
        <Link href="/admin/production/recipes" className="hover:text-primary transition-colors">Recetas</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{item.name}</span>
      </nav>

      <RecipeEditor 
        itemId={id} 
        initialData={recipe} 
        itemName={item.name} 
      />
    </div>
  )
}
