'use client'

import { useRef, useCallback, useState } from 'react'
import { fetchWithAuth } from '@/lib/api'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// Debounce strategy per question type
const STRATEGY: Record<string, number> = {
    check: 0,
    yes_no: 0,
    multi_option: 0,
    select: 0,
    photo: 0,
    text: 800,
    number: 800,
    slider: 500,
}

export function useAutoSave(submissionId: string | null) {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
    const pendingRef = useRef<Map<string, string>>(new Map())
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Flush all pending answers to the server
    const flush = useCallback(async () => {
        if (!submissionId || pendingRef.current.size === 0) return

        const answers = Array.from(pendingRef.current.entries()).map(
            ([question_id, value]) => ({ question_id, value })
        )
        pendingRef.current.clear()

        setSaveStatus('saving')
        try {
            await fetchWithAuth(`/submissions/${submissionId}/answers`, {
                method: 'PUT',
                body: JSON.stringify({ answers }),
            })
            setSaveStatus('saved')

            // Reset to idle after 3 seconds
            if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
            fadeTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000)
        } catch (err) {
            console.error('Auto-save error:', err)
            setSaveStatus('error')

            // Re-add failed answers to pending for retry
            for (const ans of answers) {
                pendingRef.current.set(ans.question_id, ans.value)
            }

            // Auto-retry after 3 seconds
            setTimeout(() => flush(), 3000)
        }
    }, [submissionId])

    // Save a single answer with type-based debounce
    const saveAnswer = useCallback(
        (questionId: string, value: string, type: string) => {
            pendingRef.current.set(questionId, value)

            const delay = STRATEGY[type] ?? 0

            if (delay === 0) {
                // Immediate save
                flush()
            } else {
                // Debounced save
                if (timerRef.current) clearTimeout(timerRef.current)
                timerRef.current = setTimeout(() => flush(), delay)
            }
        },
        [flush]
    )

    return { saveAnswer, saveStatus, flush }
}
