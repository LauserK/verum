'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    adminApi, getProfile,
    type Profile, type AdminUser, type Shift
} from '@/lib/api'
import { Plus, Trash2, Edit3, Save, X, Loader2, Shield, User, KeyRound, Fingerprint } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'
import Link from 'next/link'

export default function TeamPage() {
    const { t } = useTranslations('admin')
    const router = useRouter()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [users, setUsers] = useState<AdminUser[]>([])
    const [roles, setRoles] = useState<{id: string, name: string}[]>([])
    const [loading, setLoading] = useState(true)
    const [allShifts, setAllShifts] = useState<Shift[]>([])

    // Create form
    const [showCreate, setShowCreate] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [newPass, setNewPass] = useState('')
    const [newFirstName, setNewFirstName] = useState('')
    const [newLastName, setNewLastName] = useState('')
    const [newRole, setNewRole] = useState('staff')
    const [newVenues, setNewVenues] = useState<string[]>([])
    const [newShift, setNewShift] = useState('')
    const [newVenueShifts, setNewVenueShifts] = useState<Shift[]>([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // Edit
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editFirstName, setEditFirstName] = useState('')
    const [editLastName, setEditLastName] = useState('')
    const [editRole, setEditRole] = useState('staff')
    const [editVenues, setEditVenues] = useState<string[]>([])
    const [editShift, setEditShift] = useState('')
    const [editVenueShifts, setEditVenueShifts] = useState<Shift[]>([])
    const [editEmail, setEditEmail] = useState('')

    // Password change
    const [changingPasswordId, setChangingPasswordId] = useState<string | null>(null)
    const [newPassword, setNewPassword] = useState('')
    const [passwordSaving, setPasswordSaving] = useState(false)
    const [passwordMsg, setPasswordMsg] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const p = await getProfile()
                setProfile(p)
                const u = await adminApi.getUsers()
                setUsers(u)
                if (p.organization_id) {
                    const r = await adminApi.getRoles(p.organization_id)
                    setRoles(r)
                }
                // Load all shifts for all venues
                const allS: Shift[] = []
                for (const v of p.venues) {
                    try {
                        const shifts = await adminApi.getShifts(v.id)
                        allS.push(...shifts)
                    } catch { }
                }
                setAllShifts(allS)
            } catch { }
            setLoading(false)
        }
        load()
    }, [])

    const handleCreate = async () => {
        if (!newEmail || !newPass || !newFirstName || !newLastName || !profile) return
        setSaving(true)
        setError('')
        try {
            const user = await adminApi.createUser({
                email: newEmail,
                password: newPass,
                full_name: `${newFirstName.trim()} ${newLastName.trim()}`,
                role: newRole,
                organization_id: profile.organization_id || '',
                venue_ids: newVenues,
                shift_id: newShift || undefined,
            })
            setUsers((prev) => [...prev, user])
            setShowCreate(false)
            setNewEmail('')
            setNewPass('')
            setNewFirstName('')
            setNewLastName('')
            setNewRole('staff')
            setNewVenues([])
            setNewShift('')
            setNewVenueShifts([])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create user')
        }
        setSaving(false)
    }

    const startEdit = (u: AdminUser) => {
        setEditingId(u.id)
        const parts = (u.full_name || '').split(' ')
        setEditFirstName(parts[0] || '')
        setEditLastName(parts.slice(1).join(' ') || '')
        setEditRole(u.role)
        setEditVenues(u.venue_ids || (u.venue_id ? [u.venue_id] : []))
        setEditShift(u.shift_id || '')
        setEditEmail(u.email || '')
        
        // Load shifts for first assigned venue (legacy/fallback behavior for UI)
        const firstVenue = u.venue_ids?.[0] || u.venue_id
        if (firstVenue) {
            adminApi.getShifts(firstVenue).then(setEditVenueShifts).catch(() => setEditVenueShifts([]))
        } else {
            setEditVenueShifts([])
        }
        setChangingPasswordId(null)
        setNewPassword('')
        setPasswordMsg('')
    }

    const handleChangePassword = async (userId: string) => {
        if (!newPassword || newPassword.length < 6) {
            setPasswordMsg('Password must be at least 6 characters')
            return
        }
        setPasswordSaving(true)
        setPasswordMsg('')
        try {
            await adminApi.changePassword(userId, newPassword)
            setPasswordMsg('✓ Password updated')
            setNewPassword('')
            setChangingPasswordId(null)
        } catch (err) {
            setPasswordMsg(err instanceof Error ? err.message : 'Failed to change password')
        }
        setPasswordSaving(false)
    }

    const handleUpdate = async () => {
        if (!editingId) return
        setSaving(true)
        try {
            const updated = await adminApi.updateUser(editingId, {
                full_name: `${editFirstName.trim()} ${editLastName.trim()}`,
                role: editRole,
                venue_ids: editVenues,
                shift_id: editShift || undefined,
            })
            setUsers((prev) => prev.map((u) => u.id === editingId ? { ...u, ...updated } : u))
            setEditingId(null)
        } catch (err) {
            console.error(err)
        }
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return
        try {
            await adminApi.deleteUser(id)
            setUsers((prev) => prev.filter((u) => u.id !== id))
        } catch (err) {
            console.error(err)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary mb-1">{t('team.title', { count: users.length })}</h1>
                    <div className="flex items-center gap-6 mt-2 overflow-x-auto">
                        <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1 whitespace-nowrap">Usuarios</span>
                        <Link href="/admin/settings/roles" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
                            Roles y Permisos
                        </Link>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    {t('team.addUser')}
                </button>
            </div>

            {/* Create User Form */}
            {showCreate && (
                <div className="bg-surface border border-primary/30 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-text-primary">{t('team.newUser')}</h3>
                    {error && (
                        <div className="text-xs text-error bg-error-light px-3 py-2 rounded-xl">{error}</div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                            placeholder={t('team.firstName')}
                            value={newFirstName}
                            onChange={(e) => setNewFirstName(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <input
                            placeholder={t('team.lastName')}
                            value={newLastName}
                            onChange={(e) => setNewLastName(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <input
                            placeholder={t('team.email')}
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <input
                            placeholder={t('team.password')}
                            type="password"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none"
                        >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                        </select>
                        <div className="col-span-1 sm:col-span-2 space-y-2">
                            <p className="text-xs font-bold text-text-secondary uppercase px-1">Sedes</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {profile?.venues.map((v) => (
                                    <label key={v.id} className={`flex items-center gap-2 px-3 h-10 rounded-xl border transition-colors cursor-pointer
                                        ${newVenues.includes(v.id) ? 'bg-primary/5 border-primary' : 'bg-surface border-border hover:bg-surface-raised'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={newVenues.includes(v.id)}
                                            onChange={() => {
                                                const updated = newVenues.includes(v.id) 
                                                    ? newVenues.filter(id => id !== v.id)
                                                    : [...newVenues, v.id]
                                                setNewVenues(updated)
                                                setNewShift('')
                                                // Only load shifts if exactly ONE venue is selected
                                                if (updated.length === 1) {
                                                    adminApi.getShifts(updated[0]).then(setNewVenueShifts).catch(() => setNewVenueShifts([]))
                                                } else {
                                                    setNewVenueShifts([])
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                        />
                                        <span className="text-xs text-text-primary font-medium truncate">{v.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        {newVenues.length === 1 && newVenueShifts.length > 0 && (
                            <select
                                value={newShift}
                                onChange={(e) => setNewShift(e.target.value)}
                                className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none"
                            >
                                <option value="">{t('team.noShiftAssigned')}</option>
                                {newVenueShifts.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.start_time?.substring(0, 5)} – {s.end_time?.substring(0, 5)})</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCreate}
                            disabled={saving || !newEmail || !newPass || !newFirstName || !newLastName}
                            className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" /> {saving ? t('team.creating') : t('team.create')}
                        </button>
                        <button
                            onClick={() => { setShowCreate(false); setError('') }}
                            className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
                        >
                            <X className="w-4 h-4" /> {t('team.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* Users List */}
            {users.length === 0 ? (
                <div className="text-center py-10 text-text-secondary text-sm">{t('team.noMembers')}</div>
            ) : (
                <div className="space-y-3">
                    {users.map((u) => (
                        <div key={u.id} className="bg-surface border border-border rounded-2xl p-4">
                            {editingId === u.id ? (
                                <div className="space-y-3">
                                    {/* Email (read-only) */}
                                    <div className="bg-surface-raised rounded-xl px-4 py-2.5 text-sm text-text-secondary">
                                        ✉️ {editEmail || t('team.noEmail')}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            placeholder={t('team.firstName')}
                                            value={editFirstName}
                                            onChange={(e) => setEditFirstName(e.target.value)}
                                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                        <input
                                            placeholder={t('team.lastName')}
                                            value={editLastName}
                                            onChange={(e) => setEditLastName(e.target.value)}
                                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <select
                                            value={editRole}
                                            onChange={(e) => setEditRole(e.target.value)}
                                            className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none"
                                        >
                                            <option value="staff">Staff</option>
                                            <option value="admin">Admin</option>
                                            {roles.map((r) => (
                                                <option key={r.id} value={r.name}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-text-secondary uppercase px-1">Sedes</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {profile?.venues.map((v) => (
                                                <label key={v.id} className={`flex items-center gap-2 px-3 h-10 rounded-xl border transition-colors cursor-pointer
                                                    ${editVenues.includes(v.id) ? 'bg-primary/5 border-primary' : 'bg-surface border-border hover:bg-surface-raised'}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={editVenues.includes(v.id)}
                                                        onChange={() => {
                                                            const updated = editVenues.includes(v.id) 
                                                                ? editVenues.filter(id => id !== v.id)
                                                                : [...editVenues, v.id]
                                                            setEditVenues(updated)
                                                            setEditShift('')
                                                            // Only load shifts if exactly ONE venue is selected
                                                            if (updated.length === 1) {
                                                                adminApi.getShifts(updated[0]).then(setEditVenueShifts).catch(() => setEditVenueShifts([]))
                                                            } else {
                                                                setEditVenueShifts([])
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                    />
                                                    <span className="text-xs text-text-primary font-medium truncate">{v.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    {editVenues.length === 1 && editVenueShifts.length > 0 && (
                                        <select
                                            value={editShift}
                                            onChange={(e) => setEditShift(e.target.value)}
                                            className="w-full bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none"
                                        >
                                            <option value="">{t('team.noShiftAssigned')}</option>
                                            {editVenueShifts.map((s) => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.start_time?.substring(0, 5)} – {s.end_time?.substring(0, 5)})</option>
                                            ))}
                                        </select>
                                    )}

                                    {/* Password change */}
                                    {changingPasswordId === u.id ? (
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <input
                                                    type="password"
                                                    placeholder={t('team.newPasswordPlaceholder')}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="flex-1 bg-surface border border-border rounded-xl px-4 h-9 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                                                />
                                                <button
                                                    onClick={() => handleChangePassword(u.id)}
                                                    disabled={passwordSaving}
                                                    className="flex items-center gap-1 bg-warning/10 text-warning px-3 h-9 rounded-xl text-xs font-medium hover:bg-warning/20 transition-colors disabled:opacity-50"
                                                >
                                                    <Save className="w-3.5 h-3.5" /> {passwordSaving ? '...' : t('team.setPassword')}
                                                </button>
                                                <button
                                                    onClick={() => { setChangingPasswordId(null); setNewPassword(''); setPasswordMsg('') }}
                                                    className="text-text-secondary hover:text-text-primary transition-colors p-1"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            {passwordMsg && (
                                                <p className={`text-xs ${passwordMsg.startsWith('✓') ? 'text-success' : 'text-error'}`}>{passwordMsg}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setChangingPasswordId(u.id)}
                                            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors"
                                        >
                                            <KeyRound className="w-3.5 h-3.5" /> {t('team.changePassword')}
                                        </button>
                                    )}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleUpdate}
                                            disabled={saving}
                                            className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-9 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                                        >
                                            <Save className="w-3.5 h-3.5" /> {saving ? t('team.saving') : t('team.save')}
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-9 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" /> {t('team.cancel')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                                            ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-surface-raised text-text-secondary'}`}
                                        >
                                            {u.role === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-text-primary truncate">{u.full_name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-text-secondary truncate">{u.email || '—'}</span>
                                                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md
                                                    ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-surface-raised text-text-secondary'}`}
                                                >
                                                    {u.role}
                                                </span>
                                                {(u.venue_ids || (u.venue_id ? [u.venue_id] : [])).map(vid => (
                                                    <span key={vid} className="text-[10px] text-text-secondary bg-surface-raised px-1.5 py-0.5 rounded-md">
                                                        {profile?.venues.find(v => v.id === vid)?.name || 'Venue'}
                                                    </span>
                                                ))}
                                                {u.shift_id && (
                                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                                                        {allShifts.find(s => s.id === u.shift_id)?.name || 'Shift'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => router.push(`/admin/settings/users/${u.id}`)}
                                            className="text-text-secondary hover:text-primary transition-colors p-1"
                                            title={t('team.permissions')}
                                        >
                                            <Fingerprint className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => startEdit(u)}
                                            className="text-text-secondary hover:text-primary transition-colors p-1"
                                            title={t('team.edit')}
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        {u.id !== profile?.id && (
                                            <button
                                                onClick={() => handleDelete(u.id)}
                                                className="text-text-secondary hover:text-error transition-colors p-1"
                                                title={t('team.delete')}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
