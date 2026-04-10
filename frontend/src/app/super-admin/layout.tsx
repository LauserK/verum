'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getProfile, type Profile } from '@/lib/api'
import { logout } from '@/app/login/actions'
import { LayoutDashboard, Users, Building2, LogOut, Moon, Sun, ShieldCheck } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { useTranslations } from '@/components/I18nProvider'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const { t } = useTranslations()
    const { theme, toggleTheme } = useTheme()
    const router = useRouter()
    const pathname = usePathname()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    const NAV_ITEMS = [
        { href: '/super-admin/dashboard', label: t('superAdmin.metrics'), icon: LayoutDashboard },
        { href: '/super-admin/organizations', label: t('superAdmin.organizations'), icon: Building2 },
        { href: '/super-admin/users', label: t('superAdmin.users'), icon: Users },
    ]

    useEffect(() => {
        async function checkAccess() {
            try {
                const p = await getProfile()
                console.log('SuperAdmin Profile check:', {
                    id: p.id,
                    full_name: p.full_name,
                    is_superadmin: p.is_superadmin,
                    role: p.role
                })
                
                if (p.is_superadmin !== true) {
                    console.warn('Access denied: User is not Super Admin. Redirecting to dashboard...')
                    router.replace('/dashboard')
                    return
                }
                setProfile(p)
                setLoading(false)
            } catch (err) {
                console.error('SuperAdmin access check failed:', err)
                router.replace('/login')
            }
        }
        checkAccess()
    }, [router])

    return (
        <div className="min-h-screen bg-bg">
            {loading ? (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* Top Bar */}
                    <header className="sticky top-0 z-50 bg-surface border-b border-border px-4 h-14 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-6 h-6 text-primary" />
                            <h1 className="text-base font-bold text-text-primary">VERUM Super Admin</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-text-secondary hidden md:block">{profile?.full_name}</span>
                            <button 
                                onClick={toggleTheme}
                                className="p-2 text-text-secondary hover:text-primary hover:bg-surface-raised rounded-xl transition-all"
                                aria-label="Toggle Theme"
                            >
                                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                            </button>
                            <button onClick={() => logout()} className="text-text-secondary hover:text-error transition-colors">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </header>

                    {/* Tab Navigation */}
                    <nav className="bg-surface border-b border-border px-4 flex gap-1 overflow-x-auto">
                        {NAV_ITEMS.map((item) => {
                            const active = pathname === item.href || (item.href !== '/super-admin/dashboard' && pathname.startsWith(item.href))
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
                    <main className="max-w-6xl mx-auto px-4 py-6">
                        {children}
                    </main>
                </>
            )}
        </div>
    )
}
