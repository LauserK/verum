# Leave Requests & Absence Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete workflow for staff to request leaves/days off and for admins to manage (approve/reject) them.

**Architecture:** Extend the existing `absences` table with a `status` column to support a request-review cycle. Add backend endpoints for staff to request and admins to review. Create new frontend pages for both roles.

**Tech Stack:** FastAPI (Backend), Supabase (DB), Next.js + Tailwind CSS (Frontend).

---

### Task 1: Database Migration

**Files:**
- Create: `backend/migrations/023_absence_status.sql`

- [ ] **Step 1: Create the migration file**
Add `status`, `admin_comment`, and `requested_at` to the `absences` table.

```sql
-- backend/migrations/023_absence_status.sql
-- Add status and comment to absences to support request workflow

ALTER TABLE absences 
ADD COLUMN status text CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
ADD COLUMN admin_comment text NULL,
ADD COLUMN requested_at timestamp with time zone DEFAULT now();

-- Update existing absences to 'approved'
UPDATE absences SET status = 'approved' WHERE status IS NULL;
```

- [ ] **Step 2: Commit**

```bash
git add backend/migrations/023_absence_status.sql
git commit -m "db: add status and comment to absences"
```

---

### Task 2: Backend - Staff Leave Request

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Define Schemas**

```python
class LeaveRequest(BaseModel):
    date: str  # YYYY-MM-DD
    type: str  # 'leave', 'sick', 'holiday'
    reason: Optional[str] = None
```

- [ ] **Step 2: Implement Endpoints**
Create `POST /attendance/requests` and `GET /attendance/requests/me`.
Ensure proper authorization with `attendance.request_leave`.

```python
@app.post("/attendance/requests")
async def request_leave(body: LeaveRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.request_leave"))):
    # Logic to insert into absences with status='pending'
    # Security: Ensure user doesn't already have a mark or approved absence for that date
    pass

@app.get("/attendance/requests/me")
async def get_my_requests(current_user=Depends(get_current_user), db=Depends(get_db)):
    # Return absences for this user where status in ('pending', 'approved', 'rejected')
    pass
```

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add staff leave request endpoints"
```

---

### Task 3: Backend - Admin Absence Management

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Define Approval Schema**

```python
class AbsenceApprovalRequest(BaseModel):
    status: str  # 'approved', 'rejected'
    admin_comment: Optional[str] = None
```

- [ ] **Step 2: Implement Admin Endpoints**
Create `GET /admin/attendance/requests` and `PATCH /admin/attendance/requests/{id}`.
Ensure proper authorization with `attendance.manage`.

```python
@app.get("/admin/attendance/requests")
async def get_pending_requests(venue_id: Optional[str] = None, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    # List absences with status='pending' for the admin's organization/venue
    pass

@app.patch("/admin/attendance/requests/{absence_id}")
async def review_leave_request(absence_id: str, body: AbsenceApprovalRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    # Update status, set approved_by = current_user.id
    pass
```

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add admin absence management endpoints"
```

---

### Task 4: Frontend - API Extensions

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add new methods to `attendanceApi` and `adminApi`**

```typescript
// attendanceApi
requestLeave: (data: { date: string; type: string; reason?: string }) => fetchWithAuth('/attendance/requests', { method: 'POST', body: JSON.stringify(data) }),
getOwnRequests: () => fetchWithAuth('/attendance/requests/me'),

// adminApi
getPendingRequests: (venueId?: string) => fetchWithAuth(`/admin/attendance/requests${venueId ? `?venue_id=${venueId}` : ''}`),
reviewRequest: (id: string, data: { status: 'approved' | 'rejected'; admin_comment?: string }) => fetchWithAuth(`/admin/attendance/requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): add leave request methods to api"
```

---

### Task 5: Frontend - Staff UI

**Files:**
- Create: `frontend/src/app/attendance/requests/page.tsx`
- Modify: `frontend/src/app/attendance/page.tsx`

- [ ] **Step 1: Create the requests page**
Implement a list of previous requests and a button to open a "Request Leave" modal/form.

- [ ] **Step 2: Link from main attendance page**
Add a link/button: `href="/attendance/requests"`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/attendance/requests/page.tsx frontend/src/app/attendance/page.tsx
git commit -m "feat(frontend): staff leave request UI"
```

---

### Task 6: Frontend - Admin UI

**Files:**
- Create: `frontend/src/app/admin/attendance/absences/page.tsx`
- Modify: `frontend/src/app/admin/attendance/page.tsx`

- [ ] **Step 1: Create the absence management dashboard**
Two tabs:
1. **Solicitudes Pendientes:** List of cards/rows with "Approve" and "Reject" buttons.
2. **Historial:** Searchable list of all approved/rejected absences.

- [ ] **Step 2: Add navigation link**
In `AdminAttendancePage`, add `<Link href="/admin/attendance/absences">Ausencias</Link>`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/attendance/absences/page.tsx frontend/src/app/admin/attendance/page.tsx
git commit -m "feat(frontend): admin absence management UI"
```

---

### Task 7: Verification

- [ ] **Step 1: Test Staff Flow**
1. Login as staff.
2. Go to Attendance -> Requests.
3. Submit a request for a future date.
4. Verify it appears as "Pending".

- [ ] **Step 2: Test Admin Flow**
1. Login as admin.
2. Go to Attendance -> Ausencias.
3. Find the pending request.
4. Approve it.
5. Verify it disappears from "Pending" and appears in "Historial".

- [ ] **Step 3: Verify Attendance Logic**
1. Verify report categorization for absences.
