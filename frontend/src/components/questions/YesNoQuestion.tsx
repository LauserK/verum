'use client'

import type { SubmissionQuestion } from '@/lib/api'

interface Props {
    question: SubmissionQuestion
    value: string | null
    onChange: (value: string) => void
}

export default function YesNoQuestion({ question, value, onChange }: Props) {
    return (
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
            <h3 className="text-base font-semibold text-text-primary mb-4">{question.label}</h3>
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => onChange('yes')}
                    className={`
                        h-12 rounded-xl border-2 font-semibold text-sm transition-all duration-200
                        ${value === 'yes'
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'border-border bg-surface-raised text-text-primary hover:border-primary/40'
                        }
                    `}
                >
                    Yes
                </button>
                <button
                    type="button"
                    onClick={() => onChange('no')}
                    className={`
                        h-12 rounded-xl border-2 font-semibold text-sm transition-all duration-200
                        ${value === 'no'
                            ? 'bg-error/10 border-error text-error'
                            : 'border-border bg-surface-raised text-text-primary hover:border-error/40'
                        }
                    `}
                >
                    No
                </button>
            </div>
        </div>
    )
}
