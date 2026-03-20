'use client'

import { useEffect, useState } from 'react'
import { adminApi, getProfile, type Profile, type AdminSubmission } from '@/lib/api'
import { Loader2, Eye, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from '@/components/I18nProvider'

export default function SubmissionsPage() {
    const { t } = useTranslations()
    const router = useRouter()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [submissions, setSubmissions] = useState<AdminSubmission[]>([])
    const [loading, setLoading] = useState(true)
    const [venueId, setVenueId] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const p = await getProfile()
                setProfile(p)
                if (p.venues.length > 0) setVenueId(p.venues[0].id)
            } catch { }
        }
        load()
    }, [])

    useEffect(() => {
        if (!venueId) return
        setLoading(true)
        const filters: Record<string, string> = { venue_id: venueId }
        if (statusFilter) filters.status = statusFilter
        adminApi.getSubmissions(filters)
            .then(setSubmissions)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [venueId, statusFilter])

    const formatDate = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    const calcDuration = (started: string | null, completed: string | null) => {
        if (!started || !completed) return '—'
        const diff = (new Date(completed).getTime() - new Date(started).getTime()) / 60000
        return `${Math.round(diff)}m`
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary mb-1">{t('nav.submissions')}</h1>
                    <div className="flex items-center gap-6 mt-2 overflow-x-auto">
                        <Link href="/admin/checklists/dashboard" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
                            Dashboard
                        </Link>
                        <Link href="/admin/templates" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
                            {t('nav.templates')}
                        </Link>
                        <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1 whitespace-nowrap">{t('nav.submissions')}</span>
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
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                >
                    <option value="">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="draft">Draft</option>
                </select>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            )}

            {!loading && submissions.length === 0 && (
                <div className="text-center py-20 text-text-secondary text-sm">No submissions found.</div>
            )}

            {!loading && submissions.length > 0 && (
                <div className="space-y-3">
                    {submissions.map((s) => (
                        <div
                            key={s.id}
                            className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-border-strong transition-colors cursor-pointer"
                            onClick={() => router.push(`/checklist/${s.template_id}?venue=${s.venue_id}&submission_id=${s.id}&from=admin`)}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-text-primary truncate">
                                        {s.checklist_templates?.title || 'Untitled'}
                                    </h3>
                                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md ${
                                        s.status === 'completed'
                                            ? 'bg-success/10 text-success'
                                            : 'bg-primary/10 text-primary'
                                    }`}>
                                        {s.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                                    <span>{s.profiles?.full_name || 'Unknown'}</span>
                                    <span>·</span>
                                    <span className="capitalize">{s.shift}</span>
                                    <span>·</span>
                                    <span>{formatDate(s.created_at)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                                {s.status === 'completed' && (
                                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{calcDuration(s.started_at, s.completed_at)}</span>
                                    </div>
                                )}
                                <Eye className="w-4 h-4 text-text-secondary" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
