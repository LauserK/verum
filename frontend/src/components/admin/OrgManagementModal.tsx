'use client'

import React, { useEffect, useState } from 'react'
import { superAdminApi, adminApi, type SuperAdminOrgDetail, type SuperAdminUserInOrg, type Venue, type AdminUser } from '@/lib/api'
import { X, Building2, MapPin, Plus, Trash2, Save, Loader2, UserPlus, Users, Store, Edit2 } from 'lucide-react'

interface Props {
    orgId: string
    onClose: () => void
}

export default function OrgManagementModal({ orgId, onClose }: Props) {
    const [org, setOrg] = useState<SuperAdminOrgDetail | null>(null)
    const [globalUsers, setGlobalUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    
    // UI State
    const [activeTab, setActiveTab] = useState<'info' | 'venues' | 'users'>('info')
    const [editOrgName, setEditOrgName] = useState('')
    
    // Venues state
    const [showAddVenue, setShowAddVenue] = useState(false)
    const [newVenueData, setNewVenueData] = useState({ name: '', address: '' })
    const [editingVenueId, setEditingVenueId] = useState<string | null>(null)

    // Users association state
    const [showAddUser, setShowAddUser] = useState(false)
    const [orgRoles, setOrgRoles] = useState<{ id: string, name: string }[]>([])
    const [newUserData, setNewUserData] = useState({ userId: '', role: 'staff', venueIds: [] as string[] })

    useEffect(() => {
        loadData()
    }, [orgId])

    async function loadData() {
        setLoading(true)
        setError(null)
        try {
            const [data, roles, users] = await Promise.all([
                superAdminApi.getOrgDetail(orgId),
                adminApi.getRoles(orgId),
                superAdminApi.getUsers()
            ])
            setOrg(data)
            setEditOrgName(data.name)
            setOrgRoles(roles)
            setGlobalUsers(users)
        } catch (err) {
            setError('Error al cargar datos de la organización')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function handleUpdateOrg() {
        if (!editOrgName.trim()) return
        setSaving(true)
        try {
            await superAdminApi.updateOrganization(orgId, { name: editOrgName })
            if (org) setOrg({ ...org, name: editOrgName })
            alert('Organización actualizada')
        } catch (err) {
            alert('Error al actualizar')
        } finally {
            setSaving(false)
        }
    }

    async function toggleOrgStatus() {
        if (!org) return
        setSaving(true)
        try {
            const nextStatus = !org.is_active
            await superAdminApi.updateOrganization(orgId, { is_active: nextStatus })
            setOrg({ ...org, is_active: nextStatus })
        } catch (err) {
            alert('Error al cambiar estado')
        } finally {
            setSaving(false)
        }
    }

    // Venue Handlers
    async function handleAddVenue() {
        if (!newVenueData.name.trim()) return
        setSaving(true)
        try {
            await superAdminApi.createOrgVenue(orgId, newVenueData)
            setShowAddVenue(false)
            setNewVenueData({ name: '', address: '' })
            await loadData()
        } catch (err) {
            alert('Error al crear sede')
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteVenue(id: string) {
        if (!confirm('¿Estás seguro de eliminar esta sede? Se perderán las asociaciones de usuarios.')) return
        setSaving(true)
        try {
            await superAdminApi.deleteOrgVenue(id)
            await loadData()
        } catch (err) {
            alert('Error al eliminar sede')
        } finally {
            setSaving(false)
        }
    }

    // User Handlers
    async function handleAddUser() {
        if (!newUserData.userId) return
        setSaving(true)
        try {
            await superAdminApi.addUserOrg(newUserData.userId, {
                organization_id: orgId,
                role_name: newUserData.role,
                venue_ids: newUserData.venueIds
            })
            setShowAddUser(false)
            setNewUserData({ userId: '', role: 'staff', venueIds: [] })
            await loadData()
        } catch (err) {
            alert('Error al asociar usuario')
        } finally {
            setSaving(false)
        }
    }

    async function handleRemoveUser(userId: string) {
        if (!confirm('¿Eliminar asociación de este usuario con la organización?')) return
        setSaving(true)
        try {
            await superAdminApi.removeUserOrg(userId, orgId)
            await loadData()
        } catch (err) {
            alert('Error al eliminar asociación')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-surface p-8 rounded-3xl border border-border shadow-2xl">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            </div>
        )
    }

    if (!org) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <div className="bg-surface w-full max-w-3xl my-auto rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-border bg-surface-raised flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-text-primary leading-tight">{org.name}</h3>
                            <p className="text-xs text-text-secondary font-mono">{org.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-border rounded-xl transition-colors">
                        <X className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border bg-surface">
                    {[
                        { id: 'info', label: 'General', icon: Building2 },
                        { id: 'venues', label: 'Sedes', icon: Store },
                        { id: 'users', label: 'Usuarios', icon: Users },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-all border-b-2
                                ${activeTab === tab.id 
                                    ? 'border-primary text-primary bg-primary/5' 
                                    : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-raised'}`}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'info' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Configuración Base</h4>
                                <div className="space-y-4 bg-surface-raised p-5 rounded-2xl border border-border">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Nombre de la Organización</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text"
                                                value={editOrgName}
                                                onChange={(e) => setEditOrgName(e.target.value)}
                                                className="flex-1 px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                            <button 
                                                onClick={handleUpdateOrg}
                                                disabled={saving || editOrgName === org.name}
                                                className="px-4 py-2 bg-text-primary text-surface font-black text-xs rounded-xl hover:bg-text-primary/90 disabled:opacity-50 transition-all flex items-center gap-2"
                                            >
                                                <Save className="w-3.5 h-3.5" />
                                                Guardar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex items-center justify-between border-t border-border/50">
                                        <div>
                                            <p className="text-sm font-bold text-text-primary">Estado de la Cuenta</p>
                                            <p className="text-xs text-text-secondary">Si se desactiva, ningún usuario de esta empresa podrá entrar.</p>
                                        </div>
                                        <button 
                                            onClick={toggleOrgStatus}
                                            disabled={saving}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all
                                                ${org.is_active 
                                                    ? 'bg-success/10 text-success border border-success/20 hover:bg-success/20' 
                                                    : 'bg-error/10 text-error border border-error/20 hover:bg-error/20'}`}
                                        >
                                            {org.is_active ? 'Activa' : 'Inactiva'}
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <section className="grid grid-cols-2 gap-4">
                                <div className="bg-surface-raised p-4 rounded-2xl border border-border">
                                    <p className="text-[10px] font-black text-text-secondary uppercase mb-1">Total Sedes</p>
                                    <p className="text-2xl font-black text-text-primary">{org.venues.length}</p>
                                </div>
                                <div className="bg-surface-raised p-4 rounded-2xl border border-border">
                                    <p className="text-[10px] font-black text-text-secondary uppercase mb-1">Total Usuarios</p>
                                    <p className="text-2xl font-black text-text-primary">{org.users.length}</p>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'venues' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Gestión de Sedes</h4>
                                <button 
                                    onClick={() => setShowAddVenue(!showAddVenue)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Nueva Sede
                                </button>
                            </div>

                            {showAddVenue && (
                                <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Nombre</label>
                                            <input 
                                                type="text"
                                                placeholder="Ej: Sede Norte"
                                                value={newVenueData.name}
                                                onChange={(e) => setNewVenueData({ ...newVenueData, name: e.target.value })}
                                                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Dirección (Opcional)</label>
                                            <input 
                                                type="text"
                                                placeholder="Calle 123..."
                                                value={newVenueData.address}
                                                onChange={(e) => setNewVenueData({ ...newVenueData, address: e.target.value })}
                                                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setShowAddVenue(false)} className="flex-1 py-2 text-xs font-bold text-text-secondary">Cancelar</button>
                                        <button onClick={handleAddVenue} disabled={saving} className="flex-1 py-2 bg-primary text-white text-xs font-black rounded-xl">Crear</button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-3">
                                {org.venues.map(v => (
                                    <div key={v.id} className="bg-surface p-4 rounded-2xl border border-border flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-surface-raised rounded-lg flex items-center justify-center text-text-secondary">
                                                <Store className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-text-primary">{v.name}</p>
                                                <p className="text-xs text-text-secondary flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {v.address || 'Sin dirección'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleDeleteVenue(v.id)}
                                                className="p-2 text-text-secondary hover:text-error transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Equipo de la Empresa</h4>
                                <button 
                                    onClick={() => setShowAddUser(!showAddUser)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    Asociar Usuario
                                </button>
                            </div>

                            {showAddUser && (
                                <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Usuario Global</label>
                                        <select 
                                            value={newUserData.userId}
                                            onChange={(e) => setNewUserData({ ...newUserData, userId: e.target.value })}
                                            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none"
                                        >
                                            <option value="">Seleccionar usuario...</option>
                                            {globalUsers.filter(gu => !org.users.find(ou => ou.id === gu.id)).map(gu => (
                                                <option key={gu.id} value={gu.id}>{gu.full_name} ({gu.organizations?.name || 'Sin Org'})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Rol en esta Org</label>
                                            <select 
                                                value={newUserData.role}
                                                onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                                                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none"
                                            >
                                                <option value="staff">Personal de Línea</option>
                                                <option value="admin">Administrador</option>
                                                {orgRoles.map(r => (
                                                    <option key={r.id} value={r.name}>{r.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Sedes (Multi-selección)</label>
                                            <div className="max-h-32 overflow-y-auto p-2 bg-surface border border-border rounded-xl space-y-1">
                                                {org.venues.map(v => (
                                                    <label key={v.id} className="flex items-center gap-2 px-2 py-1 hover:bg-surface-raised rounded cursor-pointer">
                                                        <input 
                                                            type="checkbox"
                                                            checked={newUserData.venueIds.includes(v.id)}
                                                            onChange={(e) => {
                                                                const ids = e.target.checked 
                                                                    ? [...newUserData.venueIds, v.id]
                                                                    : newUserData.venueIds.filter(id => id !== v.id)
                                                                setNewUserData({ ...newUserData, venueIds: ids })
                                                            }}
                                                            className="w-3.5 h-3.5 rounded border-border"
                                                        />
                                                        <span className="text-xs text-text-primary">{v.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setShowAddUser(false)} className="flex-1 py-2 text-xs font-bold text-text-secondary">Cancelar</button>
                                        <button onClick={handleAddUser} disabled={saving || !newUserData.userId} className="flex-1 py-2 bg-primary text-white text-xs font-black rounded-xl">Asociar</button>
                                    </div>
                                </div>
                            )}

                            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-surface-raised border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-text-secondary">Usuario</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-text-secondary">Rol</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-text-secondary text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {org.users.map(ou => (
                                            <tr key={ou.id} className="hover:bg-surface-raised transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="text-xs font-bold text-text-primary">{ou.full_name}</p>
                                                    <p className="text-[9px] text-text-secondary font-mono">{ou.id.slice(0, 8)}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 bg-border text-[9px] font-black uppercase rounded-full text-text-secondary">
                                                        {ou.role_name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button 
                                                        onClick={() => handleRemoveUser(ou.id)}
                                                        className="p-1.5 text-text-secondary hover:text-error transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border bg-surface-raised shrink-0 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 bg-text-primary text-surface font-black text-sm rounded-xl hover:bg-text-primary/90 transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}
