'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
    Settings, 
    Moon, 
    Sun, 
    Languages, 
    Info, 
    LogOut, 
    Building2, 
    MapPin, 
    User,
    ChevronRight,
    Monitor
} from 'lucide-react'
import { getProfile, type Profile } from '@/lib/api'
import { useTranslations } from '@/components/I18nProvider'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/utils/supabase/client'

// ── Skeleton ────────────────────────────────────────
function SettingsSkeleton() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Profile Skeleton */}
            <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-surface-raised" />
                <div className="space-y-2">
                    <div className="h-4 w-32 bg-surface-raised rounded" />
                    <div className="h-3 w-20 bg-surface-raised rounded" />
                </div>
            </div>

            {/* Sections Skeletons */}
            {[1, 2].map((s) => (
                <div key={s} className="space-y-2">
                    <div className="h-3 w-24 bg-surface-raised rounded ml-2" />
                    <div className="bg-surface border border-border rounded-2xl p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-surface-raised rounded-lg" />
                                <div className="h-4 w-28 bg-surface-raised rounded" />
                            </div>
                            <div className="w-12 h-6 bg-surface-raised rounded-full" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function SettingsPage() {
    const router = useRouter()
    const { t, language, setLanguage } = useTranslations('settings')
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const [theme, setTheme] = useState<'light' | 'dark'>('light')

    useEffect(() => {
        // Load profile
        getProfile()
            .then(setProfile)
            .catch(() => router.push('/login'))
            .finally(() => setLoading(false))

        // Load theme from localStorage or system
        const savedTheme = localStorage.getItem('verum-theme') as 'light' | 'dark'
        if (savedTheme) {
            setTimeout(() => {
                if (theme !== savedTheme) setTheme(savedTheme)
            }, 0)
            document.documentElement.setAttribute('data-theme', savedTheme)
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            const defaultTheme = prefersDark ? 'dark' : 'light'
            setTimeout(() => {
                if (theme !== defaultTheme) setTheme(defaultTheme)
            }, 0)
            document.documentElement.setAttribute('data-theme', defaultTheme)
        }
    }, [router, theme])

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light'
        setTheme(newTheme)
        localStorage.setItem('verum-theme', newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
    }

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    const currentVenue = profile?.venues.find(v => v.id === profile.venue_id) || profile?.venues[0]

    return (
        <div className="min-h-screen bg-bg pb-24">
            {/* Header */}
            <header className="bg-surface border-b border-border sticky top-0 z-40">
                <div className="max-w-lg mx-auto px-4 h-16 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Settings className="w-6 h-6 text-primary" />
                    </div>
                    <h1 className="text-xl font-bold text-text-primary">{t('title')}</h1>
                </div>
            </header>

            <main className="max-w-lg mx-auto p-4 space-y-6">
                
                {loading ? (
                    <SettingsSkeleton />
                ) : (
                    <>
                        {/* Profile Section */}
                        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center border border-border">
                                <User className="w-6 h-6 text-text-secondary" />
                            </div>
                            <div>
                                <h2 className="font-bold text-text-primary">{profile?.full_name || 'User'}</h2>
                                <p className="text-xs text-text-secondary capitalize">{profile?.role || 'Staff'}</p>
                            </div>
                        </div>

                        {/* Appearance Section */}
                        <section className="space-y-2">
                            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider px-2">
                                {t('appearance')}
                            </h3>
                            <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
                                <button 
                                    onClick={toggleTheme}
                                    className="w-full flex items-center justify-between p-4 hover:bg-surface-raised transition-colors border-b border-border"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-warning/10 text-warning">
                                            {theme === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                                        </div>
                                        <span className="text-sm font-medium text-text-primary">
                                            {theme === 'light' ? t('lightMode') : t('darkMode')}
                                        </span>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${theme === 'dark' ? 'bg-primary' : 'bg-border'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </button>
                            </div>
                        </section>

                        {/* Language Section */}
                        <section className="space-y-2">
                            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider px-2">
                                {t('language')}
                            </h3>
                            <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                            <Languages className="w-5 h-5" />
                                        </div>
                                        <span className="text-sm font-medium text-text-primary">{t('language')}</span>
                                    </div>
                                    <select 
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value as 'en' | 'es')}
                                        className="bg-surface-raised text-sm font-medium text-text-primary px-3 py-1.5 rounded-lg border border-border outline-none focus:border-primary"
                                    >
                                        <option value="es">Español</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        {/* Info Section */}
                        <section className="space-y-2">
                            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider px-2">
                                {t('info')}
                            </h3>
                            <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-success/10 text-success">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="block text-xs text-text-secondary">{t('organization')}</span>
                                            <span className="text-sm font-medium text-text-primary">
                                                Ragazza Padel
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-info/10 text-info">
                                            <MapPin className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <span className="block text-xs text-text-secondary">{t('venue')}</span>
                                            <span className="text-sm font-medium text-text-primary">
                                                {currentVenue?.name}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-text-secondary/10 text-text-secondary">
                                            <Monitor className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="block text-xs text-text-secondary">{t('version')}</span>
                                            <span className="text-sm font-medium text-text-primary">2.4.0-build.82</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Logout */}
                        <button 
                            onClick={handleLogout}
                            className="w-full bg-error/10 text-error font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-error/20 transition-colors shadow-sm"
                        >
                            <LogOut className="w-5 h-5" />
                            {t('logout')}
                        </button>
                    </>
                )}

            </main>

            <BottomNav />
        </div>
    )
}
