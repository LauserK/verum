'use client'

import { CheckCircle2, PlayCircle, Clock, Lock } from 'lucide-react'
import type { ChecklistItem } from '@/lib/api'
import { useTranslations } from '@/components/I18nProvider'

interface Props {
    checklist: ChecklistItem
    onClick?: () => void
}

function formatDueDate(isoDate: string): string {
    const d = new Date(isoDate + 'T00:00:00')
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ChecklistCard({ checklist, onClick }: Props) {
    const { t } = useTranslations('checklistCard')

    const statusConfig = {
        completed: {
            label: t('completed'),
            icon: CheckCircle2,
            badgeClasses: 'bg-success-light text-success border-success/20',
            cardBorder: 'border-success/30',
            progressColor: 'bg-success',
        },
        in_progress: {
            label: t('inProgress'),
            icon: PlayCircle,
            badgeClasses: 'bg-primary-light text-primary border-primary/20',
            cardBorder: 'border-primary/30',
            progressColor: 'bg-primary',
        },
        pending: {
            label: t('pending'),
            icon: Clock,
            badgeClasses: 'bg-surface-raised text-text-secondary border-border',
            cardBorder: 'border-border',
            progressColor: 'bg-locked',
        },
        locked: {
            label: t('locked'),
            icon: Lock,
            badgeClasses: 'bg-surface-raised text-locked border-border',
            cardBorder: 'border-border',
            progressColor: 'bg-locked',
        },
    }

    const config = statusConfig[checklist.status]
    const Icon = config.icon
    const isDisabled = checklist.status === 'locked'
    const progress = checklist.total_questions > 0
        ? (checklist.answered_questions / checklist.total_questions) * 100
        : 0

    const dueLabel =
        checklist.due_date && checklist.due_time
            ? t('dueDateTime', {
                date: formatDueDate(checklist.due_date),
                time: (checklist.due_time || '').slice(0, 5),
            })
            : checklist.due_time
                ? t('dueTime', { time: checklist.due_time.slice(0, 5) })
                : checklist.due_date
                    ? t('dueDate', { date: formatDueDate(checklist.due_date) })
                    : null

    return (
        <button
            onClick={isDisabled ? undefined : onClick}
            disabled={isDisabled}
            className={`
                w-full text-left bg-surface border ${config.cardBorder} rounded-2xl p-4 
                shadow-sm dark:shadow-none transition-all duration-200
                ${isDisabled
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:shadow-md hover:border-primary/30 active:scale-[0.99] cursor-pointer'
                }
            `}
        >
            {/* Top row: title + badge */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-text-primary truncate">
                        {checklist.title}
                    </h3>
                    {checklist.description && (
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                            {checklist.description}
                        </p>
                    )}
                </div>

                <span className={`
                    flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide
                    border rounded-full px-2.5 py-1 shrink-0
                    ${config.badgeClasses}
                `}>
                    <Icon className="w-3.5 h-3.5" />
                    {config.label}
                </span>
            </div>

            {/* Progress bar (only for in_progress) */}
            {checklist.status === 'in_progress' && (
                <div className="mt-3">
                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-text-secondary">
                            {t('tasks', { answered: checklist.answered_questions, total: checklist.total_questions })}
                        </span>
                        <div className="flex items-center gap-2">
                            {dueLabel && (
                                <span className="text-xs text-text-secondary flex items-center gap-1">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    {dueLabel}
                                </span>
                            )}
                            <span className="text-xs font-semibold text-primary font-mono">
                                {Math.round(progress)}%
                            </span>
                        </div>
                    </div>
                    <div className="w-full h-1.5 bg-surface-raised rounded-full overflow-hidden">
                        <div
                            className={`h-full ${config.progressColor} rounded-full transition-all duration-500`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Tasks counter (for pending/completed) */}
            {(checklist.status === 'pending' || checklist.status === 'completed') && checklist.total_questions > 0 && (
                <div className="mt-3 flex justify-between items-center">
                    <span className="text-xs text-text-secondary">
                        {checklist.status === 'completed'
                            ? t('tasks', { answered: checklist.total_questions, total: checklist.total_questions })
                            : t('tasksTotal', { total: checklist.total_questions })
                        }
                    </span>
                    {dueLabel && checklist.status !== 'completed' && (
                        <span className="text-xs text-text-secondary flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            {dueLabel}
                        </span>
                    )}
                </div>
            )}

            {/* Lock message */}
            {checklist.status === 'locked' && (
                <div className="mt-3 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Lock className="w-3.5 h-3.5 text-locked shrink-0" />
                        <span className="text-xs text-locked">
                            {(() => {
                                if (checklist.available_from_time && !checklist.prerequisite_template_id) {
                                    return t('availableFrom', { time: checklist.available_from_time.slice(0, 5) })
                                }
                                if (checklist.available_from_time && checklist.prerequisite_template_id) {
                                    return t('prereqRequiredTime', { time: checklist.available_from_time.slice(0, 5) })
                                }
                                return t('prereqRequired')
                            })()}
                        </span>
                    </div>
                    {dueLabel && (
                        <span className="text-xs text-text-secondary flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            {dueLabel}
                        </span>
                    )}
                </div>
            )}
        </button>
    )
}

