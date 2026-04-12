'use client'

import { useEffect, useState } from 'react'
import { adminApi, getProfile, type AdminUser, type VenueInfo, type EmployeeShift } from '@/lib/api'
import { useVenue } from '@/components/VenueContext'
import { Loader2, CalendarDays, X, Save } from 'lucide-react'
import Link from 'next/link'

export default function ShiftsManagementPage() {
    const { availableVenues, activeOrgId } = useVenue()
    const [selectedVenue, setSelectedVenue] = useState('')
    const [users, setUsers] = useState<AdminUser[]>([])
    const [shifts, setShifts] = useState<EmployeeShift[]>([])
    const [loading, setLoading] = useState(true)

    // Form State
    const [showModal, setShowModal] = useState(false)
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
    const [modalModality, setModalModality] = useState<'fixed' | 'rotating' | 'flexible'>('fixed')
    const [fixedStart, setFixedStart] = useState('09:00')
    const [fixedEnd, setFixedEnd] = useState('17:00')
    const [fixedDays, setFixedDays] = useState<number[]>([1,2,3,4,5]) // Mon-Fri
    
    // 1=Mon, 7=Sun
    const [rotatingDays, setRotatingDays] = useState<Record<number, {start: string, end: string, off: boolean}>>({
        1: { start: '09:00', end: '17:00', off: false },
        2: { start: '09:00', end: '17:00', off: false },
        3: { start: '09:00', end: '17:00', off: false },
        4: { start: '09:00', end: '17:00', off: false },
        5: { start: '09:00', end: '17:00', off: false },
        6: { start: '09:00', end: '17:00', off: true },
        7: { start: '09:00', end: '17:00', off: true },
    })
    const [saving, setSaving] = useState(false)
    
    useEffect(() => {
        if (availableVenues.length > 0 && !selectedVenue) {
            setSelectedVenue(availableVenues[0].id)
        } else if (availableVenues.length === 0) {
            setSelectedVenue('')
            setUsers([])
            setShifts([])
            setLoading(false)
        }
    }, [availableVenues, selectedVenue])

    const fetchData = () => {
        if (!selectedVenue || !activeOrgId) return
        setLoading(true)
        Promise.all([
            adminApi.getUsers(),
            adminApi.getEmployeeShifts(selectedVenue)
        ]).then(([u, s]) => {
            setUsers(u.filter(user => user.venue_id === selectedVenue))
            setShifts(s)
        }).catch(console.error).finally(() => setLoading(false))
    }

    useEffect(() => {
        fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVenue, activeOrgId])

    const openShiftModal = (user: AdminUser) => {
        setSelectedUser(user)
        const userShift = shifts.find(s => s.profile_id === user.id && s.is_active)
        if (userShift) {
            setModalModality(userShift.modality)
            if (userShift.modality === 'fixed') {
                setFixedStart(userShift.start_time?.substring(0,5) || '09:00')
                setFixedEnd(userShift.end_time?.substring(0,5) || '17:00')
                setFixedDays(userShift.weekdays || [1,2,3,4,5])
            } else if (userShift.modality === 'rotating' && userShift.shift_days) {
                const newR = {...rotatingDays}
                userShift.shift_days.forEach(d => {
                    newR[d.weekday] = {
                        start: d.start_time?.substring(0,5) || '09:00',
                        end: d.end_time?.substring(0,5) || '17:00',
                        off: d.day_off
                    }
                })
                setRotatingDays(newR)
            }
        } else {
            setModalModality('fixed')
            setFixedStart('09:00')
            setFixedEnd('17:00')
            setFixedDays([1,2,3,4,5])
        }
        setShowModal(true)
    }

    const handleSaveShift = async () => {
        if (!selectedUser || !selectedVenue) return
        setSaving(true)
        try {
            const existing = shifts.find(s => s.profile_id === selectedUser.id && s.is_active)
            
            const payload: Record<string, unknown> = {
                profile_id: selectedUser.id,
                venue_id: selectedVenue,
                modality: modalModality,
                is_active: true
            }

            if (modalModality === 'fixed') {
                payload.start_time = fixedStart
                payload.end_time = fixedEnd
                payload.weekdays = fixedDays
            }

            let shiftId = existing?.id
            if (existing) {
                await adminApi.updateEmployeeShift(existing.id, payload)
            } else {
                const created = await adminApi.createEmployeeShift(payload)
                shiftId = created.id
            }

            if (modalModality === 'rotating' && shiftId) {
                for (let i = 1; i <= 7; i++) {
                    await adminApi.updateEmployeeShiftDays(shiftId, {
                        weekday: i,
                        start_time: rotatingDays[i].off ? null : rotatingDays[i].start,
                        end_time: rotatingDays[i].off ? null : rotatingDays[i].end,
                        day_off: rotatingDays[i].off
                    })
                }
            }

            fetchData()
            setShowModal(false)
        } catch (e) {
            alert('Error al guardar el horario')
            console.error(e)
        }
        setSaving(false)
    }

    const toggleFixedDay = (day: number) => {
        setFixedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort())
    }

    const weekdaysMap = [
        { id: 1, label: 'L' }, { id: 2, label: 'M' }, { id: 3, label: 'M' }, 
        { id: 4, label: 'J' }, { id: 5, label: 'V' }, { id: 6, label: 'S' }, { id: 7, label: 'D' }
    ]

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Horarios del Personal</h1>
                    <div className="flex items-center gap-4 mt-2">
                        <select 
                            value={selectedVenue} 
                            onChange={e => setSelectedVenue(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary outline-none"
                        >
                            <option value="" disabled>Selecciona una sede...</option>
                            {availableVenues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                        <Link href="/admin/attendance" className="text-sm font-bold text-primary hover:underline">
                            ← Volver a Live View
                        </Link>
                    </div>
                </div>
            </div>

            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface-raised text-text-secondary font-semibold">
                        <tr>
                            <th className="p-4">Empleado</th>
                            <th className="p-4">Rol</th>
                            <th className="p-4">Modalidad Asignada</th>
                            <th className="p-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-text-secondary"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-text-secondary">No hay empleados en esta sede.</td></tr>
                        ) : (
                            users.map(u => {
                                const userShift = shifts.find(s => s.profile_id === u.id && s.is_active)
                                return (
                                    <tr key={u.id} className="hover:bg-surface-raised/50">
                                        <td className="p-4 font-bold text-text-primary">{u.full_name}</td>
                                        <td className="p-4 text-text-secondary capitalize">{u.role}</td>
                                        <td className="p-4">
                                            {userShift ? (
                                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                                    userShift.modality === 'fixed' ? 'bg-primary/10 text-primary' : 
                                                    userShift.modality === 'rotating' ? 'bg-warning/10 text-warning-strong' : 
                                                    'bg-success/10 text-success'
                                                }`}>
                                                    {userShift.modality === 'fixed' ? 'Fijo' : userShift.modality === 'rotating' ? 'Rotativo' : 'Flexible'}
                                                </span>
                                            ) : (
                                                <span className="text-text-secondary italic bg-surface-raised px-2 py-1 rounded-md text-xs">Sin horario asignado</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => openShiftModal(u)} className="p-2 text-text-secondary hover:text-primary transition-colors bg-surface-raised rounded-lg border border-border">
                                                <CalendarDays className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Shift Config Modal */}
            {showModal && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-surface border border-border rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-text-primary">Configurar Horario</h2>
                                <p className="text-sm text-text-secondary mt-0.5">{selectedUser.full_name}</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 text-text-secondary hover:bg-surface-raised rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Modalidad</label>
                                <div className="flex bg-surface-raised p-1 rounded-xl">
                                    {(['fixed', 'rotating', 'flexible'] as const).map(mod => (
                                        <button 
                                            key={mod}
                                            onClick={() => setModalModality(mod)}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${modalModality === mod ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                        >
                                            {mod === 'fixed' ? 'Fijo' : mod === 'rotating' ? 'Rotativo' : 'Flexible'}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-text-secondary mt-2">
                                    {modalModality === 'fixed' && 'Mismo horario de entrada y salida los días seleccionados.'}
                                    {modalModality === 'rotating' && 'Horario independiente por cada día de la semana.'}
                                    {modalModality === 'flexible' && 'Sin horario fijo. Solo marca horas libres.'}
                                </p>
                            </div>

                            {modalModality === 'fixed' && (
                                <div className="space-y-4 pt-4 border-t border-border animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Entrada</label>
                                            <input type="time" value={fixedStart} onChange={e => setFixedStart(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-3 h-10 text-sm focus:border-primary outline-none" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Salida</label>
                                            <input type="time" value={fixedEnd} onChange={e => setFixedEnd(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-3 h-10 text-sm focus:border-primary outline-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Días Laborables</label>
                                        <div className="flex gap-2">
                                            {weekdaysMap.map(day => (
                                                <button 
                                                    key={day.id}
                                                    onClick={() => toggleFixedDay(day.id)}
                                                    className={`w-10 h-10 rounded-full font-bold text-sm transition-colors border ${fixedDays.includes(day.id) ? 'bg-primary text-white border-primary' : 'bg-surface-raised text-text-secondary border-transparent'}`}
                                                >
                                                    {day.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {modalModality === 'rotating' && (
                                <div className="space-y-3 pt-4 border-t border-border animate-in fade-in slide-in-from-bottom-2">
                                    <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center px-2">
                                        <span className="text-xs font-bold text-text-secondary uppercase w-8">Día</span>
                                        <span className="text-xs font-bold text-text-secondary uppercase">Entrada</span>
                                        <span className="text-xs font-bold text-text-secondary uppercase">Salida</span>
                                        <span className="text-xs font-bold text-text-secondary uppercase w-12 text-center">Libre</span>
                                    </div>
                                    {weekdaysMap.map(day => (
                                        <div key={day.id} className={`grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center p-2 rounded-xl border transition-colors ${rotatingDays[day.id].off ? 'bg-surface-raised border-transparent opacity-60' : 'bg-surface border-border'}`}>
                                            <span className="font-bold text-sm w-8 text-center">{day.label}</span>
                                            <input 
                                                type="time" 
                                                value={rotatingDays[day.id].start} 
                                                onChange={e => setRotatingDays(prev => ({...prev, [day.id]: {...prev[day.id], start: e.target.value}}))}
                                                disabled={rotatingDays[day.id].off}
                                                className="w-full bg-transparent border border-border rounded-lg px-2 h-9 text-sm focus:border-primary outline-none disabled:opacity-50" 
                                            />
                                            <input 
                                                type="time" 
                                                value={rotatingDays[day.id].end} 
                                                onChange={e => setRotatingDays(prev => ({...prev, [day.id]: {...prev[day.id], end: e.target.value}}))}
                                                disabled={rotatingDays[day.id].off}
                                                className="w-full bg-transparent border border-border rounded-lg px-2 h-9 text-sm focus:border-primary outline-none disabled:opacity-50" 
                                            />
                                            <div className="w-12 flex justify-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={rotatingDays[day.id].off}
                                                    onChange={e => setRotatingDays(prev => ({...prev, [day.id]: {...prev[day.id], off: e.target.checked}}))}
                                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setShowModal(false)} className="flex-1 h-12 rounded-xl font-bold text-text-primary bg-surface-raised hover:bg-surface-raised/80 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSaveShift} disabled={saving} className="flex-[2] h-12 rounded-xl font-bold text-text-inverse bg-primary hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar Horario
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}