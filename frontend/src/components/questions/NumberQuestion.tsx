'use client'

import type { SubmissionQuestion } from '@/lib/api'

interface Props {
    question: SubmissionQuestion
    value: string | null
    onChange: (value: string) => void
}

export default function NumberQuestion({ question, value, onChange }: Props) {
    const unit = (question.config as any)?.unit || ''

    return (
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
            <h3 className="text-base font-semibold text-text-primary mb-3">{question.label}</h3>
            <div className="relative">
                <input
                    type="number"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="0"
                    className="w-full bg-surface-raised border border-border rounded-xl px-4 h-12 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-strong transition-all"
                />
                {unit && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-secondary font-medium">
                        {unit}
                    </span>
                )}
            </div>
        </div>
    )
}
