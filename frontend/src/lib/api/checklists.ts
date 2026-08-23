import { fetchWithAuth, VenueInfo, OrgInfo } from './core'

export interface Profile {
    id: string
    full_name: string
    email?: string
    role: string
    is_superadmin?: boolean
    organizations: OrgInfo[]
    // Keep legacy for now
    venues: VenueInfo[]
    organization_id?: string
    venue_id?: string
    shift_id?: string
    shift_name?: string
    permissions?: string[]
}

export interface ChecklistItem {
    id: string
    title: string
    description?: string | null
    frequency?: string | null
    due_date?: string | null
    due_time?: string | null
    available_from_time?: string | null
    schedule?: number[] | null
    prerequisite_template_id?: string | null
    status: 'completed' | 'in_progress' | 'pending' | 'locked'
    total_questions: number
    answered_questions: number
    submission_id: string | null
    custom_title?: string | null
    is_private?: boolean
}

export interface LibraryTemplate {
    id: string
    title: string
    description: string | null
    frequency: string
}

export interface SubmissionQuestion {
    id: string
    label: string
    type: string
    is_required: boolean
    config: Record<string, unknown> | null
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

export interface HistoryItem {
    id: string
    template_title: string
    shift: string
    completed_at: string
    total_questions: number
    venue_name: string | null
    started_at: string | null
}

export async function getProfile(): Promise<Profile> {
    const profile = await fetchWithAuth<Profile>('/me')
    // Compatibility layer: flatten all venues from all orgs into a top-level venues array
    if (!profile.venues) {
        profile.venues = profile.organizations?.flatMap(org => org.venues || []) || []
    }
    return profile
}

export function getChecklists(venueId: string): Promise<ChecklistItem[]> {
    return fetchWithAuth(`/checklists/${venueId}`)
}

export function getLibraryTemplates(venueId: string): Promise<LibraryTemplate[]> {
    return fetchWithAuth(`/checklists/library/${venueId}`)
}

export function createSubmission(templateId: string, venueId: string, customTitle?: string | null, isPrivate: boolean = false): Promise<{ id: string }> {
    return fetchWithAuth('/submissions', {
        method: 'POST',
        body: JSON.stringify({ template_id: templateId, venue_id: venueId, custom_title: customTitle, is_private: isPrivate }),
    })
}

export function getSubmission(submissionId: string): Promise<SubmissionDetail> {
    return fetchWithAuth(`/submissions/${submissionId}`)
}

export function getHistory(): Promise<HistoryItem[]> {
    return fetchWithAuth('/submissions/history')
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

export const checklistsApi = {
    getProfile,
    getChecklists,
    getLibraryTemplates,
    createSubmission,
    getSubmission,
    getHistory,
    submitAudit,
}
