# Attendance-Based Access Restriction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a global restriction that prevents users from accessing system modules if they have the `attendance.force_clock_in` permission and have not registered their "clock-in" for the current day.

**Architecture:** 
1. **Backend:** Add a new permission `attendance.force_clock_in`. Update the `require_permission` decorator to check the user's latest attendance log if this permission is present.
2. **Frontend:** Create an `AttendanceGuard` component that intercepts a specific error code (e.g., `403 CLOCK_IN_REQUIRED`) and displays a blocking screen with a link to the attendance module.

**Tech Stack:** FastAPI, Next.js, Supabase.

---

## Chunk 1: Database and Backend Logic

### Task 1: Add New Permission

**Files:**
- Create: `backend/migrations/022_force_clock_in_permission.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration: Add force clock-in permission
INSERT INTO permissions (key, description, category) 
VALUES ('attendance.force_clock_in', 'Force user to clock-in before accessing other modules', 'Attendance');
```

- [ ] **Step 2: Commit**

```bash
git add backend/migrations/022_force_clock_in_permission.sql
git commit -m "feat(db): add attendance.force_clock_in permission"
```

### Task 2: Implement Attendance Check Utility

**Files:**
- Create: `backend/attendance_utils.py`

- [ ] **Step 1: Write `is_clocked_in` function**

```python
from database import get_db

async def is_clocked_in(profile_id: str, db) -> bool:
    """ Checks if the user's latest attendance log for today is an active session. """
    from datetime import datetime, date
    
    # Get the latest log for today
    today = date.today().isoformat()
    res = db.table("attendance_logs")\
        .select("action")\
        .eq("profile_id", profile_id)\
        .gte("timestamp", today)\
        .order("timestamp", desc=True)\
        .limit(1)\
        .execute()
    
    if not res.data:
        return False
    
    # If the last action was 'clock_in' or 'break_end', they are active
    return res.data[0]["action"] in ["clock_in", "break_end"]
```

### Task 3: Update Permission Decorator

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update `require_permission` decorator**

Import `resolve_permission` and the new utility. Modify the decorator logic:

```python
# Around line 140 in main.py (inside require_permission)
from permissions import resolve_permission
from attendance_utils import is_clocked_in

def require_permission(permission_key: str):
    async def decorator(user=Depends(get_current_user), db=Depends(get_db)):
        profile_id = user["id"]
        
        # 1. Check if user is forced to clock-in
        # Exclude attendance-related keys to avoid circular blocking
        if not permission_key.startswith("attendance."):
            force_check = await resolve_permission(profile_id, "attendance.force_clock_in", db)
            if force_check:
                clocked_in = await is_clocked_in(profile_id, db)
                if not clocked_in:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="CLOCK_IN_REQUIRED"
                    )
        
        # 2. Standard permission check
        has_perm = await resolve_permission(profile_id, permission_key, db)
        if not has_perm:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
        return user
    return decorator
```

- [ ] **Step 2: Commit**

```bash
git add backend/attendance_utils.py backend/main.py
git commit -m "feat(backend): implement attendance-based access restriction"
```

---

## Chunk 2: Frontend Implementation

### Task 4: UI Blocking and Translations

**Files:**
- Modify: `frontend/src/messages/es.json`
- Modify: `frontend/src/messages/en.json`
- Create: `frontend/src/components/AttendanceGuard.tsx`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Add translations**

In `es.json`:
```json
"attendance": {
    "requiredTitle": "Entrada Requerida",
    "requiredDesc": "Debes marcar tu entrada en el módulo de asistencia antes de acceder a otras funciones.",
    "goToAttendance": "Ir a Asistencia"
}
```

- [ ] **Step 2: Create `AttendanceGuard` component**

```tsx
'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Clock, AlertCircle } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'

export default function AttendanceGuard({ children }: { children: React.ReactNode }) {
    const [isBlocked, setIsBlocked] = useState(false)
    const { t } = useTranslations('attendance')
    const pathname = usePathname()
    const router = useRouter()

    // Listen for custom CLOCK_IN_REQUIRED events or handle 403 errors globally
    // For now, we assume the API wrapper or a global state might trigger this
    
    if (isBlocked && !pathname.includes('/attendance')) {
        return (
            <div className="fixed inset-0 z-[100] bg-bg flex items-center justify-center p-6">
                <div className="max-w-sm w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                        <Clock className="w-10 h-10 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-text-primary">{t('requiredTitle')}</h2>
                        <p className="text-text-secondary">{t('requiredDesc')}</p>
                    </div>
                    <button
                        onClick={() => { setIsBlocked(false); router.push('/attendance') }}
                        className="w-full bg-primary text-text-inverse h-14 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
                    >
                        {t('goToAttendance')}
                    </button>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
```

- [ ] **Step 3: Wrap layout with `AttendanceGuard`**

In `frontend/src/app/layout.tsx`, wrap the `main` or children content.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/messages/es.json frontend/src/messages/en.json frontend/src/components/AttendanceGuard.tsx frontend/src/app/layout.tsx
git commit -m "feat(frontend): add AttendanceGuard for access restriction"
```
