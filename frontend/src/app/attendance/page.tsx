'use client'

import { useEffect, useState } from 'react'
import { attendanceApi } from '@/lib/api'
import { Clock, Loader2, ArrowLeft, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { useTranslations } from '@/components/I18nProvider'

interface AttendanceStatus {
    last_event: string | null;
    last_marked_at: string | null;
    available_actions: string[];
}

export default function AttendancePage() {
    const { t } = useTranslations()
    const [status, setStatus] = useState<AttendanceStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [marking, setMarking] = useState<string | null>(null)
    const [result, setResult] = useState<Record<string, any> | null>(null)
    const [confirmModal, setConfirmModal] = useState<string | null>(null)
    const [errorModal, setErrorModal] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        attendanceApi.getStatus()
            .then(setStatus)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const executeMark = async (type: string) => {
        setConfirmModal(null)
        setMarking(type)
        try {
            const res = await attendanceApi.mark(type)
            setResult({ type, data: res })
            setTimeout(() => {
                router.push('/dashboard')
            }, 3000)
        } catch (e: unknown) {
            setErrorModal((e as Error).message || 'Error al registrar marca')
            setMarking(null)
        }
    }

    const handleMark = (type: string) => {
        setConfirmModal(type)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <p className="text-text-secondary font-medium">Verificando estado...</p>
            </div>
        )
    }

    if (result) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center text-success mb-6 mx-auto">
                    <Clock className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-text-primary mb-2">Marca Registrada</h1>
                <p className="text-text-secondary mb-4">
                    {t(`attendance.actions.${result.type}`)} — {format(new Date(result.data.marked_at), 'hh:mm a')}
                </p>
                
                {result.type === 'clock_in' && result.data.minutes_late > 0 && (
                    <p className="text-warning font-bold bg-warning/10 px-4 py-2 rounded-xl text-sm">
                        {result.data.minutes_late} min tarde
                    </p>
                )}
                {result.data.overtime_hours > 0 && (
                    <p className="text-success font-bold bg-success/10 px-4 py-2 rounded-xl text-sm mt-2">
                        {result.data.overtime_hours} hora(s) extra generada(s)
                    </p>
                )}
                
                <p className="text-sm text-text-secondary mt-8 animate-pulse">Redirigiendo al inicio...</p>
            </div>
        )
    }

    const mapAction = {
        'clock_in': { color: 'bg-primary text-text-inverse hover:bg-primary-hover border border-transparent' },
        'clock_out': { color: 'bg-error text-text-inverse hover:bg-error/90 border border-transparent' },
        'break_start': { color: 'bg-surface-raised text-text-primary border border-border hover:border-warning' },
        'break_end': { color: 'bg-surface-raised text-text-primary border border-border hover:border-success' }
    }

    return (
        <div className="min-h-screen bg-background pb-24">
            <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border px-4 h-14 flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-bold text-text-primary">Control de Asistencia</h1>
            </header>

            <main className="p-4 max-w-sm mx-auto space-y-6 mt-4">
                <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm text-center">
                    
                    <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center text-text-primary mb-4 mx-auto border border-border">
                        <Clock className="w-8 h-8" />
                    </div>
                    
                    <h2 className="text-lg font-bold text-text-primary mb-1">Estado Actual</h2>
                    <p className="text-sm text-text-secondary mb-6">
                        {status?.last_event 
                            ? `Último registro: ${t(`attendance.actions.${status.last_event}`)} a las ${format(new Date(status.last_marked_at!), 'hh:mm a')}` 
                            : 'Aún no has registrado actividad hoy.'}
                    </p>

                    <div className="space-y-3">
                        {status?.available_actions.map((action: string) => {
                            const config = mapAction[action as keyof typeof mapAction]
                            return (
                                <button 
                                    key={action} 
                                    onClick={() => handleMark(action)}
                                    disabled={marking !== null}
                                    className={`w-full h-14 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${config.color} ${marking === action ? 'opacity-70 scale-95' : 'active:scale-[0.98]'}`}
                                >
                                    {marking === action && <Loader2 className="w-5 h-5 animate-spin" />}
                                    {t(`attendance.actions.${action}`)}
                                </button>
                            )
                        })}
                        
                        {status?.available_actions.length === 0 && (
                            <div className="bg-success/10 border border-success/20 p-4 rounded-xl text-success font-bold flex flex-col items-center gap-2">
                                <span>🎉</span>
                                Jornada completada por hoy
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-center">
                    <Link href="/attendance/history" className="text-primary text-sm font-bold mt-4 inline-block hover:underline">
                        Ver mi historial completo
                    </Link>
                </div>
            </main>

            {/* Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmModal(null)} />
                    <div className="relative bg-surface border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 text-center">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4 mx-auto">
                            <Clock className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-text-primary mb-2">Confirmar Marcación</h3>
                        <p className="text-text-secondary mb-6">
                            ¿Estás seguro de registrar: <strong className="text-text-primary">{t(`attendance.actions.${confirmModal}`)}</strong>?
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmModal(null)}
                                className="flex-1 h-12 rounded-xl font-bold text-text-primary bg-surface-raised hover:bg-surface-raised/80 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => executeMark(confirmModal)}
                                className="flex-1 h-12 rounded-xl font-bold text-text-inverse bg-primary hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Modal */}
            {errorModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setErrorModal(null)} />
                    <div className="relative bg-surface border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 text-center">
                        <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center text-error mb-4 mx-auto">
                            <X className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-text-primary mb-2">Error</h3>
                        <p className="text-text-secondary mb-6">{errorModal}</p>
                        <button 
                            onClick={() => setErrorModal(null)}
                            className="w-full h-12 rounded-xl font-bold text-text-inverse bg-error hover:bg-error/90 transition-colors shadow-lg shadow-error/20"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}