'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Clock } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'

export default function AttendanceGuard({ children }: { children: React.ReactNode }) {
    const [isBlocked, setIsBlocked] = useState(false)
    const { t } = useTranslations('attendance')
    const pathname = usePathname()
    const router = useRouter()

    useEffect(() => {
        const handleAttendanceRequired = () => {
            if (!pathname.includes('/attendance') && !pathname.includes('/login')) {
                setIsBlocked(true)
            }
        }

        // Check if there was a pending block event before mount
        if (window.__attendanceRequiredPending) {
            handleAttendanceRequired()
            delete window.__attendanceRequiredPending
        }

        window.addEventListener('attendance-required', handleAttendanceRequired)
        return () => window.removeEventListener('attendance-required', handleAttendanceRequired)
    }, [pathname])

    // If the user navigates to attendance, unblock (they are taking action)
    useEffect(() => {
        if (pathname.includes('/attendance')) {
            setTimeout(() => {
                if (isBlocked) setIsBlocked(false)
            }, 0)
        }
    }, [pathname, isBlocked])

    if (isBlocked && !pathname.includes('/attendance')) {
        return (
            <div className="fixed inset-0 z-[100] bg-bg flex items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                        <Clock className="w-10 h-10 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-text-primary">{t('requiredTitle')}</h2>
                        <p className="text-text-secondary">{t('requiredDesc')}</p>
                    </div>
                    <button
                        onClick={() => { 
                            setIsBlocked(false)
                            router.push('/attendance') 
                        }}
                        className="w-full bg-primary text-text-inverse h-14 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all active:scale-[0.98]"
                    >
                        {t('goToAttendance')}
                    </button>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
