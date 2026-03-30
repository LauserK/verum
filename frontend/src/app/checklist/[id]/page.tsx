'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, CheckCircle2, X } from 'lucide-react'
import {
    createSubmission,
    getSubmission,
    submitAudit,
    type SubmissionDetail,
    type SubmissionQuestion,
} from '@/lib/api'
import { useAutoSave } from '@/hooks/useAutoSave'
import SaveIndicator from '@/components/SaveIndicator'
import { useTranslations } from '@/components/I18nProvider'

// Question components
import CheckQuestion from '@/components/questions/CheckQuestion'
import TextQuestion from '@/components/questions/TextQuestion'
import NumberQuestion from '@/components/questions/NumberQuestion'
import YesNoQuestion from '@/components/questions/YesNoQuestion'
import MultiOptionQuestion from '@/components/questions/MultiOptionQuestion'
import SelectQuestion from '@/components/questions/SelectQuestion'
import SliderQuestion from '@/components/questions/SliderQuestion'
import PhotoQuestion from '@/components/questions/PhotoQuestion'

// ── Question renderer ───────────────────────────────
function QuestionRenderer({
    question,
    value,
    onChange,
}: {
    question: SubmissionQuestion
    value: string | null
    onChange: (value: string) => void
}) {
    const props = { question, value, onChange }

    switch (question.type) {
        case 'check':        return <CheckQuestion {...props} />
        case 'text':         return <TextQuestion {...props} />
        case 'number':       return <NumberQuestion {...props} />
        case 'yes_no':       return <YesNoQuestion {...props} />
        case 'multi_option': return <MultiOptionQuestion {...props} />
        case 'select':       return <SelectQuestion {...props} />
        case 'slider':       return <SliderQuestion {...props} />
        case 'photo':        return <PhotoQuestion {...props} />
        default:             return <TextQuestion {...props} />
    }
}

// ── Skeleton ────────────────────────────────────────
function QuestionSkeleton() {
    return (
        <div className="bg-surface border border-border rounded-2xl p-4 animate-pulse">
            <div className="h-5 bg-surface-raised rounded w-3/4 mb-3" />
            <div className="h-12 bg-surface-raised rounded-xl" />
        </div>
    )
}

// ── Main Page ───────────────────────────────────────
export default function ChecklistPage() {
    const { t } = useTranslations('checklist')
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()

    const templateId = params.id as string
    const venueId = searchParams.get('venue') || ''
    const submissionIdParam = searchParams.get('submission_id') || ''
    const fromParam = searchParams.get('from')

    let backPath = '/dashboard'
    if (fromParam === 'history') backPath = '/history'
    else if (fromParam === 'admin') backPath = '/admin/submissions'
    else if (fromParam === 'dashboard') backPath = '/dashboard'
    else if (submissionIdParam) backPath = '/admin/submissions'

    const [submission, setSubmission] = useState<SubmissionDetail | null>(null)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [step, setStep] = useState(1) // 1 = Check, 2 = Review
    const [auditorNotes, setAuditorNotes] = useState('')
    const [auditorConfirmed, setAuditorConfirmed] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

    // Auto-save hook
    const { saveAnswer, saveStatus, flush } = useAutoSave(submission?.id || null)

    // Load or create submission
    useEffect(() => {
        async function init() {
            try {
                setLoading(true)

                let sub: { id: string }

                if (submissionIdParam) {
                    // Direct load (admin view) — skip createSubmission
                    sub = { id: submissionIdParam }
                } else {
                    // Create draft (idempotent — returns existing if any)
                    sub = await createSubmission(templateId, venueId)
                }

                // Load full submission data with questions
                const detail = await getSubmission(sub.id)
                setSubmission(detail)

                // Pre-populate answers from existing data
                const existingAnswers: Record<string, string> = {}
                for (const q of detail.questions) {
                    if (q.answer) existingAnswers[q.id] = q.answer
                }
                setAnswers(existingAnswers)
                setAuditorNotes(detail.auditor_notes || '')
                setAuditorConfirmed(detail.auditor_confirmed || false)

                // If already completed, jump to review
                if (detail.status === 'completed') {
                    setStep(2)
                }
            } catch (err: unknown) {
                setError((err as Error).message || 'Failed to load checklist')
            } finally {
                setLoading(false)
            }
        }
        init()
    }, [templateId, venueId])

    const handleAnswer = (questionId: string, value: string, type: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }))
        if (!isCompleted) {
            saveAnswer(questionId, value, type)
        }
    }

    // Count answered required questions
    const requiredQuestions = submission?.questions.filter((q) => q.is_required) || []
    const answeredRequired = requiredQuestions.filter((q) => {
        const val = answers[q.id]
        return val !== undefined && val !== '' && val !== null
    })
    const allRequiredAnswered = answeredRequired.length === requiredQuestions.length
    const totalAnswered = Object.values(answers).filter((v) => v && v !== '').length
    const isCompleted = submission?.status === 'completed'

    // Submit audit
    const handleSubmit = async () => {
        if (!submission) return

        setSubmitting(true)
        try {
            // Flush any pending auto-saves first
            await flush()

            await submitAudit(submission.id, {
                auditor_notes: auditorNotes,
                auditor_confirmed: auditorConfirmed,
                status: 'completed',
            })

            router.push('/dashboard')
        } catch (err: unknown) {
            setError((err as Error).message || 'Failed to submit audit')
            setSubmitting(false)
        }
    }

    // ── Loading state ───────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-bg">
                <header className="sticky top-0 z-40 bg-surface border-b border-border">
                    <div className="max-w-lg mx-auto flex items-center gap-3 px-4 h-14">
                        <div className="h-5 w-5 bg-surface-raised rounded animate-pulse" />
                        <div className="h-5 w-48 bg-surface-raised rounded animate-pulse" />
                    </div>
                </header>
                <main className="max-w-lg mx-auto px-4 pt-6 flex flex-col gap-3">
                    <QuestionSkeleton />
                    <QuestionSkeleton />
                    <QuestionSkeleton />
                </main>
            </div>
        )
    }

    // ── Error state ─────────────────────────────────
    if (error && !submission) {
        return (
            <div className="min-h-screen bg-bg flex items-center justify-center p-4">
                <div className="bg-error-light text-error text-sm p-4 rounded-lg border border-error/20">
                    ⚠️ {error}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg pb-28">
            {/* ── Header ─────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-surface border-b border-border">
                <div className="max-w-lg mx-auto flex items-center gap-3 px-4 h-14">
                    <button
                        onClick={() => (step === 2 && !isCompleted) ? setStep(1) : router.push(backPath)}
                        className="p-1 -ml-1 text-text-primary hover:text-primary transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-base font-bold text-text-primary truncate flex-1">
                        {submission?.template_title || t('title')}
                    </h1>
                    {!isCompleted && <SaveIndicator status={saveStatus} />}
                </div>
            </header>

            {/* ── Step Indicator ──────────────────────── */}
            <div className="max-w-lg mx-auto px-4 pt-5 pb-4">
                <div className="flex items-center justify-between">
                    {/* Step 1 */}
                    <div className="flex flex-col items-center gap-1">
                        <div className={`
                            w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                            ${step >= 1
                                ? 'bg-primary text-text-inverse'
                                : 'bg-surface-raised text-text-secondary border border-border'
                            }
                        `}>
                            {step > 1 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                        </div>
                        <span className={`text-xs font-semibold uppercase tracking-wider ${step >= 1 ? 'text-primary' : 'text-text-secondary'}`}>
                            {t('stepCheck')}
                        </span>
                    </div>

                    {/* Line */}
                    <div className="flex-1 mx-4 h-0.5 rounded-full bg-border">
                        <div className={`h-full rounded-full bg-primary transition-all duration-500 ${step >= 2 ? 'w-full' : 'w-0'}`} />
                    </div>

                    {/* Step 2 */}
                    <div className="flex flex-col items-center gap-1">
                        <div className={`
                            w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                            ${step >= 2
                                ? 'bg-primary text-text-inverse'
                                : 'bg-surface-raised text-text-secondary border border-border'
                            }
                        `}>
                            2
                        </div>
                        <span className={`text-xs font-semibold uppercase tracking-wider ${step >= 2 ? 'text-primary' : 'text-text-secondary'}`}>
                            {t('stepReview')}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Step 1: Check ──────────────────────── */}
            {step === 1 && (
                <main className="max-w-lg mx-auto px-4 flex flex-col gap-3">
                    {submission?.questions.map((q) => (
                        <QuestionRenderer
                            key={q.id}
                            question={q}
                            value={answers[q.id] || null}
                            onChange={(val) => handleAnswer(q.id, val, q.type)}
                        />
                    ))}
                </main>
            )}

            {/* ── Step 2: Review ─────────────────────── */}
            {step === 2 && (
                <main className="max-w-lg mx-auto px-4 flex flex-col gap-4">
                    {/* Summary Card */}
                    <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
                        <h3 className="text-base font-semibold text-text-primary mb-3">{t('summaryTitle')}</h3>
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-text-secondary">{t('tasksCompleted')}</span>
                            <span className="font-semibold text-text-primary font-mono">
                                {totalAnswered}/{submission?.questions.length || 0}
                            </span>
                        </div>
                        <div className="w-full h-2 bg-surface-raised rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${submission?.questions.length ? (totalAnswered / submission.questions.length) * 100 : 0}%` }}
                            />
                        </div>
                    </div>

                    {/* Answers Review */}
                    <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
                        <h3 className="text-base font-semibold text-text-primary mb-3">{t('responsesTitle')}</h3>
                        <div className="flex flex-col gap-2.5">
                            {submission?.questions.map((q) => {
                                const val = answers[q.id]
                                return (
                                    <div key={q.id} className="flex flex-col gap-1 py-3 border-b border-border last:border-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-sm text-text-secondary flex-1">{q.label}</span>
                                            {q.type === 'photo' && val && val.startsWith('http') ? (
                                                <img
                                                    src={val}
                                                    alt={q.label}
                                                    onClick={() => setLightboxUrl(val)}
                                                    className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all flex-shrink-0"
                                                />
                                            ) : (
                                                <span className={`text-sm font-medium text-right shrink-0 max-w-[40%] truncate ${val ? 'text-text-primary' : 'text-text-disabled italic'}`}>
                                                    {val || t('notAnswered')}
                                                </span>
                                            )}
                                        </div>
                                        {q.answered_at && (
                                            <span className="text-[10px] text-text-disabled text-right w-full block">
                                                {new Date(q.answered_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Auditor Notes */}
                    <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
                        <h3 className="text-base font-semibold text-text-primary mb-3">{t('auditorNotesTitle')}</h3>
                        {isCompleted ? (
                            <p className="text-sm text-text-primary bg-surface-raised rounded-xl px-4 py-3">
                                {auditorNotes || t('noNotes')}
                            </p>
                        ) : (
                            <textarea
                                value={auditorNotes}
                                onChange={(e) => setAuditorNotes(e.target.value)}
                                placeholder={t('notesPlaceholder')}
                                rows={3}
                                className="w-full bg-surface-raised border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-strong transition-all resize-none"
                            />
                        )}
                    </div>

                    {/* Confirmation — show only when not completed */}
                    {isCompleted ? (
                        <div className="flex items-center gap-3 bg-success/10 border border-success/20 rounded-2xl p-4">
                            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                            <span className="text-sm text-success font-medium">
                                {t('confirmedMessage')}
                            </span>
                        </div>
                    ) : (
                        <label className="flex items-start gap-3 bg-surface border border-border rounded-2xl p-4 cursor-pointer shadow-sm dark:shadow-none">
                            <div className="relative flex items-center mt-0.5">
                                <input
                                    type="checkbox"
                                    checked={auditorConfirmed}
                                    onChange={(e) => setAuditorConfirmed(e.target.checked)}
                                    className="appearance-none w-5 h-5 border-2 border-border-strong rounded peer checked:bg-primary checked:border-primary focus:outline-none transition-all cursor-pointer bg-surface"
                                />
                                <svg className="absolute w-4 h-4 text-white left-[2px] top-[2px] pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <span className="text-sm text-text-primary font-medium">
                                {t('confirmLabel')}
                            </span>
                        </label>
                    )}

                    {error && (
                        <div className="bg-error-light text-error text-sm p-3 rounded-lg border border-error/20">
                            ⚠️ {error}
                        </div>
                    )}
                </main>
            )}

            {/* ── Footer Actions ─────────────────────── */}
            <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50">
                <div className="max-w-lg mx-auto flex gap-3 px-4 py-3">
                    {/* Completed: only show Back button */}
                    {isCompleted && (
                        <button
                            onClick={() => router.push(backPath)}
                            className="flex-1 h-12 bg-primary text-text-inverse rounded-xl font-semibold text-sm hover:bg-primary-hover transition-colors"
                        >
                            {t('backToDashboard')}
                        </button>
                    )}

                    {/* Step 1: Back + Review */}
                    {!isCompleted && step === 1 && (
                        <>
                            <button
                                onClick={() => router.push(backPath)}
                                className="flex-1 h-12 border border-border rounded-xl font-semibold text-sm text-text-primary hover:bg-surface-raised transition-colors"
                            >
                                {t('back')}
                            </button>
                            <button
                                onClick={() => setStep(2)}
                                disabled={!allRequiredAnswered}
                                className="flex-[2] h-12 bg-primary text-text-inverse rounded-xl font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {t('reviewAudit')}
                            </button>
                        </>
                    )}

                    {/* Step 2 (not completed): Back + Submit */}
                    {!isCompleted && step === 2 && (
                        <>
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 h-12 border border-border rounded-xl font-semibold text-sm text-text-primary hover:bg-surface-raised transition-colors"
                            >
                                {t('back')}
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!auditorConfirmed || submitting}
                                className="flex-[2] h-12 bg-success text-white rounded-xl font-semibold text-sm hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('submitting')}
                                    </>
                                ) : (
                                    t('submitAudit')
                                )}
                            </button>
                        </>
                    )}
                </div>
                <div className="h-[env(safe-area-inset-bottom)]" />
            </div>

            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setLightboxUrl(null)}
                >
                    <button
                        onClick={() => setLightboxUrl(null)}
                        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors z-[101]"
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={lightboxUrl}
                        alt="Photo"
                        className="max-w-full max-h-[85vh] object-contain rounded-xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    )
}

