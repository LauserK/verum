// frontend/src/app/admin/inventory/tickets/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Loader2, AlertTriangle, Search, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Ticket {
  id: string
  title: string
  status: string
  priority: string
  opened_at: string
  closed_at: string | null
  assets?: { id: string; name: string; venue_id: string }
  profiles?: { full_name: string }
}

interface Venue {
  id: string
  name: string
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [filterVenue, setFilterVenue] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStatus, setFilterStatus] = useState('active') // 'active' | 'all' | 'resuelto'
  const [search, setSearch] = useState('')

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      try {
        const { data: userRes } = await supabase.auth.getUser()
        if (!userRes.user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', userRes.user.id)
          .single()

        const orgId = profile?.organization_id

        // Fetch tickets with asset info
        let query = supabase
          .from('repair_tickets')
          .select('*, assets!inner(id, name, venue_id, org_id), profiles!repair_tickets_opened_by_fkey(full_name)')
          .order('opened_at', { ascending: false })

        if (orgId) {
          query = query.eq('assets.org_id', orgId)
        }

        const [ticketsRes, venuesRes] = await Promise.all([
          query,
          orgId ? supabase.from('venues').select('id, name').eq('org_id', orgId) : Promise.resolve({ data: [] })
        ])

        if (ticketsRes.data) setTickets(ticketsRes.data as Ticket[])
        if (venuesRes.data) setVenues(venuesRes.data as Venue[])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  const venueMap = Object.fromEntries(venues.map(v => [v.id, v.name]))

  const filteredTickets = tickets.filter(t => {
    if (filterStatus === 'active' && t.status === 'resuelto') return false
    if (filterStatus === 'resuelto' && t.status !== 'resuelto') return false
    if (filterVenue && t.assets?.venue_id !== filterVenue) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.title.toLowerCase().includes(q) && !t.assets?.name?.toLowerCase().includes(q)) return false
    }
    return true
  })

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Tickets de Reparación</h1>
          <p className="text-sm text-text-secondary">
            {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
            {filterStatus === 'active' ? ' activos' : filterStatus === 'resuelto' ? ' resueltos' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            placeholder="Buscar por título o activo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none appearance-none cursor-pointer"
        >
          <option value="active">Activos</option>
          <option value="all">Todos</option>
          <option value="resuelto">Resueltos</option>
        </select>
        {venues.length > 1 && (
          <select
            value={filterVenue}
            onChange={e => setFilterVenue(e.target.value)}
            className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none appearance-none cursor-pointer"
          >
            <option value="">Todas las sedes</option>
            {venues.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        )}
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none appearance-none cursor-pointer"
        >
          <option value="">Todas las prioridades</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-2xl">
          <AlertTriangle className="w-12 h-12 text-text-secondary mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-text-primary mb-1">
            {tickets.length === 0 ? 'No hay tickets registrados' : 'No hay resultados'}
          </h3>
          <p className="text-sm text-text-secondary max-w-sm mx-auto">
            {tickets.length === 0
              ? 'Los tickets aparecerán aquí cuando un usuario reporte una falla en un activo.'
              : 'Intenta ajustar los filtros para ver más resultados.'}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm divide-y divide-border">
          {filteredTickets.map(ticket => (
            <Link
              key={ticket.id}
              href={`/admin/inventory/tickets/${ticket.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-surface-raised/50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-text-primary text-sm truncate">{ticket.title}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  <span className="font-medium">{ticket.assets?.name}</span>
                  {ticket.assets?.venue_id && venueMap[ticket.assets.venue_id] && (
                    <>
                      <span className="text-border">•</span>
                      <span>{venueMap[ticket.assets.venue_id]}</span>
                    </>
                  )}
                  <span className="text-border">•</span>
                  <span>{formatDistanceToNow(new Date(ticket.opened_at), { locale: es, addSuffix: true })}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${priorityColors[ticket.priority]}`}>
                  {ticket.priority}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusColors[ticket.status]}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
                <ChevronRight className="w-4 h-4 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
