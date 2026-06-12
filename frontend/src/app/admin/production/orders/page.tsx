'use client'

import { useTranslations } from '@/components/I18nProvider'
import { ClipboardList, ChevronLeft, Plus } from 'lucide-react'
import Link from 'next/link'

export default function ProductionOrdersPage() {
    const { t } = useTranslations()

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
                        {t('production.orders')}
                    </h1>
                    <button className="px-6 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm flex items-center gap-2 opacity-50 cursor-not-allowed">
                        <Plus className="w-4 h-4" /> {t('production.newOrder')}
                    </button>
                </div>
            </div>

            {/* Placeholder Content */}
            <div className="bg-surface border border-border border-dashed rounded-3xl p-20 text-center">
                <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClipboardList className="w-8 h-8 text-text-secondary" />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Órdenes de Producción</h3>
                <p className="text-text-secondary max-w-sm mx-auto">
                    Próximamente podrás crear órdenes de producción, realizar explosión de materiales y registrar la producción terminada.
                </p>
            </div>
        </div>
    )
}
