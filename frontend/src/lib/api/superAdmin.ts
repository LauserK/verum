import { fetchWithAuth, VenueInfo } from './core'
import { Venue } from './admin'

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
    getOrganizations: (): Promise<unknown[]> => fetchWithAuth('/super-admin/organizations'),
    getOrgDetail: (id: string): Promise<SuperAdminOrgDetail> => fetchWithAuth(`/super-admin/organizations/${id}`),
    updateOrganization: (id: string, data: unknown): Promise<unknown> => 
        fetchWithAuth(`/super-admin/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    createOrganization: (name: string): Promise<unknown> =>
        fetchWithAuth('/super-admin/organizations', { method: 'POST', body: JSON.stringify({ name }) }),
    
    createOrgVenue: (orgId: string, data: { name: string, address?: string }): Promise<unknown> =>
        fetchWithAuth(`/super-admin/organizations/${orgId}/venues`, { method: 'POST', body: JSON.stringify(data) }),
    updateOrgVenue: (venueId: string, data: { name?: string, address?: string }): Promise<unknown> =>
        fetchWithAuth(`/super-admin/venues/${venueId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteOrgVenue: (venueId: string): Promise<unknown> =>
        fetchWithAuth(`/super-admin/venues/${venueId}`, { method: 'DELETE' }),

    getUsers: (): Promise<unknown[]> => fetchWithAuth('/super-admin/users'),
    getUserDetail: (id: string): Promise<SuperAdminUserDetail> => fetchWithAuth(`/super-admin/users/${id}`),
    addUserOrg: (userId: string, data: { organization_id: string, role_name?: string, venue_ids?: string[] }): Promise<unknown> =>
        fetchWithAuth(`/super-admin/users/${userId}/organizations`, { method: 'POST', body: JSON.stringify(data) }),
    updateUserOrg: (userId: string, orgId: string, data: { role_name?: string, venue_ids?: string[] }): Promise<unknown> =>
        fetchWithAuth(`/super-admin/users/${userId}/organizations/${orgId}`, { method: 'PUT', body: JSON.stringify(data) }),
    removeUserOrg: (userId: string, orgId: string): Promise<unknown> =>
        fetchWithAuth(`/super-admin/users/${userId}/organizations/${orgId}`, { method: 'DELETE' }),
    
    promoteUser: (userId: string, isSuper: boolean): Promise<unknown> =>
        fetchWithAuth(`/super-admin/users/${userId}/super-admin`, { method: 'PATCH', body: JSON.stringify({ is_superadmin: isSuper }) }),
        
    getMetrics: (): Promise<unknown> => fetchWithAuth('/super-admin/metrics'),
}
