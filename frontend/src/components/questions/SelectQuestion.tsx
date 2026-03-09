'use client'

import { ChevronDown } from 'lucide-react'
import type { SubmissionQuestion } from '@/lib/api'

interface Props {
    question: SubmissionQuestion
    value: string | null
    onChange: (value: string) => void
}

export default function SelectQuestion({ question, value, onChange }: Props) {
    const options: string[] = question.config?.options || []
    const label = question.config?.label

    return (
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
            <h3 className="text-base font-semibold text-text-primary mb-1">{question.label}</h3>
            {label && (
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">{label}</p>
            )}
            <div className="relative">
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-surface-raised border border-border rounded-xl px-4 h-12 text-sm text-text-primary appearance-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-strong transition-all cursor-pointer"
                >
                    <option value="" disabled>Select an option...</option>
                    {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
            </div>
        </div>
    )
}
