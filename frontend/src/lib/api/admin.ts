import { fetchWithAuth } from './core'

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
    config: Record<string, unknown> | null
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
    shifts?: { name: string } | null
    venues?: { name: string } | null
}

export interface AdminSummary {
    active_staff: number
    pending_tickets: number
    critical_failures: number
    pending_absences: number
    today: {
        submissions: number
        attendance_rate: number
    }
}

export const adminApi = {
    getOrganizations: (): Promise<Organization[]> =>
        fetchWithAuth('/admin/organizations'),

    createOrganization: (name: string): Promise<Organization> =>
        fetchWithAuth('/admin/organizations', { method: 'POST', body: JSON.stringify({ name }) }),

    getVenues: (orgId: string): Promise<Venue[]> =>
        fetchWithAuth(`/admin/organizations/${orgId}/venues`),

    createVenue: (orgId: string, name: string, address?: string): Promise<Venue> =>
        fetchWithAuth('/admin/venues', { method: 'POST', body: JSON.stringify({ org_id: orgId, name, address }) }),

    updateVenue: (id: string, data: { name?: string; address?: string }): Promise<Venue> =>
        fetchWithAuth(`/admin/venues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    deleteVenue: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/venues/${id}`, { method: 'DELETE' }),

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

    reorderQuestions: (templateId: string, questions: { id: string, sort_order: number }[]): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/templates/${templateId}/questions/reorder`, { method: 'PUT', body: JSON.stringify({ questions }) }),

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

    getAdminSummary: (venueId?: string): Promise<AdminSummary> =>
        fetchWithAuth(`/admin/summary${venueId ? `?venue_id=${venueId}` : ''}`),
}
