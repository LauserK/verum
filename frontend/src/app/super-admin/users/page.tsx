'use client'

import { useEffect, useState, useMemo } from 'react'
import { superAdminApi } from '@/lib/api'
import { Users, Shield, ShieldOff, Search } from 'lucide-react'

import { useTranslations } from '@/components/I18nProvider'
import UserManagementModal from '@/components/admin/UserManagementModal'

export default function GlobalUsersManagement() {
    const { t } = useTranslations()
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

    useEffect(() => {
        loadUsers()
    }, [])

    async function loadUsers() {
        setLoading(true)
        try {
            const data = await superAdminApi.getUsers()
            setUsers(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function toggleSuperAdmin(id: string, currentStatus: boolean, e: React.MouseEvent) {
        e.stopPropagation() // Prevent row click
        if (!confirm(`¿Estás seguro de que quieres ${currentStatus ? 'quitar' : 'dar'} permisos de Super Admin?`)) return
        try {
            await superAdminApi.promoteUser(id, !currentStatus)
            setUsers(users => users.map(u => u.id === id ? { ...u, is_superadmin: !currentStatus } : u))
        } catch (err) {
            alert('Error al actualizar permisos')
        }
    }

    const filtered = useMemo(() => users.filter(u => 
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.organizations?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [users, searchTerm])

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {t('superAdmin.users')}
            </h2>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input 
                    type="text" 
                    placeholder={t('superAdmin.searchUser')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
            </div>

            {loading ? (
                <div className="py-20 text-center text-text-secondary">Cargando...</div>
            ) : (
                <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border bg-surface-raised">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-text-secondary">Usuario</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-text-secondary">Organización</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-text-secondary">Rol Base</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-text-secondary">Super Admin</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-text-secondary">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered.map((user) => (
                                    <tr 
                                        key={user.id} 
                                        className="hover:bg-surface-raised transition-colors cursor-pointer group"
                                        onClick={() => setSelectedUserId(user.id)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">{user.full_name}</div>
                                            <div className="text-xs text-text-secondary font-mono">{user.id.slice(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-primary">
                                            {user.organizations?.name || <span className="text-text-secondary italic">Sin org</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 rounded-full bg-surface-raised border border-border text-[10px] font-bold uppercase text-text-secondary">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.is_superadmin ? (
                                                <span className="flex items-center gap-1 text-primary text-xs font-bold">
                                                    <Shield className="w-3 h-3" />
                                                    Sí
                                                </span>
                                            ) : (
                                                <span className="text-text-secondary text-xs">No</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={(e) => toggleSuperAdmin(user.id, user.is_superadmin, e)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                                                    ${user.is_superadmin 
                                                        ? 'bg-error/5 border-error/10 text-error hover:bg-error/10' 
                                                        : 'bg-primary/5 border-primary/10 text-primary hover:bg-primary/10'}`}
                                            >
                                                {user.is_superadmin ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                                                {user.is_superadmin ? 'Degradar' : 'Promover'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedUserId && (
                <UserManagementModal 
                    userId={selectedUserId}
                    onClose={() => {
                        setSelectedUserId(null)
                        loadUsers() // Refresh list in case something changed
                    }}
                />
            )}
        </div>
    )
}
