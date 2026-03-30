// frontend/src/app/attendance/requests/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { attendanceApi } from '@/lib/api'
import { ArrowLeft, Plus, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface LeaveRequest {
    id: string
    date: string
    type: string
    reason?: string
    status: 'pending' | 'approved' | 'rejected'
    admin_comment?: string
}

export default function LeaveRequestsPage() {
    const router = useRouter()
    const [requests, setRequests] = useState<LeaveRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    
    // Form state
    const [date, setDate] = useState('')
    const [type, setType] = useState('leave')
    const [reason, setReason] = useState('')

    useEffect(() => {
        loadRequests()
    }, [])

    async function loadRequests() {
        try {
            const data = await attendanceApi.getOwnRequests() as LeaveRequest[]
            setRequests(data)
        } catch (error) {
            console.error('Error loading requests:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSubmitting(true)
        try {
            await attendanceApi.requestLeave({ date, type, reason })
            setShowForm(false)
            setDate('')
            setReason('')
            loadRequests()
        } catch (error: unknown) {
            alert((error as Error).message || 'Error al enviar solicitud')
        } finally {
            setSubmitting(false)
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return <CheckCircle2 className="w-5 h-5 text-success" />
            case 'rejected': return <XCircle className="w-5 h-5 text-error" />
            default: return <Clock className="w-5 h-5 text-warning" />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'approved': return 'Aprobado'
            case 'rejected': return 'Rechazado'
            default: return 'Pendiente'
        }
    }

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'sick': return 'Médico'
            case 'holiday': return 'Vacaciones'
            default: return 'Permiso'
        }
    }

    return (
        <div className="min-h-screen bg-background p-4 pb-24">
            <header className="flex items-center gap-4 mb-8">
                <button 
                    onClick={() => router.back()}
                    className="p-2 rounded-full hover:bg-surface-raised transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-black tracking-tight">Mis Solicitudes</h1>
            </header>

            {!showForm ? (
                <div className="space-y-4">
                    <button 
                        onClick={() => setShowForm(true)}
                        className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Solicitar Día Libre
                    </button>

                    <div className="space-y-3 pt-4">
                        <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest px-1">Historial Reciente</h2>
                        
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="bg-surface border border-border rounded-2xl p-8 text-center">
                                <p className="text-text-secondary font-medium">No tienes solicitudes registradas.</p>
                            </div>
                        ) : (
                            requests.map((req) => (
                                <div key={req.id} className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-lg">
                                                {format(new Date(req.date + 'T12:00:00'), 'EEEE d MMMM', { locale: es })}
                                            </p>
                                            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                                                {getTypeLabel(req.type)}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {getStatusIcon(req.status)}
                                            <span className="text-[10px] font-black uppercase tracking-tighter">
                                                {getStatusLabel(req.status)}
                                            </span>
                                        </div>
                                    </div>
                                    {req.reason && (
                                        <p className="text-sm text-text-secondary mt-2 border-t border-border pt-2 italic">
                                            &quot;{req.reason}&quot;
                                        </p>
                                    )}
                                    {req.admin_comment && (
                                        <div className="mt-2 p-2 bg-primary/5 rounded-lg border border-primary/10">
                                            <p className="text-[10px] font-bold text-primary uppercase mb-1">Nota del Admin:</p>
                                            <p className="text-xs text-text-primary">{req.admin_comment}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-surface border border-border rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h2 className="text-xl font-black mb-6">Nueva Solicitud</h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-text-secondary uppercase px-1">Fecha</label>
                            <input 
                                type="date" 
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium focus:border-primary outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-text-secondary uppercase px-1">Motivo / Tipo</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'leave', label: 'Permiso' },
                                    { id: 'sick', label: 'Médico' },
                                    { id: 'holiday', label: 'Vacaciones' }
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setType(t.id)}
                                        className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                                            type === t.id 
                                                ? 'bg-primary border-primary text-white shadow-md shadow-primary/20' 
                                                : 'bg-background border-border text-text-secondary hover:border-primary/50'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-text-secondary uppercase px-1">Explicación (opcional)</label>
                            <textarea 
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Escribe aquí el motivo de tu solicitud..."
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium focus:border-primary outline-none transition-all min-h-[100px] resize-none"
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button 
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="flex-1 bg-surface-raised font-bold py-4 rounded-2xl active:scale-95 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                disabled={submitting}
                                className="flex-2 bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all"
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}
