# Count Schedules Management Enhancement Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement edit and "soft delete" (archive) functionality for Count Schedules in the Admin UI.

**Architecture:** 
- **Backend (FastAPI):** Add `PATCH` endpoint for updating schedules. A schedule will be "deleted" by setting its `is_active` flag to `false`.
- **Frontend API (lib/api.ts):** Add `updateSchedule` method.
- **Frontend UI (SchedulesPage):** Add Edit and Delete actions to the schedule cards. Clicking edit populates the modal. Clicking delete sets `is_active` to false. Add a toggle or filter to show/hide inactive schedules.

---

## Chunk 1: Backend API Updates

### Task 1: Add Update Endpoint
Add a `PATCH` endpoint to modify existing schedules.

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add Update Model**
```python
class UpdateCountScheduleRequest(BaseModel):
    venue_id: Optional[str] = None
    assigned_to: Optional[str] = None
    name: Optional[str] = None
    frequency: Optional[str] = None
    scope: Optional[str] = None
    category_id: Optional[str] = None
    next_due: Optional[str] = None
    is_active: Optional[bool] = None
    item_ids: Optional[list[str]] = None
```

- [ ] **Step 2: Add PATCH Endpoint**
```python
@app.patch("/count-schedules/{schedule_id}")
async def update_count_schedule(
    schedule_id: str,
    body: UpdateCountScheduleRequest,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.manage_items"))
):
    try:
        payload = body.dict(exclude_none=True, exclude={"item_ids"})
        
        if payload:
            res = db.table("count_schedules").update(payload).eq("id", schedule_id).execute()
            if not res.data:
                raise HTTPException(404, "Schedule not found")

        # Update specific items if scope changed to custom or custom items changed
        if body.scope == "custom" and body.item_ids is not None:
            # Delete old items
            db.table("count_schedule_items").delete().eq("schedule_id", schedule_id).execute()
            # Insert new items
            if body.item_ids:
                items_data = [{"schedule_id": schedule_id, "item_id": item_id} for item_id in body.item_ids]
                db.table("count_schedule_items").insert(items_data).execute()
        elif body.scope in ["all", "category"]:
             # Ensure no items exist if scope is no longer custom
             db.table("count_schedule_items").delete().eq("schedule_id", schedule_id).execute()

        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 3: Update `GET /count-schedules` to include item_ids**
Modify `list_count_schedules` to fetch `item_ids` for custom scopes so the edit form can be populated.
```python
@app.get("/count-schedules")
async def list_count_schedules(
    venue_id: Optional[str] = None,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.view"))
):
    query = db.table("count_schedules").select("*, profiles!count_schedules_assigned_to_fkey(full_name), venues(name)").order("created_at", desc=True)
    if venue_id:
        query = query.eq("venue_id", venue_id)
    
    res = query.execute()
    schedules = res.data or []
    
    # Attach items if it's a custom scope
    for s in schedules:
        if s["scope"] == "custom":
            items_res = db.table("count_schedule_items").select("item_id").eq("schedule_id", s["id"]).execute()
            s["item_ids"] = [i["item_id"] for i in (items_res.data or [])]
            
    return schedules
```

- [ ] **Step 4: Commit**
```bash
git add backend/main.py
git commit -m "feat(api): add update count schedule endpoint (M11.2)"
```

---

## Chunk 2: Frontend API Updates

### Task 2: Add update method to adminApi
Expose the new endpoint in the frontend API client.

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add updateSchedule to adminApi**
```typescript
    updateSchedule: (id: string, data: any): Promise<any> =>
        fetchWithAuth(`/count-schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/lib/api.ts
git commit -m "feat(api): add updateSchedule method to adminApi"
```

---

## Chunk 3: Admin UI - Schedule Editing

### Task 3: Implement Edit and Archive in UI
Update the schedules page to allow editing existing schedules and archiving them via a "Delete" button.

**Files:**
- Modify: `frontend/src/app/admin/inventory/utensils/schedules/page.tsx`

- [ ] **Step 1: Add Editing State**
```typescript
  const [editingSchedule, setEditingSchedule] = useState<CountSchedule | null>(null)
  const [showArchived, setShowArchived] = useState(false) // Toggle to see deleted schedules
```

- [ ] **Step 2: Implement startEdit**
```typescript
  const startEdit = (schedule: CountSchedule) => {
    setEditingSchedule(schedule)
    setNewName(schedule.name)
    setNewVenueId(schedule.venue_id)
    setNewAssignedTo(schedule.assigned_to || '')
    setNewFrequency(schedule.frequency)
    setNewScope(schedule.scope as any)
    setNewCategoryId(schedule.category_id || '')
    setNewNextDue(schedule.next_due)
    
    if (schedule.scope === 'custom' && schedule.item_ids) {
       const preSelected = utensils.filter(u => schedule.item_ids!.includes(u.id))
       setSelectedItems(preSelected)
    } else {
       setSelectedItems([])
    }
    setShowCreate(true)
  }
```

- [ ] **Step 3: Update handleSave for Updates**
Modify `handleSave` to call `adminApi.updateSchedule` if `editingSchedule` is set, otherwise call `createSchedule`.

- [ ] **Step 4: Implement handleArchive**
```typescript
  const handleArchive = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta programación?')) return
    try {
      await adminApi.updateSchedule(id, { is_active: false })
      await fetchData()
    } catch (e) {
      console.error(e)
    }
  }
```

- [ ] **Step 5: Update UI**
  - Add Edit and Delete buttons to each schedule card (only show delete if `is_active` is true).
  - Add a toggle switch or button near the top to "Mostrar Inactivas" (`showArchived`).
  - Filter `schedules` array based on `showArchived` before rendering.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/app/admin/inventory/utensils/schedules/page.tsx
git commit -m "feat(ui): implement edit and archive for count schedules (M11.2)"
```

---
*End of Plan*