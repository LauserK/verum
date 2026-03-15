// frontend/src/app/admin/inventory/tickets/[id]/page.tsx
'use client'

import { use } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  ArrowLeft, Loader2, AlertTriangle, Eye, FileText, ShoppingCart,
  StickyNote, CheckCircle2, Clock, DollarSign, Send, X, Plus, User
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface TicketEntry {
  id: string
  type: string
  description: string
  technician: string | null
  cost: number | null
  attachments: string[] | null
  next_action: string | null
  status_after: string | null
  created_at: string
  profiles?: { full_name: string }
}

interface TicketDetail {
  id: string
  title: string
  status: string
  priority: string
  opened_at: string
  closed_at: string | null
  total_cost: number
  entries: TicketEntry[]
  assets?: { id: string; name: string; qr_code: string; venue_id: string; status: string }
  profiles?: { full_name: string }
}

const entryIcons: Record<string, typeof AlertTriangle> = {
  nota: StickyNote,
  visita: Eye,
  presupuesto: FileText,
  compra: ShoppingCart,
  cierre: CheckCircle2,
}

const entryColors: Record<string, string> = {
  nota: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  visita: 'bg-primary/10 text-primary border-primary/20',
  presupuesto: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  compra: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  cierre: 'bg-success/10 text-success border-success/20',
}

const entryLabels: Record<string, string> = {
  nota: 'Nota',
  visita: 'Visita Técnica',
  presupuesto: 'Presupuesto',
  compra: 'Compra de Repuesto',
  cierre: 'Cierre',
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Add entry form
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [entryType, setEntryType] = useState('nota')
  const [entryDesc, setEntryDesc] = useState('')
  const [entryTechnician, setEntryTechnician] = useState('')
  const [entryCost, setEntryCost] = useState('')
  const [entryNextAction, setEntryNextAction] = useState('')
  const [entryStatusAfter, setEntryStatusAfter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Close ticket
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [closeDesc, setCloseDesc] = useState('Reparación completada y verificada.')
  const [closeCost, setCloseCost] = useState('')
  const [closing, setClosing] = useState(false)

  const fetchTicket = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tickets/${id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (!res.ok) throw new Error('Ticket no encontrado')

      const data = await res.json()
      setTicket(data as TicketDetail)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTicket()
  }, [id])

  const handleAddEntry = async () => {
    if (!entryDesc.trim()) {
      setSubmitError('La descripción es requerida.')
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const body: Record<string, unknown> = {
        type: entryType,
        description: entryDesc,
      }
      if (entryTechnician) body.technician = entryTechnician
      if (entryCost) body.cost = parseFloat(entryCost)
      if (entryNextAction) body.next_action = entryNextAction
      if (entryStatusAfter) body.status_after = entryStatusAfter

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tickets/${id}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail))
      }

      // Reset form & reload
      setShowAddEntry(false)
      setEntryDesc('')
      setEntryTechnician('')
      setEntryCost('')
      setEntryNextAction('')
      setEntryStatusAfter('')
      setLoading(true)
      await fetchTicket()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseTicket = async () => {
    setClosing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const body: Record<string, unknown> = { description: closeDesc }
      if (closeCost) body.cost = parseFloat(closeCost)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tickets/${id}/close`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail))
      }

      setShowCloseForm(false)
      setLoading(true)
      await fetchTicket()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setClosing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-text-secondary mx-auto mb-4" />
        <p className="text-text-primary font-semibold">{error || 'Ticket no encontrado'}</p>
        <button onClick={() => router.back()} className="mt-4 text-primary font-medium hover:underline">
          Volver
        </button>
      </div>
    )
  }

  const priorityColors: Record<string, string> = {
    baja: 'bg-blue-500/10 text-blue-600',
    media: 'bg-warning/10 text-warning',
    alta: 'bg-orange-500/10 text-orange-600',
    critica: 'bg-error/10 text-error',
  }

  const statusColors: Record<string, string> = {
    abierto: 'bg-error/10 text-error',
    en_progreso: 'bg-warning/10 text-warning',
    esperando: 'bg-blue-500/10 text-blue-600',
    resuelto: 'bg-success/10 text-success',
  }

  const isOpen = ticket.status !== 'resuelto'

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors mt-0.5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-text-primary leading-tight">{ticket.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusColors[ticket.status]}`}>
              {ticket.status.replace('_', ' ')}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${priorityColors[ticket.priority]}`}>
              {ticket.priority}
            </span>
            {ticket.assets && (
              <span className="text-xs text-text-secondary">
                → <span className="font-medium">{ticket.assets.name}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <Clock className="w-5 h-5 text-text-secondary mx-auto mb-1" />
          <p className="text-lg font-bold text-text-primary">
            {formatDistanceToNow(new Date(ticket.opened_at), { locale: es })}
          </p>
          <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold mt-0.5">Abierto</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <DollarSign className="w-5 h-5 text-text-secondary mx-auto mb-1" />
          <p className="text-lg font-bold text-text-primary">
            {ticket.total_cost > 0 ? `$${ticket.total_cost.toLocaleString()}` : '$0'}
          </p>
          <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold mt-0.5">Costo total</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <FileText className="w-5 h-5 text-text-secondary mx-auto mb-1" />
          <p className="text-lg font-bold text-text-primary">{ticket.entries.length}</p>
          <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold mt-0.5">Entradas</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        <h2 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Línea de Tiempo</h2>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-3 bottom-3 w-px bg-border" />

          <div className="space-y-0">
            {ticket.entries.map((entry, idx) => {
              const Icon = entryIcons[entry.type] || StickyNote
              const colorClasses = entryColors[entry.type] || entryColors.nota
              const isLast = idx === ticket.entries.length - 1

              return (
                <div key={entry.id} className="relative flex gap-4 pb-6">
                  {/* Icon */}
                  <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${colorClasses}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>

                  {/* Content */}
                  <div className={`flex-1 bg-surface border border-border rounded-xl p-4 shadow-sm ${isLast ? 'ring-2 ring-primary/10' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${colorClasses}`}>
                          {entryLabels[entry.type] || entry.type}
                        </span>
                        {entry.status_after && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${statusColors[entry.status_after] || ''}`}>
                            → {entry.status_after.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-secondary">
                        {format(new Date(entry.created_at), "dd MMM HH:mm", { locale: es })}
                      </span>
                    </div>

                    <p className="text-sm text-text-primary leading-relaxed">{entry.description}</p>

                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {entry.profiles?.full_name && (
                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                          <User className="w-3 h-3" /> {entry.profiles.full_name}
                        </span>
                      )}
                      {entry.technician && (
                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                          🔧 {entry.technician}
                        </span>
                      )}
                      {entry.cost != null && entry.cost > 0 && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-text-primary bg-surface-raised px-2 py-0.5 rounded-md">
                          <DollarSign className="w-3 h-3" /> {entry.cost.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Next action */}
                    {entry.next_action && (
                      <div className="mt-3 bg-primary/5 border border-primary/10 rounded-lg p-2.5">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Próxima acción</p>
                        <p className="text-sm text-text-primary font-medium">{entry.next_action}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddEntry(false)} />
          <div className="relative bg-surface border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4 animate-in slide-in-from-bottom-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">Agregar Entrada</h2>
              <button onClick={() => setShowAddEntry(false)} className="p-1 text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitError && (
              <div className="p-3 bg-error/10 text-error text-sm rounded-xl border border-error/20">{submitError}</div>
            )}

            {/* Type selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Tipo de entrada</label>
              <div className="grid grid-cols-2 gap-2">
                {['visita', 'presupuesto', 'compra', 'nota'].map(type => {
                  const Icon = entryIcons[type] || StickyNote
                  return (
                    <button
                      key={type}
                      onClick={() => setEntryType(type)}
                      className={`flex items-center gap-2 h-10 px-3 rounded-xl text-sm font-semibold border transition-all
                        ${entryType === type
                          ? `${entryColors[type]} border-current`
                          : 'bg-surface-raised text-text-secondary border-border hover:border-text-secondary'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      {entryLabels[type]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Common: description */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Descripción</label>
              <textarea
                placeholder="Describe lo realizado o la información relevante..."
                value={entryDesc}
                onChange={e => setEntryDesc(e.target.value)}
                rows={3}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
              />
            </div>

            {/* Conditional fields */}
            {entryType === 'visita' && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-text-secondary">Técnico</label>
                <input
                  placeholder="Nombre del técnico"
                  value={entryTechnician}
                  onChange={e => setEntryTechnician(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            )}

            {(entryType === 'visita' || entryType === 'presupuesto' || entryType === 'compra') && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-text-secondary">Costo ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={entryCost}
                  onChange={e => setEntryCost(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            )}

            {/* Next action */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Próxima acción (opcional)</label>
              <input
                placeholder="Ej: Esperar repuesto, Agendar segunda visita..."
                value={entryNextAction}
                onChange={e => setEntryNextAction(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            {/* Status after */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Nuevo estado del ticket (opcional)</label>
              <select
                value={entryStatusAfter}
                onChange={e => setEntryStatusAfter(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary outline-none appearance-none cursor-pointer"
              >
                <option value="">Sin cambio</option>
                <option value="en_progreso">En progreso</option>
                <option value="esperando">Esperando</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAddEntry(false)}
                className="flex-1 h-12 rounded-xl font-semibold text-sm border border-border text-text-primary hover:bg-surface-raised transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddEntry}
                disabled={submitting}
                className="flex-1 h-12 rounded-xl font-semibold text-sm bg-primary text-text-inverse hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Ticket Modal */}
      {showCloseForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCloseForm(false)} />
          <div className="relative bg-surface border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4 animate-in slide-in-from-bottom-4">
            <h2 className="text-lg font-bold text-text-primary">Cerrar Ticket</h2>
            <p className="text-sm text-text-secondary">El activo volverá al estado <strong>operativo</strong> y se actualizará la fecha de última revisión.</p>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Nota de cierre</label>
              <textarea
                value={closeDesc}
                onChange={e => setCloseDesc(e.target.value)}
                rows={2}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Costo final adicional (opcional)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={closeCost}
                onChange={e => setCloseCost(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCloseForm(false)}
                className="flex-1 h-12 rounded-xl font-semibold text-sm border border-border text-text-primary hover:bg-surface-raised transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseTicket}
                disabled={closing}
                className="flex-1 h-12 rounded-xl font-semibold text-sm bg-success text-text-inverse hover:bg-success/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {closing ? 'Cerrando...' : 'Cerrar Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Action Bar */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface/90 backdrop-blur-md border-t border-border">
          <div className="max-w-3xl mx-auto flex gap-3">
            <button
              onClick={() => setShowAddEntry(true)}
              className="flex-1 bg-primary text-text-inverse h-12 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-hover transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Agregar Entrada
            </button>
            <button
              onClick={() => setShowCloseForm(true)}
              className="bg-success text-text-inverse h-12 px-5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-success/90 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" /> Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
