'use client'

import { Check } from 'lucide-react'
import type { SubmissionQuestion } from '@/lib/api'

interface Props {
    question: SubmissionQuestion
    value: string | null
    onChange: (value: string) => void
}

export default function CheckQuestion({ question, value, onChange }: Props) {
    const isChecked = value === 'true'

    return (
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <h3 className="text-base font-semibold text-text-primary">{question.label}</h3>
                    {question.config?.description && (
                        <p className="text-sm text-text-secondary mt-1">{question.config.description}</p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => onChange(isChecked ? '' : 'true')}
                    className={`
                        w-10 h-10 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200
                        ${isChecked
                            ? 'bg-success/10 border-success text-success'
                            : 'border-border-strong bg-surface hover:border-primary/50'
                        }
                    `}
                >
                    {isChecked && <Check className="w-6 h-6" strokeWidth={3} />}
                </button>
            </div>
        </div>
    )
}
