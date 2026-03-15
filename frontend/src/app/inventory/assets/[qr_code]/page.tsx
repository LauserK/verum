// frontend/src/app/inventory/assets/[qr_code]/page.tsx
'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { 
  ArrowLeft, Box, Calendar, Wrench, ShieldCheck, Activity, 
  MapPin, Hash, Loader2, AlertTriangle, ChevronDown, ChevronUp,
  Clock, DollarSign, Send
} from 'lucide-react';
import { format, differenceInDays, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface AssetDetail {
  id: string;
  name: string;
  serial: string;
  brand: string;
  model: string;
  purchase_date: string;
  status: string;
  location_note: string;
  last_reviewed_at: string;
  asset_categories: {
    name: string;
    review_interval_days: number;
  };
}

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  opened_at: string;
  closed_at: string | null;
  total_cost?: number;
  entry_count?: number;
  profiles?: { full_name: string };
}

interface TicketEntry {
  id: string;
  type: string;
  description: string;
  next_action: string | null;
  created_at: string;
}

export default function AssetPublicView({ params }: { params: Promise<{ qr_code: string }> }) {
  const { qr_code } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  
  // Ticket state
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [lastEntries, setLastEntries] = useState<TicketEntry[]>([]);
  const [closedTickets, setClosedTickets] = useState<Ticket[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  
  // Report fault form
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportPriority, setReportPriority] = useState('media');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Review Asset State
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
          router.push('/login');
          return;
        }

        // Fetch asset
        const { data, error: dbErr } = await supabase
          .from('assets')
          .select('*, asset_categories(name, review_interval_days)')
          .eq('qr_code', qr_code)
          .single();

        if (dbErr || !data) {
          setError('No se pudo encontrar este activo o fue eliminado.');
          return;
        }

        const assetData = data as AssetDetail;
        setAsset(assetData);

        // Check if needs review
        if (assetData.asset_categories?.review_interval_days) {
          if (!assetData.last_reviewed_at) {
            setNeedsReview(true);
          } else {
            const daysSinceReview = differenceInDays(new Date(), new Date(assetData.last_reviewed_at));
            setNeedsReview(daysSinceReview >= assetData.asset_categories.review_interval_days);
          }
        }

        // Fetch tickets for this asset
        const { data: tickets } = await supabase
          .from('repair_tickets')
          .select('*, profiles!repair_tickets_opened_by_fkey(full_name)')
          .eq('asset_id', assetData.id)
          .order('opened_at', { ascending: false });

        if (tickets && tickets.length > 0) {
          const active = tickets.find((t: Ticket) => t.status !== 'resuelto');
          if (active) {
            setActiveTicket(active as Ticket);
            
            // Fetch last 3 entries for the active ticket
            const { data: entries } = await supabase
              .from('repair_ticket_entries')
              .select('id, type, description, next_action, created_at')
              .eq('ticket_id', active.id)
              .order('created_at', { ascending: false })
              .limit(3);
            
            if (entries) setLastEntries(entries as TicketEntry[]);
          }
          
          const closed = tickets.filter((t: Ticket) => t.status === 'resuelto');
          setClosedTickets(closed as Ticket[]);
        }

      } catch (err) {
        console.error(err);
        setError('Ocurrió un error inesperado.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [qr_code, supabase, router]);


  const handleReportFault = async () => {
    if (!asset || !reportTitle.trim() || !reportDesc.trim()) {
      setSubmitError('Título y descripción son requeridos.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assets/${asset.id}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: reportTitle,
          priority: reportPriority,
          description: reportDesc,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al crear el ticket');
      }

      // Reload the page to show the new ticket
      window.location.reload();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewAsset = async () => {
    if (!asset) return;

    setSubmittingReview(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assets/${asset.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          notes: reviewNotes || 'Revisión preventiva registrada desde la app',
          photo_url: null
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al registrar la revisión');
      }

      // Reload the page to show the new status
      window.location.reload();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error inesperado';
      alert(errorMsg); // Fallback error handling for now
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-text-secondary font-medium">Buscando información del activo...</p>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mb-4 text-text-secondary">
          <Box className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">Activo no encontrado</h1>
        <p className="text-text-secondary mb-8">{error}</p>
        <button 
          onClick={() => router.push('/dashboard')}
          className="bg-primary text-text-inverse px-6 h-12 rounded-xl font-semibold hover:bg-primary-hover transition-colors"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    operativo: 'bg-success text-text-inverse',
    en_reparacion: 'bg-warning text-text-primary',
    baja: 'bg-error text-text-inverse'
  };

  const priorityColors: Record<string, string> = {
    baja: 'bg-blue-500/10 text-blue-600',
    media: 'bg-warning/10 text-warning',
    alta: 'bg-orange-500/10 text-orange-600',
    critica: 'bg-error/10 text-error',
  };

  const ticketStatusColors: Record<string, string> = {
    abierto: 'bg-error/10 text-error',
    en_progreso: 'bg-warning/10 text-warning',
    esperando: 'bg-blue-500/10 text-blue-600',
    resuelto: 'bg-success/10 text-success',
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header Fijo */}
      <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border px-4 h-14 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-text-primary truncate">Ficha del Activo</h1>
      </header>

      <main className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Tarjeta Principal */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">
                {asset.asset_categories?.name || 'Categoría Desconocida'}
              </p>
              <h2 className="text-2xl font-bold text-text-primary leading-tight">{asset.name}</h2>
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${statusColors[asset.status] || 'bg-surface-raised'}`}>
              {asset.status.replace('_', ' ')}
            </div>
          </div>
          
          {asset.location_note && (
            <div className="flex items-start gap-2 text-sm text-text-secondary mt-3 bg-surface-raised p-3 rounded-xl">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
              <p>{asset.location_note}</p>
            </div>
          )}
        </section>

        {/* Active Ticket Card */}
        {activeTicket && (
          <section className="bg-warning/5 border border-warning/20 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-warning/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs font-bold text-warning uppercase tracking-wider mb-0.5">Ticket Activo</p>
                  <h3 className="font-bold text-text-primary text-sm leading-snug">{activeTicket.title}</h3>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${ticketStatusColors[activeTicket.status]}`}>
                {activeTicket.status.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDistanceToNow(new Date(activeTicket.opened_at), { locale: es, addSuffix: true })}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${priorityColors[activeTicket.priority]}`}>
                {activeTicket.priority}
              </span>
            </div>

            {/* Last entry next_action */}
            {lastEntries.length > 0 && lastEntries[0].next_action && (
              <div className="bg-surface rounded-xl p-3 border border-border">
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Próxima acción</p>
                <p className="text-sm text-text-primary font-medium">{lastEntries[0].next_action}</p>
              </div>
            )}

            <button 
              onClick={() => router.push(`/admin/inventory/tickets/${activeTicket.id}`)}
              className="w-full bg-warning/10 text-warning h-10 rounded-xl font-bold text-sm hover:bg-warning/20 transition-colors"
            >
              Ver ticket completo →
            </button>
          </section>
        )}

        {/* Alerta de Revisión */}
        {needsReview && !activeTicket && (
          <section className="bg-warning/10 border border-warning/20 rounded-2xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-warning mb-1">Revisión Preventiva Pendiente</h3>
              <p className="text-xs text-warning/80">Este equipo ha superado el tiempo recomendado para su inspección regular.</p>
            </div>
          </section>
        )}

        {/* Detalles Técnicos */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
            <Wrench className="w-4 h-4 text-text-secondary" />
            Especificaciones Técnicas
          </h3>
          
          <div className="grid grid-cols-2 gap-y-4 gap-x-3">
            <div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Marca
              </p>
              <p className="text-sm font-semibold text-text-primary">{asset.brand || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Modelo
              </p>
              <p className="text-sm font-semibold text-text-primary">{asset.model || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Número de Serial
              </p>
              <p className="text-sm font-semibold font-mono text-text-primary bg-surface-raised px-2 py-1.5 rounded-lg border border-border inline-block">
                {asset.serial || '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Historial Corto */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
            <Calendar className="w-4 h-4 text-text-secondary" />
            Fechas Clave
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">Última revisión:</span>
              <span className="font-semibold text-text-primary">
                {asset.last_reviewed_at 
                  ? format(new Date(asset.last_reviewed_at), "dd MMM yyyy", { locale: es }) 
                  : 'Nunca'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">Fecha de compra:</span>
              <span className="font-semibold text-text-primary">
                {asset.purchase_date 
                  ? format(new Date(`${asset.purchase_date}T00:00:00`), "dd MMM yyyy", { locale: es }) 
                  : '—'}
              </span>
            </div>
          </div>
        </section>

        {/* Closed Tickets */}
        {closedTickets.length > 0 && (
          <section className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setShowClosed(!showClosed)}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-raised/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-text-secondary" />
                <span className="text-sm font-bold text-text-primary">Historial de Reparaciones</span>
                <span className="text-xs bg-surface-raised text-text-secondary px-2 py-0.5 rounded-full font-semibold">{closedTickets.length}</span>
              </div>
              {showClosed ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
            </button>
            
            {showClosed && (
              <div className="border-t border-border divide-y divide-border">
                {closedTickets.map(ticket => (
                  <button
                    key={ticket.id}
                    onClick={() => router.push(`/admin/inventory/tickets/${ticket.id}`)}
                    className="w-full text-left p-4 hover:bg-surface-raised/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-text-primary">{ticket.title}</p>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${ticketStatusColors[ticket.status]}`}>
                        Resuelto
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      <span>{format(new Date(ticket.opened_at), "dd MMM yyyy", { locale: es })}</span>
                      {ticket.total_cost != null && ticket.total_cost > 0 && (
                        <span className="flex items-center gap-0.5">
                          <DollarSign className="w-3 h-3" />
                          {ticket.total_cost.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Report Fault Modal */}
      {showReportForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowReportForm(false)} />
          <div className="relative bg-surface border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4 animate-in slide-in-from-bottom-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-text-primary">Reportar Problema</h2>

            {submitError && (
              <div className="p-3 bg-error/10 text-error text-sm rounded-xl border border-error/20">
                {submitError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Título del problema</label>
              <input
                placeholder="Ej: Motor no enciende"
                value={reportTitle}
                onChange={e => setReportTitle(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Prioridad</label>
              <div className="grid grid-cols-4 gap-2">
                {['baja', 'media', 'alta', 'critica'].map(p => (
                  <button
                    key={p}
                    onClick={() => setReportPriority(p)}
                    className={`h-9 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border
                      ${reportPriority === p
                        ? `${priorityColors[p]} border-current`
                        : 'bg-surface-raised text-text-secondary border-border hover:border-text-secondary'
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Descripción</label>
              <textarea
                placeholder="Describe el problema con el mayor detalle posible..."
                value={reportDesc}
                onChange={e => setReportDesc(e.target.value)}
                rows={3}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowReportForm(false)}
                className="flex-1 h-12 rounded-xl font-semibold text-sm border border-border text-text-primary hover:bg-surface-raised transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReportFault}
                disabled={submitting}
                className="flex-1 h-12 rounded-xl font-semibold text-sm bg-error text-text-inverse hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'Enviando...' : 'Crear Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Asset Modal */}
      {showReviewForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowReviewForm(false)} />
          <div className="relative bg-surface border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4 animate-in slide-in-from-bottom-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Registrar Revisión
            </h2>
            <p className="text-sm text-text-secondary">
              Se creará un ticket de mantenimiento y se cerrará automáticamente con esta nota.
            </p>

            <div className="space-y-1.5 pt-2">
              <label className="text-sm font-semibold text-text-secondary">Notas de revisión (opcional)</label>
              <textarea
                placeholder="Ej: Se ajustaron los cables y se limpió el filtro..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                rows={3}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowReviewForm(false)}
                className="flex-1 h-12 rounded-xl font-semibold text-sm border border-border text-text-primary hover:bg-surface-raised transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReviewAsset}
                disabled={submittingReview}
                className="flex-1 h-12 rounded-xl font-semibold text-sm bg-primary text-text-inverse hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {submittingReview ? 'Guardando...' : 'Completar Revisión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface/90 backdrop-blur-md border-t border-border flex gap-3 max-w-lg mx-auto">
        {activeTicket ? (
          <button 
            onClick={() => router.push(`/admin/inventory/tickets/${activeTicket.id}`)}
            className="flex-1 bg-warning text-text-primary h-12 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm"
          >
            <AlertTriangle className="w-4 h-4" /> Ver Ticket Activo
          </button>
        ) : (
          <>
            <button 
              onClick={() => setShowReportForm(true)}
              className="flex-1 bg-surface-raised text-text-primary h-12 rounded-xl font-bold border border-border hover:bg-surface transition-colors flex items-center justify-center gap-2"
            >
              <Wrench className="w-4 h-4" /> Reportar Falla
            </button>
            <button 
              onClick={() => setShowReviewForm(true)}
              disabled={submittingReview}
              className="flex-1 bg-primary text-text-inverse h-12 rounded-xl font-bold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {submittingReview ? 'Registrando...' : 'Registrar Revisión'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
