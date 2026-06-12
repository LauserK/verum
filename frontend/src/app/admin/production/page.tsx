'use client'

import { useTranslations } from '@/components/I18nProvider'
import { ChefHat, ArrowRight, BookOpen, ClipboardList, Plus } from 'lucide-react'
import Link from 'next/link'

export default function ProductionDashboard() {
    const { t } = useTranslations()

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-text-primary tracking-tight">
                    {t('production.title')}
                </h1>
                <p className="text-text-secondary text-sm mt-1">
                    {t('production.dashboard')}
                </p>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link href="/admin/production/recipes" className="bg-surface border border-border rounded-3xl p-6 shadow-sm hover:border-primary/50 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <BookOpen className="w-6 h-6" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary">{t('production.recipes')}</h2>
                        <p className="text-sm text-text-secondary mt-1">Gestiona las fichas técnicas y costos de producción.</p>
                    </div>
                    <div className="flex items-center justify-end mt-6">
                        <ArrowRight className="w-5 h-5 text-text-secondary group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>

                <Link href="/admin/production/orders" className="bg-surface border border-border rounded-3xl p-6 shadow-sm hover:border-primary/50 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center text-success group-hover:scale-110 transition-transform">
                            <ClipboardList className="w-6 h-6" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary">{t('production.orders')}</h2>
                        <p className="text-sm text-text-secondary mt-1">Controla las órdenes de producción y rendimientos.</p>
                    </div>
                    <div className="flex items-center justify-end mt-6">
                        <ArrowRight className="w-5 h-5 text-text-secondary group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>
            </div>

            {/* Placeholder Content */}
            <div className="bg-surface border border-border border-dashed rounded-3xl p-12 text-center">
                <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
                    <ChefHat className="w-8 h-8 text-text-secondary" />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Módulo en Desarrollo</h3>
                <p className="text-text-secondary max-w-sm mx-auto">
                    Próximamente podrás gestionar recetas, costos y órdenes de producción integradas con el inventario.
                </p>
                <div className="mt-8 flex justify-center gap-4">
                    <button className="px-6 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm flex items-center gap-2 opacity-50 cursor-not-allowed">
                        <Plus className="w-4 h-4" /> {t('production.newOrder')}
                    </button>
                </div>
            </div>
        </div>
    )
}
