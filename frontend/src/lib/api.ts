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

export interface Asset {
    id: string
    name: string
    venue_id: string
    category_id: string
    status: string
    qr_code: string
    serial?: string | null
    brand?: string | null
    model?: string | null
    asset_categories?: { name: string }
}

export interface CountSchedule {
    id: string
    org_id: string
    venue_id: string
    assigned_to: string | null
    name: string
    frequency: string
    scope: string
    category_id: string | null
    next_due: string
    last_completed_at: string | null
    is_active: boolean
    created_at: string
    item_ids?: string[]
    venues?: { name: string }
    profiles?: { full_name: string }
}

export interface RepairTicket {
    id: string;
    asset_id: string;
    title: string;
    issue_description: string | null;
    status: string;
    opened_at: string;
    closed_at: string | null;
    assets?: {
        name: string;
    };
}

export interface UtensilCount {
    id: string;
    org_id: string;
    venue_id: string;
    profile_id: string;
    status: 'pending' | 'confirmed';
    created_at: string;
    confirmed_at: string | null;
    profiles?: {
        full_name: string;
    };
}

export interface InventoryDashboardSummary {
    asset_stats: {
        total: number;
        operativo: number;
        en_reparacion: number;
        baja: number;
    };
    active_tickets: RepairTicket[];
    pending_counts: AttendanceLog[];
    due_schedules: CountSchedule[];
}

// Employee Shifts
export interface EmployeeShiftDay {
    id: string;
    weekday: number;
    start_time: string | null;
    end_time: string | null;
    day_off: boolean;
}

export interface EmployeeShift {
    id: string;
    profile_id: string;
    venue_id: string;
    modality: 'fixed' | 'rotating' | 'flexible';
    weekdays: number[] | null;
    start_time: string | null;
    end_time: string | null;
    is_active: boolean;
    shift_days?: EmployeeShiftDay[];
}

export interface AttendanceLog {
    id: string;
    profile_id: string;
    venue_id: string;
    event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
    marked_at: string;
    minutes_late?: number;
    overtime_hours?: number;
    profiles?: {
        full_name: string;
    };
}

export interface AttendanceStatus {
    last_event: string | null;
    last_marked_at: string | null;
    available_actions: string[];
    has_active_shift?: boolean;
}

// Attendance API
export const attendanceApi = {
    getStatus: (): Promise<AttendanceStatus> => fetchWithAuth('/attendance/today/status'),
    mark: (event_type: string, data: Record<string, unknown> = {}): Promise<AttendanceLog> => fetchWithAuth('/attendance/mark', { method: 'POST', body: JSON.stringify({ event_type, ...data }) }),
    getLive: (venueId: string): Promise<AttendanceLog[]> => fetchWithAuth(`/attendance/live?venue_id=${venueId}`),
    getHistory: (): Promise<AttendanceLog[]> => fetchWithAuth('/attendance/me'),
};

// Admin CRUD
export const adminApi = {

    getAttendanceReport: (venueId: string, from: string, to: string, profileId?: string): Promise<any[]> => {
        let url = `/attendance/report?venue_id=${venueId}&date_from=${from}&date_to=${to}`;
        if (profileId) url += `&profile_id=${profileId}`;
        return fetchWithAuth(url);
    },
    exportAttendanceCSV: (venueId: string, type: string, from: string, to: string, profileId?: string) => {
        let url = `${API_URL}/attendance/export?venue_id=${venueId}&report_type=${type}&date_from=${from}&date_to=${to}`;
        if (profileId) url += `&profile_id=${profileId}`;
        return url;
    },

    getEmployeeShifts: (venueId?: string): Promise<EmployeeShift[]> =>
        fetchWithAuth(`/employee-shifts${venueId ? `?venue_id=${venueId}` : ''}`),
        
    createEmployeeShift: (data: Record<string, unknown>): Promise<EmployeeShift> =>
        fetchWithAuth('/employee-shifts', { method: 'POST', body: JSON.stringify(data) }),

    updateEmployeeShift: (id: string, data: Record<string, unknown>): Promise<EmployeeShift> =>
        fetchWithAuth(`/employee-shifts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    updateEmployeeShiftDays: (id: string, data: { weekday: number; start_time?: string | null; end_time?: string | null; day_off: boolean }): Promise<Record<string, unknown>> =>
        fetchWithAuth(`/employee-shifts/${id}/days`, { method: 'POST', body: JSON.stringify(data) }),

    getAdminSummary: (venueId?: string): Promise<Record<string, any>> =>
        fetchWithAuth(`/admin/summary${venueId ? `?venue_id=${venueId}` : ''}`),

    // Inventory Dashboard
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

    getRoles: (orgId: string): Promise<{ id: string; name: string }[]> =>
        fetchWithAuth(`/roles?org_id=${orgId}`),

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

    createAsset: (data: { org_id: string; venue_id: string; category_id: string; name: string; serial?: string; brand?: string; model?: string }): Promise<Asset> =>
        fetchWithAuth('/assets', { method: 'POST', body: JSON.stringify(data) }),

    updateAsset: (id: string, data: Partial<Asset>): Promise<Asset> =>
        fetchWithAuth(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    // Utensils
    getUtensilCategories: (orgId: string): Promise<UtensilCategory[]> =>
        fetchWithAuth(`/utensil-categories?org_id=${orgId}`),

    createUtensilCategory: (data: { org_id: string; name: string; description?: string }): Promise<UtensilCategory> =>
        fetchWithAuth('/utensil-categories', { method: 'POST', body: JSON.stringify(data) }),

    updateUtensilCategory: (id: string, data: Partial<UtensilCategory>): Promise<UtensilCategory> =>
        fetchWithAuth(`/utensil-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    getUtensils: (filters?: { org_id?: string; category_id?: string; include_archived?: boolean }): Promise<Utensil[]> => {
        const params = new URLSearchParams()
        if (filters?.org_id) params.set('org_id', filters.org_id)
        if (filters?.category_id) params.set('category_id', filters.category_id)
        if (filters?.include_archived) params.set('include_archived', 'true')
        const qs = params.toString()
        return fetchWithAuth(`/utensils${qs ? `?${qs}` : ''}`)
    },

    createUtensil: (data: { org_id: string; category_id: string; name: string; unit?: string; min_stock?: number }): Promise<Utensil> =>
        fetchWithAuth('/utensils', { method: 'POST', body: JSON.stringify(data) }),

    updateUtensil: (id: string, data: Partial<Utensil>): Promise<Utensil> =>
        fetchWithAuth(`/utensils/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    recordUtensilMovement: (data: { 
        utensil_id: string; 
        type: 'entry' | 'exit' | 'transfer' | 'adjustment'; 
        quantity: number; 
        from_venue_id?: string; 
        to_venue_id?: string; 
        notes?: string 
    }): Promise<any> =>
        fetchWithAuth('/utensil-movements', { method: 'POST', body: JSON.stringify(data) }),

    createUtensilCount: (data: {
        venue_id: string;
        items: Array<{ utensil_id: string; count: number }>;
        schedule_id?: string;
    }): Promise<{ id: string; status: string }> =>
        fetchWithAuth('/utensil-counts', { method: 'POST', body: JSON.stringify(data) }),

    getUtensilsCounts: (venueId?: string): Promise<UtensilCount[]> =>
        fetchWithAuth(`/utensil-counts${venueId ? `?venue_id=${venueId}` : ''}`),

    getUtensilCountDetail: (countId: string): Promise<UtensilCount & { items: any[] }> =>
        fetchWithAuth(`/utensil-counts/${countId}`),

    confirmUtensilCount: (countId: string, items: Array<{ utensil_id: string; confirmed_count: number }>): Promise<any> =>
        fetchWithAuth(`/utensil-counts/${countId}/confirm`, { method: 'PATCH', body: JSON.stringify({ items }) }),

    // Count Schedules
    getSchedules: (venueId?: string): Promise<CountSchedule[]> =>
        fetchWithAuth(`/count-schedules${venueId ? `?venue_id=${venueId}` : ''}`),

    createSchedule: (data: any): Promise<CountSchedule> =>
        fetchWithAuth('/count-schedules', { method: 'POST', body: JSON.stringify(data) }),

    updateSchedule: (id: string, data: any): Promise<any> =>
        fetchWithAuth(`/count-schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    // Inventory Dashboard
    getInventoryDashboard: (venueId?: string): Promise<InventoryDashboardSummary> =>
        fetchWithAuth(`/inventory/dashboard/summary${venueId ? `?venue_id=${venueId}` : ''}`),
}

export function getDueSchedules(venueId: string): Promise<CountSchedule[]> {
    return fetchWithAuth(`/count-schedules/due?venue_id=${venueId}`)
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

export interface UtensilCategory {
    id: string
    org_id: string
    name: string
    description?: string | null
}

export interface Utensil {
    id: string
    org_id: string
    category_id: string | null
    name: string
    unit: string
    min_stock: number
    is_active: boolean
    created_at: string
    utensil_categories?: { name: string }
}
