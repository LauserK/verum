'use client'

import { useEffect, useState } from 'react'
import { getHistory, getProfile, type HistoryItem, type Profile } from '@/lib/api'
import { logout } from '@/app/login/actions'
import BottomNav from '@/components/BottomNav'
import { LogOut, Sun, Moon, Clock, CheckCircle2, Eye, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/components/I18nProvider'

// ── Skeleton ────────────────────────────────────────
function HistorySkeleton() {
    return (
        <div className="bg-surface border border-border rounded-2xl p-4 animate-pulse">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-4 bg-surface-raised rounded-lg w-2/3" />
                <div className="h-4 bg-surface-raised rounded-full w-16" />
            </div>
            <div className="flex items-center gap-3 mt-1">
                <div className="h-3 bg-surface-raised rounded-lg w-20" />
                <div className="h-3 bg-surface-raised rounded-lg w-24" />
                <div className="h-3 bg-surface-raised rounded-lg w-16" />
            </div>
        </div>
    )
}

// ── Main ────────────────────────────────────────────
export default function HistoryPage() {
    const { t, language } = useTranslations('history')
    const { t: tNav } = useTranslations('dashboard')
    const router = useRouter()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const [theme, setTheme] = useState<'light' | 'dark'>('light')

    useEffect(() => {
        setMounted(true)
        const savedTheme = localStorage.getItem('verum-theme')
        if (savedTheme) {
            setTheme(savedTheme as 'light' | 'dark')
            document.documentElement.setAttribute('data-theme', savedTheme)
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            if (prefersDark) {
                setTheme('dark')
                document.documentElement.setAttribute('data-theme', 'dark')
            }
        }
    }, [])

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true)
                const [profileData, historyData] = await Promise.all([
                    getProfile(),
                    getHistory(),
                ])
                setProfile(profileData)
                setHistory(historyData)
            } catch (err: unknown) {
                setError((err as Error).message || 'Failed to load history')
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light'
        setTheme(newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
        localStorage.setItem('verum-theme', newTheme)
    }

    const formatDate = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const calcDuration = (started: string | null, completed: string | null) => {
        if (!started || !completed) return '—'
        const diff = (new Date(completed).getTime() - new Date(started).getTime()) / 60000
        return `${Math.round(diff)}m`
    }

    const getShiftLabel = (shift: string): string => {
        switch (shift) {
            case 'morning': return t('morningShift')
            case 'mid': return t('midShift')
            case 'closing': return t('closingShift')
            default: return shift
        }
    }

    return (
        <div className="min-h-screen bg-bg pb-24">
            {/* ── Header ─────────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-surface border-b border-border">
                <div className="max-w-lg mx-auto flex justify-between items-center px-4 h-14">
                    <h1 className="text-base font-bold text-text-primary leading-tight">
                        {t('title')}
                    </h1>

                    <div className="flex gap-1 items-center">
                        {mounted && (
                            <button
                                onClick={toggleTheme}
                                className="p-2 rounded-full hover:bg-surface-raised text-text-secondary transition-colors"
                                aria-label="Toggle Theme"
                            >
                                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                            </button>
                        )}

                        {profile?.role === 'admin' && (
                            <button
                                onClick={() => router.push('/admin/dashboard')}
                                className="p-2 rounded-full hover:bg-surface-raised text-primary transition-colors"
                                aria-label="Admin Panel"
                            >
                                <Shield className="w-5 h-5" />
                            </button>
                        )}

                        <button
                            onClick={() => logout()}
                            className="p-2 rounded-full text-error hover:bg-error-light transition-colors"
                            aria-label="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Content ────────────────────────────────── */}
            <main className="max-w-lg mx-auto px-4 pt-5">
                {/* Section Title */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-text-primary">{t('subtitle')}</h2>
                    {!loading && history.length > 0 && (
                        <span className="text-xs text-text-secondary font-medium">
                            {t('totalCount', { count: history.length })}
                        </span>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-error-light text-error text-sm p-3 rounded-lg border border-error/20 mb-4">
                        ⚠️ {error}
                    </div>
                )}

                {/* Loading Skeletons */}
                {loading && (
                    <div className="space-y-3">
                        <HistorySkeleton />
                        <HistorySkeleton />
                        <HistorySkeleton />
                        <HistorySkeleton />
                    </div>
                )}

                {/* History Cards — Same pattern as admin/submissions */}
                {!loading && history.length > 0 && (
                    <div className="space-y-3">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-border-strong transition-colors cursor-pointer"
                                onClick={() => router.push(`/checklist/${item.id}?submission_id=${item.id}&from=history`)}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold text-text-primary truncate">
                                            {item.template_title}
                                        </h3>
                                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-success/10 text-success">
                                            {t('completed')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                                        <span className="capitalize">{getShiftLabel(item.shift)}</span>
                                        <span>·</span>
                                        <span>{formatDate(item.completed_at)}</span>
                                        {item.venue_name && (
                                            <>
                                                <span>·</span>
                                                <span>{item.venue_name}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 flex-shrink-0">
                                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{calcDuration(item.started_at, item.completed_at)}</span>
                                    </div>
                                    <Eye className="w-4 h-4 text-text-secondary" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && history.length === 0 && !error && (
                    <div className="bg-surface border border-border rounded-2xl p-8 text-center">
                        <div className="text-4xl mb-3">📋</div>
                        <h3 className="text-base font-semibold text-text-primary mb-1">
                            {t('noHistoryTitle')}
                        </h3>
                        <p className="text-sm text-text-secondary">
                            {t('noHistoryDesc')}
                        </p>
                    </div>
                )}
            </main>

            {/* ── Bottom Nav ─────────────────────────────── */}
            <BottomNav />
        </div>
    )
}
