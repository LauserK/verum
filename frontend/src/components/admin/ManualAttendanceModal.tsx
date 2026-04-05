'use client'

import React, { useState, useEffect } from 'react'
import { X, AlertCircle, Calendar, Clock, User } from 'lucide-react'
import { adminApi, attendanceApi, type AdminUser } from '@/lib/api'
import { useVenue } from '@/components/VenueContext'
import { useTranslations } from '@/components/I18nProvider'

interface ManualAttendanceModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

export default function ManualAttendanceModal({
    isOpen,
    onClose,
    onSuccess
}: ManualAttendanceModalProps) {
    const { t } = useTranslations()
    const { selectedVenueId } = useVenue()

    const [users, setUsers] = useState<AdminUser[]>([])
    const [selectedUserId, setSelectedUserId] = useState('')
    const [clockIn, setClockIn] = useState('')
    const [clockOut, setClockOut] = useState('')
    const [reason, setReason] = useState('')
    
    const [isLoadingUsers, setIsLoadingUsers] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchUsers()
            // Reset states when opening
            setSelectedUserId('')
            setClockIn('')
            setClockOut('')
            setReason('')
            setError(null)
            setSuccess(false)
        }
    }, [isOpen])

    async function fetchUsers() {
        setIsLoadingUsers(true)
        try {
            const data = await adminApi.getUsers()
            setUsers(data)
        } catch (err) {
            console.error('Failed to fetch users', err)
            setError('Failed to load users')
        } finally {
            setIsLoadingUsers(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedVenueId) return

        setIsSubmitting(true)
        setError(null)

        try {
            await attendanceApi.manualEntry({
                profile_id: selectedUserId,
                venue_id: selectedVenueId,
                clock_in: new Date(clockIn).toISOString(),
                clock_out: new Date(clockOut).toISOString(),
                reason
            })
            
            setSuccess(true)
            setTimeout(() => {
                onClose()
                onSuccess?.()
            }, 1500)
        } catch (err: any) {
            console.error('Manual entry failed', err)
            setError(err.message || t('admin.attendance.error'))
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-border animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-surface-raised">
                    <h3 className="text-lg font-bold text-text-primary">
                        {t('admin.attendance.manualEntryTitle')}
                    </h3>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-border/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                <div className="p-6">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="w-10 h-10" />
                            </div>
                            <h4 className="text-xl font-bold text-text-primary mb-2">
                                {t('admin.attendance.success')}
                            </h4>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-error/10 border border-error/20 rounded-2xl flex items-center gap-3 text-error text-sm">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    <p>{error}</p>
                                </div>
                            )}

                            {/* User Selector */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1">
                                    {t('admin.attendance.userLabel')}
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                                    <select
                                        required
                                        value={selectedUserId}
                                        onChange={(e) => setSelectedUserId(e.target.value)}
                                        className="w-full h-12 pl-12 pr-4 bg-surface-raised border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none"
                                        disabled={isLoadingUsers}
                                    >
                                        <option value="">{t('admin.attendance.selectUser')}</option>
                                        {users.map(user => (
                                            <option key={user.id} value={user.id}>
                                                {user.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Clock In */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1">
                                    {t('admin.attendance.clockInLabel')}
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                                    <input
                                        type="datetime-local"
                                        required
                                        value={clockIn}
                                        onChange={(e) => setClockIn(e.target.value)}
                                        className="w-full h-12 pl-12 pr-4 bg-surface-raised border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            {/* Clock Out */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1">
                                    {t('admin.attendance.clockOutLabel')}
                                </label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                                    <input
                                        type="datetime-local"
                                        required
                                        value={clockOut}
                                        onChange={(e) => setClockOut(e.target.value)}
                                        className="w-full h-12 pl-12 pr-4 bg-surface-raised border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            {/* Reason */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1">
                                    {t('admin.attendance.reasonLabel')}
                                </label>
                                <textarea
                                    required
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder={t('admin.attendance.reasonPlaceholder')}
                                    className="w-full p-4 bg-surface-raised border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[100px] resize-none"
                                />
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full h-12 bg-primary text-text-inverse rounded-2xl font-bold text-sm hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-text-inverse/30 border-t-text-inverse rounded-full animate-spin" />
                                            {t('admin.attendance.submitting')}
                                        </>
                                    ) : t('admin.attendance.submit')}
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full h-12 bg-surface-raised text-text-primary rounded-2xl font-bold text-sm hover:bg-border/20 transition-colors"
                                >
                                    {t('admin.attendance.cancel')}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
