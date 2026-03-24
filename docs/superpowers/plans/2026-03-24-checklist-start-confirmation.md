# Confirmation Modal for Starting Checklists Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a confirmation modal that appears when a user clicks on a "pending" checklist to prevent accidental "in-progress" status changes.

**Architecture:** Create a reusable `ConfirmationModal` component. Update the `DashboardPage` to intercept clicks on pending checklists and show the modal.

**Tech Stack:** React, Next.js, Tailwind CSS, Lucide Icons.

---

## Chunk 1: Shared Components and Translations

### Task 1: Create ConfirmationModal Component

**Files:**
- Create: `frontend/src/components/ConfirmationModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmationModal({
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-border animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 text-primary">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-text-primary">{title}</h3>
                    </div>
                    
                    <p className="text-text-secondary text-sm leading-relaxed mb-8">
                        {message}
                    </p>

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={onConfirm}
                            className="w-full h-12 bg-primary text-text-inverse rounded-2xl font-bold text-sm hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                        >
                            {confirmLabel}
                        </button>
                        <button
                            onClick={onCancel}
                            className="w-full h-12 bg-surface-raised text-text-primary rounded-2xl font-bold text-sm hover:bg-border/20 transition-colors"
                        >
                            {cancelLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ConfirmationModal.tsx
git commit -m "feat(ui): add ConfirmationModal component"
```

### Task 2: Update Translations

**Files:**
- Modify: `frontend/src/messages/es.json`
- Modify: `frontend/src/messages/en.json`

- [ ] **Step 1: Add dashboard translation keys**

In `es.json` under `dashboard`:
```json
"startConfirmationTitle": "¿Empezar checklist?",
"startConfirmationDesc": "Vas a iniciar este checklist. Una vez iniciado, aparecerá como 'En progreso'. ¿Deseas continuar?",
"startConfirm": "Sí, empezar",
"startCancel": "No, ahora no"
```

In `en.json` under `dashboard`:
```json
"startConfirmationTitle": "Start checklist?",
"startConfirmationDesc": "You are about to start this checklist. Once started, it will appear as 'In progress'. Do you want to continue?",
"startConfirm": "Yes, start",
"startCancel": "No, not now"
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/messages/es.json frontend/src/messages/en.json
git commit -m "feat(i18n): add checklist start confirmation messages"
```

---

## Chunk 2: Dashboard Integration

### Task 3: Implement Confirmation Logic in Dashboard

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Add state and import**

Add imports:
```tsx
import ConfirmationModal from '@/components/ConfirmationModal'
```

Add state inside `DashboardPage`:
```tsx
const [pendingChecklist, setPendingChecklist] = useState<ChecklistItem | null>(null)
```

- [ ] **Step 2: Update handle click logic**

Modify the `ChecklistCard` onClick and add the handler:

```tsx
    const handleChecklistClick = (checklist: ChecklistItem) => {
        if (checklist.status === 'pending') {
            setPendingChecklist(checklist)
        } else if (checklist.status !== 'locked') {
            proceedToChecklist(checklist)
        }
    }

    const proceedToChecklist = (checklist: ChecklistItem) => {
        const venueId = profile?.venue_id || profile?.venues?.[0]?.id || ''
        router.push(`/checklist/${checklist.id}?venue=${venueId}&from=dashboard`)
        setPendingChecklist(null)
    }
```

- [ ] **Step 3: Render the modal**

Add the modal at the end of the return JSX:

```tsx
            <ConfirmationModal
                isOpen={!!pendingChecklist}
                title={t('startConfirmationTitle')}
                message={t('startConfirmationDesc')}
                confirmLabel={t('startConfirm')}
                cancelLabel={t('startCancel')}
                onConfirm={() => pendingChecklist && proceedToChecklist(pendingChecklist)}
                onCancel={() => setPendingChecklist(null)}
            />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat(dashboard): add confirmation modal before starting checklist"
```
