'use client'

import { useEffect, useState } from 'react'
import { logout } from '@/app/login/actions'
import { getProfile, getChecklists, type Profile, type ChecklistItem } from '@/lib/api'
import ChecklistCard from '@/components/ChecklistCard'
import BottomNav from '@/components/BottomNav'
import { VenueSelector } from '@/components/VenueSelector'
import { useVenue } from '@/components/VenueContext'
import ConfirmationModal from '@/components/ConfirmationModal'
import { LogOut, Sun, Moon, Sunrise, CloudSun, Sunset, Shield, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/components/I18nProvider'
import { useTheme } from '@/components/ThemeProvider'

function getShiftInfo(t: any): { label: string; icon: typeof Sun } {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 14) return { label: t('morningShift'), icon: Sunrise }
    if (hour >= 14 && hour < 20) return { label: t('midShift'), icon: CloudSun }
    return { label: t('closingShift'), icon: Sunset }
}

function formatDate(locale: string): string {
    return new Date().toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

// ── Skeleton ────────────────────────────────────────
function ChecklistSkeleton() {
    return (
        <div className="bg-surface border border-border rounded-2xl p-4 animate-pulse">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                    <div className="h-5 bg-surface-raised rounded-lg w-3/4 mb-2" />
                    <div className="h-3 bg-surface-raised rounded-lg w-1/2" />
                </div>
                <div className="h-6 bg-surface-raised rounded-full w-24" />
            </div>
            <div className="h-3 bg-surface-raised rounded-lg w-20 mt-2" />
        </div>
    )
}

// ── Main ────────────────────────────────────────────
export default function DashboardPage() {
    const { t, language } = useTranslations('dashboard')
    const { t: attendanceT } = useTranslations('attendance')
    const { theme, toggleTheme } = useTheme()
    const router = useRouter()
    const { selectedVenueId } = useVenue()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [checklists, setChecklists] = useState<ChecklistItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const [pendingChecklist, setPendingChecklist] = useState<ChecklistItem | null>(null)

    const fallbackShiftInfo = getShiftInfo(t)
    const shiftLabel = profile?.shift_name || fallbackShiftInfo.label
    const ShiftIcon = fallbackShiftInfo.icon

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true)
                const profileData = await getProfile()
                setProfile(profileData)

                // Fetch checklists for the user's assigned venue, fallback to first org venue
                const targetVenueId = selectedVenueId || profileData.venue_id || (profileData.venues && profileData.venues.length > 0 ? profileData.venues[0].id : null)
                if (targetVenueId) {
                    try {
                        const checklistData = await getChecklists(targetVenueId)
                        setChecklists(checklistData)
                    } catch (err: any) {
                        // Check if it's the specific no_shift_assigned error
                        if (err.message && err.message.includes('no_shift_assigned')) {
                            setError('no_shift_assigned')
                        } else {
                            // Venue might not have checklists yet or other error
                            setChecklists([])
                        }
                    }
                }
            } catch (err: any) {
                if (err.message && err.message.includes('no_shift_assigned')) {
                    setError('no_shift_assigned')
                } else {
                    setError(err.message || 'Failed to load data')
                }
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [selectedVenueId])

    const handleChecklistClick = (checklist: ChecklistItem) => {
        if (checklist.status === 'pending') {
            setPendingChecklist(checklist)
        } else if (checklist.status !== 'locked') {
            proceedToChecklist(checklist)
        }
    }

    const proceedToChecklist = (checklist: ChecklistItem) => {
        const venueId = selectedVenueId || profile?.venue_id || profile?.venues?.[0]?.id || ''
        router.push(`/checklist/${checklist.id}?venue=${venueId}&from=dashboard`)
        setPendingChecklist(null)
    }

    return (
        <div className="min-h-screen bg-bg pb-24">
            {/* ── Header ─────────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-surface border-b border-border">
                <div className="max-w-lg mx-auto flex justify-between items-center px-4 h-14">
                    <div className="flex items-center gap-2">
                        <h1 className="text-base font-bold text-text-primary leading-tight">
                            {loading ? (
                                <span className="inline-block h-5 w-32 bg-surface-raised rounded animate-pulse" />
                            ) : (
                                t('hello', { name: profile?.full_name?.split(' ')[0] || t('staff') })
                            )}
                        </h1>
                        <VenueSelector />
                    </div>

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
                {/* Shift & Date */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <ShiftIcon className="w-5 h-5 text-primary" />
                            <span className="text-sm font-semibold text-primary">{shiftLabel}</span>
                        </div>
                        <p className="text-xs text-text-secondary">{formatDate(language)}</p>
                    </div>
                    
                    {/* Attendance Quick Link */}
                    <button 
                        onClick={() => router.push('/attendance')}
                        className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/20 transition-colors"
                    >
                        <Clock className="w-4 h-4" />
                        {attendanceT('title')}
                    </button>
                </div>

                {/* Section Title */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-text-primary">{t('todaysAudits')}</h2>
                    {!loading && checklists.length > 0 && (
                        <span className="text-xs text-text-secondary font-medium">
                            {t('done', { completed: checklists.filter(c => c.status === 'completed').length, total: checklists.length })}
                        </span>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-error-light text-error text-sm p-3 rounded-lg border border-error/20 mb-4">
                        ⚠️ {error === 'no_shift_assigned' ? t('noShiftError') : error}
                    </div>
                )}

                {/* Loading Skeletons */}
                {loading && (
                    <div className="flex flex-col gap-3">
                        <ChecklistSkeleton />
                        <ChecklistSkeleton />
                        <ChecklistSkeleton />
                    </div>
                )}

                {/* Checklist Cards */}
                {!loading && checklists.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {checklists.map((checklist) => (
                            <ChecklistCard
                                key={checklist.id}
                                checklist={checklist}
                                onClick={() => handleChecklistClick(checklist)}
                            />
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && checklists.length === 0 && !error && (
                    <div className="bg-surface border border-border rounded-2xl p-8 text-center">
                        <div className="text-4xl mb-3">📋</div>
                        <h3 className="text-base font-semibold text-text-primary mb-1">
                            {t('noAuditsTitle')}
                        </h3>
                        <p className="text-sm text-text-secondary">
                            {t('noAuditsDesc')}
                        </p>
                    </div>
                )}
            </main>

            {/* ── Bottom Nav ─────────────────────────────── */}
            <BottomNav />

            <ConfirmationModal
                isOpen={!!pendingChecklist}
                title={t('startConfirmationTitle')}
                message={t('startConfirmationDesc')}
                confirmLabel={t('startConfirm')}
                cancelLabel={t('startCancel')}
                onConfirm={() => pendingChecklist && proceedToChecklist(pendingChecklist)}
                onCancel={() => setPendingChecklist(null)}
            />
        </div>
    )
}
