'use client'

import { useEffect, useState } from 'react'
import { superAdminApi } from '@/lib/api'
import { Building2, Store, Users, Activity, Database } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'
import Link from 'next/link'

export default function SuperAdminDashboard() {
    const { t } = useTranslations()
    const [metrics, setMetrics] = useState<any>(null)
    const [cacheHealth, setCacheHealth] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const cards = [
        { label: t('superAdmin.totalOrgs'), value: metrics?.total_organizations, icon: Building2, color: 'text-blue-500' },
        { label: t('superAdmin.totalVenues'), value: metrics?.total_venues, icon: Store, color: 'text-green-500' },
        { label: t('superAdmin.totalUsers'), value: metrics?.total_users, icon: Users, color: 'text-purple-500' },
        { label: t('superAdmin.systemStatus'), value: 'Activo', icon: Activity, color: 'text-primary' },
    ]

    useEffect(() => {
        async function loadMetrics() {
            try {
                const [metricsData, cacheData] = await Promise.all([
                    superAdminApi.getMetrics(),
                    superAdminApi.getCacheHealth().catch(() => null)
                ])
                setMetrics(metricsData)
                setCacheHealth(cacheData)
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        loadMetrics()
    }, [])

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-text-primary">{t('superAdmin.metrics')}</h2>
            
            {loading ? (
                <div className="py-20 text-center text-text-secondary">Cargando métricas...</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {cards.map((card) => {
                            const Icon = card.icon
                            return (
                                <div key={card.label} className="bg-surface p-4 rounded-2xl border border-border shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <Icon className={`w-5 h-5 ${card.color}`} />
                                    </div>
                                    <div className="text-2xl font-black text-text-primary">{card.value}</div>
                                    <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">{card.label}</div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-surface p-6 rounded-2xl border border-border">
                            <h3 className="text-base font-bold text-text-primary mb-4">Información del Sistema</h3>
                            <div className="space-y-2 text-sm text-text-secondary">
                                <p>API URL: <code className="bg-surface-raised px-2 py-1 rounded text-xs">{process.env.NEXT_PUBLIC_API_URL}</code></p>
                                <p>Entorno: <span className="font-bold text-primary">Producción / Mantenimiento</span></p>
                            </div>
                        </div>

                        <div className="bg-surface p-6 rounded-2xl border border-border flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Database className="w-5 h-5 text-primary" />
                                    <h3 className="text-base font-bold text-text-primary">Caché Redis</h3>
                                </div>
                                <div className="space-y-2 text-sm text-text-secondary">
                                    <p>Estado: <span className={`font-bold ${cacheHealth?.connected ? 'text-green-500' : 'text-text-secondary'}`}>
                                        {cacheHealth?.connected ? 'Conectado (Activo)' : 'Inactivo / No-op'}
                                    </span></p>
                                    {cacheHealth?.connected && (
                                        <>
                                            <p>Uso de memoria: <span className="text-text-primary font-medium">{cacheHealth.memory_used}</span></p>
                                            <p>Hit Rate: <span className="text-text-primary font-medium">{cacheHealth.stats?.hit_rate}</span></p>
                                        </>
                                    )}
                                </div>
                            </div>
                            <Link
                                href="/super-admin/cache"
                                className="mt-4 text-xs font-bold text-primary hover:underline self-start"
                            >
                                Administrar Caché &rarr;
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

