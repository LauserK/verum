'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from '@/components/I18nProvider'
import { adminApi, RecipeBriefResponse, InventoryItem } from '@/lib/api'
import { BookOpen, Search, Loader2, Plus, ArrowRight, BookPlus, X } from 'lucide-react'
import Link from 'next/link'

export default function RecipesPage() {
    const { t } = useTranslations('production.recipes')
    const [recipes, setRecipes] = useState<RecipeBriefResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    
    // Create flow state
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [itemsWithoutRecipe, setItemsWithoutRecipe] = useState<InventoryItem[]>([])
    const [loadingItems, setLoadingItems] = useState(false)
    const [itemSearch, setItemSearch] = useState('')

    useEffect(() => {
        loadRecipes()
    }, [])

    async function loadRecipes() {
        try {
            const data = await adminApi.getRecipes()
            setRecipes(data)
        } catch (error) {
            console.error('Error loading recipes:', error)
        } finally {
            setLoading(false)
        }
    }

    async function openCreateModal() {
        setShowCreateModal(true)
        setLoadingItems(true)
        try {
            const allItems = await adminApi.getInventoryItems()
            const existingItemIds = new Set(recipes.map(r => r.item_id))
            
            // Only items that can have recipes (semi_finished, finished) and don't have one yet
            const filtered = allItems.filter(item => 
                (item.type === 'semi_finished' || item.type === 'finished') && 
                !existingItemIds.has(item.id)
            )
            setItemsWithoutRecipe(filtered)
        } catch (error) {
            console.error('Error loading items:', error)
        } finally {
            setLoadingItems(false)
        }
    }

    const filteredRecipes = recipes.filter(r => 
        r.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.item_code?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )

    const filteredItemsToCreate = itemsWithoutRecipe.filter(i =>
        i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        (i.code?.toLowerCase() || '').includes(itemSearch.toLowerCase())
    )

    if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-primary" />
                        Libro de Recetas (BOM)
                    </h1>
                    <p className="text-sm text-text-secondary mt-1">
                        Gestión de ingredientes y pasos de producción por producto
                    </p>
                </div>
                <button 
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Receta
                </button>
            </div>

            <div className="relative group max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary group-focus-within:text-primary transition-colors" />
                <input 
                    type="text" 
                    placeholder="Buscar por nombre o código de producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-11 text-sm outline-none focus:border-primary transition-all"
                />
            </div>

            <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-raised border-b border-border">
                                <th className="p-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Producto</th>
                                <th className="p-4 text-[10px] font-black text-text-secondary uppercase tracking-widest text-center">Tipo</th>
                                <th className="p-4 text-[10px] font-black text-text-secondary uppercase tracking-widest text-center">Rendimiento Base</th>
                                <th className="p-4 text-[10px] font-black text-text-secondary uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredRecipes.map((recipe) => (
                                <tr key={recipe.id} className="hover:bg-surface-raised/50 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-text-primary text-sm">{recipe.item_name}</span>
                                            <span className="text-[10px] font-mono text-text-secondary">{recipe.item_code || 'SIN CÓDIGO'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                            recipe.item_type === 'semi_finished' 
                                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                        }`}>
                                            {recipe.item_type === 'semi_finished' ? 'SEMIMANUFACTURA' : 'TERMINADO'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="text-sm font-mono font-bold text-text-primary">
                                            {Number(recipe.yield_qty_base).toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Link 
                                            href={`/admin/production/recipes/${recipe.item_id}`}
                                            className="inline-flex items-center gap-1 text-xs font-black text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
                                        >
                                            EDITAR RECETA
                                            <ArrowRight className="w-3 h-3" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {filteredRecipes.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 rounded-full bg-surface-raised flex items-center justify-center">
                                                <BookPlus className="w-8 h-8 text-text-disabled" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-text-primary">No se encontraron recetas</p>
                                                <p className="text-xs text-text-secondary">Crea una nueva receta para comenzar.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Recipe Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                    <div className="relative bg-surface w-full max-w-xl rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-surface-raised">
                            <div>
                                <h2 className="text-lg font-bold text-text-primary">Crear Nueva Receta</h2>
                                <p className="text-xs text-text-secondary">Selecciona un producto para definir su receta</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-surface rounded-xl transition-colors">
                                <X className="w-5 h-5 text-text-secondary" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary group-focus-within:text-primary transition-colors" />
                                <input 
                                    type="text" 
                                    placeholder="Filtrar productos..."
                                    value={itemSearch}
                                    onChange={(e) => setItemSearch(e.target.value)}
                                    className="w-full bg-surface-raised border border-border rounded-xl pl-10 pr-4 h-11 text-sm outline-none focus:border-primary transition-all"
                                />
                            </div>

                            {loadingItems ? (
                                <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>
                            ) : (
                                <div className="grid gap-2">
                                    {filteredItemsToCreate.map(item => (
                                        <Link 
                                            key={item.id}
                                            href={`/admin/production/recipes/${item.id}`}
                                            className="flex items-center justify-between p-4 bg-surface-raised border border-border rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group"
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-bold text-text-primary text-sm group-hover:text-primary">{item.name}</span>
                                                <span className="text-[10px] text-text-secondary uppercase tracking-widest">
                                                    {item.code ? `${item.code} • ` : ''}{item.type === 'semi_finished' ? 'Semielaborado' : 'Terminado'}
                                                </span>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-text-disabled group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </Link>
                                    ))}
                                    {filteredItemsToCreate.length === 0 && (
                                        <div className="py-10 text-center text-text-secondary text-sm italic">
                                            No hay productos disponibles para nuevas recetas.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
