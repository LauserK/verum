'use client'

import { useTranslations } from '@/components/I18nProvider'
import { ChefHat, ArrowRight, BookOpen, ClipboardList, Plus, Monitor } from 'lucide-react'
import Link from 'next/link'

export default function ProductionDashboard() {
    const { t } = useTranslations()

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-black text-text-primary tracking-tight">
                        {t('production.title')}
                    </h1>
                    <p className="text-text-secondary text-sm mt-1">
                        Panel de control y gestión de manufactura gastronómica.
                    </p>
                </div>
                <Link 
                    href="/admin/production/orders/new"
                    className="px-6 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                >
                    <Plus className="w-4 h-4" /> {t('production.newOrder')}
                </Link>
            </div>

            {/* Main Navigation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* KDS - Destacado */}
                <Link href="/admin/production/kds" className="bg-primary/5 border-2 border-primary/20 rounded-[40px] p-8 shadow-sm hover:border-primary transition-all group flex flex-col justify-between">
                    <div>
                        <div className="w-14 h-14 rounded-3xl bg-primary flex items-center justify-center text-text-inverse group-hover:scale-110 transition-transform shadow-lg shadow-primary/30 mb-6">
                            <Monitor className="w-7 h-7" />
                        </div>
                        <h2 className="text-2xl font-black text-text-primary tracking-tight">Tablero KDS</h2>
                        <p className="text-sm text-text-secondary mt-2 leading-relaxed">Pantalla de ejecución para cocina. Gestiona comandas en tiempo real.</p>
                    </div>
                    <div className="flex items-center justify-end mt-8">
                        <span className="text-xs font-bold text-primary uppercase tracking-widest mr-2 group-hover:mr-4 transition-all">Entrar ahora</span>
                        <ArrowRight className="w-5 h-5 text-primary transition-transform" />
                    </div>
                </Link>

                {/* Recetas */}
                <Link href="/admin/production/recipes" className="bg-surface border border-border rounded-[40px] p-8 shadow-sm hover:border-border-strong transition-all group flex flex-col justify-between">
                    <div>
                        <div className="w-14 h-14 rounded-3xl bg-surface-raised border border-border flex items-center justify-center text-text-secondary group-hover:scale-110 transition-transform mb-6">
                            <BookOpen className="w-7 h-7" />
                        </div>
                        <h2 className="text-2xl font-bold text-text-primary tracking-tight">{t('production.recipes')}</h2>
                        <p className="text-sm text-text-secondary mt-2 leading-relaxed">Configuración de BOM, mermas permitidas y pasos de preparación.</p>
                    </div>
                    <div className="flex items-center justify-end mt-8">
                        <ArrowRight className="w-5 h-5 text-text-secondary group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>

                {/* Órdenes */}
                <Link href="/admin/production/orders" className="bg-surface border border-border rounded-[40px] p-8 shadow-sm hover:border-border-strong transition-all group flex flex-col justify-between">
                    <div>
                        <div className="w-14 h-14 rounded-3xl bg-surface-raised border border-border flex items-center justify-center text-text-secondary group-hover:scale-110 transition-transform mb-6">
                            <ClipboardList className="w-7 h-7" />
                        </div>
                        <h2 className="text-2xl font-bold text-text-primary tracking-tight">{t('production.orders')}</h2>
                        <p className="text-sm text-text-secondary mt-2 leading-relaxed">Historial de fabricación, auditoría de varianza y trazabilidad de lotes.</p>
                    </div>
                    <div className="flex items-center justify-end mt-8">
                        <ArrowRight className="w-5 h-5 text-text-secondary group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>
            </div>
        </div>
    )
}
