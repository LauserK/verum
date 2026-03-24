# Drag and Drop Question Reordering Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to reorder questions within a template using a drag-and-drop interface in the admin templates page.

**Architecture:** Use `@dnd-kit` in the frontend for an accessible drag-and-drop interface. Update the backend by adding a new `PUT` endpoint to handle bulk updating the `sort_order` of multiple questions efficiently in a single request.

**Tech Stack:** React, Next.js, @dnd-kit/core, @dnd-kit/sortable, FastAPI, Supabase.

---

## Chunk 1: Backend Endpoint

### Task 1: Add Reorder Endpoint

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Write the failing test**
(Skipped as there's no test suite defined for this module in the current context, but we will write the endpoint).

- [ ] **Step 2: Write minimal implementation**

Add the Pydantic models and the new endpoint in `backend/main.py` below the `create_question` endpoint:

```python
class ReorderItem(BaseModel):
    id: str
    sort_order: int

class ReorderQuestionsRequest(BaseModel):
    questions: list[ReorderItem]

@app.put("/admin/templates/{template_id}/questions/reorder")
async def reorder_questions(template_id: str, body: ReorderQuestionsRequest, user=Depends(require_permission("checklists.manage_templates"))):
    db = get_db()
    for item in body.questions:
        db.table("questions").update({"sort_order": item.sort_order}).eq("id", item.id).execute()
    return {"ok": True}
```

- [ ] **Step 3: Run the tests and make sure they pass**
Run the backend server to ensure there are no syntax errors.

```bash
cd backend
venv\Scripts\python -m uvicorn main:app --reload --port 8000
```
Expected: Server starts without errors.

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add endpoint to bulk reorder questions"
```

---

## Chunk 2: Frontend Integration

### Task 2: Install Dependencies and Update API Client

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Install `@dnd-kit`**

```bash
cd frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Update API Client**

In `frontend/src/lib/api.ts`, inside the `adminApi` object, add the `reorderQuestions` function:

```typescript
    reorderQuestions: (templateId: string, questions: { id: string, sort_order: number }[]): Promise<{ ok: boolean }> =>
        fetchWithAuth(`/admin/templates/${templateId}/questions/reorder`, { method: 'PUT', body: JSON.stringify({ questions }) }),
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/api.ts
git commit -m "feat(frontend): add dnd-kit dependencies and reorder API method"
```

### Task 3: Implement Drag and Drop in UI

**Files:**
- Create: `frontend/src/components/admin/SortableQuestionItem.tsx`
- Modify: `frontend/src/app/admin/templates/page.tsx`

- [ ] **Step 1: Create `SortableQuestionItem` component**

Create `frontend/src/components/admin/SortableQuestionItem.tsx`:

```tsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit3, Trash2 } from 'lucide-react';
import { Question } from '@/lib/api';

interface SortableQuestionItemProps {
    question: Question;
    onEdit: (q: Question) => void;
    onDelete: (id: string) => void;
}

export function SortableQuestionItem({ question: q, onEdit, onDelete }: SortableQuestionItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: q.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="bg-surface border border-border rounded-2xl p-4 flex items-start justify-between gap-3 relative bg-white">
            <div className="flex items-start gap-2 min-w-0 flex-1">
                <div {...attributes} {...listeners} className="cursor-grab hover:text-primary transition-colors touch-none">
                    <GripVertical className="w-4 h-4 text-text-disabled flex-shrink-0 mt-0.5" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{q.label}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                            {q.type}
                        </span>
                        {q.is_required && (
                            <span className="text-[10px] font-medium text-error">Required</span>
                        )}
                        {q.config && (
                            <span className="text-[10px] text-text-secondary">config ✓</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(q); }}
                    className="text-text-secondary hover:text-primary transition-colors p-1"
                >
                    <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(q.id); }}
                    className="text-text-secondary hover:text-error transition-colors p-1"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Update `TemplatesPage`**

In `frontend/src/app/admin/templates/page.tsx`:
Add imports:
```tsx
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableQuestionItem } from '@/components/admin/SortableQuestionItem';
```

Inside `TemplatesPage` function, add the sensors and drag handler:
```tsx
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !selectedTemplate) return;

        const oldIndex = questions.findIndex((q) => q.id === active.id);
        const newIndex = questions.findIndex((q) => q.id === over.id);

        const newQuestions = arrayMove(questions, oldIndex, newIndex).map((q, index) => ({
            ...q,
            sort_order: index,
        }));

        setQuestions(newQuestions);

        try {
            await adminApi.reorderQuestions(
                selectedTemplate.id,
                newQuestions.map(q => ({ id: q.id, sort_order: q.sort_order }))
            );
        } catch (err) {
            console.error('Failed to save new order', err);
        }
    };
```

Replace the questions map block (lines ~386-455) with:
```tsx
                        <>
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-3">
                                        {questions.map((q) => (
                                            editingQuestionId === q.id ? (
                                                /* Inline Edit Form */
                                                <div key={q.id} className="bg-surface border border-border rounded-2xl p-4">
                                                    <div className="space-y-3">
                                                        <input
                                                            value={eqLabel}
                                                            onChange={(e) => setEqLabel(e.target.value)}
                                                            className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                                                        />
                                                        <div className="flex gap-3">
                                                            <select
                                                                value={eqType}
                                                                onChange={(e) => setEqType(e.target.value)}
                                                                className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none flex-1"
                                                            >
                                                                {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                            </select>
                                                            <label className="flex items-center gap-2 text-sm text-text-primary">
                                                                <input type="checkbox" checked={eqRequired} onChange={(e) => setEqRequired(e.target.checked)} className="accent-primary" />
                                                                Required
                                                            </label>
                                                        </div>
                                                        <QuestionConfigEditor type={eqType} config={eqConfig} onChange={setEqConfig} />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={handleUpdateQuestion}
                                                                disabled={saving}
                                                                className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-9 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                                                            >
                                                                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingQuestionId(null)}
                                                                className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-9 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
                                                            >
                                                                <X className="w-3.5 h-3.5" /> Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <SortableQuestionItem
                                                    key={q.id}
                                                    question={q}
                                                    onEdit={startEditQuestion}
                                                    onDelete={handleDeleteQuestion}
                                                />
                                            )
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </>
```

- [ ] **Step 3: Run the tests and make sure they pass**
Start the frontend server and verify compilation and dragging functionality.
```bash
cd frontend
npm run dev
```

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/admin/SortableQuestionItem.tsx frontend/src/app/admin/templates/page.tsx
git commit -m "feat(frontend): implement question drag and drop in templates"
```