import { fetchWithAuth, API_URL } from './core'

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

export interface Shift {
    id: string
    venue_id: string
    name: string
    start_time: string
    end_time: string
    sort_order: number
}

export function getVenueShifts(venueId: string): Promise<Shift[]> {
    return fetchWithAuth(`/venues/${venueId}/shifts`)
}

export const attendanceApi = {
    getStatus: (venueId?: string): Promise<AttendanceStatus> => 
        fetchWithAuth<AttendanceStatus>(`/attendance/today/status${venueId ? `?venue_id=${venueId}` : ''}`),
    
    mark: (event_type: string, data: Record<string, unknown> = {}): Promise<AttendanceLog> => 
        fetchWithAuth<AttendanceLog>('/attendance/mark', { method: 'POST', body: JSON.stringify({ event_type, ...data }) }),
    
    getLive: (venueId: string): Promise<AttendanceLog[]> => 
        fetchWithAuth<AttendanceLog[]>(`/attendance/live?venue_id=${venueId}`),
    
    getHistory: (): Promise<AttendanceRecord[]> => 
        fetchWithAuth<AttendanceRecord[]>('/attendance/me'),
    
    requestLeave: (data: { date: string; type: string; reason?: string }): Promise<unknown> => 
        fetchWithAuth('/attendance/requests', { method: 'POST', body: JSON.stringify(data) }),
    
    getOwnRequests: (): Promise<LeaveRequest[]> => 
        fetchWithAuth<LeaveRequest[]>('/attendance/requests/me'),
    
    manualEntry: (data: {
        profile_id: string
        venue_id: string
        clock_in: string
        clock_out: string
        reason: string
    }) => fetchWithAuth('/admin/attendance/manual', {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    editAttendanceDay: async (payload: { profile_id: string, venue_id: string, work_date: string, clock_in?: string, clock_out?: string, reason: string }) => {
        return await fetchWithAuth('/admin/attendance/edit-day', {
            method: 'POST',
            body: JSON.stringify(payload)
        })
    },

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

    exportAttendanceCSV: (venueId: string, type: string, from: string, to: string, profileId?: string): string => {
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

    getShifts: (venueId: string): Promise<Shift[]> =>
        fetchWithAuth(`/admin/venues/${venueId}/shifts`),

    createShift: (data: { venue_id: string; name: string; start_time: string; end_time: string; sort_order?: number }): Promise<Shift> =>
        fetchWithAuth('/admin/shifts', { method: 'POST', body: JSON.stringify(data) }),

    updateShift: (id: string, data: { name?: string; start_time?: string; end_time?: string; sort_order?: number }): Promise<Shift> =>
        fetchWithAuth(`/admin/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    deleteShift: (id: string): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/shifts/${id}`, { method: 'DELETE' }),
}
