import { createClient } from '@/utils/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function fetchWithAuth(path: string, options: RequestInit = {}) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        throw new Error('Not authenticated')
    }

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            ...options.headers,
        },
    })

    if (!res.ok) {
        const error = await res.text()
        throw new Error(error || `API Error: ${res.status}`)
    }

    return res.json()
}


// ── API Functions ───────────────────────────────────

export interface VenueInfo {
    id: string
    name: string
}

export interface Profile {
    id: string
    full_name: string | null
    role: string
    organization_id: string | null
    venues: VenueInfo[]
}

export interface ChecklistItem {
    id: string
    title: string
    description: string | null
    frequency: string | null
    status: 'completed' | 'in_progress' | 'pending' | 'locked'
    total_questions: number
    answered_questions: number
    submission_id: string | null
}

export function getProfile(): Promise<Profile> {
    return fetchWithAuth('/me')
}

export function getChecklists(venueId: string): Promise<ChecklistItem[]> {
    return fetchWithAuth(`/checklists/${venueId}`)
}


// ── Milestone 3: Submissions ────────────────────────

export interface SubmissionQuestion {
    id: string
    label: string
    type: string
    is_required: boolean
    config: Record<string, any> | null
    sort_order: number
    answer: string | null
    answered_at?: string | null
}

export interface SubmissionDetail {
    id: string
    template_id: string
    template_title: string
    status: string
    shift: string
    questions: SubmissionQuestion[]
    auditor_notes: string | null
    auditor_confirmed: boolean
}

export function createSubmission(templateId: string, venueId: string): Promise<{ id: string }> {
    return fetchWithAuth('/submissions', {
        method: 'POST',
        body: JSON.stringify({ template_id: templateId, venue_id: venueId }),
    })
}

export function getSubmission(submissionId: string): Promise<SubmissionDetail> {
    return fetchWithAuth(`/submissions/${submissionId}`)
}

export function submitAudit(
    submissionId: string,
    data: {
        status?: string
        auditor_notes?: string
        auditor_confirmed?: boolean
        answers?: { question_id: string; value: string }[]
    }
): Promise<{ ok: boolean }> {
    return fetchWithAuth(`/submissions/${submissionId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}
