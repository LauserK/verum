'use client'

import { useEffect, useState, useMemo } from 'react'
import { superAdminApi } from '@/lib/api'
import { Building2, Plus, Search, Power, PowerOff } from 'lucide-react'

import { useTranslations } from '@/components/I18nProvider'

export default function OrganizationsManagement() {
    const { t } = useTranslations()
    const [organizations, setOrganizations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newOrgName, setNewOrgName] = useState('')

    useEffect(() => {
        loadOrgs()
    }, [])

    async function loadOrgs() {
        setLoading(true)
        try {
            const data = await superAdminApi.getOrganizations()
            setOrganizations(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function toggleOrgStatus(id: string, currentStatus: boolean) {
        try {
            await superAdminApi.updateOrganization(id, { is_active: !currentStatus })
            setOrganizations(orgs => orgs.map(o => o.id === id ? { ...o, is_active: !currentStatus } : o))
        } catch (err) {
            alert('Error al actualizar estado')
        }
    }

    async function handleCreateOrg() {
        if (!newOrgName.trim()) return
        try {
            await superAdminApi.createOrganization(newOrgName)
            setNewOrgName('')
            setShowCreateModal(false)
            loadOrgs()
        } catch (err) {
            alert('Error al crear organización')
        }
    }

    const filtered = useMemo(() => organizations.filter(o => 
        o.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [organizations, searchTerm])

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    {t('superAdmin.organizations')}
                </h2>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all text-sm"
                >
                    <Plus className="w-4 h-4" />
                    {t('superAdmin.newOrg')}
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input 
                    type="text" 
                    placeholder={t('superAdmin.searchOrg')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
            </div>

            {loading ? (
                <div className="py-20 text-center text-text-secondary">Cargando...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((org) => (
                        <div key={org.id} className="bg-surface p-5 rounded-2xl border border-border hover:border-border-strong transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-base font-bold text-text-primary">{org.name}</h3>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${org.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                                        {org.is_active ? t('superAdmin.active') : t('superAdmin.inactive')}
                                    </span>
                                </div>
                                <p className="text-xs text-text-secondary font-mono mb-4">{org.id}</p>
                            </div>
                            
                            <div className="flex items-center justify-end gap-2">
                                <button 
                                    onClick={() => toggleOrgStatus(org.id, org.is_active)}
                                    className={`p-2 rounded-lg border transition-all ${org.is_active 
                                        ? 'bg-error/5 border-error/10 text-error hover:bg-error/10' 
                                        : 'bg-success/5 border-success/10 text-success hover:bg-success/10'}`}
                                    title={org.is_active ? 'Desactivar' : 'Activar'}
                                >
                                    {org.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de creación simplificado */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface w-full max-w-md p-6 rounded-3xl border border-border shadow-2xl">
                        <h3 className="text-lg font-bold text-text-primary mb-4">Nueva Organización</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Nombre</label>
                                <input 
                                    type="text"
                                    value={newOrgName}
                                    onChange={(e) => setNewOrgName(e.target.value)}
                                    className="w-full px-4 py-3 bg-surface-raised border border-border rounded-xl focus:outline-none"
                                    placeholder="Nombre de la empresa"
                                />
                            </div>
                            <div className="flex items-center gap-3 pt-4">
                                <button 
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 text-sm font-bold text-text-secondary bg-surface-raised rounded-xl hover:bg-border transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleCreateOrg}
                                    className="flex-1 py-3 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-hover transition-all"
                                >
                                    Crear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
