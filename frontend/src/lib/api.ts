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
    venue_id?: string | null
    shift_id?: string | null
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


// ── Staff History ───────────────────────────────────

export interface HistoryItem {
    id: string
    template_title: string
    shift: string
    completed_at: string
    total_questions: number
    venue_name: string | null
    started_at: string | null
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


// ── Milestone 5: Admin API ─────────────────────────

export interface Organization {
    id: string
    name: string
}

export interface Venue {
    id: string
    org_id: string
    name: string
    address: string | null
}

export interface TemplateDetail {
    id: string
    venue_id: string
    title: string
    description: string | null
    frequency: string | null
    due_date: string | null
    due_time: string | null
    available_from_time: string | null
    schedule: number[] | null
    prerequisite_template_id: string | null
}

export interface Question {
    id: string
    template_id: string
    label: string
    type: string
    is_required: boolean
    config: Record<string, any> | null
    sort_order: number
}

export interface ComplianceReport {
    total_expected: number
    completed_on_time: number
    completed_late: number
    completed_total: number
    missing: number
    compliance_pct: number
    critical_issues: number
    non_critical_issues: number
    avg_execution_minutes: number
}

export interface AdminSubmission {
    id: string
    template_id: string
    user_id: string
    venue_id: string
    shift: string
    status: string
    started_at: string | null
    completed_at: string | null
    created_at: string
    profiles: { full_name: string } | null
    checklist_templates: { title: string } | null
}

// Admin CRUD
export const adminApi = {
    getOrganizations: (): Promise<Organization[]> =>
        fetchWithAuth('/admin/organizations'),

    createOrganization: (name: string): Promise<Organization> =>
        fetchWithAuth('/admin/organizations', { method: 'POST', body: JSON.stringify({ name }) }),

    getVenues: (orgId: string): Promise<Venue[]> =>
        fetchWithAuth(`/admin/organizations/${orgId}/venues`),

    createVenue: (orgId: string, name: string, address?: string): Promise<Venue> =>
        fetchWithAuth('/admin/venues', { method: 'POST', body: JSON.stringify({ org_id: orgId, name, address }) }),

    getTemplates: (venueId: string): Promise<TemplateDetail[]> =>
        fetchWithAuth(`/admin/venues/${venueId}/templates`),

    createTemplate: (data: Partial<TemplateDetail>): Promise<TemplateDetail> =>
        fetchWithAuth('/admin/templates', { method: 'POST', body: JSON.stringify(data) }),

    updateTemplate: (id: string, data: Partial<TemplateDetail>): Promise<TemplateDetail> =>
        fetchWithAuth(`/admin/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    deleteTemplate: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/templates/${id}`, { method: 'DELETE' }),

    getQuestions: (templateId: string): Promise<Question[]> =>
        fetchWithAuth(`/admin/templates/${templateId}/questions`),

    createQuestion: (data: Partial<Question> & { template_id: string }): Promise<Question> =>
        fetchWithAuth('/admin/questions', { method: 'POST', body: JSON.stringify(data) }),

    updateQuestion: (id: string, data: Partial<Question>): Promise<Question> =>
        fetchWithAuth(`/admin/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    deleteQuestion: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/questions/${id}`, { method: 'DELETE' }),

    getSubmissions: (filters?: { venue_id?: string; status?: string; date_from?: string; date_to?: string }): Promise<AdminSubmission[]> => {
        const params = new URLSearchParams()
        if (filters?.venue_id) params.set('venue_id', filters.venue_id)
        if (filters?.status) params.set('status', filters.status)
        if (filters?.date_from) params.set('date_from', filters.date_from)
        if (filters?.date_to) params.set('date_to', filters.date_to)
        const qs = params.toString()
        return fetchWithAuth(`/admin/submissions${qs ? `?${qs}` : ''}`)
    },

    getCompliance: (filters?: { venue_id?: string; date_from?: string; date_to?: string }): Promise<ComplianceReport> => {
        const params = new URLSearchParams()
        if (filters?.venue_id) params.set('venue_id', filters.venue_id)
        if (filters?.date_from) params.set('date_from', filters.date_from)
        if (filters?.date_to) params.set('date_to', filters.date_to)
        const qs = params.toString()
        return fetchWithAuth(`/admin/reports/compliance${qs ? `?${qs}` : ''}`)
    },

    // Users
    getUsers: (): Promise<AdminUser[]> =>
        fetchWithAuth('/admin/users'),

    createUser: (data: { email: string; password: string; full_name: string; role: string; organization_id: string; venue_id?: string; shift_id?: string }): Promise<AdminUser> =>
        fetchWithAuth('/admin/users', { method: 'POST', body: JSON.stringify(data) }),

    updateUser: (id: string, data: { full_name?: string; role?: string; venue_id?: string; shift_id?: string }): Promise<AdminUser> =>
        fetchWithAuth(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    deleteUser: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/users/${id}`, { method: 'DELETE' }),

    changePassword: (id: string, password: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),

    // Venues
    updateVenue: (id: string, data: { name?: string; address?: string }): Promise<Venue> =>
        fetchWithAuth(`/admin/venues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    deleteVenue: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/venues/${id}`, { method: 'DELETE' }),

    // Shifts
    getShifts: (venueId: string): Promise<Shift[]> =>
        fetchWithAuth(`/admin/venues/${venueId}/shifts`),

    createShift: (data: { venue_id: string; name: string; start_time: string; end_time: string; sort_order?: number }): Promise<Shift> =>
        fetchWithAuth('/admin/shifts', { method: 'POST', body: JSON.stringify(data) }),

    updateShift: (id: string, data: { name?: string; start_time?: string; end_time?: string; sort_order?: number }): Promise<Shift> =>
        fetchWithAuth(`/admin/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    deleteShift: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/shifts/${id}`, { method: 'DELETE' }),
}

// Public venue shifts (for staff)
export function getVenueShifts(venueId: string): Promise<Shift[]> {
    return fetchWithAuth(`/venues/${venueId}/shifts`)
}

export interface AdminUser {
    id: string
    email: string | null
    full_name: string
    role: string
    organization_id: string
    venue_id: string | null
    shift_id: string | null
}

export interface Shift {
    id: string
    venue_id: string
    name: string
    start_time: string
    end_time: string
    sort_order: number
}
