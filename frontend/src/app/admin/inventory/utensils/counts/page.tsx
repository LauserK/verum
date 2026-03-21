// frontend/src/app/admin/inventory/utensils/counts/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminApi, type UtensilCount, getProfile } from '@/lib/api'
import { Loader2, Calendar, User, ChevronRight, ClipboardCheck, History } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTranslations } from '@/components/I18nProvider'

export default function UtensilCountsPage() {
  const { t } = useTranslations()
  const [counts, setCounts] = useState<UtensilCount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCounts = useCallback(async () => {
    setLoading(true)
    try {
      const profile = await getProfile()
      if (profile.organization_id) {
        // List counts for the organization (currently backend list_utensil_counts lists all, but filtered by venue if provided)
        const data = await adminApi.getUtensilsCounts()
        setCounts(data)
      }
    } catch (err) {
      console.error('Error fetching counts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Historial de Conteos</h1>
          <div className="flex items-center gap-6 mt-2">
            <Link href="/admin/inventory/assets" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.assets.listTab')}
            </Link>
            <Link href="/admin/inventory/utensils" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.utensils.listTab')}
            </Link>
            <Link href="/admin/inventory/utensils/categories" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.utensils.categoriesTab')}
            </Link>
            <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1">Historial</span>
            <Link href="/admin/inventory/utensils/schedules" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              Programación
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-surface-raised rounded-2xl w-full"></div>
          ))}
        </div>
      ) : counts.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-2xl">
          <History className="w-12 h-12 text-text-secondary mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-text-primary mb-1">Sin conteos registrados</h3>
          <p className="text-sm text-text-secondary">Los inventarios físicos realizados por el staff aparecerán aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {counts.map((c) => (
            <Link 
              key={c.id} 
              href={`/admin/inventory/utensils/counts/${c.id}`}
              className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/30 transition-all group shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
                    ${c.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-text-primary truncate">
                        Conteo {format(new Date(c.created_at), "dd 'de' MMMM", { locale: es })}
                      </p>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
                        ${c.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                        {c.status === 'pending' ? 'Pendiente' : 'Confirmado'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3 h-3" /> {c.profiles?.full_name || 'Staff'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> {format(new Date(c.created_at), "HH:mm'h'")}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-secondary group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
