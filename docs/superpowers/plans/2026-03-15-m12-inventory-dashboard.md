# M10 & M12 Inventory Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the unified Inventory Dashboard combining Asset insights (M10) and Utensil alerts/reports (M12) into a single screen for administrators.

**Architecture:**
- **Backend:** Create a `GET /inventory/dashboard/summary` endpoint that aggregates data from `assets`, `repair_tickets`, `utensil_counts`, and `count_schedules`.
- **Frontend:** Create `frontend/src/app/admin/inventory/page.tsx` as the main inventory dashboard. Update the `layout.tsx` to point to `/admin/inventory` instead of `/admin/inventory/assets`.

**Tech Stack:** FastAPI, Next.js, TailwindCSS, Supabase PostgreSQL, Lucide React.

---

## Chunk 1: Backend Aggregation Endpoint

### Task 1: Create Dashboard Summary API

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add summary endpoints logic**
Add an endpoint that collects all necessary insights for the dashboard.
```python
# ── Inventory: Dashboard (M10 & M12) ──

@app.get("/inventory/dashboard/summary")
async def get_inventory_dashboard_summary(
    venue_id: Optional[str] = None,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission("inventory_assets.view"))
):
    try:
        # We need the org_id to filter correctly if venue_id is not provided
        profile_res = db.table("profiles").select("organization_id").eq("id", current_user.id).single().execute()
        org_id = profile_res.data["organization_id"]

        # 1. Asset Status Scorecards
        assets_query = db.table("assets").select("id, status").eq("org_id", org_id)
        if venue_id:
            assets_query = assets_query.eq("venue_id", venue_id)
        assets_res = assets_query.execute()
        assets = assets_res.data or []
        
        asset_stats = {
            "total": len(assets),
            "operativo": sum(1 for a in assets if a["status"] == "operativo"),
            "en_reparacion": sum(1 for a in assets if a["status"] == "en_reparacion"),
            "baja": sum(1 for a in assets if a["status"] == "baja")
        }

        # 2. Active Tickets
        tickets_query = db.table("repair_tickets").select("*, assets(name)").eq("org_id", org_id).neq("status", "cerrado").order("created_at", desc=True).limit(5)
        if venue_id:
            tickets_query = tickets_query.eq("venue_id", venue_id)
        active_tickets = tickets_query.execute().data or []

        # 3. Pending Utensil Counts
        counts_query = db.table("utensil_counts").select("*, profiles!utensil_counts_created_by_fkey(full_name), venues(name)").eq("status", "pending").order("created_at", desc=True).limit(5)
        # Note: counts don't have org_id directly, we filter by venue_id if provided. If not, this might need a join, but for simplicity we rely on venue_id if provided.
        if venue_id:
            counts_query = counts_query.eq("venue_id", venue_id)
        pending_counts = counts_query.execute().data or []

        # 4. Due Schedules (Utensils)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        sched_query = db.table("count_schedules").select("*, venues(name)").eq("org_id", org_id).eq("is_active", True).lte("next_due", today)
        if venue_id:
            sched_query = sched_query.eq("venue_id", venue_id)
        due_schedules = sched_query.execute().data or []

        return {
            "asset_stats": asset_stats,
            "active_tickets": active_tickets,
            "pending_counts": pending_counts,
            "due_schedules": due_schedules
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 2: Commit Backend Changes**
```bash
git add backend/main.py
git commit -m "feat(api): add inventory dashboard summary endpoint (M10/M12)"
```

---

## Chunk 2: Frontend API and Navigation

### Task 2: Update Frontend API and Layout

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/admin/layout.tsx`

- [ ] **Step 1: Add getInventoryDashboard to api.ts**
```typescript
// Add inside adminApi object in frontend/src/lib/api.ts
    getInventoryDashboard: (venueId?: string): Promise<any> =>
        fetchWithAuth(`/inventory/dashboard/summary${venueId ? `?venue_id=${venueId}` : ''}`),
```

- [ ] **Step 2: Update layout.tsx navigation**
Change the inventory navigation item to point to `/admin/inventory` instead of `/admin/inventory/assets`.
```typescript
// In frontend/src/app/admin/layout.tsx
        { href: '/admin/venues', label: t('nav.venues'), icon: Building2 },
        { href: '/admin/inventory', label: t('nav.inventory'), icon: Box },
        { href: '/admin/inventory/tickets', label: t('nav.tickets'), icon: Wrench },
```

- [ ] **Step 3: Commit Navigation Changes**
```bash
git add frontend/src/lib/api.ts frontend/src/app/admin/layout.tsx
git commit -m "feat(ui): update nav and api for unified inventory dashboard"
```

---

## Chunk 3: Frontend Dashboard Page

### Task 3: Implement the Dashboard UI

**Files:**
- Create: `frontend/src/app/admin/inventory/page.tsx`

- [ ] **Step 1: Create the Dashboard Page component**
```typescript
// frontend/src/app/admin/inventory/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { adminApi, getProfile, type VenueInfo } from '@/lib/api'
import { Box, Wrench, AlertTriangle, ClipboardList, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTranslations } from '@/components/I18nProvider'

export default function InventoryDashboardPage() {
  const { t } = useTranslations()
  const [data, setData] = useState<any>(null)
  const [venues, setVenues] = useState<VenueInfo[]>([])
  const [selectedVenue, setSelectedVenue] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProfile().then(p => {
      setVenues(p.venues || [])
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    adminApi.getInventoryDashboard(selectedVenue || undefined)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedVenue])

  if (loading || !data) {
    return <div className="animate-pulse space-y-6 p-6"><div className="h-32 bg-surface rounded-2xl w-full"></div></div>
  }

  return (
    <div className="space-y-6">
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
          <Box className="w-4 h-4" /> Ir a Activos Fijos
        </Link>
        <Link href="/admin/inventory/utensils" className="px-4 py-2 bg-surface border border-border rounded-xl text-sm font-semibold hover:border-primary transition-colors flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> Ir a Utensilios
        </Link>
      </div>

      {/* Block 1: Assets Status */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Box className="w-5 h-5 text-primary" /> Estado de Activos Fijos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface p-5 rounded-2xl border border-border">
            <p className="text-xs font-bold text-text-secondary uppercase">Total</p>
            <p className="text-3xl font-black text-text-primary mt-1">{data.asset_stats.total}</p>
          </div>
          <div className="bg-success/10 p-5 rounded-2xl border border-success/20">
            <p className="text-xs font-bold text-success uppercase">Operativos</p>
            <p className="text-3xl font-black text-success mt-1">{data.asset_stats.operativo}</p>
          </div>
          <div className="bg-warning/10 p-5 rounded-2xl border border-warning/20">
            <p className="text-xs font-bold text-warning uppercase">En Reparación</p>
            <p className="text-3xl font-black text-warning mt-1">{data.asset_stats.en_reparacion}</p>
          </div>
          <div className="bg-error/10 p-5 rounded-2xl border border-error/20">
            <p className="text-xs font-bold text-error uppercase">Dados de Baja</p>
            <p className="text-3xl font-black text-error mt-1">{data.asset_stats.baja}</p>
          </div>
        </div>

        {data.active_tickets.length > 0 && (
          <div className="bg-surface border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Tickets Activos</h3>
            <div className="space-y-3">
              {data.active_tickets.map((t: any) => (
                <Link href={`/admin/inventory/tickets/${t.id}`} key={t.id} className="flex justify-between items-center p-3 hover:bg-surface-raised rounded-xl transition-colors border border-transparent hover:border-border">
                  <div>
                    <p className="font-semibold text-sm text-text-primary">{t.assets?.name}</p>
                    <p className="text-xs text-text-secondary line-clamp-1">{t.issue_description}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning px-2 py-1 rounded-md">{t.status}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Block 2: Utensils Alerts */}
      <section className="space-y-4 pt-4 border-t border-border">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" /> Operaciones de Utensilios
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center justify-between">
              Conteos Pendientes
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">{data.pending_counts.length}</span>
            </h3>
            {data.pending_counts.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-6">No hay conteos pendientes de auditar.</p>
            ) : (
              <div className="space-y-3">
                {data.pending_counts.map((c: any) => (
                  <Link href={`/admin/inventory/utensils/counts/${c.id}`} key={c.id} className="flex justify-between items-center p-3 bg-surface-raised rounded-xl border border-border hover:border-primary transition-colors">
                    <div>
                      <p className="font-semibold text-sm text-text-primary">Conteo de {c.profiles?.full_name}</p>
                      <p className="text-xs text-text-secondary flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" /> {format(new Date(c.created_at), "dd MMM, HH:mm", { locale: es })}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-text-secondary" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center justify-between">
              Órdenes Vencidas / Hoy
              <span className="bg-error/10 text-error px-2 py-0.5 rounded-full text-xs">{data.due_schedules.length}</span>
            </h3>
            {data.due_schedules.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-6">El staff está al día con el cronograma.</p>
            ) : (
              <div className="space-y-3">
                {data.due_schedules.map((s: any) => (
                  <div key={s.id} className="flex justify-between items-center p-3 bg-error/5 rounded-xl border border-error/20">
                    <div>
                      <p className="font-semibold text-sm text-text-primary">{s.name}</p>
                      <p className="text-xs text-error mt-1">{s.venues?.name} - {format(new Date(s.next_due), "dd MMM", { locale: es })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit Dashboard Page**
```bash
git add frontend/src/app/admin/inventory/page.tsx
git commit -m "feat(ui): implement unified inventory dashboard (M10/M12)"
```

---
*End of Plan*