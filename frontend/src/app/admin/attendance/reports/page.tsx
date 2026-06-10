'use client'

import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import { useVenue } from '@/components/VenueContext'
import { useTranslations } from '@/components/I18nProvider'
import { Download, Loader2, Pencil, X } from 'lucide-react'
import { format, subDays, parseISO } from 'date-fns'

interface AttendanceReportRow {
    profile_id: string
    full_name: string
    work_date: string
    clock_in: string | null
    clock_out: string | null
    net_hours: number
    overtime_hours: number
    minutes_late: number
    absence_type: string | null
    is_edited?: boolean
}

export default function AttendanceReportsPage() {
    const { availableVenues, activeOrgId } = useVenue()
    const { t } = useTranslations('admin' as any)
    const [venueId, setVenueId] = useState('')
    const [reportType, setReportType] = useState('daily')
    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [preview, setPreview] = useState<AttendanceReportRow[]>([])
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState(false)

    // Edit states
    const [editingRow, setEditingRow] = useState<AttendanceReportRow | null>(null)
    const [editClockIn, setEditClockIn] = useState('')
    const [editClockOut, setEditClockOut] = useState('')
    const [editReason, setEditReason] = useState('')
    const [editSaving, setEditSaving] = useState(false)

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

    const handleOpenEdit = (row: AttendanceReportRow) => {
        setEditingRow(row)
        setEditClockIn(row.clock_in ? format(new Date(row.clock_in), "yyyy-MM-dd'T'HH:mm") : `${row.work_date}T09:00`)
        setEditClockOut(row.clock_out ? format(new Date(row.clock_out), "yyyy-MM-dd'T'HH:mm") : `${row.work_date}T18:00`)
        setEditReason('')
    }

    const handleSaveEdit = async () => {
        if (!editingRow || !editReason) return
        setEditSaving(true)
        try {
            await adminApi.editAttendanceDay({
                profile_id: editingRow.profile_id,
                venue_id: venueId,
                work_date: editingRow.work_date,
                clock_in: editClockIn,
                clock_out: editClockOut,
                reason: editReason
            })
            setEditingRow(null)
            await handlePreview() // Refresh
        } catch (e: unknown) {
            const error = e as Error
            alert(t('editModal.error') + ': ' + (error.message || 'Error desconocido'))
        }
        setEditSaving(false)
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
            <h1 className="text-2xl font-bold text-text-primary">{t('liveTitle')} - {t('reports')}</h1>
            
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
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-raised text-text-secondary font-semibold border-b border-border">
                            <tr>
                                <th className="px-4 py-4">{t('reportTable.employee')}</th>
                                <th className="px-4 py-4">{t('reportTable.date')}</th>
                                <th className="px-4 py-4">{t('reportTable.clockIn')}</th>
                                <th className="px-4 py-4">{t('reportTable.clockOut')}</th>
                                <th className="px-4 py-4">{t('reportTable.netHours')}</th>
                                <th className="px-4 py-4">{t('reportTable.overtime')}</th>
                                <th className="px-4 py-4">{t('reportTable.late')}</th>
                                <th className="px-4 py-4">{t('reportTable.absence')}</th>
                                <th className="px-4 py-4">{t('reportTable.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {preview.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-text-secondary">{t('reportTable.noData')}</td>
                                </tr>
                            ) : (
                                preview.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-surface-raised/50 transition-colors">
                                        <td className="px-4 py-4 font-bold text-text-primary whitespace-nowrap">{row.full_name}</td>
                                        <td className="px-4 py-4 text-text-secondary whitespace-nowrap">{format(parseISO(row.work_date), 'dd/MMM/yyyy')}</td>
                                        <td className="px-4 py-4 font-medium whitespace-nowrap">{row.clock_in ? format(new Date(row.clock_in), 'HH:mm') : '—'}</td>
                                        <td className="px-4 py-4 font-medium whitespace-nowrap">{row.clock_out ? format(new Date(row.clock_out), 'HH:mm') : '—'}</td>
                                        <td className="px-4 py-4 font-black text-primary">
                                            {row.net_hours}h
                                            {row.is_edited && <span className="ml-2 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider" title={t('reportTable.modified')}>{t('reportTable.modified')}</span>}
                                        </td>
                                        <td className="px-4 py-4">{row.overtime_hours > 0 ? <span className="bg-success/10 text-success px-2 py-1 rounded-md font-bold text-xs">{row.overtime_hours}h</span> : '—'}</td>
                                        <td className="px-4 py-4">{row.minutes_late > 0 ? <span className="bg-warning/10 text-warning px-2 py-1 rounded-md font-bold text-xs">{row.minutes_late}m</span> : '—'}</td>
                                        <td className="px-4 py-4">{row.absence_type ? <span className="bg-error/10 text-error px-2 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider">{row.absence_type}</span> : '—'}</td>
                                        <td className="px-4 py-4">
                                            <button onClick={() => handleOpenEdit(row)} className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {editingRow && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-xl border border-border">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-text-primary">{t('editModal.title')}</h2>
                            <button onClick={() => setEditingRow(null)} className="text-text-secondary hover:text-text-primary"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t('editModal.employee')}</label>
                                <div className="text-sm font-medium text-text-primary">{editingRow.full_name}</div>
                                <div className="text-xs text-text-secondary">{format(parseISO(editingRow.work_date), 'dd MMM yyyy')}</div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t('editModal.clockIn')}</label>
                                    <input type="datetime-local" value={editClockIn} onChange={e => setEditClockIn(e.target.value)} className="w-full bg-surface-raised border border-border rounded-xl px-3 h-11 text-sm text-text-primary outline-none focus:border-primary" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t('editModal.clockOut')}</label>
                                    <input type="datetime-local" value={editClockOut} onChange={e => setEditClockOut(e.target.value)} className="w-full bg-surface-raised border border-border rounded-xl px-3 h-11 text-sm text-text-primary outline-none focus:border-primary" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t('editModal.reason')}</label>
                                <textarea value={editReason} onChange={e => setEditReason(e.target.value)} placeholder={t('editModal.reasonPlaceholder')} className="w-full bg-surface-raised border border-border rounded-xl p-3 text-sm text-text-primary outline-none focus:border-primary h-24 resize-none" required></textarea>
                            </div>

                            <button onClick={handleSaveEdit} disabled={editSaving || !editReason} className="w-full h-11 bg-primary text-text-inverse font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 transition-colors">
                                {editSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : t('editModal.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

