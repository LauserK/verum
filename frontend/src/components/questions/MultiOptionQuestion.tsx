'use client'

import { ShieldCheck, ThumbsUp, XCircle } from 'lucide-react'
import type { SubmissionQuestion } from '@/lib/api'

interface Props {
    question: SubmissionQuestion
    value: string | null
    onChange: (value: string) => void
}

const iconMap: Record<string, typeof ShieldCheck> = {
    'Excellent': ShieldCheck,
    'Good': ThumbsUp,
    'Reject': XCircle,
}

export default function MultiOptionQuestion({ question, value, onChange }: Props) {
    const options: string[] = question.config?.options || ['Option 1', 'Option 2', 'Option 3']
    const label = question.config?.label || question.label

    return (
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
            <h3 className="text-base font-semibold text-text-primary mb-1">{question.label}</h3>
            {question.config?.label && (
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">{question.config.label}</p>
            )}
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 3)}, 1fr)` }}>
                {options.map((opt) => {
                    const isSelected = value === opt
                    const Icon = iconMap[opt]
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => onChange(opt)}
                            className={`
                                flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl border-2
                                text-sm font-medium transition-all duration-200
                                ${isSelected
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'border-border bg-surface-raised text-text-secondary hover:border-primary/40'
                                }
                            `}
                        >
                            {Icon && <Icon className="w-6 h-6" />}
                            <span>{opt}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
