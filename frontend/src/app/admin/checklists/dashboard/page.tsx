'use client'

import { useEffect, useState } from 'react'
import { adminApi, getProfile, type ComplianceReport, type Profile } from '@/lib/api'
import {
    CheckCircle2, AlertTriangle, XCircle, Clock, TrendingUp,
    Loader2
} from 'lucide-react'
import Link from 'next/link'

import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { es } from 'date-fns/locale/es'
import { useTranslations } from '@/components/I18nProvider'

export default function ChecklistDashboard() {
    const { t } = useTranslations()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [report, setReport] = useState<ComplianceReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [venueId, setVenueId] = useState<string>('')
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today')
    const [customFrom, setCustomFrom] = useState<Date | null>(new Date())
    const [customTo, setCustomTo] = useState<Date | null>(new Date())

    useEffect(() => {
        async function load() {
            try {
                const p = await getProfile()
                setProfile(p)
                if (p.venues.length > 0 && !venueId) {
                    setVenueId(p.venues[0].id)
                }
            } catch { }
        }
        load()
    }, [])

    useEffect(() => {
        if (!venueId) return
        if (dateRange === 'custom' && (!customFrom || !customTo)) return

        let mounted = true;
        setLoading(true)

        const getLocalDateString = (d: Date) => {
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
        }

        const today = new Date()
        let dateFrom = getLocalDateString(today)
        let dateTo = dateFrom

        if (dateRange === 'week') {
            const d = new Date(today)
            d.setDate(d.getDate() - 6)
            dateFrom = getLocalDateString(d)
        } else if (dateRange === 'month') {
            const d = new Date(today)
            d.setDate(d.getDate() - 29)
            dateFrom = getLocalDateString(d)
        } else if (dateRange === 'custom' && customFrom && customTo) {
            dateFrom = getLocalDateString(customFrom)
            dateTo = getLocalDateString(customTo)
        }

        adminApi.getCompliance({ venue_id: venueId, date_from: dateFrom, date_to: dateTo })
            .then(res => {
                if (mounted) setReport(res)
            })
            .catch(console.error)
            .finally(() => {
                if (mounted) setLoading(false)
            })

        return () => { mounted = false; }
    }, [venueId, dateRange, customFrom, customTo])

    const complianceColor = (pct: number) => {
        if (pct >= 90) return 'text-success'
        if (pct >= 70) return 'text-warning'
        return 'text-error'
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary mb-1">Métricas de Checklist</h1>
                    <div className="flex items-center gap-6 mt-2 overflow-x-auto">
                        <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1 whitespace-nowrap">Dashboard</span>
                        <Link href="/admin/templates" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
                            {t('nav.templates')}
                        </Link>
                        <Link href="/admin/submissions" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
                            {t('nav.submissions')}
                        </Link>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <select
                    value={venueId}
                    onChange={(e) => setVenueId(e.target.value)}
                    className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                >
                    {profile?.venues.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>

                <div className="flex bg-surface-raised rounded-xl border border-border overflow-hidden">
                    {(['today', 'week', 'month', 'custom'] as const).map((r) => (
                        <button
                            key={r}
                            onClick={() => setDateRange(r)}
                            className={`px-4 py-2 text-xs font-medium transition-colors capitalize
                                ${dateRange === r ? 'bg-primary text-text-inverse' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            {r === 'today' ? 'Today' : r === 'week' ? '7 Days' : r === 'month' ? '30 Days' : 'Custom'}
                        </button>
                    ))}
                </div>

                {dateRange === 'custom' && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                        <DatePicker
                            selected={customFrom}
                            onChange={(date: Date | null) => setCustomFrom(date)}
                            dateFormat="dd/MM/yyyy"
                            className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none w-[120px] cursor-pointer"
                            locale={es}
                            placeholderText="DD/MM/YYYY"
                        />
                        <span className="text-text-secondary text-sm font-medium">to</span>
                        <DatePicker
                            selected={customTo}
                            onChange={(date: Date | null) => setCustomTo(date)}
                            dateFormat="dd/MM/yyyy"
                            className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none w-[120px] cursor-pointer"
                            locale={es}
                            placeholderText="DD/MM/YYYY"
                        />
                    </div>
                )}
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            )}

            {!loading && report && (
                <>
                    {/* KPI Cards Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Compliance */}
                        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="w-4 h-4 text-text-secondary" />
                                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Compliance</span>
                            </div>
                            <p className={`text-3xl font-bold ${complianceColor(report.compliance_pct)}`}>
                                {report.compliance_pct}%
                            </p>
                            <p className="text-xs text-text-secondary mt-1">
                                {report.completed_total} / {report.total_expected} completed
                            </p>
                        </div>

                        {/* On Time */}
                        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="w-4 h-4 text-success" />
                                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">On Time</span>
                            </div>
                            <p className="text-3xl font-bold text-success">{report.completed_on_time}</p>
                            <p className="text-xs text-text-secondary mt-1">
                                {report.completed_late} late · {report.missing} missing
                            </p>
                        </div>

                        {/* Critical Issues */}
                        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <XCircle className="w-4 h-4 text-error" />
                                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Critical</span>
                            </div>
                            <p className={`text-3xl font-bold ${report.critical_issues > 0 ? 'text-error' : 'text-success'}`}>
                                {report.critical_issues}
                            </p>
                            <p className="text-xs text-text-secondary mt-1">
                                {report.non_critical_issues} non-critical
                            </p>
                        </div>

                        {/* Avg Execution Time */}
                        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <Clock className="w-4 h-4 text-text-secondary" />
                                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Avg Time</span>
                            </div>
                            <p className="text-3xl font-bold text-text-primary">{report.avg_execution_minutes}m</p>
                            <p className="text-xs text-text-secondary mt-1">per checklist</p>
                        </div>
                    </div>

                    {/* Summary Bar */}
                    <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-semibold text-text-primary mb-4">Completion Breakdown</h3>
                        <div className="h-4 bg-surface-raised rounded-full overflow-hidden flex">
                            {report.total_expected > 0 && (
                                <>
                                    <div
                                        className="bg-success h-full transition-all duration-500"
                                        style={{ width: `${(report.completed_on_time / report.total_expected) * 100}%` }}
                                    />
                                    <div
                                        className="bg-warning h-full transition-all duration-500"
                                        style={{ width: `${(report.completed_late / report.total_expected) * 100}%` }}
                                    />
                                    <div
                                        className="bg-error/30 h-full transition-all duration-500"
                                        style={{ width: `${(report.missing / report.total_expected) * 100}%` }}
                                    />
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-6 mt-3 text-xs text-text-secondary">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-success" /> On Time ({report.completed_on_time})
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-warning" /> Late ({report.completed_late})
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-error/30" /> Missing ({report.missing})
                            </span>
                        </div>
                    </div>

                    {/* Warnings */}
                    {report.critical_issues > 0 && (
                        <div className="bg-error/5 border border-error/20 rounded-2xl p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-error">
                                    {report.critical_issues} Critical Issue{report.critical_issues > 1 ? 's' : ''} Detected
                                </p>
                                <p className="text-xs text-text-secondary mt-1">
                                    Review submissions for details on critical failures that require immediate action.
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
