// frontend/src/app/inventory/utensils/count/page.tsx
'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { adminApi, getProfile, getDueSchedules, type Utensil, type UtensilCategory } from '@/lib/api'
import { ArrowLeft, Save, Loader2, Minus, Plus, ClipboardList, Info } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'
import { useVenue } from '@/components/VenueContext'

function CountContent() {
  const { t } = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get('schedule_id')
  const { selectedVenueId, activeOrgId } = useVenue()
  
  const [utensils, setUtensils] = useState<Utensil[]>([])
  const [categories, setCategories] = useState<UtensilCategory[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [scheduleName, setScheduleName] = useState<string | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [venueId, setVenueId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      let vId = selectedVenueId
      let oId = activeOrgId

      if (!vId || !oId) {
        const profile = await getProfile()
        vId = vId || profile.venue_id || null
        oId = oId || profile.organization_id || null
      }

      setVenueId(vId)

      if (oId && vId) {
        const [utRes, catRes] = await Promise.all([
          adminApi.getUtensils({ org_id: oId }),
          adminApi.getUtensilCategories(oId)
        ])
        
        let activeUtensils = utRes.filter(u => u.is_active)
        
        if (scheduleId) {
          // Fetch schedule details to filter items
          const schedules = await getDueSchedules(vId)
          const sched = schedules.find(s => s.id === scheduleId)
          if (sched) {
            setScheduleName(sched.name)
            if (sched.scope === 'category' && sched.category_id) {
              activeUtensils = activeUtensils.filter(u => u.category_id === sched.category_id)
            } else if (sched.scope === 'custom' && sched.item_ids) {
              activeUtensils = activeUtensils.filter(u => sched.item_ids?.includes(u.id))
            }
          }
        }

        setUtensils(activeUtensils)
        setCategories(catRes)
        
        // Initialize counts with 0
        const initialCounts: Record<string, number> = {}
        activeUtensils.forEach(u => {
          initialCounts[u.id] = 0
        })
        setCounts(initialCounts)
      }
    } catch (err) {
      console.error('Error fetching counting data:', err)
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [scheduleId, selectedVenueId, activeOrgId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updateCount = (id: string, delta: number) => {
    setCounts(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }))
  }

  const handleInputChange = (id: string, value: string) => {
    const num = parseInt(value)
    if (!isNaN(num)) {
      setCounts(prev => ({
        ...prev,
        [id]: Math.max(0, num)
      }))
    } else if (value === '') {
      setCounts(prev => ({
        ...prev,
        [id]: 0
      }))
    }
  }

  const handleSubmit = async () => {
    if (!venueId) {
      alert('Tu usuario no tiene una sede asignada. Contacta a un administrador.')
      return
    }

    if (!confirm(t('inventory.utensils.countFlow.confirmSubmit'))) return

    setSubmitting(true)
    try {
      const items = Object.entries(counts).map(([utensil_id, count]) => ({
        utensil_id,
        count
      }))

      await adminApi.createUtensilCount({
        venue_id: venueId,
        items,
        schedule_id: scheduleId || undefined
      })

      alert(t('inventory.utensils.countFlow.success'))
      router.push('/dashboard')
    } catch (err) {
      console.error('Error submitting count:', err)
      alert(t('inventory.utensils.countFlow.error'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-text-secondary font-medium">Cargando inventario...</p>
      </div>
    )
  }

  // Group utensils by category
  const groupedUtensils = categories.reduce((acc, cat) => {
    const items = utensils.filter(u => u.category_id === cat.id)
    if (items.length > 0) {
      acc.push({ category: cat, items })
    }
    return acc
  }, [] as Array<{ category: UtensilCategory, items: Utensil[] }>)

  // Add items without category
  const uncategorized = utensils.filter(u => !u.category_id)
  if (uncategorized.length > 0) {
    groupedUtensils.push({ 
      category: { id: 'other', name: 'Sin Categoría', org_id: '' }, 
      items: uncategorized 
    })
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border px-4 h-14 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-text-primary">{scheduleName || t('inventory.utensils.countFlow.title')}</h1>
      </header>

      <main className="p-4 space-y-6 max-w-lg mx-auto">
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex gap-3 items-start">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-primary">{t('inventory.utensils.countFlow.instructions')}</p>
            <p className="text-xs text-text-secondary">{t('inventory.utensils.countFlow.subtitle')}</p>
          </div>
        </div>

        {groupedUtensils.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            {t('inventory.utensils.countFlow.empty')}
          </div>
        ) : (
          groupedUtensils.map(({ category, items }) => (
            <section key={category.id} className="space-y-3">
              <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-1">
                {category.name}
              </h2>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-text-primary truncate">{item.name}</p>
                      <p className="text-xs text-text-secondary uppercase tracking-wider">{item.unit}</p>
                    </div>
                    <div className="flex items-center gap-1 bg-surface-raised rounded-xl p-1 border border-border">
                      <button 
                        onClick={() => updateCount(item.id, -1)}
                        className="w-10 h-10 flex items-center justify-center text-text-primary hover:bg-surface rounded-lg transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input 
                        type="number"
                        inputMode="numeric"
                        value={counts[item.id] || 0}
                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                        className="w-14 h-10 bg-transparent text-center font-black text-primary focus:outline-none"
                      />
                      <button 
                        onClick={() => updateCount(item.id, 1)}
                        className="w-10 h-10 flex items-center justify-center text-text-primary hover:bg-surface rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Footer Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface/90 backdrop-blur-md border-t border-border z-20">
        <div className="max-w-lg mx-auto">
          <button 
            onClick={handleSubmit}
            disabled={submitting || utensils.length === 0}
            className="w-full bg-primary text-text-inverse h-14 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <ClipboardList className="w-6 h-6" />}
            {submitting ? t('inventory.utensils.countFlow.submitting') : t('inventory.utensils.countFlow.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UtensilCountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>}>
      <CountContent />
    </Suspense>
  )
}
