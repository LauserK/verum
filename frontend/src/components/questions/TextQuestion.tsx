'use client'

import type { SubmissionQuestion } from '@/lib/api'

interface Props {
    question: SubmissionQuestion
    value: string | null
    onChange: (value: string) => void
}

export default function TextQuestion({ question, value, onChange }: Props) {
    return (
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
            <h3 className="text-base font-semibold text-text-primary mb-3">{question.label}</h3>
            <textarea
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Enter your response..."
                rows={3}
                className="w-full bg-surface-raised border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-strong transition-all resize-none"
            />
        </div>
    )
}
