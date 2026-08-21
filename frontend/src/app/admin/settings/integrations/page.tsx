'use client'

import React from 'react'
import VerumQuickCard from '@/components/integrations/VerumQuickCard'
import { Puzzle } from 'lucide-react'

export default function IntegrationsPage() {
    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2.5 text-primary">
                    <Puzzle className="w-6 h-6" />
                    <h1 className="text-2xl font-bold text-text-primary">Integraciones</h1>
                </div>
                <p className="text-sm text-text-secondary mt-1">
                    Conecta VERUM ERP con canales de venta, plataformas de delivery y aplicaciones externas.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <VerumQuickCard />
            </div>
        </div>
    )
}
