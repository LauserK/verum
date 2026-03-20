# M14-ATT: Attendance Reports, History, and Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the reporting layer for the Attendance module, allowing staff to view their history and admins to view alerts, generate compliance reports, and export payroll data to CSV in multiple formats.

**Architecture:** 
- **Backend (FastAPI):** Expose endpoints leveraging the `v_daily_attendance` view. Add CSV generation logic for `daily`, `weekly`, and `custom` report types using the standard `csv` Python library and `StreamingResponse`.
- **Frontend (Next.js):** Build the staff history calendar (`/attendance/history`), admin alerts widget, and the admin reports/export interface (`/admin/attendance/reports`).

**Tech Stack:** FastAPI, Supabase PostgreSQL, Next.js, TailwindCSS.

---

## Chunk 1: Backend - Staff History & Admin Alerts

### Task 1: Add History and Alerts Endpoints

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add `GET /attendance/me`**
Fetch the authenticated user's daily summary for the last 30 days.
```python
@app.get("/attendance/me")
async def get_my_attendance_history(days: int = 30, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.view_own"))):
    """Returns the staff member's attendance history for the calendar view."""
    today = datetime.now(CARACAS_TZ)
    start_date = (today - timedelta(days=days)).strftime("%Y-%m-%d")
    
    res = db.table("v_daily_attendance").select("*").eq("profile_id", current_user.id).gte("work_date", start_date).order("work_date", desc=True).execute()
    return res.data or []
```

- [ ] **Step 2: Add `GET /attendance/alerts`**
Fetch today's absences and recent late arrivals for the admin dashboard.
```python
@app.get("/attendance/alerts")
async def get_attendance_alerts(venue_id: str, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    """Returns late arrivals and unexcused absences for the admin."""
    today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
    
    # Absences
    absences_res = db.table("absences").select("*, profiles(full_name)").eq("venue_id", venue_id).eq("date", today).eq("type", "unexcused").execute()
    
    # Lates today
    lates_res = db.table("attendance_logs").select("*, profiles(full_name)").eq("venue_id", venue_id).gte("marked_at", f"{today}T00:00:00-04:00").gt("minutes_late", 0).order("marked_at", desc=True).execute()
    
    return {
        "absences": absences_res.data or [],
        "lates": lates_res.data or []
    }
```

- [ ] **Step 3: Commit**
```bash
git add backend/main.py
git commit -m "feat(api): add attendance history and alerts endpoints (M14)"
```

---

## Chunk 2: Backend - Reports & CSV Export API

### Task 2: Build the Reporting and Export Engine

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add `GET /attendance/report` for preview**
```python
@app.get("/attendance/report")
async def get_attendance_report(venue_id: str, date_from: str, date_to: str, profile_id: Optional[str] = None, db=Depends(get_db), _=Depends(require_permission("attendance.view_reports"))):
    """JSON endpoint for the frontend table preview."""
    query = db.table("v_daily_attendance").select("*").eq("venue_id", venue_id).gte("work_date", date_from).lte("work_date", date_to)
    if profile_id:
        query = query.eq("profile_id", profile_id)
        
    res = query.order("work_date", desc=False).execute()
    return res.data or []
```

- [ ] **Step 2: Add `GET /attendance/export` with CSV StreamingResponse**
Add the imports for `StreamingResponse` and `csv`, `io`.
Implement the logic for `daily`, `weekly`, and `custom` formats.
```python
from fastapi.responses import StreamingResponse
import io
import csv
from datetime import datetime, timedelta

@app.get("/attendance/export")
async def export_attendance_csv(venue_id: str, report_type: str, date_from: str, date_to: str, profile_id: Optional[str] = None, db=Depends(get_db), _=Depends(require_permission("attendance.view_reports"))):
    """Exports attendance data as a CSV file."""
    # Fetch base data
    query = db.table("v_daily_attendance").select("*").eq("venue_id", venue_id).gte("work_date", date_from).lte("work_date", date_to)
    if profile_id:
        query = query.eq("profile_id", profile_id)
    data = query.order("work_date", desc=False).execute().data or []

    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "daily":
        writer.writerow(["name", "date", "clock_in", "clock_out", "net_hours", "overtime_hours", "late_minutes", "absence"])
        for row in data:
            writer.writerow([
                row.get("full_name"), row.get("work_date"), 
                row.get("clock_in", "")[11:16] if row.get("clock_in") else "",
                row.get("clock_out", "")[11:16] if row.get("clock_out") else "",
                row.get("net_hours", 0), row.get("overtime_hours", 0),
                row.get("minutes_late", 0), row.get("absence_type", "")
            ])
    
    elif report_type in ["weekly", "custom"]:
        # Group by employee
        employees = {}
        for row in data:
            pid = row["profile_id"]
            if pid not in employees:
                employees[pid] = {"name": row["full_name"], "days": {}, "total_net": 0, "total_ot": 0}
            
            d_str = row["work_date"]
            dt = datetime.strptime(d_str, "%Y-%m-%d")
            day_key = dt.strftime("%a").lower()[:3] # mon, tue, wed...
            
            # If custom spans multiple weeks, we just append to the column or sum it up. 
            # Per PRD, if custom/weekly we assume columns by day of week.
            # To strictly follow PRD for "week sectioning" in custom, we will simplify by just adding date-specific columns if custom > 7 days, 
            # OR just stick to Mon-Sun if it's strictly a week. Let's build the dynamic columns based on the date range requested.
            
            date_col_key = d_str # Use actual date as key to support any length
            employees[pid]["days"][date_col_key] = row
            employees[pid]["total_net"] += float(row.get("net_hours") or 0)
            employees[pid]["total_ot"] += int(row.get("overtime_hours") or 0)

        # Generate headers based on date range
        start_dt = datetime.strptime(date_from, "%Y-%m-%d")
        end_dt = datetime.strptime(date_to, "%Y-%m-%d")
        delta = (end_dt - start_dt).days
        
        headers = ["name"]
        dates_in_range = []
        for i in range(delta + 1):
            curr = (start_dt + timedelta(days=i)).strftime("%Y-%m-%d")
            dates_in_range.append(curr)
            day_prefix = datetime.strptime(curr, "%Y-%m-%d").strftime("%a").lower()[:3]
            headers.extend([f"{curr}_{day_prefix}_net", f"{curr}_{day_prefix}_ot", f"{curr}_{day_prefix}_late", f"{curr}_{day_prefix}_absence"])
        
        headers.extend(["total_net", "total_ot"])
        writer.writerow(headers)

        for pid, emp in employees.items():
            row_data = [emp["name"]]
            for d in dates_in_range:
                day_data = emp["days"].get(d, {})
                row_data.extend([
                    day_data.get("net_hours", 0),
                    day_data.get("overtime_hours", 0),
                    day_data.get("minutes_late", 0),
                    day_data.get("absence_type", "")
                ])
            row_data.extend([round(emp["total_net"], 2), emp["total_ot"]])
            writer.writerow(row_data)

    output.seek(0)
    filename = f"attendance_{report_type}_{date_from}_to_{date_to}.csv"
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
```

- [ ] **Step 3: Commit**
```bash
git add backend/main.py
git commit -m "feat(api): add attendance reporting and CSV export (M14)"
```

---

## Chunk 3: Frontend - Staff History View

### Task 3: Create Staff History Page

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/app/attendance/history/page.tsx`
- Modify: `frontend/src/app/attendance/page.tsx` (Add link to history)

- [ ] **Step 1: Add API method**
```typescript
// inside attendanceApi in lib/api.ts
    getHistory: (): Promise<any[]> => fetchWithAuth('/attendance/me'),
```

- [ ] **Step 2: Create History Page**
```typescript
// frontend/src/app/attendance/history/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { attendanceApi } from '@/lib/api'
import { ArrowLeft, Calendar as CalIcon, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export default function StaffHistoryPage() {
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        attendanceApi.getHistory().then(setHistory).catch(console.error).finally(() => setLoading(false))
    }, [])

    return (
        <div className="min-h-screen bg-background pb-24">
            <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border px-4 h-14 flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-text-secondary hover:text-text-primary">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-bold text-text-primary">Mi Historial</h1>
            </header>

            <main className="p-4 max-w-md mx-auto space-y-4 mt-4">
                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : history.length === 0 ? (
                    <div className="text-center p-8 text-text-secondary">No hay registros recientes.</div>
                ) : (
                    history.map(record => (
                        <div key={record.work_date} className={`p-4 rounded-2xl border ${record.absence_type ? 'bg-error/5 border-error/20' : 'bg-surface border-border'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold">{format(parseISO(record.work_date), "EEEE, d 'de' MMMM", { locale: es })}</span>
                                {record.absence_type && <span className="text-xs bg-error/10 text-error px-2 py-1 rounded-md font-bold uppercase">{record.absence_type}</span>}
                            </div>
                            {!record.absence_type && (
                                <div className="text-sm text-text-secondary space-y-1">
                                    <p>Entrada: {record.clock_in ? format(new Date(record.clock_in), 'HH:mm') : '—'}</p>
                                    <p>Salida: {record.clock_out ? format(new Date(record.clock_out), 'HH:mm') : '—'}</p>
                                    <p>Horas Netas: <strong className="text-text-primary">{record.net_hours}h</strong></p>
                                    {record.overtime_hours > 0 && <p className="text-success">Horas extra: {record.overtime_hours}</p>}
                                    {record.minutes_late > 0 && <p className="text-warning">Tardanza: {record.minutes_late} min</p>}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </main>
        </div>
    )
}
```

- [ ] **Step 3: Add link from main attendance page**
In `frontend/src/app/attendance/page.tsx`, add a link `<Link href="/attendance/history" className="text-primary text-sm font-bold mt-4 block">Ver mi historial completo</Link>` below the actions.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/lib/api.ts frontend/src/app/attendance
git commit -m "feat(ui): add staff attendance history view (M14)"
```

---

## Chunk 4: Frontend - Admin Reports & Export View

### Task 4: Create Admin Export Interface

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/app/admin/attendance/reports/page.tsx`
- Modify: `frontend/src/app/admin/layout.tsx` (Update link if needed, though they can share a submenu).

- [ ] **Step 1: Add API Methods**
```typescript
// inside adminApi in lib/api.ts
    getAttendanceReport: (venueId: string, from: string, to: string, profileId?: string) => {
        let url = `/attendance/report?venue_id=${venueId}&date_from=${from}&date_to=${to}`;
        if (profileId) url += `&profile_id=${profileId}`;
        return fetchWithAuth(url);
    },
    exportAttendanceCSV: (venueId: string, type: string, from: string, to: string) => {
        const url = `${API_URL}/attendance/export?venue_id=${venueId}&report_type=${type}&date_from=${from}&date_to=${to}`;
        // we'll handle the download via standard anchor tag or fetch+blob in the component
        return url;
    },
```

- [ ] **Step 2: Create Admin Reports Page**
```typescript
// frontend/src/app/admin/attendance/reports/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { adminApi, getProfile, type VenueInfo } from '@/lib/api'
import { Download, Loader2 } from 'lucide-react'
import { format, subDays } from 'date-fns'

export default function AttendanceReportsPage() {
    const [venues, setVenues] = useState<VenueInfo[]>([])
    const [venueId, setVenueId] = useState('')
    const [reportType, setReportType] = useState('daily')
    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [preview, setPreview] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        getProfile().then(p => {
            setVenues(p.venues || [])
            if (p.venues?.[0]) setVenueId(p.venues[0].id)
        })
    }, [])

    const handlePreview = async () => {
        if (!venueId) return
        setLoading(true)
        try {
            const data = await adminApi.getAttendanceReport(venueId, dateFrom, dateTo)
            setPreview(data)
        } catch (e) {
            alert('Error cargando preview')
        }
        setLoading(false)
    }

    const handleExport = () => {
        if (!venueId) return
        // Ideally we fetch with auth headers and trigger a blob download.
        // For simplicity, if your API needs Auth Header, we must do a fetch:
        fetch(adminApi.exportAttendanceCSV(venueId, reportType, dateFrom, dateTo), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('supabase-auth-token')}` } // pseudo code, adjust to your auth logic if needed
        })
        // Real implementation of authenticated download will be written in the file.
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Reportes de Asistencia</h1>
            <div className="bg-surface p-5 rounded-2xl border flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Sede</label>
                    <select value={venueId} onChange={e => setVenueId(e.target.value)} className="bg-surface border rounded-xl px-3 h-10 text-sm">
                        {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Formato CSV</label>
                    <select value={reportType} onChange={e => setReportType(e.target.value)} className="bg-surface border rounded-xl px-3 h-10 text-sm">
                        <option value="daily">Diario (1 fila por día)</option>
                        <option value="weekly">Columnas por fecha</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Desde</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-surface border rounded-xl px-3 h-10 text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Hasta</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-surface border rounded-xl px-3 h-10 text-sm" />
                </div>
                <div className="flex gap-2">
                    <button onClick={handlePreview} className="h-10 px-4 bg-surface-raised border font-bold text-sm rounded-xl hover:bg-border transition">Vista Previa</button>
                    <button onClick={handleExport} className="h-10 px-4 bg-primary text-white font-bold text-sm rounded-xl flex items-center gap-2 hover:opacity-90 transition">
                        <Download className="w-4 h-4" /> Exportar CSV
                    </button>
                </div>
            </div>

            {/* Preview Table */}
        </div>
    )
}
```
*(Will implement the proper authenticated download logic in actual file generation).*

- [ ] **Step 3: Commit**
```bash
git add frontend/src/lib/api.ts frontend/src/app/admin/attendance/reports
git commit -m "feat(ui): add admin attendance reports and CSV export interface (M14)"
```

---
*End of Plan*