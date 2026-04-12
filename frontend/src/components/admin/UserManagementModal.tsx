'use client'

import React, { useEffect, useState } from 'react'
import { superAdminApi, adminApi, type SuperAdminUserDetail, type SuperAdminUserOrg, type Venue, type Organization } from '@/lib/api'
import { X, Building2, Shield, User, MapPin, Plus, Trash2, Save, Loader2, ChevronRight, ChevronDown } from 'lucide-react'

interface Props {
    userId: string
    onClose: () => void
}

export default function UserManagementModal({ userId, onClose }: Props) {
    const [user, setUser] = useState<SuperAdminUserDetail | null>(null)
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    
    // UI State for editing organizations
    const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null)
    const [orgRoles, setOrgRoles] = useState<Record<string, { id: string, name: string }[]>>({})
    const [orgVenues, setOrgVenues] = useState<Record<string, Venue[]>>({})
    const [showAddOrg, setShowAddOrg] = useState(false)
    const [newOrgData, setNewOrgData] = useState({ orgId: '', role: 'staff', venueIds: [] as string[] })

    useEffect(() => {
        loadData()
    }, [userId])

    async function loadData() {
        setLoading(true)
        setError(null)
        try {
            const [u, orgs] = await Promise.all([
                superAdminApi.getUserDetail(userId),
                superAdminApi.getOrganizations()
            ])
            setUser(u)
            setOrganizations(orgs)
            
            // Load roles/venues for each associated org sequentially or limited parallel
            // to avoid hitting request limits or confusing state
            for (const org of u.organizations) {
                await loadOrgAssets(org.id)
            }
        } catch (err) {
            setError('Error al cargar datos del usuario')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function loadOrgAssets(orgId: string) {
        try {
            const [roles, venues] = await Promise.all([
                adminApi.getRoles(orgId),
                adminApi.getVenues(orgId)
            ])
            setOrgRoles(prev => ({ ...prev, [orgId]: roles }))
            setOrgVenues(prev => ({ ...prev, [orgId]: venues }))
        } catch (err) {
            console.error(`Error loading assets for org ${orgId}`, err)
        }
    }

    async function handleUpdateOrg(orgId: string, data: { role_name?: string, venue_ids?: string[] }) {
        setSaving(true)
        try {
            await superAdminApi.updateUserOrg(userId, orgId, data)
            await loadData()
        } catch (err) {
            alert('Error al actualizar asociación')
        } finally {
            setSaving(false)
        }
    }

    async function handleRemoveOrg(orgId: string) {
        if (!confirm('¿Estás seguro de que quieres eliminar a este usuario de esta organización?')) return
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

    async function handleAddOrg() {
        if (!newOrgData.orgId) return
        setSaving(true)
        try {
            await superAdminApi.addUserOrg(userId, {
                organization_id: newOrgData.orgId,
                role_name: newOrgData.role,
                venue_ids: newOrgData.venueIds
            })
            setShowAddOrg(false)
            setNewOrgData({ orgId: '', role: 'staff', venueIds: [] })
            await loadData()
        } catch (err) {
            alert('Error al añadir organización')
        } finally {
            setSaving(false)
        }
    }

    const toggleSuperAdmin = async () => {
        if (!user) return
        setSaving(true)
        try {
            await superAdminApi.promoteUser(userId, !user.is_superadmin)
            setUser({ ...user, is_superadmin: !user.is_superadmin })
        } catch (err) {
            alert('Error al actualizar permisos')
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

    if (!user) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <div className="bg-surface w-full max-w-2xl my-auto rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-border bg-surface-raised flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-text-primary leading-tight">{user.full_name || 'Sin Nombre'}</h3>
                            <p className="text-xs text-text-secondary font-mono">{user.email || user.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-border rounded-xl transition-colors">
                        <X className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Global Info */}
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Información Global</h4>
                        <div className="bg-surface-raised p-4 rounded-2xl border border-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Shield className={`w-5 h-5 ${user.is_superadmin ? 'text-primary' : 'text-text-secondary'}`} />
                                <div>
                                    <p className="text-sm font-bold text-text-primary">Super Administrador Global</p>
                                    <p className="text-xs text-text-secondary">Acceso total a todas las organizaciones y métricas.</p>
                                </div>
                            </div>
                            <button 
                                onClick={toggleSuperAdmin}
                                disabled={saving}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all
                                    ${user.is_superadmin 
                                        ? 'bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20' 
                                        : 'bg-surface border border-border text-text-secondary hover:border-border-strong'}`}
                            >
                                {user.is_superadmin ? 'Activado' : 'Desactivado'}
                            </button>
                        </div>
                    </section>

                    {/* Organizations */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Organizaciones Asociadas</h4>
                            <button 
                                onClick={() => setShowAddOrg(!showAddOrg)}
                                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Añadir Empresa
                            </button>
                        </div>

                        {showAddOrg && (
                            <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2">
                                <h5 className="text-xs font-black text-primary uppercase">Nueva Asociación</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Organización</label>
                                        <select 
                                            value={newOrgData.orgId}
                                            onChange={(e) => {
                                                setNewOrgData({ ...newOrgData, orgId: e.target.value })
                                                if (e.target.value) loadOrgAssets(e.target.value)
                                            }}
                                            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {organizations.filter(o => !user.organizations.find(uo => uo.id === o.id)).map(o => (
                                                <option key={o.id} value={o.id}>{o.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Rol</label>
                                        <select 
                                            value={newOrgData.role}
                                            onChange={(e) => setNewOrgData({ ...newOrgData, role: e.target.value })}
                                            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none"
                                        >
                                            <option value="staff">Personal de Línea</option>
                                            <option value="admin">Administrador</option>
                                            {newOrgData.orgId && orgRoles[newOrgData.orgId]?.map(r => (
                                                <option key={r.id} value={r.name}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                
                                {newOrgData.orgId && orgVenues[newOrgData.orgId]?.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-text-secondary uppercase px-1">Sedes Asignadas</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {orgVenues[newOrgData.orgId].map(v => (
                                                <label key={v.id} className="flex items-center gap-2 p-2 bg-surface border border-border rounded-lg cursor-pointer hover:bg-surface-raised transition-colors">
                                                    <input 
                                                        type="checkbox"
                                                        checked={newOrgData.venueIds.includes(v.id)}
                                                        onChange={(e) => {
                                                            const ids = e.target.checked 
                                                                ? [...newOrgData.venueIds, v.id]
                                                                : newOrgData.venueIds.filter(id => id !== v.id)
                                                            setNewOrgData({ ...newOrgData, venueIds: ids })
                                                        }}
                                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                    />
                                                    <span className="text-xs text-text-primary truncate">{v.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 pt-2">
                                    <button 
                                        onClick={() => setShowAddOrg(false)}
                                        className="flex-1 py-2 text-xs font-bold text-text-secondary bg-surface border border-border rounded-xl hover:bg-border transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={handleAddOrg}
                                        disabled={saving || !newOrgData.orgId}
                                        className="flex-1 py-2 text-xs font-black text-white bg-primary rounded-xl hover:bg-primary-hover disabled:opacity-50 transition-all"
                                    >
                                        Asociar
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {user.organizations.map((uo) => {
                                const isExpanded = expandedOrgId === uo.id
                                const roles = orgRoles[uo.id] || []
                                const venues = orgVenues[uo.id] || []
                                
                                return (
                                    <div key={uo.id} className="bg-surface rounded-2xl border border-border overflow-hidden">
                                        <div 
                                            onClick={() => setExpandedOrgId(isExpanded ? null : uo.id)}
                                            className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-raised transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Building2 className="w-4 h-4 text-text-secondary" />
                                                <div>
                                                    <p className="text-sm font-bold text-text-primary">{uo.name}</p>
                                                    <p className="text-[10px] text-text-secondary uppercase font-black">{uo.role_name}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-text-secondary bg-border px-2 py-0.5 rounded-full">
                                                    {uo.venues.length} sedes
                                                </span>
                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-text-secondary" /> : <ChevronRight className="w-4 h-4 text-text-secondary" />}
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="px-5 py-5 border-t border-border bg-surface-raised space-y-5 animate-in slide-in-from-top-1">
                                                {/* Role Edit */}
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-text-secondary uppercase px-1">Cambiar Rol</label>
                                                    <div className="flex gap-2">
                                                        <select 
                                                            defaultValue={uo.role_name}
                                                            onChange={(e) => handleUpdateOrg(uo.id, { role_name: e.target.value })}
                                                            disabled={saving}
                                                            className="flex-1 px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        >
                                                            <option value="staff">Personal de Línea</option>
                                                            <option value="admin">Administrador</option>
                                                            {roles.map(r => (
                                                                <option key={r.id} value={r.name}>{r.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Venues Edit */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between px-1">
                                                        <label className="text-[10px] font-black text-text-secondary uppercase">Sedes Asignadas</label>
                                                        <span className="text-[10px] text-text-secondary italic">Auto-guardado al marcar</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {venues.map(v => {
                                                            const isAssigned = uo.venues.find(uv => uv.id === v.id)
                                                            return (
                                                                <label key={v.id} className="flex items-center gap-2 p-2 bg-surface border border-border rounded-xl cursor-pointer hover:border-primary/30 transition-all">
                                                                    <input 
                                                                        type="checkbox"
                                                                        checked={!!isAssigned}
                                                                        onChange={(e) => {
                                                                            const currentIds = uo.venues.map(uv => uv.id)
                                                                            const newIds = e.target.checked 
                                                                                ? [...currentIds, v.id]
                                                                                : currentIds.filter(id => id !== v.id)
                                                                            handleUpdateOrg(uo.id, { venue_ids: newIds })
                                                                        }}
                                                                        disabled={saving}
                                                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                                    />
                                                                    <span className="text-xs text-text-primary truncate">{v.name}</span>
                                                                </label>
                                                            )
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="pt-2 flex justify-end border-t border-border mt-4 pt-4">
                                                    <button 
                                                        onClick={() => handleRemoveOrg(uo.id)}
                                                        disabled={saving}
                                                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-error bg-error/5 border border-error/10 rounded-xl hover:bg-error/10 transition-all"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Remover de {uo.name}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border bg-surface-raised shrink-0 flex justify-between items-center">
                    <p className="text-[10px] text-text-secondary italic">Los cambios en los roles y sedes se aplican inmediatamente.</p>
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
