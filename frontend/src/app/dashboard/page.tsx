'use client'

import { useEffect, useState } from 'react'
import { logout } from '@/app/login/actions'
import { getProfile, getChecklists, getLibraryTemplates, createSubmission, type Profile, type ChecklistItem, type LibraryTemplate } from '@/lib/api'
import ChecklistCard from '@/components/ChecklistCard'
import BottomNav from '@/components/BottomNav'
import { VenueSelector } from '@/components/VenueSelector'
import { useVenue } from '@/components/VenueContext'
import ConfirmationModal from '@/components/ConfirmationModal'
import { LogOut, Sun, Moon, Sunrise, CloudSun, Sunset, Shield, Clock, Building2, Library, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/components/I18nProvider'
import { useTheme } from '@/components/ThemeProvider'

function getShiftInfo(t: (key: string) => string): { label: string; icon: typeof Sun } {
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


// ── Library Modal ───────────────────────────────────────
function LibraryModal({ 
    isOpen, 
    onClose, 
    venueId,
    onSuccess
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    venueId: string;
    onSuccess: (checklistId: string) => void;
}) {
    const [templates, setTemplates] = useState<LibraryTemplate[]>([])
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<LibraryTemplate | null>(null)
    const [customTitle, setCustomTitle] = useState('')
    const [isPrivate, setIsPrivate] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const { t } = useTranslations('dashboard')

    useEffect(() => {
        if (isOpen && venueId) {
            setLoading(true)
            getLibraryTemplates(venueId)
                .then(setTemplates)
                .catch(console.error)
                .finally(() => setLoading(false))
        } else {
            setSelected(null)
            setCustomTitle('')
            setIsPrivate(false)
        }
    }, [isOpen, venueId])

    if (!isOpen) return null

    const handleStart = async () => {
        if (!selected || !venueId) return
        try {
            setSubmitting(true)
            const res = await createSubmission(selected.id, venueId, customTitle || null, isPrivate)
            onSuccess(res.id)
            onClose()
        } catch (err) {
            console.error(err)
            alert('Error starting checklist')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-0">
            <div className="bg-surface w-full max-w-md rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h2 className="text-lg font-bold text-text-primary">
                        {selected ? 'Configurar Checklist' : 'Librería de Checklists'}
                    </h2>
                    <button onClick={onClose} className="p-2 bg-surface-raised rounded-full text-text-secondary hover:text-text-primary">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex justify-center p-8"><span className="animate-spin text-2xl">⏳</span></div>
                    ) : selected ? (
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Plantilla</label>
                                <div className="p-3 bg-surface-raised rounded-xl text-text-primary font-medium">{selected.title}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Nombre / Referencia (Opcional)</label>
                                <input 
                                    type="text" 
                                    value={customTitle}
                                    onChange={e => setCustomTitle(e.target.value)}
                                    placeholder="Ej. Evento Especial, Cumpleaños..."
                                    className="w-full bg-surface-raised border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 border border-border rounded-xl">
                                <div>
                                    <h4 className="text-sm font-medium text-text-primary">Mantener Privado</h4>
                                    <p className="text-xs text-text-secondary">Solo tú podrás ver y completar este checklist.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
                                    <div className="w-11 h-6 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                            
                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setSelected(null)} className="flex-1 py-3 px-4 bg-surface-raised text-text-primary rounded-xl font-medium">Volver</button>
                                <button onClick={handleStart} disabled={submitting} className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-medium disabled:opacity-70">
                                    {submitting ? 'Iniciando...' : 'Iniciar'}
                                </button>
                            </div>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center p-8 text-text-secondary">No hay checklists disponibles en la librería.</div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {templates.map(t => (
                                <button 
                                    key={t.id} 
                                    onClick={() => setSelected(t)}
                                    className="text-left p-4 rounded-xl border border-border bg-surface hover:bg-surface-raised transition-colors"
                                >
                                    <h3 className="font-semibold text-text-primary mb-1">{t.title}</h3>
                                    {t.description && <p className="text-xs text-text-secondary line-clamp-2">{t.description}</p>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Main ────────────────────────────────────────────

export default function DashboardPage() {
    const { t, language } = useTranslations('dashboard')
    const { t: attendanceT } = useTranslations('attendance')
    const { theme, toggleTheme } = useTheme()
    const router = useRouter()
    const { selectedVenueId, isLoading: isVenueLoading, isMultiOrg, activeOrgName } = useVenue()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [checklists, setChecklists] = useState<ChecklistItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const [pendingChecklist, setPendingChecklist] = useState<ChecklistItem | null>(null)
    const [showLibrary, setShowLibrary] = useState(false)
    
    const refreshChecklists = async () => {
        if (!selectedVenueId) return
        try {
            const checklistData = await getChecklists(selectedVenueId)
            setChecklists(checklistData)
        } catch (err) {
            console.error(err)
        }
    }

    const fallbackShiftInfo = getShiftInfo(t)
    const shiftLabel = profile?.shift_name || fallbackShiftInfo.label
    const ShiftIcon = fallbackShiftInfo.icon

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (isVenueLoading) return;

        async function loadData() {
            try {
                setLoading(true)
                const profileData = await getProfile()
                setProfile(profileData)

                // STRIKT: Only use selectedVenueId which is already filtered by active organization in VenueContext
                if (selectedVenueId) {
                    try {
                        const checklistData = await getChecklists(selectedVenueId)
                        setChecklists(checklistData)
                    } catch (err: unknown) {
                        const errorMessage = (err as Error).message || ''
                        if (errorMessage.includes('no_shift_assigned')) {
                            setError('no_shift_assigned')
                        } else {
                            setError(errorMessage || 'Error loading checklists')
                            setChecklists([])
                        }
                    }
                } else {
                    // No venue selected or available for this organization
                    setChecklists([])
                }
            } catch (err: unknown) {
                const errorMessage = (err as Error).message || ''
                if (errorMessage.includes('no_shift_assigned')) {
                    setError('no_shift_assigned')
                } else {
                    setError(errorMessage || 'Failed to load data')
                }
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [selectedVenueId, isVenueLoading])

    const handleChecklistClick = (checklist: ChecklistItem) => {
        if (checklist.status === 'pending') {
            setPendingChecklist(checklist)
        } else if (checklist.status !== 'locked') {
            proceedToChecklist(checklist)
        }
    }

    const proceedToChecklist = (checklist: ChecklistItem) => {
        if (!selectedVenueId) return
        router.push(`/checklist/${checklist.id}?venue=${selectedVenueId}&from=dashboard`)
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
                        {isMultiOrg && activeOrgName && (
                            <button 
                                onClick={() => router.push('/venue-selection')}
                                className="text-[10px] font-bold text-primary hover:text-primary-hover bg-primary/5 px-2 py-1 rounded-lg border border-primary/10 transition-all flex items-center gap-1.5 mr-1"
                            >
                                <Building2 className="w-3 h-3" />
                                <span className="max-w-[80px] truncate">{activeOrgName}</span>
                            </button>
                        )}

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
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-text-primary">{t('todaysAudits')}</h2>
                        <button 
                            onClick={() => setShowLibrary(true)} 
                            className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 transition-colors rounded-lg flex items-center justify-center"
                            title="Librería de Checklists"
                        >
                            <Library className="w-4 h-4" />
                        </button>
                    </div>
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

            <LibraryModal 
                isOpen={showLibrary} 
                onClose={() => setShowLibrary(false)} 
                venueId={selectedVenueId || ''}
                onSuccess={(id) => {
                    refreshChecklists()
                    // Optionally router.push(`/checklist/${id}?venue=${selectedVenueId}`)
                }}
            />
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
