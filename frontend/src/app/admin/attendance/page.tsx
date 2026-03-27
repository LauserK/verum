'use client'

import { useEffect, useState } from 'react'
import { attendanceApi, getProfile, type VenueInfo, type AttendanceLog } from '@/lib/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTranslations } from '@/components/I18nProvider'
import { RefreshCcw } from 'lucide-react'

export default function AdminAttendancePage() {
    const { t } = useTranslations()
    const [liveData, setLiveData] = useState<AttendanceLog[]>([])
    const [loading, setLoading] = useState(true)
    const [venues, setVenues] = useState<VenueInfo[]>([])
    const [selectedVenue, setSelectedVenue] = useState<string>('')
    
    useEffect(() => {
        getProfile().then(p => {
            const userVenues = p.venues || []
            setVenues(userVenues)
            if (userVenues.length > 0) {
                setSelectedVenue(userVenues[0].id)
            }
        })
    }, [])

    useEffect(() => {
        if (!selectedVenue) return

        let mounted = true

        const fetchLive = () => {
            attendanceApi.getLive(selectedVenue)
                .then(data => { 
                    if (mounted) {
                        setLiveData(data)
                        setLoading(false)
                    }
                })
                .catch(console.error)
        }
        
        fetchLive()
        const interval = setInterval(fetchLive, 60000)
        return () => {
            mounted = false
            clearInterval(interval)
        }
    }, [selectedVenue])

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Asistencia en Vivo</h1>
                    <div className="flex items-center gap-4 mt-2">
                        <select 
                            value={selectedVenue} 
                            onChange={e => setSelectedVenue(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary outline-none"
                        >
                            <option value="" disabled>Selecciona una sede...</option>
                            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                        <a href="/admin/attendance/reports" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                            Ver Reportes
                        </a>
                        <span className="text-border">|</span>
                        <a href="/admin/attendance/shifts" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                            Horarios
                        </a>
                        <span className="text-border">|</span>
                        <a href="/admin/attendance/absences" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                            Ausencias
                        </a>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                    <RefreshCcw className="w-3 h-3 animate-spin-slow" /> 
                    Actualización automática
                </div>
            </div>

            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface-raised text-text-secondary font-semibold">
                        <tr>
                            <th className="p-4">Empleado</th>
                            <th className="p-4">Último Evento</th>
                            <th className="p-4">Hora</th>
                            <th className="p-4">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-text-secondary">Cargando datos...</td>
                            </tr>
                        ) : liveData.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-text-secondary">No hay registros de asistencia hoy.</td>
                            </tr>
                        ) : (
                            liveData.map(log => {
                                const isWorking = log.event_type === 'clock_in' || log.event_type === 'break_end'
                                const isBreak = log.event_type === 'break_start'
                                const isOut = log.event_type === 'clock_out'

                                return (
                                    <tr key={log.id} className="hover:bg-surface-raised/50 transition-colors">
                                        <td className="p-4 font-bold text-text-primary">{log.profiles?.full_name}</td>
                                        <td className="p-4 text-text-secondary">{t(`attendance.actions.${log.event_type}`)}</td>
                                        <td className="p-4 text-text-secondary">{format(new Date(log.marked_at), 'HH:mm', { locale: es })}</td>
                                        <td className="p-4">
                                            {isWorking && <span className="bg-success/10 text-success px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Activo</span>}
                                            {isBreak && <span className="bg-warning/10 text-warning px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">En Pausa</span>}
                                            {isOut && <span className="bg-surface-raised text-text-secondary px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">Fuera</span>}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}