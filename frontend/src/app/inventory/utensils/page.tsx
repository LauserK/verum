// frontend/src/app/inventory/utensils/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi, getProfile, getDueSchedules, type CountSchedule } from '@/lib/api'
import { ArrowLeft, ClipboardList, Loader2, Calendar, Clock, AlertCircle } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useVenue } from '@/components/VenueContext'

export default function StaffPendingCountsPage() {
  const { t } = useTranslations()
  const router = useRouter()
  const { selectedVenueId, isLoading: isVenueLoading } = useVenue()
  const [schedules, setSchedules] = useState<CountSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchDueSchedules = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let venueId = selectedVenueId
      
      if (!venueId) {
        const profile = await getProfile()
        venueId = profile.venue_id
      }

      if (!venueId) {
        setError('No tienes una sede asignada para realizar conteos.')
        setLoading(false)
        return
      }

      const dueSchedules = await getDueSchedules(venueId)
      setSchedules(dueSchedules)
    } catch (err) {
      console.error('Error fetching due schedules:', err)
      setError('Error al cargar las tareas pendientes.')
    } finally {
      setLoading(false)
    }
  }, [selectedVenueId])

  useEffect(() => {
    if (!isVenueLoading) {
      fetchDueSchedules()
    }
  }, [fetchDueSchedules, isVenueLoading])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-text-secondary font-medium">Buscando tareas pendientes...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border px-4 h-14 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-text-primary truncate">Tareas de Inventario</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-6">
        {error ? (
          <div className="bg-error/10 border border-error/20 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-error">{error}</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-16 bg-surface border border-border rounded-3xl">
            <ClipboardList className="w-12 h-12 text-success mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-bold text-text-primary mb-2">¡Todo al día!</h2>
            <p className="text-sm text-text-secondary max-w-[250px] mx-auto">
              No tienes órdenes de conteo pendientes para tu sede en este momento.
            </p>
            <button 
              onClick={() => router.push('/inventory/utensils/count')}
              className="mt-6 text-sm font-bold text-primary hover:underline"
            >
              Hacer un conteo libre general
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-bold text-text-secondary uppercase tracking-wider">
              Conteos Programados
            </p>
            {schedules.map(schedule => {
              // Comparar fechas usando strings YYYY-MM-DD para evitar problemas de horas
              const todayStr = new Date().toLocaleDateString('en-CA') // formato local YYYY-MM-DD
              const isOverdue = schedule.next_due < todayStr

              return (
              <button
                key={schedule.id}
                onClick={() => router.push(`/inventory/utensils/count?schedule_id=${schedule.id}`)}
                className="w-full text-left bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all group shadow-sm flex flex-col gap-3 active:scale-[0.98]"
              >
                <div className="flex items-start justify-between w-full">
                  <div>
                    <h3 className="font-bold text-text-primary text-lg leading-tight mb-1">
                      {schedule.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                        {schedule.scope === 'all' ? 'Todo' : schedule.scope === 'category' ? 'Categoría' : 'Personalizado'}
                      </span>
                      {schedule.frequency === 'daily' && (
                        <span className="bg-surface-raised text-text-secondary text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                          Diario
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center text-text-secondary group-hover:bg-primary group-hover:text-text-inverse transition-colors flex-shrink-0">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                </div>

                <div className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl w-full ${isOverdue ? 'text-error bg-error/10' : 'text-warning bg-warning/10'}`}>
                  <Clock className="w-4 h-4" />
                  {isOverdue ? 'Vencido el:' : 'Vence hoy:'} {format(new Date(schedule.next_due + 'T00:00:00'), "dd 'de' MMMM", { locale: es })}
                </div>
              </button>
            )})}
          </div>
        )}
      </main>
    </div>
  )
}
