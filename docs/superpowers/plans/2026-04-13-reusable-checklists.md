# Reusable Checklists (On-Demand) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to create multiple instances of "On-Demand" checklists from a library, with optional custom names and privacy settings, which persist in the feed until completed.

**Architecture:** Add `custom_title` and `is_private` to `submissions`. Create a new endpoint for the library (`GET /checklists/library/{venue_id}`). Modify the main `get_checklists` feed logic to return multiple active submissions for `on_demand` templates, persisting them across days. Update the Dashboard UI to include a Library modal.

**Tech Stack:** FastAPI, Supabase (PostgreSQL), Next.js (React), TailwindCSS.

---

### Task 1: Database Migration

**Files:**
- Create: `backend/migrations/027_reusable_checklists.sql`

- [ ] **Step 1: Create the migration script**

```sql
-- Milestone 3.5: Reusable Checklists (On-Demand)

-- Add custom_title and is_private to submissions
ALTER TABLE submissions ADD COLUMN custom_title text NULL;
ALTER TABLE submissions ADD COLUMN is_private boolean DEFAULT false;
```

- [ ] **Step 2: Run the migration**

Run: `psql $DATABASE_URL -f backend/migrations/027_reusable_checklists.sql` (assuming local or remote DB connection is available via `run_shell_command` or just consider it applied manually if DB is managed via Supabase UI, but usually we just commit the SQL file and apply it. Let's apply it using Supabase CLI or psql if available, otherwise just document it).
Actually, just commit the file. We will assume the agent applies it or the system applies it on boot.
*Wait, let's make the step actually run it against the local test DB if there is one. We'll just create the file and commit.*

```bash
# If there's a script to apply migrations, run it. Otherwise, just creating the file is enough.
```

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/027_reusable_checklists.sql
git commit -m "feat: add reusable checklists db migration"
```

### Task 2: Backend Models & Create Submission Update

**Files:**
- Modify: `backend/schemas.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Update schemas.py**

Modify `ChecklistItem`, `CreateSubmissionRequest`, `SubmissionDetail`, and `HistoryItem` to include the new fields.

```python
# In backend/schemas.py

# In ChecklistItem (around line 43)
class ChecklistItem(BaseModel):
    # ... existing fields
    custom_title: Optional[str] = None
    is_private: bool = False

# In CreateSubmissionRequest (around line 50)
class CreateSubmissionRequest(BaseModel):
    template_id: str
    venue_id: str
    custom_title: Optional[str] = None
    is_private: bool = False

# In SubmissionDetail (around line 63)
class SubmissionDetail(BaseModel):
    # ... existing fields
    custom_title: Optional[str] = None
    is_private: bool = False

# In HistoryItem (around line 72)
class HistoryItem(BaseModel):
    # ... existing fields
    custom_title: Optional[str] = None
    is_private: bool = False
```

- [ ] **Step 2: Update create_submission in main.py**

Modify `create_submission` to insert the new fields.

```python
# In backend/main.py inside create_submission endpoint

        # After defining 'shift' and before inserting into 'submissions' table
        insert_data = {
            "template_id": req.template_id,
            "user_id": user.id,
            "venue_id": req.venue_id,
            "shift": shift,
            "status": "draft",
            "custom_title": req.custom_title,
            "is_private": req.is_private
        }

        sub_res = db.table("submissions").insert(insert_data).execute()
```

- [ ] **Step 3: Commit**

```bash
git add backend/schemas.py backend/main.py
git commit -m "feat: update backend schemas and create_submission for reusable checklists"
```

### Task 3: Backend Feed and Library API

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Create the Library endpoint**

Add a new endpoint `GET /checklists/library/{venue_id}`.

```python
# In backend/main.py

@app.get("/checklists/library/{venue_id}")
async def get_library_templates(venue_id: str, user=Depends(require_permission("checklists.view"))):
    """Returns all on_demand templates for a venue."""
    try:
        db = get_db()
        # Permission check logic similar to get_checklists
        venue_res = db.table("venues").select("org_id").eq("id", venue_id).execute()
        if not venue_res.data:
            raise HTTPException(404, "Sede no encontrada")
        v_org_id = venue_res.data[0]["org_id"]
        is_org_admin = await resolve_permission(user.id, "admin.view_dashboard", db, org_id=v_org_id)
        if not is_org_admin:
            pv_check = db.table("profile_venues").select("venue_id").eq("profile_id", user.id).eq("venue_id", venue_id).execute()
            if not pv_check.data:
                 raise HTTPException(403, "No tienes acceso a esta sede")

        templates_res = (
            db.table("checklist_templates")
            .select("id, title, description, frequency")
            .eq("venue_id", venue_id)
            .eq("frequency", "on_demand")
            .execute()
        )
        return templates_res.data or []
    except Exception as e:
        raise HTTPException(500, str(e))
```

- [ ] **Step 2: Update `get_checklists` logic for on_demand**

Modify `get_checklists` to handle `on_demand` templates correctly. We need to fetch ALL active submissions for `on_demand` templates, regardless of the date.

```python
# In backend/main.py inside get_checklists
        # 3. Get submissions
        # Instead of just today's submissions, we need today's OR active on_demand
        # It's easier to just fetch today's + all active (not completed) for this venue
        submissions_res = (
            db.table("submissions")
            .select("*")
            .eq("venue_id", venue_id)
            .execute() # Fetch all for now and filter in memory since OR with gte in PostgREST can be tricky
        )
        all_venue_submissions = submissions_res.data or []
        
        all_today_submissions = [s for s in all_venue_submissions if s["created_at"].startswith(today) or s["status"] != "completed"]

        # 4. Map submissions
        # ... logic needs to map multiple submissions if frequency is on_demand
        # Change result building to yield multiple items for on_demand
```
*Note for implementer: This step requires careful refactoring of the `get_checklists` loop so that a single `on_demand` template with 3 active submissions yields 3 items in the `result` list. And privacy logic: if `s["is_private"]` and `s["user_id"] != user.id`, ignore it.*

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: implement library API and update feed for on_demand checklists"
```

### Task 4: Frontend API & Types

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Update Interfaces**

```typescript
// In frontend/src/lib/api.ts

export interface ChecklistItem {
    // ... existing
    custom_title?: string | null;
    is_private?: boolean;
}

export interface LibraryTemplate {
    id: string;
    title: string;
    description: string | null;
    frequency: string;
}

// Add to exports
export function getLibraryTemplates(venueId: string): Promise<LibraryTemplate[]> {
    return fetchWithAuth(`/checklists/library/${venueId}`)
}

export async function createSubmission(templateId: string, venueId: string, customTitle?: string, isPrivate: boolean = false): Promise<{ id: string }> {
    return fetchWithAuth('/submissions', {
        method: 'POST',
        body: JSON.stringify({ template_id: templateId, venue_id: venueId, custom_title: customTitle, is_private: isPrivate })
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add frontend api types for reusable checklists"
```

### Task 5: Frontend UI (Library Modal & Feed Updates)

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/components/ChecklistCard.tsx`

- [ ] **Step 1: Update ChecklistCard to show custom title**

```tsx
// In frontend/src/components/ChecklistCard.tsx
// Use checklist.custom_title if available, fallback to checklist.title
const displayTitle = checklist.custom_title 
    ? `${checklist.title} - ${checklist.custom_title}` 
    : checklist.title;

// Add a lock icon if is_private
// <h3>{displayTitle} {checklist.is_private && <Lock className="w-3 h-3 inline" />}</h3>
```

- [ ] **Step 2: Add Library Modal to Dashboard**

Create a simple modal in `dashboard/page.tsx` that fetches `getLibraryTemplates`. Add an icon button (e.g. `Library` or `Plus`) next to the "Today's Audits" title.

```tsx
// In frontend/src/app/dashboard/page.tsx
// Add state for LibraryModal
const [showLibrary, setShowLibrary] = useState(false)
// ... Add a button next to Todays Audits
<div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-text-primary">{t('todaysAudits')}</h2>
        <button onClick={() => setShowLibrary(true)} className="p-1.5 bg-primary/10 text-primary rounded-lg">
            <Library className="w-4 h-4" />
        </button>
    </div>
    // ...
</div>
```

- [ ] **Step 3: Implement Library Modal logic**

When a template is selected, show an input for `customTitle` and a toggle for `isPrivate`. Then call `createSubmission` and refresh the feed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx frontend/src/components/ChecklistCard.tsx
git commit -m "feat: implement library modal and custom title display"
```