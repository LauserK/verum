// frontend/src/app/admin/inventory/utensils/counts/[id]/page.tsx
'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi } from '@/lib/api'
import { ArrowLeft, Save, Loader2, Check, AlertCircle, User, Calendar, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTranslations } from '@/components/I18nProvider'

export default function UtensilAuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useTranslations()
  const router = useRouter()
  
  const [countData, setCountData] = useState<any>(null)
  const [confirmedCounts, setConfirmedCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.getUtensilCountDetail(id)
      setCountData(data)
      
      // Pre-fill confirmed counts with initial ones
      const initial: Record<string, number> = {}
      data.items.forEach((item: any) => {
        initial[item.utensil_id] = item.confirmed_count ?? item.initial_count
      })
      setConfirmedCounts(initial)
    } catch (err) {
      console.error('Error fetching count detail:', err)
      setError('No se pudo cargar el detalle del conteo.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const handleConfirmedChange = (utensil_id: string, value: string) => {
    const num = parseInt(value)
    if (!isNaN(num)) {
      setConfirmedCounts(prev => ({ ...prev, [utensil_id]: Math.max(0, num) }))
    }
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError('')
    try {
      const items = Object.entries(confirmedCounts).map(([utensil_id, confirmed_count]) => ({
        utensil_id,
        confirmed_count
      }))

      await adminApi.confirmUtensilCount(id, items)
      alert('Inventario confirmado y cerrado exitosamente.')
      router.push('/admin/inventory/utensils/counts')
    } catch (err) {
      console.error('Error confirming count:', err)
      setError('Error al confirmar el inventario.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-text-secondary font-medium">Cargando detalle del conteo...</p>
      </div>
    )
  }

  if (!countData) {
    return (
      <div className="p-6 text-center">
        <p className="text-text-secondary">{error || 'No se encontró la información.'}</p>
        <button onClick={() => router.back()} className="mt-4 text-primary font-bold">Volver</button>
      </div>
    )
  }

  const isConfirmed = countData.status === 'confirmed'

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 bg-surface border border-border rounded-xl hover:bg-surface-raised transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Auditando Inventario</h1>
          <p className="text-sm text-text-secondary">Revisa y ajusta las cantidades ingresadas por el staff.</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-surface border border-border rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Iniciado por</p>
            <p className="text-sm font-bold text-text-primary">{countData.profiles?.full_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Fecha y Hora</p>
            <p className="text-sm font-bold text-text-primary">
              {format(new Date(countData.created_at), "dd MMM, HH:mm'h'", { locale: es })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Sede</p>
            <p className="text-sm font-bold text-text-primary">{countData.venues?.name || 'Sede Principal'}</p>
          </div>
        </div>
      </div>

      {isConfirmed && (
        <div className="p-4 bg-success/10 border border-success/20 rounded-2xl flex items-center gap-3 text-success">
          <Check className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold">Este inventario ya ha sido auditado y cerrado.</p>
            <p className="text-xs mt-0.5 opacity-90">
              Confirmado por <strong>{countData.confirmed_by_user || 'Supervisor'}</strong> el {format(new Date(countData.confirmed_at), "dd MMM, HH:mm'h'", { locale: es })}.
            </p>
          </div>
        </div>
      )}

      {/* Audit Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-raised text-text-secondary font-semibold border-b border-border">
            <tr>
              <th className="px-6 py-4">Utensilio</th>
              <th className="px-6 py-4 text-center">Conteo Staff</th>
              <th className="px-6 py-4 text-center">Auditado / Real</th>
              <th className="px-6 py-4 text-right">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {countData.items.map((item: any) => {
              const diff = confirmedCounts[item.utensil_id] - item.initial_count
              return (
                <tr key={item.utensil_id} className="hover:bg-surface-raised/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-text-primary">{item.utensils.name}</p>
                    <p className="text-[10px] text-text-secondary uppercase">{item.utensils.unit}</p>
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-text-secondary">
                    {item.initial_count}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <input 
                        type="number"
                        disabled={isConfirmed}
                        value={confirmedCounts[item.utensil_id]}
                        onChange={(e) => handleConfirmedChange(item.utensil_id, e.target.value)}
                        className={`w-20 h-10 text-center rounded-xl font-bold border transition-all
                          ${diff === 0 ? 'bg-surface border-border text-text-primary' : 'bg-warning/5 border-warning/30 text-warning'}
                          disabled:opacity-50 focus:border-primary outline-none`}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {diff !== 0 ? (
                      <span className={`font-black ${diff > 0 ? 'text-success' : 'text-error'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    ) : (
                      <span className="text-text-secondary opacity-30">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Action Bar */}
      {!isConfirmed && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface/90 backdrop-blur-md border-t border-border flex justify-end">
          <div className="max-w-5xl w-full mx-auto flex justify-end gap-3">
            <button 
              onClick={() => router.back()}
              className="px-6 h-12 rounded-xl font-bold text-text-secondary hover:bg-surface-raised transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirm}
              disabled={saving}
              className="bg-primary text-text-inverse px-8 h-12 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Confirmar y Cerrar Inventario
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

