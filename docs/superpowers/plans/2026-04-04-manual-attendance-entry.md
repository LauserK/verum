# Manual Attendance Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow administrators to manually add attendance records (clock-in and clock-out) for employees who missed their marking, including a reason and audit trail.

**Architecture:** 
1. Create a new Pydantic schema for the manual request.
2. Implement a new POST endpoint `/admin/attendance/manual` in the backend.
3. The endpoint will insert two rows into `attendance_logs` (one for clock_in, one for clock_out).
4. Reuse existing logic for calculating late minutes and overtime based on the employee's assigned shift.
5. Create a frontend modal for admins to fill in the manual entry details.

**Tech Stack:** FastAPI, Pydantic, Supabase (PostgreSQL), React (Next.js), Tailwind CSS.

---

### Task 1: Backend - Define Schema

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Add ManualAttendanceRequest schema**

```python
class ManualAttendanceRequest(BaseModel):
    profile_id: str
    venue_id: str
    clock_in: str  # ISO Format: YYYY-MM-DDTHH:MM:SS
    clock_out: str # ISO Format: YYYY-MM-DDTHH:MM:SS
    reason: str
```

- [ ] **Step 2: Commit**

```bash
git add backend/schemas.py
git commit -m "feat(attendance): add ManualAttendanceRequest schema"
```

---

### Task 2: Backend - Implement Admin Endpoint Logic

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add the manual entry endpoint**
Add it after the `/attendance/absences` endpoint.

```python
@app.post("/admin/attendance/manual")
async def add_manual_attendance(body: ManualAttendanceRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    """Admin manually adds a clock-in and clock-out for a user."""
    
    # 1. Parse dates
    try:
        # Expected format from frontend: "YYYY-MM-DDTHH:MM"
        # We append :00 if needed and parse
        in_str = body.clock_in if len(body.clock_in) > 16 else f"{body.clock_in}:00"
        out_str = body.clock_out if len(body.clock_out) > 16 else f"{body.clock_out}:00"
        
        in_dt = datetime.fromisoformat(in_str).replace(tzinfo=CARACAS_TZ)
        out_dt = datetime.fromisoformat(out_str).replace(tzinfo=CARACAS_TZ)
    except ValueError:
        raise HTTPException(400, "Formato de fecha inválido. Use ISO8601 (YYYY-MM-DDTHH:MM)")

    if out_dt <= in_dt:
        raise HTTPException(400, "La hora de salida debe ser posterior a la de entrada")

    # 2. Get shift info for calculations
    target_date_str = in_dt.strftime("%Y-%m-%d")
    in_time_str = in_dt.strftime("%H:%M:%S")
    out_time_str = out_dt.strftime("%H:%M:%S")
    
    active_shift = None
    iso_weekday = in_dt.isoweekday()
    
    shift_res = db.table("employee_shifts").select("*").eq("profile_id", body.profile_id).eq("venue_id", body.venue_id).eq("is_active", True).execute()
    
    for s in shift_res.data or []:
        if s["modality"] == "fixed" and s["weekdays"] and iso_weekday in s["weekdays"]:
            active_shift = {
                "id": s["id"],
                "expected_start": s["start_time"],
                "expected_end": s["end_time"]
            }
            break
        elif s["modality"] == "rotating":
            d_res = db.table("shift_days").select("*").eq("employee_shift_id", s["id"]).eq("weekday", iso_weekday).execute()
            if d_res.data and not d_res.data[0].get("day_off"):
                active_shift = {
                    "id": s["id"],
                    "expected_start": d_res.data[0]["start_time"],
                    "expected_end": d_res.data[0]["end_time"]
                }
                break

    # 3. Prepare common log data
    base_log = {
        "profile_id": body.profile_id,
        "venue_id": body.venue_id,
        "edited_by": current_user.id,
        "edit_reason": body.reason,
        "verification_status": "verified"
    }
    
    if active_shift:
        base_log.update({
            "employee_shift_id": active_shift["id"],
            "expected_start": active_shift["expected_start"],
            "expected_end": active_shift["expected_end"]
        })

    # 4. Calculate Minutes Late and Overtime (New Logic)
    # Overtime only if total_worked_minutes > total_expected_minutes
    minutes_late = 0
    overtime_hours = 0
    
    if active_shift:
        # Expected duration in minutes
        e_in = datetime.strptime(active_shift["expected_start"], "%H:%M:%S")
        e_out = datetime.strptime(active_shift["expected_end"], "%H:%M:%S")
        total_expected_mins = (e_out.hour * 60 + e_out.minute) - (e_in.hour * 60 + e_in.minute)
        
        # Real duration in minutes
        total_worked_mins = (out_dt - in_dt).total_seconds() / 60
        
        # 1. Late Minutes (based on start time)
        minutes_late = calculate_late_minutes(in_time_str, active_shift["expected_start"])
        
        # 2. Overtime Hours (only if we worked more than expected)
        if total_worked_mins > total_expected_mins:
            overtime_mins = total_worked_mins - total_expected_mins
            overtime_hours = int(overtime_mins // 60)

    # 5. Insert Clock In
    in_log = base_log.copy()
    in_log.update({
        "event_type": "clock_in",
        "marked_at": in_dt.isoformat(),
        "minutes_late": minutes_late
    })
    
    db.table("attendance_logs").insert(in_log).execute()

    # 6. Insert Clock Out
    out_log = base_log.copy()
    out_log.update({
        "event_type": "clock_out",
        "marked_at": out_dt.isoformat(),
        "overtime_hours": overtime_hours
    })
    
    res = db.table("attendance_logs").insert(out_log).execute()
    
    return {"ok": True, "count": 2, "overtime_hours": overtime_hours, "minutes_late": minutes_late}
```

- [ ] **Step 2: Commit**

```bash
git add backend/main.py
git commit -m "feat(attendance): add admin manual attendance endpoint"
```

---

### Task 3: Backend - Validation / Testing

**Files:**
- Create: `backend/tests/test_manual_attendance.py`

- [ ] **Step 1: Write test for manual attendance**

```python
def test_manual_attendance_flow(client, admin_token, test_user_id, test_venue_id):
    payload = {
        "profile_id": test_user_id,
        "venue_id": test_venue_id,
        "clock_in": "2026-04-04T08:00:00",
        "clock_out": "2026-04-04T17:00:00",
        "reason": "Olvido marcar"
    }
    response = client.post(
        "/admin/attendance/manual",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
```

- [ ] **Step 2: Run tests**

Run: `pytest backend/tests/test_manual_attendance.py`

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_manual_attendance.py
git commit -m "test(attendance): add test for manual attendance entry"
```

---

### Task 4: Frontend - Update API client

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add manualEntry method to attendanceApi**

```typescript
export const attendanceApi = {
    // ... existing methods
    manualEntry: (data: {
        profile_id: string
        venue_id: string
        clock_in: string
        clock_out: string
        reason: string
    }) => fetchWithAuth('/admin/attendance/manual', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): add manualEntry to attendanceApi"
```

---

### Task 5: Frontend - Create ManualAttendanceModal component

**Files:**
- Create: `frontend/src/components/admin/ManualAttendanceModal.tsx`

- [ ] **Step 1: Implement the modal component**
Include a user selector (fetching users via `adminApi.getUsers()`), datetime inputs, and a reason text field.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/admin/ManualAttendanceModal.tsx
git commit -m "feat(frontend): create ManualAttendanceModal component"
```

---

### Task 6: Frontend - Integrate Modal in AdminAttendancePage

**Files:**
- Modify: `frontend/src/app/admin/attendance/page.tsx`

- [ ] **Step 1: Add "Registro Manual" button and state to handle modal**

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/attendance/page.tsx
git commit -m "feat(frontend): integrate manual entry in admin attendance page"
```
