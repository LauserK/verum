'use client'

import { useEffect, useState } from 'react'
import { adminApi, getProfile, type VenueInfo } from '@/lib/api'
import { useVenue } from '@/components/VenueContext'
import { Download, Loader2 } from 'lucide-react'
import { format, subDays, parseISO } from 'date-fns'

interface AttendanceReportRow {
    full_name: string
    work_date: string
    clock_in: string | null
    clock_out: string | null
    net_hours: number
    overtime_hours: number
    minutes_late: number
    absence_type: string | null
}

export default function AttendanceReportsPage() {
    const { availableVenues, activeOrgId } = useVenue()
    const [venueId, setVenueId] = useState('')
    const [reportType, setReportType] = useState('daily')
    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [preview, setPreview] = useState<AttendanceReportRow[]>([])
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState(false)

    useEffect(() => {
        if (availableVenues.length > 0 && !venueId) {
            setVenueId(availableVenues[0].id)
        } else if (availableVenues.length === 0) {
            setVenueId('')
            setPreview([])
            setLoading(false)
        }
    }, [availableVenues, venueId])

    const handlePreview = async () => {
        if (!venueId || !activeOrgId) return
        setLoading(true)
        try {
            const data = await adminApi.getAttendanceReport(venueId, dateFrom, dateTo)
            setPreview(data as AttendanceReportRow[])
        } catch {
            alert('Error cargando preview')
        }
        setLoading(false)
    }

    const handleExport = async () => {
        if (!venueId || !activeOrgId) return
        setExporting(true)
        
        try {
            const url = adminApi.exportAttendanceCSV(venueId, reportType, dateFrom, dateTo)
            
            // To download protected file, we fetch it with Auth headers then create an object URL
            const supabase = (await import('@/utils/supabase/client')).createClient()
            const { data: { session } } = await supabase.auth.getSession()

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            })

            if (!response.ok) throw new Error('Error downloading file')

            const blob = await response.blob()
            const downloadUrl = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = downloadUrl
            a.download = `attendance_${reportType}_${dateFrom}_to_${dateTo}.csv`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(downloadUrl)
            document.body.removeChild(a)
        } catch (e) {
            alert('Error al exportar')
            console.error(e)
        }
        setExporting(false)
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-text-primary">Reportes de Asistencia</h1>
            
            <div className="bg-surface p-5 rounded-2xl border border-border flex flex-wrap gap-4 items-end shadow-sm">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 tracking-wider">Sede</label>
                    <select value={venueId} onChange={e => setVenueId(e.target.value)} className="w-full bg-surface-raised border border-border rounded-xl px-3 h-11 text-sm text-text-primary focus:border-primary outline-none transition-all">
                        {availableVenues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 tracking-wider">Formato CSV</label>
                    <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full bg-surface-raised border border-border rounded-xl px-3 h-11 text-sm text-text-primary focus:border-primary outline-none transition-all">
                        <option value="daily">Diario (1 fila por día)</option>
                        <option value="weekly">Semanal (Columnas por fecha)</option>
                        <option value="custom">Custom (Columnas por fecha)</option>
                    </select>
                </div>
                <div className="w-[140px]">
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 tracking-wider">Desde</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-surface-raised border border-border rounded-xl px-3 h-11 text-sm text-text-primary focus:border-primary outline-none transition-all" />
                </div>
                <div className="w-[140px]">
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5 tracking-wider">Hasta</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-surface-raised border border-border rounded-xl px-3 h-11 text-sm text-text-primary focus:border-primary outline-none transition-all" />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={handlePreview} disabled={loading} className="flex-1 sm:flex-none h-11 px-6 bg-surface border border-border text-text-primary font-bold text-sm rounded-xl hover:bg-surface-raised transition-colors flex items-center justify-center">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vista Previa'}
                    </button>
                    <button onClick={handleExport} disabled={exporting} className="flex-[2] sm:flex-none h-11 px-6 bg-primary text-text-inverse font-bold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-primary-hover transition-colors disabled:opacity-50">
                        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* Preview Table */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-surface-raised text-text-secondary font-semibold border-b border-border">
                            <tr>
                                <th className="px-6 py-4">Empleado</th>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Entrada</th>
                                <th className="px-6 py-4">Salida</th>
                                <th className="px-6 py-4">Horas Netas</th>
                                <th className="px-6 py-4">Horas Extra</th>
                                <th className="px-6 py-4">Tardanza</th>
                                <th className="px-6 py-4">Ausencia</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {preview.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-text-secondary">Haz clic en &quot;Vista Previa&quot; para cargar los datos del período seleccionado.</td>
                                </tr>
                            ) : (
                                preview.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-surface-raised/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-text-primary">{row.full_name}</td>
                                        <td className="px-6 py-4 text-text-secondary">{format(parseISO(row.work_date), 'dd/MMM/yyyy')}</td>
                                        <td className="px-6 py-4 font-medium">{row.clock_in ? format(new Date(row.clock_in), 'HH:mm') : '—'}</td>
                                        <td className="px-6 py-4 font-medium">{row.clock_out ? format(new Date(row.clock_out), 'HH:mm') : '—'}</td>
                                        <td className="px-6 py-4 font-black text-primary">{row.net_hours}h</td>
                                        <td className="px-6 py-4">{row.overtime_hours > 0 ? <span className="bg-success/10 text-success px-2 py-1 rounded-md font-bold text-xs">{row.overtime_hours}h</span> : '—'}</td>
                                        <td className="px-6 py-4">{row.minutes_late > 0 ? <span className="bg-warning/10 text-warning px-2 py-1 rounded-md font-bold text-xs">{row.minutes_late}m</span> : '—'}</td>
                                        <td className="px-6 py-4">{row.absence_type ? <span className="bg-error/10 text-error px-2 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider">{row.absence_type}</span> : '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

