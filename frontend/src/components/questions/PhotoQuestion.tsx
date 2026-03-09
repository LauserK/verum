'use client'

import { Camera } from 'lucide-react'
import type { SubmissionQuestion } from '@/lib/api'

interface Props {
    question: SubmissionQuestion
    value: string | null
    onChange: (value: string) => void
}

export default function PhotoQuestion({ question, value, onChange }: Props) {
    const photoLabel = question.config?.label || question.label

    return (
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
            <h3 className="text-base font-semibold text-text-primary mb-1">{question.label}</h3>
            {question.config?.label && (
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">{question.config.label}</p>
            )}

            {value ? (
                <div className="relative rounded-xl overflow-hidden bg-surface-raised">
                    <div className="aspect-video flex items-center justify-center bg-success/10 border border-success/20 rounded-xl">
                        <div className="text-center">
                            <Camera className="w-8 h-8 text-success mx-auto mb-1" />
                            <p className="text-sm font-medium text-success">Photo captured</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className="mt-2 text-xs text-error hover:text-error/80 transition-colors"
                    >
                        Remove photo
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => onChange('photo_placeholder')}
                    className="w-full aspect-video rounded-xl border-2 border-dashed border-border-strong hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-text-secondary hover:text-primary transition-all cursor-pointer bg-surface-raised/50"
                >
                    <Camera className="w-8 h-8" />
                    <span className="text-sm font-medium">Tap to take photo</span>
                </button>
            )}
        </div>
    )
}
