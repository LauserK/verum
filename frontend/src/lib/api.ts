import { createClient } from '@/utils/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

declare global {
    interface Window {
        __attendanceRequiredPending?: boolean
    }
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
                // Also set a flag in case the Guard hasn't mounted yet
                window.__attendanceRequiredPending = true
            }
        }

        // If errorDetail is an object or array (like Pydantic validation errors), stringify it or pick a message
        if (typeof errorDetail === 'object' && errorDetail !== null) {
            errorDetail = JSON.stringify(errorDetail)
        }

        throw new Error(errorDetail || `API Error: ${res.status}`)
    }

    return res.json() as Promise<T>
}


// ── API Functions ───────────────────────────────────

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

export interface Profile {
    id: string
    full_name: string
    role: string
    is_superadmin?: boolean
    organizations: OrgInfo[]
    // Keep legacy for now
    venues: VenueInfo[]
    organization_id?: string
    venue_id?: string
    shift_id?: string
    shift_name?: string
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


// ── Milestone 3: Submissions ────────────────────────

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

export interface AttendanceRecord {
    work_date: string
    profile_id: string
    venue_id: string
    clock_in: string | null
    clock_out: string | null
    net_hours: number | null
    overtime_hours: number | null
    minutes_late: number | null
    absence_type: string | null
}

export interface AttendanceStatus {
    last_event: string | null;
    last_marked_at: string | null;
    available_actions: string[];
    has_active_shift?: boolean;
    locked_to_venue?: string | null;
    effective_venue_id?: string | null;
}

export interface LeaveRequest {
    id: string
    profile_id: string
    venue_id: string
    date: string
    type: string
    reason?: string
    status: 'pending' | 'approved' | 'rejected'
    admin_comment?: string
    profiles?: { full_name: string }
    venues?: { name: string }
    reviewer?: { full_name: string }
}

// Attendance API
export const attendanceApi = {
    getStatus: (venueId?: string): Promise<AttendanceStatus> => 
        fetchWithAuth<AttendanceStatus>(`/attendance/today/status${venueId ? `?venue_id=${venueId}` : ''}`),
    mark: (event_type: string, data: Record<string, unknown> = {}): Promise<AttendanceLog> => fetchWithAuth<AttendanceLog>('/attendance/mark', { method: 'POST', body: JSON.stringify({ event_type, ...data }) }),
    getLive: (venueId: string): Promise<AttendanceLog[]> => fetchWithAuth<AttendanceLog[]>(`/attendance/live?venue_id=${venueId}`),
    getHistory: (): Promise<AttendanceRecord[]> => fetchWithAuth<AttendanceRecord[]>('/attendance/me'),
    
    // Leave Requests
    requestLeave: (data: { date: string; type: string; reason?: string }): Promise<unknown> => 
        fetchWithAuth('/attendance/requests', { method: 'POST', body: JSON.stringify(data) }),
    getOwnRequests: (): Promise<LeaveRequest[]> => fetchWithAuth<LeaveRequest[]>('/attendance/requests/me'),
    manualEntry: (data: {
        profile_id: string
        venue_id: string
        clock_in: string
        clock_out: string
        reason: string
    }) => fetchWithAuth('/admin/attendance/manual', {
        method: 'POST',
        body: JSON.stringify(data)
    })
};

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

// Admin CRUD
export const adminApi = {
    // Leave Requests Admin
    getPendingRequests: (venueId?: string): Promise<LeaveRequest[]> => 
        fetchWithAuth<LeaveRequest[]>(`/admin/attendance/requests${venueId ? `?venue_id=${venueId}` : ''}`),
    getAllAbsences: (venueId?: string): Promise<LeaveRequest[]> => 
        fetchWithAuth<LeaveRequest[]>(`/admin/attendance/absences${venueId ? `?venue_id=${venueId}` : ''}`),
    reviewRequest: (id: string, data: { status: 'approved' | 'rejected'; admin_comment?: string }): Promise<unknown> => 
        fetchWithAuth(`/admin/attendance/requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    createAbsence: (data: { profile_id: string; venue_id: string; date: string; type: string; reason?: string }): Promise<unknown> =>
        fetchWithAuth('/attendance/absences', { method: 'POST', body: JSON.stringify(data) }),

    getAttendanceReport: (venueId: string, from: string, to: string, profileId?: string): Promise<unknown[]> => {
        let url = `/attendance/report?venue_id=${venueId}&date_from=${from}&date_to=${to}`;
        if (profileId) url += `&profile_id=${profileId}`;
        return fetchWithAuth<unknown[]>(url);
    },
    exportAttendanceCSV: (venueId: string, type: string, from: string, to: string, profileId?: string) => {
        let url = `${API_URL}/attendance/export?venue_id=${venueId}&report_type=${type}&date_from=${from}&date_to=${to}`;
        if (profileId) url += `&profile_id=${profileId}`;
        return url;
    },

    getEmployeeShifts: (venueId?: string): Promise<EmployeeShift[]> =>
        fetchWithAuth<EmployeeShift[]>(`/employee-shifts${venueId ? `?venue_id=${venueId}` : ''}`),

    createEmployeeShift: (data: Record<string, unknown>): Promise<EmployeeShift> =>
        fetchWithAuth<EmployeeShift>('/employee-shifts', { method: 'POST', body: JSON.stringify(data) }),

    updateEmployeeShift: (id: string, data: Record<string, unknown>): Promise<EmployeeShift> =>
        fetchWithAuth<EmployeeShift>(`/employee-shifts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    updateEmployeeShiftDays: (id: string, data: { weekday: number; start_time?: string | null; end_time?: string | null; day_off: boolean }): Promise<Record<string, unknown>> =>
        fetchWithAuth<Record<string, unknown>>(`/employee-shifts/${id}/days`, { method: 'POST', body: JSON.stringify(data) }),

    getAdminSummary: (venueId?: string): Promise<AdminSummary> =>
        fetchWithAuth<AdminSummary>(`/admin/summary${venueId ? `?venue_id=${venueId}` : ''}`),
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

    // Users
    getUsers: (): Promise<AdminUser[]> =>
        fetchWithAuth('/admin/users'),

    createUser: (data: { email: string; password: string; full_name: string; role: string; organization_id: string; venue_id?: string; venue_ids?: string[]; shift_id?: string }): Promise<AdminUser> =>
        fetchWithAuth('/admin/users', { method: 'POST', body: JSON.stringify(data) }),

    updateUser: (id: string, data: { full_name?: string; role?: string; venue_id?: string; venue_ids?: string[]; shift_id?: string }): Promise<AdminUser> =>
        fetchWithAuth(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    deleteUser: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/users/${id}`, { method: 'DELETE' }),

    changePassword: (id: string, password: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),

    getRoles: (orgId: string): Promise<{ id: string; name: string }[]> =>
        fetchWithAuth(`/roles?org_id=${orgId}`),

    getProfile: (): Promise<any> =>
        fetchWithAuth('/me'),

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
    }): Promise<unknown> =>
        fetchWithAuth('/utensil-movements', { method: 'POST', body: JSON.stringify(data) }),

    createUtensilCount: (data: {
        venue_id: string;
        items: Array<{ utensil_id: string; count: number }>;
        schedule_id?: string;
    }): Promise<{ id: string; status: string }> =>
        fetchWithAuth('/utensil-counts', { method: 'POST', body: JSON.stringify(data) }),

    getUtensilsCounts: (venueId?: string): Promise<UtensilCount[]> =>
        fetchWithAuth(`/utensil-counts${venueId ? `?venue_id=${venueId}` : ''}`),

    getUtensilCountDetail: (countId: string): Promise<UtensilCount & { items: unknown[] }> =>
        fetchWithAuth(`/utensil-counts/${countId}`),

    confirmUtensilCount: (countId: string, items: Array<{ utensil_id: string; confirmed_count: number }>): Promise<unknown> =>
        fetchWithAuth(`/utensil-counts/${countId}/confirm`, { method: 'PATCH', body: JSON.stringify({ items }) }),

    // Count Schedules
    getSchedules: (venueId?: string): Promise<CountSchedule[]> =>
        fetchWithAuth(`/count-schedules${venueId ? `?venue_id=${venueId}` : ''}`),

    createSchedule: (data: Record<string, unknown>): Promise<CountSchedule> =>
        fetchWithAuth('/count-schedules', { method: 'POST', body: JSON.stringify(data) }),

    updateSchedule: (id: string, data: Record<string, unknown>): Promise<unknown> =>
        fetchWithAuth(`/count-schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    // Inventory Dashboard
    getInventoryDashboard: (venueId?: string): Promise<InventoryDashboardSummary> =>
        fetchWithAuth(`/inventory/dashboard/summary${venueId ? `?venue_id=${venueId}` : ''}`),

    editAttendanceDay: async (payload: { profile_id: string, venue_id: string, work_date: string, clock_in?: string, clock_out?: string, reason: string }) => {
        return await fetchWithAuth('/admin/attendance/edit-day', {
            method: 'POST',
            body: JSON.stringify(payload)
        })
    },
    // M16: Production & Inventory
    getInventoryItems: (): Promise<InventoryItem[]> =>
        fetchWithAuth('/inventory/items'),

    createInventoryItem: (data: Partial<InventoryItem>): Promise<InventoryItem> =>
        fetchWithAuth('/inventory/items', { method: 'POST', body: JSON.stringify(data) }),

    getInventoryWarehouses: (): Promise<Warehouse[]> =>
        fetchWithAuth('/inventory/warehouses'),

    createInventoryWarehouse: (data: Partial<Warehouse>): Promise<Warehouse> =>
        fetchWithAuth('/inventory/warehouses', { method: 'POST', body: JSON.stringify(data) }),

    updateInventoryWarehouse: (id: string, data: Partial<Warehouse>): Promise<Warehouse> =>
        fetchWithAuth(`/inventory/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    getUOMBase: (): Promise<UOMBase[]> =>
        fetchWithAuth('/inventory/uom-base'),

    getKardex: (filters?: { item_id?: string; warehouse_id?: string; start_date?: string; end_date?: string; movement_type?: string }): Promise<StockMovement[]> => {
        const params = new URLSearchParams()
        if (filters?.item_id) params.set('item_id', filters.item_id)
        if (filters?.warehouse_id) params.set('warehouse_id', filters.warehouse_id)
        if (filters?.start_date) params.set('start_date', filters.start_date)
        if (filters?.end_date) params.set('end_date', filters.end_date)
        if (filters?.movement_type) params.set('movement_type', filters.movement_type)
        const qs = params.toString()
        return fetchWithAuth(`/inventory/kardex${qs ? `?${qs}` : ''}`)
    },

    getInventorySnapshot: (date: string, warehouse_id?: string): Promise<StockSnapshotResponse> => {
        const params = new URLSearchParams({ date })
        if (warehouse_id) params.set('warehouse_id', warehouse_id)
        return fetchWithAuth(`/inventory/snapshot?${params.toString()}`)
    },

    getInventoryValuation: (warehouse_id?: string): Promise<StockValuationResponse> => {
        const params = new URLSearchParams()
        if (warehouse_id) params.set('warehouse_id', warehouse_id)
        const qs = params.toString()
        return fetchWithAuth(`/inventory/valuation${qs ? `?${qs}` : ''}`)
    },

    createPurchaseReceipt: (data: Partial<PurchaseReceipt>): Promise<PurchaseReceipt> =>
        fetchWithAuth('/inventory/purchase-receipts', { method: 'POST', body: JSON.stringify(data) }),

    getPurchaseReceipts: (): Promise<any[]> =>
        fetchWithAuth('/inventory/purchase-receipts'),

    getIssueDocuments: (): Promise<any[]> =>
        fetchWithAuth('/inventory/issue-documents'),

    createIssueDocument: (data: Partial<IssueDocument>): Promise<IssueDocument> =>
        fetchWithAuth('/inventory/issue-documents', { method: 'POST', body: JSON.stringify(data) }),

    getPurchaseReceipt: (id: string): Promise<{ header: any; lines: any[] }> =>
        fetchWithAuth(`/inventory/purchase-receipts/${id}`),

    getIssueDocument: (id: string): Promise<{ header: any; lines: any[] }> =>
        fetchWithAuth(`/inventory/issue-documents/${id}`),

    createTransfer: (data: any): Promise<any> =>
        fetchWithAuth('/inventory/transfers', { method: 'POST', body: JSON.stringify(data) }),

    confirmTransfer: (id: string, data: any): Promise<any> =>
        fetchWithAuth(`/inventory/transfers/${id}/confirm`, { method: 'PATCH', body: JSON.stringify(data) }),

    getPendingTransfers: (warehouseId?: string): Promise<any[]> => {
        const url = warehouseId ? `/inventory/transfers/pending?warehouse_id=${warehouseId}` : '/inventory/transfers/pending';
        return fetchWithAuth(url);
    },

    getTransfers: (): Promise<any[]> =>
        fetchWithAuth('/inventory/transfers'),

    getTransferDetail: (id: string): Promise<any> =>
        fetchWithAuth(`/inventory/transfers/${id}`),

    getMovementsByReference: (referenceId: string): Promise<StockMovement[]> =>
        fetchWithAuth(`/inventory/movements/reference/${referenceId}`),

    getItemCategories: (): Promise<ItemCategory[]> =>
        fetchWithAuth('/inventory/item-categories'),

    createItemCategory: (data: Partial<ItemCategory>): Promise<ItemCategory> =>
        fetchWithAuth('/inventory/item-categories', { method: 'POST', body: JSON.stringify(data) }),

    deleteItemCategory: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/item-categories/${id}`, { method: 'DELETE' }),

    updateInventoryItem: (id: string, data: Partial<InventoryItem>): Promise<InventoryItem> =>
        fetchWithAuth(`/inventory/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    deleteInventoryItem: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/items/${id}`, { method: 'DELETE' }),

    getInventoryItem: (id: string): Promise<InventoryItem> =>
        fetchWithAuth(`/inventory/items/${id}`),

    getItemStock: (itemId: string): Promise<any[]> =>
        fetchWithAuth(`/inventory/items/${itemId}/stock`),

    associateWarehouseToItem: (itemId: string, warehouseId: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/items/${itemId}/stock`, { method: 'POST', body: JSON.stringify({ warehouse_id: warehouseId }) }),

    getUOMPresentations: (): Promise<UOMPresentation[]> =>
        fetchWithAuth('/inventory/uom-presentations'),

    createUOMPresentation: (data: Partial<UOMPresentation>): Promise<UOMPresentation> =>
        fetchWithAuth('/inventory/uom-presentations', { method: 'POST', body: JSON.stringify(data) }),

    deleteUOMPresentation: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/uom-presentations/${id}`, { method: 'DELETE' }),

    getItemPresentations: (itemId: string): Promise<UOMPresentation[]> =>
        fetchWithAuth(`/inventory/items/${itemId}/presentations`),

    enableItemPresentation: (itemId: string, presId: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/items/${itemId}/presentations/${presId}`, { method: 'POST' }),

    disableItemPresentation: (itemId: string, presId: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/inventory/items/${itemId}/presentations/${presId}`, { method: 'DELETE' }),

    updateItemCategory: (id: string, data: Partial<ItemCategory>): Promise<ItemCategory> =>
        fetchWithAuth(`/inventory/item-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    // M19: Recipes & Production
    // M39: Physical Inventory Count API Client
    getPhysicalInventories: (): Promise<any[]> => 
        fetchWithAuth('/inventory/physical-inventories'),

    getPhysicalInventoryDetail: (id: string): Promise<any> => 
        fetchWithAuth(`/inventory/physical-inventories/${id}`),

    createPhysicalInventory: (data: any): Promise<any> => 
        fetchWithAuth('/inventory/physical-inventories', { method: 'POST', body: JSON.stringify(data) }),

    updatePhysicalInventory: (id: string, data: any): Promise<any> => 
        fetchWithAuth(`/inventory/physical-inventories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    processPhysicalInventory: (id: string): Promise<any> => 
        fetchWithAuth(`/inventory/physical-inventories/${id}/process`, { method: 'POST' }),

    getRecipes: (): Promise<RecipeBriefResponse[]> => fetchWithAuth('/production/recipes'),
    getRecipe: (itemId: string): Promise<RecipeResponse> => fetchWithAuth(`/production/recipes/${itemId}`),


    saveRecipe: (data: RecipeCreate): Promise<RecipeResponse> =>
        fetchWithAuth('/production/recipes', { method: 'POST', body: JSON.stringify(data) }),

    calculateProductionNeeds: (data: CalculateProductionNeedsRequest): Promise<ProductionNeedsResponse> =>
        fetchWithAuth('/production/calculate-needs', { method: 'POST', body: JSON.stringify(data) }),

    createProductionOrder: (data: ProductionOrderCreate): Promise<ProductionOrderResponse> =>
        fetchWithAuth('/production/orders', { method: 'POST', body: JSON.stringify(data) }),

    getKDSOrders: (warehouseId: string): Promise<any[]> =>
        fetchWithAuth(`/production/orders/kds?warehouse_id=${warehouseId}`),

    getProductionOrders: (): Promise<any[]> =>
        fetchWithAuth('/production/orders'),

    getProductionOrderDetail: (id: string): Promise<ProductionOrderDetailResponse> =>
        fetchWithAuth(`/production/orders/${id}`),

    markLotPrinted: (lotId: string): Promise<any> =>
        fetchWithAuth(`/production/lots/${lotId}/printed`, { method: 'PATCH' }),

    resolveLotNumber: (lotNumber: string): Promise<any> =>
        fetchWithAuth(`/inventory/lots/resolve/${encodeURIComponent(lotNumber)}`),

    updateOrderStatus: (id: string, status: string): Promise<any> =>
        fetchWithAuth(`/production/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

    completeProductionOrder: (id: string, data: OrderCompleteRequest): Promise<any> =>
        fetchWithAuth(`/production/orders/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),

    // Catering & MRP
    getCateringRequests: (): Promise<CateringRequest[]> =>
        fetchWithAuth('/production/catering'),

    getCateringRequest: (id: string): Promise<CateringRequest> =>
        fetchWithAuth(`/production/catering/${id}`),

    createCateringRequest: (data: any): Promise<CateringRequest> =>
        fetchWithAuth('/production/catering', { method: 'POST', body: JSON.stringify(data) }),

    updateCateringRequest: (id: string, data: any): Promise<any> =>
        fetchWithAuth(`/production/catering/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    generateMRPPlan: (reqId: string, warehouseId: string): Promise<MRPResultResponse> =>
        fetchWithAuth(`/production/catering/${reqId}/plan`, {
            method: 'POST',
            body: JSON.stringify({ warehouse_id: warehouseId })
        }),

    generateMRPOrders: (reqId: string, data: { warehouse_id: string, target_warehouse_id: string, scheduled_date: string }): Promise<any> =>
        fetchWithAuth(`/production/catering/${reqId}/generate-orders`, {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    bulkAdjustStock: (warehouseId: string, adjustments: StockAdjustItem[]): Promise<BulkStockAdjustResponse> =>
        fetchWithAuth('/inventory/bulk-adjust-stock', {
            method: 'POST',
            body: JSON.stringify({ warehouse_id: warehouseId, adjustments })
        }),
}

// ── Production Types (M20) ─────────────────────────

export interface OrderCompleteRequest {
    qty_produced_base: number
    ignore_variance?: boolean
    consumptions?: Array<{
        item_id: string
        qty_actual_base: number
    }>
}

// ── Recipe Types (M19) ─────────────────────────────

export interface RecipeBriefResponse {
    id: string
    item_id: string
    item_name: string
    item_code: string | null
    item_type: string
    yield_qty_base: number
    created_at: string
}

export interface RecipeIngredient {
    item_id: string
    qty_base: number
    presentation_id: string | null
    order_index: number
    notes?: string
    // UI helpful fields
    item_name?: string
    presentation_name?: string
}

export interface RecipeStep {
    order_index: number
    description: string
    estimated_time_minutes: number
}

export interface RecipeCreate {
    item_id: string
    yield_qty_base: number
    yield_presentation_id: string | null
    ingredients: RecipeIngredient[]
    steps: RecipeStep[]
}

export interface RecipeResponse {
    id: string
    item_id: string
    yield_qty_base: number
    yield_presentation_id: string | null
    ingredients: any[]
    steps: any[]
    is_active: boolean
    created_at: string
}

export interface CalculateProductionNeedsRequest {
    item_id: string
    target_qty: number
    target_uom_id: string | null
    warehouse_id: string
}

export interface IngredientDeficit {
    item_id: string
    item_name: string
    uom_name: string
    needed_base_qty: number
    available_base_qty: number
    deficit_base_qty: number
}

export interface ProductionNeedsResponse {
    status: 'OK' | 'DEFICIT'
    ingredients: Array<{
        item_id: string
        item_name: string
        uom_name: string
        needed_base_qty: number
        available_base_qty: number
        deficit_base_qty: number
    }>
    deficits: IngredientDeficit[]
}

export interface ProductionOrderCreate {
    item_id: string
    warehouse_id: string
    qty_ordered_base: number
    presentation_id: string | null
    scheduled_date: string
    priority: string
}

export interface ProductionOrderResponse {
    id: string
    order_number: string
    item_id: string
    recipe_id: string
    warehouse_id: string
    qty_ordered_base: number
    presentation_id: string | null
    status: string
    priority: string
    scheduled_date?: string
    created_at: string
    items?: { 
        name: string, 
        uom_base: { name: string },
        yield_alert_enabled?: boolean,
        yield_alert_threshold_pct?: number,
        shelf_life_days?: number
    }
    warehouses?: { name: string }
    uom_presentations?: { name: string, conversion_factor: number }
}

export interface ProductionOrderDetailResponse extends ProductionOrderResponse {
    started_at?: string
    completed_at?: string
    qty_produced_base?: number
    yield_alert_triggered: boolean
    yield_variance_pct?: number
    notes?: string
    created_by_profile?: { full_name: string }
    assigned_to_profile?: { full_name: string }
    origin_warehouse?: { name: string }
    target_warehouse?: { name: string }
    consumptions: Array<{
        item_id: string
        qty_planned_base: number
        qty_actual_base: number
        items: { name: string, uom_base: { name: string } }
    }>
    produced_lots: Array<{
        id: string
        lot_number: string
        qty_base: number
    }>
}

// Super Admin CRUD
export interface SuperAdminUserOrg {
    id: string
    name: string
    role_id: string | null
    role_name: string
    venues: VenueInfo[]
}

export interface SuperAdminUserDetail {
    id: string
    full_name: string | null
    email: string | null
    role: string
    is_superadmin: boolean
    organizations: SuperAdminUserOrg[]
}

export interface SuperAdminUserInOrg {
    id: string
    full_name: string | null
    role_name: string
}

export interface SuperAdminOrgDetail {
    id: string
    name: string
    is_active: boolean
    venues: Venue[]
    users: SuperAdminUserInOrg[]
}

export const superAdminApi = {
    getOrganizations: (): Promise<any[]> => fetchWithAuth('/super-admin/organizations'),
    getOrgDetail: (id: string): Promise<SuperAdminOrgDetail> => fetchWithAuth(`/super-admin/organizations/${id}`),
    updateOrganization: (id: string, data: any): Promise<any> => 
        fetchWithAuth(`/super-admin/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    createOrganization: (name: string): Promise<any> =>
        fetchWithAuth('/super-admin/organizations', { method: 'POST', body: JSON.stringify({ name }) }),
    
    createOrgVenue: (orgId: string, data: { name: string, address?: string }): Promise<any> =>
        fetchWithAuth(`/super-admin/organizations/${orgId}/venues`, { method: 'POST', body: JSON.stringify(data) }),
    updateOrgVenue: (venueId: string, data: { name?: string, address?: string }): Promise<any> =>
        fetchWithAuth(`/super-admin/venues/${venueId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteOrgVenue: (venueId: string): Promise<any> =>
        fetchWithAuth(`/super-admin/venues/${venueId}`, { method: 'DELETE' }),

    getUsers: (): Promise<any[]> => fetchWithAuth('/super-admin/users'),
    getUserDetail: (id: string): Promise<SuperAdminUserDetail> => fetchWithAuth(`/super-admin/users/${id}`),
    addUserOrg: (userId: string, data: { organization_id: string, role_name?: string, venue_ids?: string[] }): Promise<any> =>
        fetchWithAuth(`/super-admin/users/${userId}/organizations`, { method: 'POST', body: JSON.stringify(data) }),
    updateUserOrg: (userId: string, orgId: string, data: { role_name?: string, venue_ids?: string[] }): Promise<any> =>
        fetchWithAuth(`/super-admin/users/${userId}/organizations/${orgId}`, { method: 'PUT', body: JSON.stringify(data) }),
    removeUserOrg: (userId: string, orgId: string): Promise<any> =>
        fetchWithAuth(`/super-admin/users/${userId}/organizations/${orgId}`, { method: 'DELETE' }),
    
    promoteUser: (userId: string, isSuper: boolean): Promise<any> =>
        fetchWithAuth(`/super-admin/users/${userId}/super-admin`, { method: 'PATCH', body: JSON.stringify({ is_superadmin: isSuper }) }),
        
    getMetrics: (): Promise<any> => fetchWithAuth('/super-admin/metrics'),
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
    venue_ids?: string[]
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

export interface UOMBase {
    id: string
    code: string
    name: string
}

export interface UOMPresentation {
    id: string
    org_id: string
    name: string
    base_uom_id: string
    conversion_factor: number
    is_default: boolean
}

export interface ItemCategory {
    id: string
    org_id: string
    name: string
    description: string | null
    is_active: boolean
}

export interface InventoryItem {
    id: string
    org_id: string
    code: string | null
    name: string
    type: 'raw_material' | 'semi_finished' | 'finished' | 'packaging' | 'supply'
    category_id: string | null
    base_uom_id: string
    uom_name?: string
    last_purchase_cost: number | null
    last_purchase_cost_updated_at: string | null
    is_active: boolean
    created_at: string
    yield_alert_enabled?: boolean
    yield_alert_threshold_pct?: number | null
}

export interface Warehouse {
    id: string
    org_id: string
    venue_id: string | null
    name: string
    type: 'production' | 'storage' | 'point_of_sale' | 'transit'
    is_active: boolean
}

export interface StockMovement {
    id: string
    movement_type: string
    warehouse_id: string
    item_id: string
    qty_base: number
    unit_cost_base: number | null
    total_cost: number | null
    reference_id: string | null
    reference_type: string | null
    notes: string | null
    created_at: string
}

export interface PurchaseReceiptLine {
    item_id: string
    qty_presentation: number
    presentation_id: string | null
    unit_cost_presentation: number
    expiry_date?: string
    lot_number?: string
}

export interface PurchaseReceipt {
    id: string
    warehouse_id: string
    supplier: string | null
    receipt_number: string | null
    date?: string
    status: string
    lines: PurchaseReceiptLine[]
    created_at: string
}

export interface IssueDocument {
    id: string
    warehouse_id: string
    reason: string
    notes: string | null
    status: string
    lines: Array<{
        item_id: string
        qty_presentation: number
        presentation_id: string | null
    }>
    created_at: string
}

// ── Catering & MRP (M22) ─────────────────────────────

export interface CateringRequestLine {
    item_id: string
    qty_base: number
    presentation_id?: string | null
    qty_presentation?: number | null
    items?: { name: string, uom_base: { name: string } }
    item_name?: string
    uom_name?: string
}

export interface CateringRequest {
    id: string
    name: string
    event_date: string | null
    status: 'planning' | 'confirmed' | 'cancelled'
    notes: string | null
    tentative_production_date: string | null
    buffer_percentage: number | null
    created_at: string
    lines?: CateringRequestLine[]
}

export interface MRPProductionPlan {
    item_id: string
    item_name: string
    uom_name: string
    qty_to_produce: number
    recipe_id: string
}

export interface MRPPurchaseList {
    item_id: string
    item_name: string
    uom_name: string
    qty_needed: number
    qty_available: number
    qty_deficit: number
}

export interface MRPResultResponse {
    production_plan: MRPProductionPlan[]
    purchase_list: MRPPurchaseList[]
}

export interface StockSnapshotItem {
    item_id: string
    item_name: string
    item_code: string | null
    uom_name: string | null
    warehouse_id: string
    warehouse_name: string
    qty_on_hand: number
    valuation: number
}

export interface StockSnapshotResponse {
    date: string
    items: StockSnapshotItem[]
    total_valuation: number
}

export interface StockValuationLotDetail {
    lot_id: string
    lot_number: string | null
    qty_base: number
    unit_cost_base: number
    valuation: number
    production_date: string | null
    expiry_date: string | null
    received_at: string
}

export interface StockValuationItem {
    item_id: string
    item_name: string
    item_code: string | null
    uom_name: string | null
    warehouse_id: string
    warehouse_name: string
    qty_on_hand: number
    valuation: number
    lots_detail: StockValuationLotDetail[]
}

export interface StockValuationResponse {
    items: StockValuationItem[]
    total_valuation: number
}

export interface StockAdjustItem {
    item_code: string
    qty_counted: number
}

export interface StockAdjustResult {
    item_code: string
    status: 'success' | 'error'
    error_message?: string
    qty_expected?: number
    qty_counted?: number
    difference?: number
}

export interface BulkStockAdjustResponse {
    results: StockAdjustResult[]
}
