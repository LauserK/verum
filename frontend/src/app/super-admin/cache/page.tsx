'use client'

import { useEffect, useState } from 'react'
import { superAdminApi } from '@/lib/api'
import { Database, RefreshCw, Trash2, ShieldAlert, Cpu, HardDrive, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

export default function SuperAdminCachePage() {
    const [health, setHealth] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [flushing, setFlushing] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    async function loadHealth() {
        setLoading(true)
        try {
            const data = await superAdminApi.getCacheHealth()
            setHealth(data)
        } catch (err) {
            console.error('Failed to load cache health:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleFlush() {
        if (!confirm('¿Estás seguro de que deseas limpiar COMPLETAMENTE la caché de Redis? Esta acción invalidará todas las sesiones persistidas en caché, los permisos cargados y los catálogos temporales.')) {
            return
        }
        
        setFlushing(true)
        setMessage(null)
        try {
            await superAdminApi.flushCache()
            setMessage({ type: 'success', text: 'La caché de Redis ha sido vaciada completamente.' })
            await loadHealth()
        } catch (err) {
            console.error('Failed to flush cache:', err)
            setMessage({ type: 'error', text: 'Error al intentar limpiar la caché de Redis.' })
        } finally {
            setFlushing(false)
        }
    }

    useEffect(() => {
        loadHealth()
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-xl">
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary">Administración de Caché Redis</h2>
                        <p className="text-xs text-text-secondary">Monitorea y gestiona el rendimiento del almacenamiento en caché.</p>
                    </div>
                </div>
                <button
                    onClick={loadHealth}
                    disabled={loading || flushing}
                    className="p-2 text-text-secondary hover:text-primary hover:bg-surface-raised rounded-xl transition-all disabled:opacity-50"
                    title="Actualizar Estado"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm transition-all
                    ${message.type === 'success' 
                        ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' 
                        : 'bg-error/10 border-error/20 text-error'}`}
                >
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                    <span>{message.text}</span>
                </div>
            )}

            {loading && !health ? (
                <div className="py-20 text-center text-text-secondary">Cargando estado de la caché...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* General Status Card */}
                    <div className="bg-surface p-6 rounded-2xl border border-border md:col-span-2 space-y-6">
                        <h3 className="text-base font-bold text-text-primary">Estado de Conexión</h3>
                        
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-raised border border-border">
                            <div className={`w-3 h-3 rounded-full ${health?.connected ? 'bg-green-500 animate-pulse' : 'bg-text-secondary'}`} />
                            <div>
                                <div className="text-sm font-bold text-text-primary">
                                    {health?.connected ? 'Conectado a Render Redis' : 'No Conectado / Modo Fallback (No-Op)'}
                                </div>
                                <div className="text-xs text-text-secondary">
                                    {health?.connected 
                                        ? 'El sistema está aligerando las peticiones a Supabase usando caché en memoria.' 
                                        : 'El backend continúa funcionando normalmente consultando la base de datos directamente.'}
                                </div>
                            </div>
                        </div>

                        {health?.connected && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-raised border border-border">
                                    <HardDrive className="w-5 h-5 text-blue-500" />
                                    <div>
                                        <div className="text-xs font-bold text-text-secondary uppercase">Memoria Usada</div>
                                        <div className="text-lg font-black text-text-primary">{health.memory_used}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-raised border border-border">
                                    <Cpu className="w-5 h-5 text-purple-500" />
                                    <div>
                                        <div className="text-xs font-bold text-text-secondary uppercase">Límite Máximo</div>
                                        <div className="text-lg font-black text-text-primary">{health.memory_max || 'Ilimitado'}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-raised border border-border">
                                    <Clock className="w-5 h-5 text-green-500" />
                                    <div>
                                        <div className="text-xs font-bold text-text-secondary uppercase">Tiempo Activo</div>
                                        <div className="text-lg font-black text-text-primary">
                                            {health.uptime_seconds ? `${Math.floor(health.uptime_seconds / 3600)}h ${Math.floor((health.uptime_seconds % 3600) / 60)}m` : 'N/A'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-raised border border-border">
                                    <Database className="w-5 h-5 text-orange-500" />
                                    <div>
                                        <div className="text-xs font-bold text-text-secondary uppercase">Claves Activas (Keys)</div>
                                        <div className="text-lg font-black text-text-primary">{health.stats?.active_keys ?? 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stats & Actions Card */}
                    <div className="bg-surface p-6 rounded-2xl border border-border flex flex-col justify-between space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-base font-bold text-text-primary">Rendimiento de Lectura</h3>
                            
                            {health?.connected ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-secondary">Hits (Aciertos):</span>
                                        <span className="font-bold text-green-500">{health.stats?.total_hits}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-secondary">Misses (Fallos):</span>
                                        <span className="font-bold text-error">{health.stats?.total_misses}</span>
                                    </div>
                                    <div className="flex justify-between text-sm border-t border-border pt-2 font-bold">
                                        <span className="text-text-primary">Tasa de Acierto (Hit Rate):</span>
                                        <span className="text-primary">{health.stats?.hit_rate}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-text-secondary">Estadísticas no disponibles en modo fallback.</p>
                            )}
                        </div>

                        <div className="space-y-4 pt-4 border-t border-border">
                            <div className="flex items-start gap-2 text-xs text-text-secondary bg-surface-raised p-3 rounded-xl border border-border">
                                <ShieldAlert className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                                <span>El vaciado de caché forzará la regeneración inmediata de los catálogos y permisos en las próximas peticiones.</span>
                            </div>
                            
                            <button
                                onClick={handleFlush}
                                disabled={flushing || !health?.connected}
                                className="w-full py-3 px-4 bg-error text-white font-bold rounded-xl hover:bg-error-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                {flushing ? 'Limpiando...' : 'Vaciar Caché completamente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
