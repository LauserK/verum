'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle2, RefreshCw, ExternalLink, Unlink, Store, AlertCircle } from 'lucide-react'
import { useVenue } from '@/components/VenueContext'

interface IntegrationStatus {
    is_connected: boolean
    company_id?: string | null
    workstation_name?: string | null
}

export default function VerumQuickCard() {
    const { activeVenueId } = useVenue()
    const [quickUrl, setQuickUrl] = useState(
        process.env.NEXT_PUBLIC_VERUM_QUICK_URL || 'http://localhost:8000'
    )
    const [status, setStatus] = useState<IntegrationStatus>({ is_connected: false })
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchStatus = async () => {
        try {
            setLoading(true)
            setError(null)
            const res = await fetch('/api/integrations/quick/status')
            if (res.ok) {
                const data = await res.json()
                setStatus(data)
            } else {
                setError('No se pudo verificar el estado de la integración.')
            }
        } catch (err) {
            setError('Error de conexión con el backend.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStatus()

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'VERUM_QUICK_LINKED') {
                fetchStatus()
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [])

    const handleConnect = () => {
        setError(null)
        // Read active org from cookies or localStorage if needed, or pass placeholder
        const authUrl = `${quickUrl.replace(/\/$/, '')}/integrations/verum/authorize/?org_id=default&redirect_uri=${encodeURIComponent(window.location.origin + '/api/integrations/quick/callback')}`
        
        const width = 520
        const height = 680
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2

        window.open(
            authUrl,
            'verum_quick_oauth',
            `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
        )
    }

    const handleDisconnect = async () => {
        if (!confirm('¿Seguro que deseas desvincular VerumQuick? Se pausará la sincronización de órdenes.')) {
            return
        }

        try {
            setActionLoading(true)
            const res = await fetch('/api/integrations/quick/disconnect', {
                method: 'POST'
            })
            if (res.ok) {
                await fetchStatus()
            } else {
                alert('No se pudo desconectar la integración.')
            }
        } catch (err) {
            alert('Error al intentar desconectar.')
        } finally {
            setActionLoading(false)
        }
    }

    return (
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl">
                        <Store className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-text-primary">VerumQuick</h3>
                            {status.is_connected ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Conectado
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-raised text-text-tertiary border border-border">
                                    Desconectado
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-text-secondary mt-1">
                            Menú Digital QR, pedidos para Dine-in y Delivery con inyección automática a cocina y sincronización de catálogo.
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mt-4 p-3 rounded-xl bg-error/10 border border-error/20 flex items-center gap-2 text-sm text-error">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="mt-6 pt-6 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                {status.is_connected ? (
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center text-sm text-text-secondary">
                        <div>
                            <span className="font-semibold text-text-primary">Compañía ID:</span> {status.company_id || 'Principal'}
                        </div>
                        <div className="hidden sm:block text-border">•</div>
                        <div>
                            <span className="font-semibold text-text-primary">Workstation POS:</span> {status.workstation_name || 'VerumQuick POS'}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 max-w-sm">
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                            URL de VerumQuick
                        </label>
                        <input
                            type="text"
                            value={quickUrl}
                            onChange={(e) => setQuickUrl(e.target.value)}
                            placeholder="http://localhost:8000"
                            className="w-full text-sm px-3 py-2 bg-surface-raised border border-border rounded-xl focus:outline-none focus:border-primary text-text-primary"
                        />
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {loading ? (
                        <button disabled className="px-4 py-2 bg-surface-raised text-text-tertiary rounded-xl text-sm font-medium flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Verificando...
                        </button>
                    ) : status.is_connected ? (
                        <button
                            onClick={handleDisconnect}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-error/10 hover:bg-error/20 text-error border border-error/20 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <Unlink className="w-4 h-4" />
                            Desconectar
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Conectar con VerumQuick
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
