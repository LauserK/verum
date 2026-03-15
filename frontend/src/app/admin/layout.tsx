'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getProfile, type Profile } from '@/lib/api'
import { logout } from '@/app/login/actions'
import { LayoutDashboard, ClipboardList, FileText, LogOut, ChevronLeft, Users, Building2, Settings, Box } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { t } = useTranslations()
    const router = useRouter()
    const pathname = usePathname()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    const NAV_ITEMS = [
        { href: '/admin/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
        { href: '/admin/templates', label: t('nav.templates'), icon: ClipboardList },
        { href: '/admin/submissions', label: t('nav.submissions'), icon: FileText },
        { href: '/admin/team', label: t('nav.team'), icon: Users },
        { href: '/admin/venues', label: t('nav.venues'), icon: Building2 },
        { href: '/admin/inventory/assets', label: t('nav.inventory'), icon: Box },
        { href: '/admin/settings/roles', label: t('nav.settings'), icon: Settings },
    ]

    useEffect(() => {
        async function checkAccess() {
            try {
                const p = await getProfile()
                if (p.role !== 'admin') {
                    router.push('/dashboard')
                    return
                }
                setProfile(p)
            } catch {
                router.push('/login')
            } finally {
                setLoading(false)
            }
        }
        checkAccess()
    }, [router])

    if (loading) {
        return (
            <div className="min-h-screen bg-bg flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg">
            {/* Top Bar */}
            <header className="sticky top-0 z-50 bg-surface border-b border-border px-4 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push('/dashboard')} className="text-text-secondary hover:text-text-primary transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-base font-bold text-text-primary">VERUM Admin</h1>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary hidden sm:block">{profile?.full_name}</span>
                    <button onClick={() => logout()} className="text-text-secondary hover:text-error transition-colors">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Tab Navigation */}
            <nav className="bg-surface border-b border-border px-4 flex gap-1 overflow-x-auto">
                {NAV_ITEMS.map((item) => {
                    const active = pathname.startsWith(item.href)
                    const Icon = item.icon
                    return (
                        <button
                            key={item.href}
                            onClick={() => router.push(item.href)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                                ${active
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {item.label}
                        </button>
                    )
                })}
            </nav>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-4 py-6">
                {children}
            </main>
        </div>
    )
}
