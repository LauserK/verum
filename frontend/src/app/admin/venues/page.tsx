'use client'

import { useEffect, useState } from 'react'
import {
    adminApi, getProfile,
    type Profile, type Venue, type Shift
} from '@/lib/api'
import {
    Plus, Trash2, Edit3, Save, X, Loader2, Clock,
    Building2, ChevronRight, MapPin
} from 'lucide-react'

export default function VenuesPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [venues, setVenues] = useState<Venue[]>([])
    const [loading, setLoading] = useState(true)

    // Selected venue → shifts
    const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
    const [shifts, setShifts] = useState<Shift[]>([])
    const [loadingShifts, setLoadingShifts] = useState(false)

    // Create venue
    const [showNewVenue, setShowNewVenue] = useState(false)
    const [newVenueName, setNewVenueName] = useState('')
    const [newVenueAddr, setNewVenueAddr] = useState('')
    const [saving, setSaving] = useState(false)

    // Edit venue
    const [editingVenueId, setEditingVenueId] = useState<string | null>(null)
    const [evName, setEvName] = useState('')
    const [evAddr, setEvAddr] = useState('')

    // Create shift
    const [showNewShift, setShowNewShift] = useState(false)
    const [nsName, setNsName] = useState('')
    const [nsStart, setNsStart] = useState('')
    const [nsEnd, setNsEnd] = useState('')

    // Edit shift
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
    const [esName, setEsName] = useState('')
    const [esStart, setEsStart] = useState('')
    const [esEnd, setEsEnd] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const p = await getProfile()
                setProfile(p)
                if (p.organization_id) {
                    const v = await adminApi.getVenues(p.organization_id)
                    setVenues(v)
                }
            } catch { }
            setLoading(false)
        }
        load()
    }, [])

    const loadShifts = async (venue: Venue) => {
        setSelectedVenue(venue)
        setLoadingShifts(true)
        try {
            const s = await adminApi.getShifts(venue.id)
            setShifts(s)
        } catch { }
        setLoadingShifts(false)
    }

    // ── Venue CRUD ─────────────────────────────────────
    const handleCreateVenue = async () => {
        if (!newVenueName.trim() || !profile?.organization_id) return
        setSaving(true)
        try {
            const v = await adminApi.createVenue(profile.organization_id, newVenueName, newVenueAddr || undefined)
            setVenues((prev) => [...prev, v])
            setShowNewVenue(false)
            setNewVenueName('')
            setNewVenueAddr('')
        } catch (err) { console.error(err) }
        setSaving(false)
    }

    const startEditVenue = (v: Venue, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingVenueId(v.id)
        setEvName(v.name)
        setEvAddr(v.address || '')
    }

    const handleUpdateVenue = async () => {
        if (!editingVenueId || !evName.trim()) return
        setSaving(true)
        try {
            const updated = await adminApi.updateVenue(editingVenueId, { name: evName, address: evAddr || undefined })
            setVenues((prev) => prev.map((v) => v.id === editingVenueId ? { ...v, ...updated } : v))
            if (selectedVenue?.id === editingVenueId) {
                setSelectedVenue((prev) => prev ? { ...prev, ...updated } : prev)
            }
            setEditingVenueId(null)
        } catch (err) { console.error(err) }
        setSaving(false)
    }

    const handleDeleteVenue = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Delete this venue and all its data? This cannot be undone.')) return
        try {
            await adminApi.deleteVenue(id)
            setVenues((prev) => prev.filter((v) => v.id !== id))
            if (selectedVenue?.id === id) {
                setSelectedVenue(null)
                setShifts([])
            }
        } catch (err) { console.error(err) }
    }

    // ── Shift CRUD ─────────────────────────────────────
    const handleCreateShift = async () => {
        if (!nsName.trim() || !nsStart || !nsEnd || !selectedVenue) return
        setSaving(true)
        try {
            const s = await adminApi.createShift({
                venue_id: selectedVenue.id,
                name: nsName,
                start_time: nsStart,
                end_time: nsEnd,
                sort_order: shifts.length,
            })
            setShifts((prev) => [...prev, s])
            setShowNewShift(false)
            setNsName('')
            setNsStart('')
            setNsEnd('')
        } catch (err) { console.error(err) }
        setSaving(false)
    }

    const startEditShift = (s: Shift) => {
        setEditingShiftId(s.id)
        setEsName(s.name)
        setEsStart(s.start_time?.substring(0, 5) || '')
        setEsEnd(s.end_time?.substring(0, 5) || '')
    }

    const handleUpdateShift = async () => {
        if (!editingShiftId) return
        setSaving(true)
        try {
            const updated = await adminApi.updateShift(editingShiftId, {
                name: esName,
                start_time: esStart,
                end_time: esEnd,
            })
            setShifts((prev) => prev.map((s) => s.id === editingShiftId ? { ...s, ...updated } : s))
            setEditingShiftId(null)
        } catch (err) { console.error(err) }
        setSaving(false)
    }

    const handleDeleteShift = async (id: string) => {
        if (!confirm('Delete this shift?')) return
        try {
            await adminApi.deleteShift(id)
            setShifts((prev) => prev.filter((s) => s.id !== id))
        } catch (err) { console.error(err) }
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
                    <h1 className="text-2xl font-bold text-text-primary mb-1">Estructura de la Empresa</h1>
                    <div className="flex items-center gap-6 mt-2 overflow-x-auto">
                        <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1 whitespace-nowrap">Sedes y Bloques</span>
                    </div>
                </div>
                <button
                    onClick={() => setShowNewVenue(true)}
                    className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Sede
                </button>
            </div>

            {/* Create Venue Form */}
            {showNewVenue && (
                <div className="bg-surface border border-primary/30 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-text-primary">New Venue</h3>
                    <input
                        placeholder="Venue Name"
                        value={newVenueName}
                        onChange={(e) => setNewVenueName(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                    <input
                        placeholder="Address (optional)"
                        value={newVenueAddr}
                        onChange={(e) => setNewVenueAddr(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                    <div className="flex gap-2">
                        <button onClick={handleCreateVenue} disabled={saving || !newVenueName.trim()}
                            className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
                            <Save className="w-4 h-4" /> {saving ? 'Creating...' : 'Create'}
                        </button>
                        <button onClick={() => setShowNewVenue(false)}
                            className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors">
                            <X className="w-4 h-4" /> Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Venues list */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">All Venues</h3>
                    {venues.length === 0 ? (
                        <div className="text-center py-10 text-text-secondary text-sm">No venues. Create one above.</div>
                    ) : (
                        venues.map((v) => (
                            <div key={v.id}
                                className={`bg-surface border rounded-2xl p-4 transition-all
                                    ${selectedVenue?.id === v.id
                                        ? 'border-primary shadow-md ring-2 ring-primary/20'
                                        : 'border-border hover:border-border-strong'
                                    }`}
                            >
                                {editingVenueId === v.id ? (
                                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                                        <input value={evName} onChange={(e) => setEvName(e.target.value)} placeholder="Venue Name"
                                            className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                                        <input value={evAddr} onChange={(e) => setEvAddr(e.target.value)} placeholder="Address (optional)"
                                            className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                                        <div className="flex gap-2">
                                            <button onClick={handleUpdateVenue} disabled={saving}
                                                className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-9 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
                                                <Save className="w-3.5 h-3.5" /> Save
                                            </button>
                                            <button onClick={() => setEditingVenueId(null)}
                                                className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-9 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors">
                                                <X className="w-3.5 h-3.5" /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between cursor-pointer" onClick={() => loadShifts(v)}>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-text-secondary flex-shrink-0" />
                                                <h4 className="text-sm font-semibold text-text-primary truncate">{v.name}</h4>
                                            </div>
                                            {v.address && (
                                                <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" /> {v.address}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button onClick={(e) => startEditVenue(v, e)} className="text-text-secondary hover:text-primary transition-colors p-1">
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button onClick={(e) => handleDeleteVenue(v.id, e)} className="text-text-secondary hover:text-error transition-colors p-1">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <ChevronRight className="w-4 h-4 text-text-secondary" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Shifts panel */}
                <div className="space-y-3">
                    {selectedVenue ? (
                        <>
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                                    Shifts — {selectedVenue.name}
                                </h3>
                                <button
                                    onClick={() => setShowNewShift(true)}
                                    className="flex items-center gap-1 bg-primary/10 text-primary px-3 h-8 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Shift
                                </button>
                            </div>

                            {/* Create Shift Form */}
                            {showNewShift && (
                                <div className="bg-surface border border-primary/30 rounded-2xl p-4 space-y-3">
                                    <input placeholder="Shift Name (e.g. Morning)" value={nsName} onChange={(e) => setNsName(e.target.value)}
                                        className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-text-secondary mb-1 block">Start Time</label>
                                            <input type="time" value={nsStart} onChange={(e) => setNsStart(e.target.value)}
                                                className="w-full bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-text-secondary mb-1 block">End Time</label>
                                            <input type="time" value={nsEnd} onChange={(e) => setNsEnd(e.target.value)}
                                                className="w-full bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleCreateShift} disabled={saving || !nsName.trim() || !nsStart || !nsEnd}
                                            className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-9 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
                                            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Add'}
                                        </button>
                                        <button onClick={() => setShowNewShift(false)}
                                            className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-9 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors">
                                            <X className="w-3.5 h-3.5" /> Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Shifts List */}
                            {loadingShifts ? (
                                <div className="text-center py-10 text-text-secondary text-sm">Loading...</div>
                            ) : shifts.length === 0 ? (
                                <div className="text-center py-10">
                                    <Clock className="w-8 h-8 text-text-disabled mx-auto mb-2" />
                                    <p className="text-sm text-text-secondary">No shifts defined.</p>
                                    <p className="text-xs text-text-disabled mt-1">Add shifts to organize work schedules.</p>
                                </div>
                            ) : (
                                shifts.map((s) => (
                                    <div key={s.id} className="bg-surface border border-border rounded-2xl p-4">
                                        {editingShiftId === s.id ? (
                                            <div className="space-y-3">
                                                <input value={esName} onChange={(e) => setEsName(e.target.value)} placeholder="Shift Name"
                                                    className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs text-text-secondary mb-1 block">Start</label>
                                                        <input type="time" value={esStart} onChange={(e) => setEsStart(e.target.value)}
                                                            className="w-full bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-text-secondary mb-1 block">End</label>
                                                        <input type="time" value={esEnd} onChange={(e) => setEsEnd(e.target.value)}
                                                            className="w-full bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none" />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={handleUpdateShift} disabled={saving}
                                                        className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-9 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
                                                        <Save className="w-3.5 h-3.5" /> Save
                                                    </button>
                                                    <button onClick={() => setEditingShiftId(null)}
                                                        className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-9 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors">
                                                        <X className="w-3.5 h-3.5" /> Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                        <Clock className="w-4 h-4 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-text-primary">{s.name}</p>
                                                        <p className="text-xs text-text-secondary">
                                                            {s.start_time?.substring(0, 5)} — {s.end_time?.substring(0, 5)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => startEditShift(s)} className="text-text-secondary hover:text-primary transition-colors p-1">
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleDeleteShift(s.id)} className="text-text-secondary hover:text-error transition-colors p-1">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </>
                    ) : (
                        <div className="text-center py-20">
                            <Building2 className="w-10 h-10 text-text-disabled mx-auto mb-3" />
                            <p className="text-sm text-text-secondary">Select a venue to manage its shifts.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
