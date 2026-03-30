'use client'

import { useActionState, useState } from 'react'
import { login } from './actions'
import { Loader2, Utensils, IdCard, Lock, Eye, EyeOff, Globe } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'

export default function LoginPage() {
    const { t, language, setLanguage } = useTranslations('login');
    const [state, formAction, isPending] = useActionState(async (prevState: unknown, formData: FormData) => {
        return await login(formData)
    }, null)

    const [showPassword, setShowPassword] = useState(false)

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'es' : 'en')
    }

    return (
        <div className="flex justify-center items-center min-h-screen bg-slate-50 p-4 font-sans">
            <div className="absolute top-4 right-4">
                <button
                    onClick={toggleLanguage}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                    title={t('switchLanguage')}
                >
                    <Globe className="w-4 h-4" />
                    {language === 'en' ? 'EN' : 'ES'}
                </button>
            </div>
            <div className="w-full max-w-[400px] bg-white border border-gray-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col">
                <div className="flex flex-col items-center pt-10 pb-4">
                    <div className="bg-[#3b82f6] w-[60px] h-[60px] rounded-[14px] flex items-center justify-center text-white shadow-sm mb-5">
                        <Utensils className="w-8 h-8" strokeWidth={2} />
                    </div>
                    <h1 className="text-[22px] font-bold text-slate-900 tracking-tight leading-none mb-2">{t('title')}</h1>
                    <p className="text-[14px] font-medium text-slate-500">{t('subtitle')}</p>
                </div>

                <div className="px-8 pb-8 pt-2">
                    <h2 className="text-xl font-bold text-slate-900 mb-6 mt-1">{t('signIn')}</h2>

                    <form action={formAction} className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="email" className="text-sm font-medium text-slate-900">
                                {t('employeeId')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <IdCard className="w-5 h-5" strokeWidth={2} />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="text"
                                    required
                                    placeholder={t('employeeIdPlaceholder')}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-4 h-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors"
                                    disabled={isPending}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="password" className="text-sm font-medium text-slate-900">
                                {t('password')}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Lock className="w-5 h-5" strokeWidth={2} />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder={t('passwordPlaceholder')}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-11 h-12 text-sm text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors tracking-widest font-medium"
                                    disabled={isPending}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
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
                                        className="appearance-none w-[18px] h-[18px] border border-slate-300 rounded-[5px] peer checked:bg-blue-500 checked:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer bg-white"
                                    />
                                    <svg className="absolute w-[14px] h-[14px] text-white left-[2px] top-[2px] pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                <span className="text-[14px] font-medium text-slate-600 group-hover:text-slate-800 transition-colors">{t('rememberMe')}</span>
                            </label>
                            
                            <a href="#" className="text-[14px] font-medium text-blue-500 hover:text-blue-600 transition-colors">
                                {t('forgotPassword')}
                            </a>
                        </div>

                        {state?.error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex gap-2 items-start mt-2">
                                <span className="shrink-0 mt-0.5">⚠️</span>
                                <span>{state.error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="mt-3 bg-[#3b82f6] text-white rounded-[10px] h-12 font-medium hover:bg-blue-600 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-sm text-[15px]"
                            disabled={isPending}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    {t('signingIn')}
                                </>
                            ) : (
                                t('signIn')
                            )}
                        </button>
                    </form>
                </div>
                
                <div className="bg-slate-50/80 border-t border-slate-100 px-6 py-[18px] flex flex-col items-center justify-center text-[13px] text-slate-500 mt-auto">
                    <p>{t('authorizedOnly')}</p>
                    <p className="mt-1">{t('version')}</p>
                </div>
            </div>
        </div>
    )
}
