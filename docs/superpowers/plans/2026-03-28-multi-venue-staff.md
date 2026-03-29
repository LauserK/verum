# Staff Multi-Venue Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modificar la arquitectura del sistema para permitir que los usuarios (staff) puedan ser asignados a múltiples sedes (venues) simultáneamente. Incluye un selector de sedes en el Header, selección de sede al marcar entrada, y bloqueo de sede mientras hay un turno activo.

**Architecture:** 
1. **DB:** Creación de tabla intermedia `profile_venues` (relación M:N).
2. **Backend:** Modificación de `backend/main.py` para devolver array de sedes. Modificar módulo de asistencia para requerir `venue_id` explícito y validar que no haya turnos activos cruzados en otras sedes.
3. **Frontend:** 
   - Añadir un `VenueSelector` en el Header (lado derecho, junto al nombre).
   - El componente de Asistencia (`AttendanceGuard` / `Dashboard`) debe mostrar un desplegable de sede al hacer Clock-in si el usuario tiene múltiples sedes.
   - Bloquear el cambio de sede para marcaje si ya existe un `clock_in` activo en otra.

**Tech Stack:** Supabase (SQL Migrations), FastAPI (Python), Next.js (React).

---

### Task 1: Database Migration (M:N Relationship)

**Files:**
- Create: `backend/migrations/024_multi_venue_profiles.sql`

- [ ] **Step 1: Write the migration script**

```sql
-- backend/migrations/024_multi_venue_profiles.sql

CREATE TABLE IF NOT EXISTS profile_venues (
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
    created_at timestamp with time zone default now(),
    PRIMARY KEY (profile_id, venue_id)
);

-- Migrate existing data
INSERT INTO profile_venues (profile_id, venue_id)
SELECT id, venue_id FROM profiles WHERE venue_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE profile_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own venue links"
ON profile_venues FOR SELECT TO authenticated USING (profile_id = auth.uid());

CREATE POLICY "Admins can manage profile venues"
ON profile_venues FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
```

- [ ] **Step 2: Commit**

```bash
git add backend/migrations/024_multi_venue_profiles.sql
git commit -m "feat(db): add profile_venues junction table for multi-venue support"
```

---

### Task 2: Backend Schemas and `/me` Endpoint Update

**Files:**
- Modify: `backend/schemas.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Update ProfileResponse and Admin Schemas**

```python
# In backend/schemas.py
class ProfileResponse(BaseModel):
    id: str
    full_name: Optional[str] = None
    role: str
    organization_id: Optional[str] = None
    venues: List[VenueInfo] = [] 
    venue_id: Optional[str] = None # Deprecated
    shift_id: Optional[str] = None
    shift_name: Optional[str] = None

class CreateUserRequest(BaseModel):
    # ... other fields
    venue_ids: Optional[List[str]] = None
    venue_id: Optional[str] = None

class UpdateUserRequest(BaseModel):
    # ... other fields
    venue_ids: Optional[List[str]] = None
    venue_id: Optional[str] = None
```

- [ ] **Step 2: Update get_profile in main.py**

Modify `get_profile` to fetch venues from `profile_venues` for staff, or all org venues for admins.

- [ ] **Step 3: Update Admin User Creation/Update**

Modify `/admin/users` POST/PUT to handle `venue_ids` array, inserting/deleting from `profile_venues` accordingly.

- [ ] **Step 4: Commit**

```bash
git add backend/schemas.py backend/main.py
git commit -m "feat(api): update profile and user endpoints for multiple venues"
```

---

### Task 3: Contextualize Attendance API & Cross-Venue Lock

**Files:**
- Modify: `backend/schemas.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Require explicit venue_id in requests**

Update `MarkAttendanceRequest` and `LeaveRequest` in `schemas.py` to include `venue_id: str`.

- [ ] **Step 2: Refactor Attendance Status logic**

Update `get_attendance_status` to accept an optional `venue_id` parameter. If not provided, it should look across all assigned venues to find an active `clock_in`. If the user is currently clocked into Venue A, they must be forced to use Venue A's context until they clock out.

- [ ] **Step 3: Refactor Mark Attendance logic**

Update `/attendance/mark` to use the provided `body.venue_id`. Add validation: if trying to clock in to Venue B while an active shift exists in Venue A, throw a 400 error ("Ya tienes un turno activo en otra sede").

- [ ] **Step 4: Commit**

```bash
git add backend/main.py backend/schemas.py
git commit -m "refactor(api): require explicit venue context and add cross-venue lock"
```

---

### Task 4: Frontend Context Provider & Header Selector

**Files:**
- Create: `frontend/src/components/VenueContext.tsx`
- Modify: `frontend/src/app/layout.tsx` (or an internal layout if Header is there)
- Modify: Header component (create or modify existing to add dropdown)

- [ ] **Step 1: Create VenueContext**

Create `VenueContext` that stores `selectedVenueId`. It initializes by checking `localStorage` or defaulting to the first venue in the user's profile.

- [ ] **Step 2: Add Header Dropdown**

Create a dropdown next to the user name in the Header. It lists `profile.venues`. Changing the dropdown updates the context and saves to `localStorage`.

- [ ] **Step 3: Provide context**

Wrap the necessary application tree with `<VenueProvider>`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/VenueContext.tsx frontend/src/app/layout.tsx
git commit -m "feat(ui): implement venue context provider and header selector"
```

---

### Task 5: Frontend Attendance & Dashboard Adaptation

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/components/AttendanceGuard.tsx` (if it handles clock in) or equivalent attendance UI.

- [ ] **Step 1: Dashboard Context**

Make `DashboardPage` use the `selectedVenueId` from context to fetch checklists (`adminApi.getChecklists(selectedVenueId)`).

- [ ] **Step 2: Clock-In Venue Selector & Lock**

In the UI where the user marks attendance (e.g., Dashboard or AttendanceGuard):
- If user has multiple venues and action is 'clock_in', show a `select` dropdown to confirm the venue. Default to the Header's selected venue.
- If the API's `get_attendance_status` returns that the user is locked into a specific venue, disable the selector and force that venue.
- Pass the chosen `venue_id` in the `markAttendance` API call.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx frontend/src/components/AttendanceGuard.tsx
git commit -m "feat(ui): adapt dashboard and attendance UI for multi-venue selection"
```
