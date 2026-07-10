import { fetchWithAuth } from './core'

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

export interface Role {
    id: string
    name: string
}

export const settingsApi = {
    // Users Management
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

    // Roles Management
    getRoles: (orgId: string): Promise<Role[]> =>
        fetchWithAuth(`/roles?org_id=${orgId}`),

    createRole: (data: { name: string; org_id: string; description?: string; is_admin?: boolean }): Promise<Role> =>
        fetchWithAuth('/roles', { method: 'POST', body: JSON.stringify(data) }),

    getPermissions: (): Promise<unknown[]> =>
        fetchWithAuth('/permissions'),

    getRolePermissions: (roleId: string): Promise<string[]> =>
        fetchWithAuth(`/roles/${roleId}/permissions`),

    assignRolePermissions: (roleId: string, permissionIds: string[]): Promise<unknown> =>
        fetchWithAuth(`/roles/${roleId}/permissions`, { method: 'POST', body: JSON.stringify(permissionIds) }),
}
