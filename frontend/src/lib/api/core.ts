import { createClient } from '@/utils/supabase/client'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface VenueInfo {
    id: string
    name: string
    address?: string
}

export interface OrgInfo {
    id: string
    name: string
    venues: VenueInfo[]
    is_active?: boolean
}

declare global {
    interface Window {
        __attendanceRequiredPending?: boolean
    }
}

export async function getSessionToken(): Promise<string | null> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
}

export async function fetchWithAuth<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        throw new Error('Not authenticated')
    }

    const activeOrgId = typeof window !== 'undefined' ? localStorage.getItem('activeOrgId') : null

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            ...(activeOrgId ? { 'X-Org-ID': activeOrgId } : {}),
            ...options.headers,
        },
    })

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        let errorDetail = errorData.detail?.detail || errorData.detail

        if (errorDetail === 'CLOCK_IN_REQUIRED') {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('attendance-required'))
                window.__attendanceRequiredPending = true
            }
        }

        if (typeof errorDetail === 'object' && errorDetail !== null) {
            errorDetail = JSON.stringify(errorDetail)
        }

        throw new Error(errorDetail || `API Error: ${res.status}`)
    }

    return res.json() as Promise<T>
}
