'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProfile, type Profile, type VenueInfo } from '@/lib/api'
import { useVenue } from '@/components/VenueContext'
import { useTranslations } from '@/components/I18nProvider'
import { MapPin, ArrowRight, Loader2, LogOut } from 'lucide-react'
import { logout } from '@/app/login/actions'

export default function VenueSelectionPage() {
    const { t } = useTranslations('venueSelection')
    const router = useRouter()
    const { setSelectedVenueId } = useVenue()
    const [loading, setLoading] = useState(true)
    const [venues, setVenues] = useState<VenueInfo[]>([])
    const [error, setError] = useState(false)

    useEffect(() => {
        async function init() {
            try {
                const profile = await getProfile()
                if (profile.venues && profile.venues.length > 0) {
                    if (profile.venues.length === 1) {
                        setSelectedVenueId(profile.venues[0].id)
                        router.replace('/dashboard')
                    } else {
                        setVenues(profile.venues)
                        setLoading(false)
                    }
                } else {
                    setError(true)
                    setLoading(false)
                }
            } catch (err) {
                console.error(err)
                setError(true)
                setLoading(false)
            }
        }
        init()
    }, [setSelectedVenueId, router])

    const handleSelect = (id: string) => {
        setSelectedVenueId(id)
        router.push('/dashboard')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <p className="text-text-secondary font-medium animate-pulse">Cargando tus sedes...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-4">
                    <MapPin className="w-8 h-8" />
                </div>
                <h1 className="text-xl font-bold text-text-primary mb-2">{t('title')}</h1>
                <p className="text-text-secondary mb-8 max-w-xs">{t('noVenues')}</p>
                <button 
                    onClick={() => logout()}
                    className="flex items-center gap-2 text-primary font-bold hover:underline"
                >
                    <LogOut className="w-5 h-5" />
                    {t('backToLogin')}
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-md">
                <header className="text-center mb-10">
                    <h1 className="text-3xl font-black text-text-primary mb-2 tracking-tight uppercase italic">VERUM</h1>
                    <h2 className="text-xl font-bold text-text-primary">{t('title')}</h2>
                    <p className="text-text-secondary mt-1">{t('subtitle')}</p>
                </header>

                <div className="grid gap-4">
                    {venues.map((venue) => (
                        <button
                            key={venue.id}
                            onClick={() => handleSelect(venue.id)}
                            className="group relative bg-surface border border-border rounded-3xl p-6 flex items-center justify-between hover:border-primary hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 active:scale-[0.98] text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-text-inverse transition-colors duration-300">
                                    <MapPin className="w-6 h-6" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors">{venue.name}</h3>
                                    <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mt-0.5">Sede Operativa</p>
                                </div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center text-text-disabled group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300">
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </button>
                    ))}
                </div>

                <div className="mt-12 text-center">
                    <button 
                        onClick={() => logout()}
                        className="text-sm font-bold text-text-disabled hover:text-error transition-colors flex items-center gap-2 mx-auto"
                    >
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
    )
}
