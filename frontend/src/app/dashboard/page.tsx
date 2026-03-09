'use client'

import { useEffect, useState } from 'react'
import { logout } from '@/app/login/actions'
import { LogOut } from 'lucide-react'

export default function DashboardClient() {
    const [mounted, setMounted] = useState(false)
    const [theme, setTheme] = useState<'light' | 'dark'>('light')

    useEffect(() => {
        setMounted(true)

        // Check initial theme
        const savedTheme = localStorage.getItem('verum-theme')
        if (savedTheme) {
            setTheme(savedTheme as 'light' | 'dark')
            document.documentElement.setAttribute('data-theme', savedTheme)
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            if (prefersDark) {
                setTheme('dark')
                document.documentElement.setAttribute('data-theme', 'dark')
            }
        }
    }, [])

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light'
        setTheme(newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
        localStorage.setItem('verum-theme', newTheme)
    }

    return (
        <div className="min-h-screen bg-bg p-4 flex flex-col pt-12">
            <div className="flex justify-between items-center mb-8 absolute top-0 left-0 right-0 p-4 border-b border-border bg-surface h-16">
                <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>

                <div className="flex gap-4 items-center">
                    {mounted && (
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-surface-raised text-text-secondary text-sm"
                            aria-label="Toggle Theme"
                        >
                            {theme === 'light' ? '🌙' : '☀️'}
                        </button>
                    )}

                    <button
                        onClick={() => logout()}
                        className="p-2 px-3 text-sm font-medium text-error flex items-center gap-2 hover:bg-error-light rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Salir
                    </button>
                </div>
            </div>

            <div className="w-full max-w-lg mx-auto mt-8 flex flex-col gap-4">
                <div className="bg-surface border border-border p-6 rounded-2xl">
                    <h2 className="text-lg font-semibold text-text-primary mb-2">Bienvenido a Verum!</h2>
                    <p className="text-text-secondary text-sm">
                        Has iniciado sesión exitosamente. La funcionalidad de checklists se implementará en el próximo hito.
                    </p>
                </div>
            </div>
        </div>
    )
}
