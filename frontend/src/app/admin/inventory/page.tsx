// frontend/src/app/admin/inventory/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { adminApi, getProfile, type VenueInfo, type InventoryDashboardSummary } from '@/lib/api'
import { Box, Wrench, AlertTriangle, ClipboardList, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function InventoryDashboardPage() {
  const [data, setData] = useState<InventoryDashboardSummary | null>(null)
  const [venues, setVenues] = useState<VenueInfo[]>([])
  const [selectedVenue, setSelectedVenue] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProfile().then(p => {
      setVenues(p.venues || [])
    })
  }, [])

  useEffect(() => {
    let active = true
    
    if (selectedVenue || venues.length > 0) {
        setLoading(true)
        adminApi.getInventoryDashboard(selectedVenue || undefined)
          .then(res => {
            if (active) setData(res)
          })
          .catch(console.error)
          .finally(() => {
            if (active) setLoading(false)
          })
    }
    
    return () => { active = false }
  }, [selectedVenue, venues.length])

  if (loading || !data) {
    return <div className="animate-pulse space-y-6 p-6"><div className="h-32 bg-surface rounded-2xl w-full"></div></div>
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard de Inventario</h1>
          <p className="text-sm text-text-secondary mt-1">Resumen unificado de Activos y Utensilios</p>
        </div>
        <select 
          value={selectedVenue} 
          onChange={e => setSelectedVenue(e.target.value)}
          className="bg-surface border border-border rounded-xl px-4 h-10 text-sm focus:border-primary outline-none"
        >
          <option value="">Todas las Sedes</option>
          {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {/* Submenu Redirection Links */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        <Link href="/admin/inventory/assets" className="px-4 py-2 bg-surface border border-border rounded-xl text-sm font-semibold hover:border-primary transition-colors flex items-center gap-2">
          <Box className="w-4 h-4 text-primary" /> Ir a Activos Fijos
        </Link>
        <Link href="/admin/inventory/utensils" className="px-4 py-2 bg-surface border border-border rounded-xl text-sm font-semibold hover:border-primary transition-colors flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" /> Ir a Utensilios
        </Link>
      </div>

      {/* Block 1: Assets Status */}
      <section className="space-y-4 pt-4 border-t border-border">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Box className="w-5 h-5 text-primary" /> Estado de Activos Fijos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface p-5 rounded-2xl border border-border">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Total</p>
            <p className="text-3xl font-black text-text-primary mt-1">{data.asset_stats.total}</p>
          </div>
          <div className="bg-success/10 p-5 rounded-2xl border border-success/20">
            <p className="text-xs font-bold text-success uppercase tracking-wider">Operativos</p>
            <p className="text-3xl font-black text-success mt-1">{data.asset_stats.operativo}</p>
          </div>
          <div className="bg-warning/10 p-5 rounded-2xl border border-warning/20">
            <p className="text-xs font-bold text-warning uppercase tracking-wider">En Reparación</p>
            <p className="text-3xl font-black text-warning mt-1">{data.asset_stats.en_reparacion}</p>
          </div>
          <div className="bg-error/10 p-5 rounded-2xl border border-error/20">
            <p className="text-xs font-bold text-error uppercase tracking-wider">Dados de Baja</p>
            <p className="text-3xl font-black text-error mt-1">{data.asset_stats.baja}</p>
          </div>
        </div>

        {data.active_tickets.length > 0 && (
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Tickets Activos
            </h3>
            <div className="space-y-3">
              {data.active_tickets.map((t) => (
                <Link href={`/admin/inventory/tickets/${t.id}`} key={t.id} className="flex justify-between items-center p-3 hover:bg-surface-raised rounded-xl transition-colors border border-border hover:border-primary/50 group">
                  <div>
                    <p className="font-semibold text-sm text-text-primary group-hover:text-primary transition-colors">{t.assets?.name}</p>
                    <p className="text-xs text-text-secondary mt-1">{t.issue_description || t.title}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning px-2.5 py-1 rounded-md">{t.status.replace('_', ' ')}</span>
                </Link>
              ))}
            </div>
            <div className="mt-4 text-right">
                <Link href="/admin/inventory/tickets" className="text-xs font-bold text-primary hover:underline">Ver todos los tickets →</Link>
            </div>
          </div>
        )}
      </section>

      {/* Block 2: Utensils Alerts */}
      <section className="space-y-4 pt-6 border-t border-border">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" /> Operaciones de Utensilios
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4 flex items-center justify-between">
              Conteos Pendientes
              {data.pending_counts.length > 0 && (
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">{data.pending_counts.length}</span>
              )}
            </h3>
            {data.pending_counts.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-6">No hay conteos pendientes de auditar.</p>
            ) : (
              <div className="space-y-3">
                {data.pending_counts.map((c) => (
                  <Link href={`/admin/inventory/utensils/counts/${c.id}`} key={c.id} className="flex justify-between items-center p-3 bg-surface border border-border hover:border-primary/50 rounded-xl transition-colors group">
                    <div>
                      <p className="font-semibold text-sm text-text-primary group-hover:text-primary transition-colors">Conteo de {c.profiles?.full_name}</p>
                      <p className="text-xs text-text-secondary flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" /> {format(new Date(c.marked_at), "dd MMM, HH:mm", { locale: es })}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            )}
            {data.pending_counts.length > 0 && (
                <div className="mt-4 text-right">
                    <Link href="/admin/inventory/utensils/counts" className="text-xs font-bold text-primary hover:underline">Ver historial de conteos →</Link>
                </div>
            )}
          </div>

          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4 flex items-center justify-between">
              Órdenes Vencidas / Para Hoy
              {data.due_schedules.length > 0 && (
                <span className="bg-error/10 text-error px-2 py-0.5 rounded-full text-xs font-bold">{data.due_schedules.length}</span>
              )}
            </h3>
            {data.due_schedules.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-6">El staff está al día con el cronograma.</p>
            ) : (
              <div className="space-y-3">
                {data.due_schedules.map((s) => {
                  const isOverdue = s.next_due < new Date().toLocaleDateString('en-CA')
                  return (
                  <div key={s.id} className={`flex justify-between items-center p-3 rounded-xl border ${isOverdue ? 'bg-error/5 border-error/20' : 'bg-warning/5 border-warning/20'}`}>
                    <div>
                      <p className="font-semibold text-sm text-text-primary">{s.name}</p>
                      <p className={`text-xs mt-1 ${isOverdue ? 'text-error' : 'text-warning-strong'}`}>
                        {venues.find(v => v.id === s.venue_id)?.name || 'Sede'} - {isOverdue ? 'Vencida el' : 'Para hoy'}: {format(new Date(s.next_due + 'T00:00:00'), "dd MMM", { locale: es })}
                      </p>
                    </div>
                  </div>
                )})}
              </div>
            )}
            <div className="mt-4 text-right">
                <Link href="/admin/inventory/utensils/schedules" className="text-xs font-bold text-primary hover:underline">Administrar programaciones →</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
