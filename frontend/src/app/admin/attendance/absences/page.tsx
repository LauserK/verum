// frontend/src/app/admin/attendance/absences/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { adminApi, getProfile, type Profile, type AdminUser } from '@/lib/api'
import { 
    ArrowLeft, CheckCircle2, XCircle, Clock, 
    Calendar, User, FileText, Loader2, Search,
    Filter, AlertCircle, Plus, X
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface LeaveRequest {
    id: string
    profile_id: string
    venue_id: string
    date: string
    type: string
    reason?: string
    status: 'pending' | 'approved' | 'rejected'
    admin_comment?: string
    profiles?: { full_name: string }
    venues?: { name: string }
    reviewer?: { full_name: string }
}

export default function AdminAbsencesPage() {
    const router = useRouter()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [users, setUsers] = useState<AdminUser[]>([])
    const [requests, setRequests] = useState<LeaveRequest[]>([])
    const [history, setHistory] = useState<LeaveRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
    const [venueId, setVenueId] = useState<string>('')
    
    // Manual Absence state
    const [showManualForm, setShowManualForm] = useState(false)
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0])
    const [manualProfileId, setManualProfileId] = useState('')
    const [manualType, setManualType] = useState('leave')
    const [manualReason, setManualReason] = useState('')
    
    // Review state
    const [reviewing, setReviewing] = useState<string | null>(null)
    const [adminComment, setAdminComment] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        getProfile().then(p => {
            setProfile(p)
            if (p.venue_id) setVenueId(p.venue_id)
        })
        adminApi.getUsers().then(setUsers)
    }, [])

    useEffect(() => {
        if (venueId || (profile && !venueId)) {
            loadData()
        }
    }, [venueId, profile])

    async function loadData() {
        setLoading(true)
        console.log('Loading absences data for venue:', venueId)
        try {
            const pendingPromise = adminApi.getPendingRequests(venueId).catch(err => {
                console.error('Error fetching pending:', err)
                return []
            })
            const historyPromise = adminApi.getAllAbsences(venueId).catch(err => {
                console.error('Error fetching history:', err)
                return []
            })

            const [pendingData, historyData] = await Promise.all([pendingPromise, historyPromise])
            console.log('Absences data loaded:', { pending: pendingData.length, history: historyData.length })
            
            setRequests(pendingData)
            setHistory(historyData)
        } catch (error) {
            console.error('General error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleReview(id: string, status: 'approved' | 'rejected') {
        setSubmitting(true)
        try {
            await adminApi.reviewRequest(id, { status, admin_comment: adminComment })
            setReviewing(null)
            setAdminComment('')
            loadData()
        } catch (error: unknown) {
            alert((error as Error).message || 'Error al procesar solicitud')
        } finally {
            setSubmitting(false)
        }
    }

    async function handleManualSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSubmitting(true)
        try {
            const user = users.find(u => u.id === manualProfileId)
            if (!user) throw new Error('Usuario no seleccionado')
            
            await adminApi.createAbsence({
                profile_id: manualProfileId,
                venue_id: user.venue_id || venueId,
                date: manualDate,
                type: manualType,
                reason: manualReason
            })
            setShowManualForm(false)
            setManualReason('')
            loadData()
        } catch (error: unknown) {
            alert((error as Error).message || 'Error al registrar ausencia')
        } finally {
            setSubmitting(false)
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return <CheckCircle2 className="w-5 h-5 text-success" />
            case 'rejected': return <XCircle className="w-5 h-5 text-error" />
            case 'pending': return <Clock className="w-5 h-5 text-warning" />
            default: return <AlertCircle className="w-5 h-5 text-error" />
        }
    }

    return (
        <div className="min-h-screen bg-background p-4 sm:p-8">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.back()}
                        className="p-2 rounded-full hover:bg-surface-raised transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Gestión de Ausencias</h1>
                        <p className="text-text-secondary text-sm">Aprobación de permisos y control de faltas</p>
                    </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <select
                        value={venueId}
                        onChange={(e) => setVenueId(e.target.value)}
                        className="flex-1 sm:flex-none bg-surface border border-border rounded-xl px-4 py-2 font-bold text-sm focus:border-primary outline-none"
                    >
                        <option value="">Todas las Sedes</option>
                        {profile?.venues.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                    <button 
                        onClick={() => setShowManualForm(true)}
                        className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Registrar
                    </button>
                </div>
            </header>

            <div className="flex gap-1 bg-surface-raised p-1 rounded-2xl w-fit mb-8">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                        activeTab === 'pending' 
                            ? 'bg-surface text-primary shadow-sm' 
                            : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                    Pendientes ({requests.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                        activeTab === 'history' 
                            ? 'bg-surface text-primary shadow-sm' 
                            : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                    Historial
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-text-secondary font-medium">Cargando información...</p>
                </div>
            ) : activeTab === 'pending' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {requests.length === 0 ? (
                        <div className="col-span-full bg-surface border border-border border-dashed rounded-3xl p-12 text-center">
                            <CheckCircle2 className="w-12 h-12 text-success/20 mx-auto mb-4" />
                            <p className="text-text-secondary font-medium italic">No hay solicitudes pendientes de revisión.</p>
                        </div>
                    ) : (
                        requests.map((req) => (
                            <div key={req.id} className="bg-surface border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-black text-text-primary">{req.profiles?.full_name}</p>
                                            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{req.venues?.name}</p>
                                        </div>
                                    </div>
                                    <div className="bg-warning/10 text-warning px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                        Pendiente
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6 flex-1">
                                    <div className="flex items-center gap-3 text-sm">
                                        <Calendar className="w-4 h-4 text-text-secondary" />
                                        <span className="font-bold">{format(new Date(req.date + 'T12:00:00'), 'EEEE d MMMM', { locale: es })}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <AlertCircle className="w-4 h-4 text-text-secondary" />
                                        <span className="font-bold capitalize">{req.type === 'leave' ? 'Permiso' : req.type === 'sick' ? 'Médico' : 'Vacaciones'}</span>
                                    </div>
                                    {req.reason && (
                                        <div className="flex items-start gap-3 text-sm bg-surface-raised p-3 rounded-xl border border-border">
                                            <FileText className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                                            <p className="text-text-secondary italic">&quot;{req.reason}&quot;</p>
                                        </div>
                                    )}
                                </div>

                                {reviewing === req.id ? (
                                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                        <textarea
                                            value={adminComment}
                                            onChange={(e) => setAdminComment(e.target.value)}
                                            placeholder="Añadir nota o motivo..."
                                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary min-h-[80px] resize-none"
                                        />
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setReviewing(null)}
                                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-surface-raised hover:bg-border transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button 
                                                onClick={() => handleReview(req.id, 'rejected')}
                                                disabled={submitting}
                                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-error/10 text-error hover:bg-error hover:text-white transition-all disabled:opacity-50"
                                            >
                                                Rechazar
                                            </button>
                                            <button 
                                                onClick={() => handleReview(req.id, 'approved')}
                                                disabled={submitting}
                                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-success text-white hover:bg-success/90 shadow-md shadow-success/20 transition-all disabled:opacity-50"
                                            >
                                                Aprobar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => setReviewing(req.id)}
                                        className="w-full py-3 rounded-xl font-bold text-sm bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/10 transition-all active:scale-95"
                                    >
                                        Revisar Solicitud
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-surface-raised border-b border-border">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Empleado</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Fecha</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Tipo</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Estado</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Revisado Por</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Notas / Comentarios</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {history.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-text-secondary italic">No hay registros en el historial.</td>
                                    </tr>
                                ) : (
                                    history.map((row) => (
                                        <tr key={row.id} className="hover:bg-surface-raised/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-text-primary">{row.profiles?.full_name}</div>
                                                <div className="text-[10px] text-text-secondary uppercase font-bold">{row.venues?.name}</div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-sm text-text-primary">
                                                {format(new Date(row.date + 'T12:00:00'), 'd MMM, yyyy', { locale: es })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-black uppercase tracking-tighter text-text-secondary">
                                                    {row.type === 'leave' ? 'Permiso' : row.type === 'sick' ? 'Médico' : row.type === 'holiday' ? 'Vacaciones' : 'Falta'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(row.status)}
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">{row.status}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-bold text-text-primary">{row.reviewer?.full_name || '—'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="max-w-xs space-y-1">
                                                    {row.reason && (
                                                        <p className="text-xs text-text-primary italic">&quot;{row.reason}&quot;</p>
                                                    )}
                                                    {row.admin_comment && (
                                                        <p className="text-[10px] bg-primary/5 text-primary px-2 py-1 rounded-lg border border-primary/10">
                                                            <span className="font-black uppercase mr-1">Admin:</span>
                                                            {row.admin_comment}
                                                        </p>
                                                    )}
                                                    {!row.reason && !row.admin_comment && <span className="text-text-secondary">—</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Manual Absence Modal */}
            {showManualForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface border border-border rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black">Registrar Ausencia</h2>
                            <button onClick={() => setShowManualForm(false)} className="p-2 hover:bg-surface-raised rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-1">Empleado</label>
                                <select 
                                    required
                                    value={manualProfileId}
                                    onChange={(e) => setManualProfileId(e.target.value)}
                                    className="w-full bg-background text-text-primary border border-border rounded-xl px-4 py-3 text-sm font-bold focus:border-primary outline-none"
                                >
                                    <option value="" className="bg-surface text-text-primary">Seleccionar empleado...</option>
                                    {users.filter(u => !venueId || u.venue_id === venueId).map(u => (
                                        <option key={u.id} value={u.id} className="bg-surface text-text-primary">{u.full_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-1">Fecha</label>
                                <input 
                                    type="date"
                                    required
                                    value={manualDate}
                                    onChange={(e) => setManualDate(e.target.value)}
                                    className="w-full bg-background text-text-primary border border-border rounded-xl px-4 py-3 text-sm font-bold focus:border-primary outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-1">Tipo</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['leave', 'sick', 'holiday'].map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setManualType(t)}
                                            className={`py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                                                manualType === t 
                                                    ? 'bg-primary border-primary text-white' 
                                                    : 'bg-background border-border text-text-secondary'
                                            }`}
                                        >
                                            {t === 'leave' ? 'Permiso' : t === 'sick' ? 'Médico' : 'Vacaciones'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-1">Observaciones</label>
                                <textarea 
                                    value={manualReason}
                                    onChange={(e) => setManualReason(e.target.value)}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[100px] resize-none"
                                    placeholder="Motivo de la ausencia..."
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all mt-4"
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Registrar Ausencia'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
