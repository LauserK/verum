'use client'

import { useState, useEffect } from 'react'
import type { SubmissionQuestion } from '@/lib/api'

interface Props {
    question: SubmissionQuestion
    value: string | null
    onChange: (value: string) => void
}

export default function SliderQuestion({ question, value, onChange }: Props) {
    const min = question.config?.min ?? 0
    const max = question.config?.max ?? 100
    const unit = question.config?.unit || ''
    const targetMin = question.config?.target_min
    const targetMax = question.config?.target_max

    const numValue = value ? parseFloat(value) : Math.round((min + max) / 2)
    const [localValue, setLocalValue] = useState(numValue)

    useEffect(() => {
        if (value) setLocalValue(parseFloat(value))
    }, [value])

    const percentage = ((localValue - min) / (max - min)) * 100
    const isInTarget = targetMin !== undefined && targetMax !== undefined
        ? localValue >= targetMin && localValue <= targetMax
        : true

    const handleChange = (newVal: number) => {
        setLocalValue(newVal)
        onChange(String(newVal))
    }

    return (
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
            <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="text-base font-semibold text-text-primary">{question.label}</h3>
                <span className={`
                    text-sm font-semibold font-mono px-2.5 py-0.5 rounded-lg
                    ${isInTarget
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/10 text-warning'
                    }
                `}>
                    {localValue}{unit}
                </span>
            </div>

            {targetMin !== undefined && targetMax !== undefined && (
                <p className="text-xs text-text-secondary mb-4">
                    Target range: {targetMin}{unit} - {targetMax}{unit}
                </p>
            )}

            <div className="mt-2">
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={localValue}
                    onChange={(e) => handleChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-surface-raised rounded-full appearance-none cursor-pointer accent-primary
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 
                        [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${percentage}%, var(--color-surface-raised) ${percentage}%, var(--color-surface-raised) 100%)`
                    }}
                />
                <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-text-secondary">{min}{unit}</span>
                    <span className="text-xs text-text-secondary">{max}{unit}</span>
                </div>
            </div>
        </div>
    )
}
