'use client'

import { useEffect, useState } from 'react'
import {
    adminApi, getProfile,
    type Profile, type AdminUser, type Shift
} from '@/lib/api'
import { Plus, Trash2, Edit3, Save, X, Loader2, UserPlus, Shield, User, KeyRound } from 'lucide-react'

export default function TeamPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [allShifts, setAllShifts] = useState<Shift[]>([])

    // Create form
    const [showCreate, setShowCreate] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [newPass, setNewPass] = useState('')
    const [newFirstName, setNewFirstName] = useState('')
    const [newLastName, setNewLastName] = useState('')
    const [newRole, setNewRole] = useState<'staff' | 'admin'>('staff')
    const [newVenue, setNewVenue] = useState('')
    const [newShift, setNewShift] = useState('')
    const [newVenueShifts, setNewVenueShifts] = useState<Shift[]>([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // Edit
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editFirstName, setEditFirstName] = useState('')
    const [editLastName, setEditLastName] = useState('')
    const [editRole, setEditRole] = useState('staff')
    const [editVenue, setEditVenue] = useState('')
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
                venue_id: newVenue || undefined,
                shift_id: newShift || undefined,
            })
            setUsers((prev) => [...prev, user])
            setShowCreate(false)
            setNewEmail('')
            setNewPass('')
            setNewFirstName('')
            setNewLastName('')
            setNewRole('staff')
            setNewVenue('')
            setNewShift('')
            setNewVenueShifts([])
        } catch (err: any) {
            setError(err.message || 'Failed to create user')
        }
        setSaving(false)
    }

    const startEdit = (u: AdminUser) => {
        setEditingId(u.id)
        const parts = (u.full_name || '').split(' ')
        setEditFirstName(parts[0] || '')
        setEditLastName(parts.slice(1).join(' ') || '')
        setEditRole(u.role)
        setEditVenue(u.venue_id || '')
        setEditShift(u.shift_id || '')
        setEditEmail(u.email || '')
        // Load shifts for this user's venue
        if (u.venue_id) {
            adminApi.getShifts(u.venue_id).then(setEditVenueShifts).catch(() => setEditVenueShifts([]))
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
        } catch (err: any) {
            setPasswordMsg(err.message || 'Failed to change password')
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
                venue_id: editVenue || undefined,
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
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
                    Team Members ({users.length})
                </h2>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                    <UserPlus className="w-4 h-4" /> Add User
                </button>
            </div>

            {/* Create User Form */}
            {showCreate && (
                <div className="bg-surface border border-primary/30 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-text-primary">New User</h3>
                    {error && (
                        <div className="text-xs text-error bg-error-light px-3 py-2 rounded-xl">{error}</div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                            placeholder="First Name"
                            value={newFirstName}
                            onChange={(e) => setNewFirstName(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <input
                            placeholder="Last Name"
                            value={newLastName}
                            onChange={(e) => setNewLastName(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <input
                            placeholder="Email"
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <input
                            placeholder="Password"
                            type="password"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as 'staff' | 'admin')}
                            className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none"
                        >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                        </select>
                        <select
                            value={newVenue}
                            onChange={(e) => {
                                const vid = e.target.value
                                setNewVenue(vid)
                                setNewShift('')
                                if (vid) {
                                    adminApi.getShifts(vid).then(setNewVenueShifts).catch(() => setNewVenueShifts([]))
                                } else {
                                    setNewVenueShifts([])
                                }
                            }}
                            className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none"
                        >
                            <option value="">No venue assigned</option>
                            {profile?.venues.map((v) => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                        {newVenue && newVenueShifts.length > 0 && (
                            <select
                                value={newShift}
                                onChange={(e) => setNewShift(e.target.value)}
                                className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none"
                            >
                                <option value="">No shift assigned</option>
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
                            <Save className="w-4 h-4" /> {saving ? 'Creating...' : 'Create User'}
                        </button>
                        <button
                            onClick={() => { setShowCreate(false); setError('') }}
                            className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
                        >
                            <X className="w-4 h-4" /> Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Users List */}
            {users.length === 0 ? (
                <div className="text-center py-10 text-text-secondary text-sm">No team members found.</div>
            ) : (
                <div className="space-y-3">
                    {users.map((u) => (
                        <div key={u.id} className="bg-surface border border-border rounded-2xl p-4">
                            {editingId === u.id ? (
                                <div className="space-y-3">
                                    {/* Email (read-only) */}
                                    <div className="bg-surface-raised rounded-xl px-4 py-2.5 text-sm text-text-secondary">
                                        ✉️ {editEmail || 'No email'}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            placeholder="First Name"
                                            value={editFirstName}
                                            onChange={(e) => setEditFirstName(e.target.value)}
                                            className="bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                        <input
                                            placeholder="Last Name"
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
                                        </select>
                                        <select
                                            value={editVenue}
                                            onChange={(e) => {
                                                const vid = e.target.value
                                                setEditVenue(vid)
                                                setEditShift('')
                                                if (vid) {
                                                    adminApi.getShifts(vid).then(setEditVenueShifts).catch(() => setEditVenueShifts([]))
                                                } else {
                                                    setEditVenueShifts([])
                                                }
                                            }}
                                            className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none flex-1"
                                        >
                                            <option value="">No venue</option>
                                            {profile?.venues.map((v) => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {editVenue && editVenueShifts.length > 0 && (
                                        <select
                                            value={editShift}
                                            onChange={(e) => setEditShift(e.target.value)}
                                            className="w-full bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none"
                                        >
                                            <option value="">No shift assigned</option>
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
                                                    placeholder="New password (min 6 chars)"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="flex-1 bg-surface border border-border rounded-xl px-4 h-9 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                                                />
                                                <button
                                                    onClick={() => handleChangePassword(u.id)}
                                                    disabled={passwordSaving}
                                                    className="flex items-center gap-1 bg-warning/10 text-warning px-3 h-9 rounded-xl text-xs font-medium hover:bg-warning/20 transition-colors disabled:opacity-50"
                                                >
                                                    <Save className="w-3.5 h-3.5" /> {passwordSaving ? '...' : 'Set'}
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
                                            <KeyRound className="w-3.5 h-3.5" /> Change Password
                                        </button>
                                    )}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleUpdate}
                                            disabled={saving}
                                            className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-9 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                                        >
                                            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-9 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" /> Cancel
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
                                                {u.venue_id && (
                                                    <span className="text-[10px] text-text-secondary">
                                                        {profile?.venues.find(v => v.id === u.venue_id)?.name || 'Venue'}
                                                    </span>
                                                )}
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
                                            onClick={() => startEdit(u)}
                                            className="text-text-secondary hover:text-primary transition-colors p-1"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        {u.id !== profile?.id && (
                                            <button
                                                onClick={() => handleDelete(u.id)}
                                                className="text-text-secondary hover:text-error transition-colors p-1"
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
