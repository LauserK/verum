'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from '@/components/I18nProvider'
import { adminApi, InventoryItem } from '@/lib/api'
import { BookOpen, ChevronLeft, ChevronRight, Search, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function RecipesPage() {
    const { t } = useTranslations()
    const [items, setItems] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        const loadItems = async () => {
            try {
                const data = await adminApi.getInventoryItems()
                // Filter for items that can have recipes
                const recipeEligible = data.filter(item => 
                    item.type === 'semi_finished' || item.type === 'finished'
                )
                setItems(recipeEligible)
            } catch (error) {
                console.error('Error loading items:', error)
            } finally {
                setLoading(false)
            }
        }
        loadItems()
    }, [])

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Breadcrumb / Header */}
            <div>
                <Link href="/admin/production" className="text-text-secondary hover:text-primary transition-colors flex items-center gap-2 text-sm font-bold mb-4">
                    <ChevronLeft className="w-4 h-4" />
                    {t('production.title')}
                </Link>
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-black text-text-primary tracking-tight">
                        {t('production.recipes')}
                    </h1>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Buscar producto o código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-14 pl-12 pr-4 bg-surface border border-border rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-medium"
                />
            </div>

            {/* List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-text-secondary font-bold">Cargando catálogo...</p>
                </div>
            ) : filteredItems.length > 0 ? (
                <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
                    <div className="divide-y divide-border">
                        {filteredItems.map(item => (
                            <Link 
                                key={item.id} 
                                href={`/admin/production/recipes/${item.id}`}
                                className="flex items-center justify-between p-6 hover:bg-surface-raised transition-colors group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${
                                        item.type === 'finished' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                                    }`}>
                                        {item.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-text-primary group-hover:text-primary transition-colors">
                                            {item.name}
                                        </h3>
                                        <div className="flex items-center gap-3 text-xs text-text-secondary font-medium mt-1">
                                            <span className="bg-surface-raised px-2 py-0.5 rounded-full border border-border capitalize">
                                                {item.type === 'finished' ? 'Producto Terminado' : 'Semi-elaborado'}
                                            </span>
                                            {item.code && (
                                                <span className="bg-surface-raised px-2 py-0.5 rounded-full border border-border uppercase">
                                                    {item.code}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-text-secondary">
                                    <span className="text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                                        Editar Receta
                                    </span>
                                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-surface border border-border border-dashed rounded-3xl p-20 text-center">
                    <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-8 h-8 text-text-secondary" />
                    </div>
                    <h3 className="text-lg font-bold text-text-primary mb-2">No se encontraron productos</h3>
                    <p className="text-text-secondary max-w-sm mx-auto">
                        Asegúrate de tener productos de tipo semi-elaborado o terminado en tu catálogo.
                    </p>
                </div>
            )}
        </div>
    )
}
