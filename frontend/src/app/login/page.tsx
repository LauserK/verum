'use client'

import { useActionState, useState, useEffect } from 'react'
import { login } from './actions'
import { Loader2, Utensils, IdCard, Lock, Eye, EyeOff, Globe, Sun, Moon } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'

export default function LoginPage() {
    const { t, language, setLanguage } = useTranslations('login');
    const [state, formAction, isPending] = useActionState(async (prevState: unknown, formData: FormData) => {
        return await login(formData)
    }, null)

    const [showPassword, setShowPassword] = useState(false)
    const [theme, setTheme] = useState<'light' | 'dark'>('light')

    useEffect(() => {
        const savedTheme = localStorage.getItem('verum-theme') as 'light' | 'dark'
        if (savedTheme) {
            setTheme(savedTheme)
            document.documentElement.setAttribute('data-theme', savedTheme)
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            const defaultTheme = prefersDark ? 'dark' : 'light'
            setTheme(defaultTheme)
            document.documentElement.setAttribute('data-theme', defaultTheme)
        }
    }, [])

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light'
        setTheme(newTheme)
        localStorage.setItem('verum-theme', newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
    }

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'es' : 'en')
    }

    return (
        <div className="flex justify-center items-center min-h-screen bg-bg p-4 font-sans transition-colors duration-300">
            <div className="absolute top-4 right-4 flex gap-2">
                <button
                    onClick={toggleTheme}
                    className="p-2 bg-surface border border-border rounded-lg shadow-sm text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
                    title="Cambiar tema"
                >
                    {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
                <button
                    onClick={toggleLanguage}
                    className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg shadow-sm text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
                    title={t('switchLanguage')}
                >
                    <Globe className="w-4 h-4" />
                    {language === 'en' ? 'EN' : 'ES'}
                </button>
            </div>
            
            <div className="w-full max-w-[400px] bg-surface border border-border rounded-3xl shadow-xl shadow-black/5 overflow-hidden flex flex-col transition-all duration-300">
                <div className="flex flex-col items-center pt-10 pb-4">
                    <div className="bg-primary w-[64px] h-[64px] rounded-2xl flex items-center justify-center text-text-inverse shadow-lg shadow-primary/20 mb-5">
                        <Utensils className="w-8 h-8" strokeWidth={2.5} />
                    </div>
                    <h1 className="text-2xl font-black text-text-primary tracking-tight leading-none mb-2 italic">VERUM</h1>
                    <p className="text-sm font-bold text-text-secondary uppercase tracking-widest">{t('subtitle')}</p>
                </div>

                <div className="px-8 pb-8 pt-2">
                    <h2 className="text-xl font-bold text-text-primary mb-6 mt-1">{t('signIn')}</h2>

                    <form action={formAction} className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="email" className="text-sm font-bold text-text-secondary uppercase tracking-wider ml-1">
                                {t('employeeId')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-disabled">
                                    <IdCard className="w-5 h-5" strokeWidth={2} />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="text"
                                    required
                                    placeholder={t('employeeIdPlaceholder')}
                                    className="w-full bg-surface-raised border border-border rounded-xl pl-12 pr-4 h-14 text-base text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                    disabled={isPending}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="password" className="text-sm font-bold text-text-secondary uppercase tracking-wider ml-1">
                                {t('password')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-disabled">
                                    <Lock className="w-5 h-5" strokeWidth={2} />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder={t('passwordPlaceholder')}
                                    className="w-full bg-surface-raised border border-border rounded-xl pl-12 pr-12 h-14 text-base text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium tracking-widest"
                                    disabled={isPending}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-disabled hover:text-text-secondary focus:outline-none transition-colors"
                                    tabIndex={-1}
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" strokeWidth={2} />
                                    ) : (
                                        <Eye className="w-5 h-5" strokeWidth={2} />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-1">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input 
                                        type="checkbox" 
                                        name="remember" 
                                        className="appearance-none w-5 h-5 border-2 border-border-strong rounded-lg peer checked:bg-primary checked:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer bg-surface"
                                    />
                                    <svg className="absolute w-3.5 h-3.5 text-text-inverse left-0.5 top-0.5 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                <span className="text-sm font-semibold text-text-secondary group-hover:text-text-primary transition-colors">{t('rememberMe')}</span>
                            </label>
                            
                            <a href="#" className="text-sm font-bold text-primary hover:text-primary-hover transition-colors">
                                {t('forgotPassword')}
                            </a>
                        </div>

                        {state?.error && (
                            <div className="bg-error/10 text-error text-sm p-4 rounded-xl border border-error/20 flex gap-3 items-start mt-2 font-medium">
                                <span className="shrink-0">⚠️</span>
                                <span>{state.error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="mt-3 bg-primary text-text-inverse rounded-xl h-14 font-black hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-lg shadow-primary/20 text-base"
                            disabled={isPending}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-3" />
                                    {t('signingIn')}
                                </>
                            ) : (
                                t('signIn').toUpperCase()
                            )}
                        </button>
                    </form>
                </div>
                
                <div className="bg-surface-raised/50 border-t border-border px-6 py-6 flex flex-col items-center justify-center text-xs text-text-disabled mt-auto text-center">
                    <p className="font-bold uppercase tracking-widest">{t('authorizedOnly')}</p>
                    <p className="mt-1 font-medium opacity-60">{t('version')}</p>
                </div>
            </div>
        </div>
    )
}

