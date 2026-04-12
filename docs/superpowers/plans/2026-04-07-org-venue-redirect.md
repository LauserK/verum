# Org Selection Redirection to Venue Creation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically redirect admins to the venue creation page when they select an organization that has no venues.

**Architecture:** Update the `VenueSelectionPage` logic to check the user's role and the number of venues in the selected organization. If venues are missing and the user is an admin, redirect to `/admin/venues`.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS.

---

### Task 1: Update VenueSelectionPage to store User Role

**Files:**
- Modify: `frontend/src/app/venue-selection/page.tsx`

- [ ] **Step 1: Add userRole state**

```typescript
// frontend/src/app/venue-selection/page.tsx

// Inside VenueSelectionPage function
const [userRole, setUserRole] = useState<string | null>(null)
```

- [ ] **Step 2: Update useEffect to capture role**

```typescript
// frontend/src/app/venue-selection/page.tsx

// Inside useEffect -> init()
const profile = await getProfile()
setUserRole(profile.role) // Capture role
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/venue-selection/page.tsx
git commit -m "feat: capture user role in VenueSelectionPage"
```

### Task 2: Implement Redirection Logic for Single Organization

**Files:**
- Modify: `frontend/src/app/venue-selection/page.tsx`

- [ ] **Step 1: Update initial redirection logic in useEffect**

```typescript
// frontend/src/app/venue-selection/page.tsx

// Inside useEffect -> init() -> if (profile.organizations.length === 1)
if (profile.organizations.length === 1) {
    const org = profile.organizations[0]
    setActiveOrgId(org.id)
    
    if (org.venues && org.venues.length === 1) {
        setSelectedVenueId(org.venues[0].id)
        router.replace('/dashboard')
    } else if ((!org.venues || org.venues.length === 0) && profile.role === 'admin') {
        // Only 1 org, no venues, and is admin -> redirect to create venue
        router.replace('/admin/venues')
    } else {
        // 1 org but multiple venues (or 0 venues and not admin) -> show venue selection
        setSelectedOrg(org)
        setStep('venue')
        setLoading(false)
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/venue-selection/page.tsx
git commit -m "feat: redirect admin to venue creation if single org has no venues"
```

### Task 3: Implement Redirection Logic for Organization Selection

**Files:**
- Modify: `frontend/src/app/venue-selection/page.tsx`

- [ ] **Step 1: Update handleOrgSelect**

```typescript
// frontend/src/app/venue-selection/page.tsx

const handleOrgSelect = (org: OrgInfo) => {
    setActiveOrgId(org.id)
    
    if ((!org.venues || org.venues.length === 0) && userRole === 'admin') {
        // Selected org has no venues and user is admin -> redirect to create venue
        router.push('/admin/venues')
    } else {
        setSelectedOrg(org)
        setStep('venue')
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/venue-selection/page.tsx
git commit -m "feat: redirect admin to venue creation when selecting org with no venues"
```

### Task 4: Improve UX for non-admins when an org has no venues

**Files:**
- Modify: `frontend/src/app/venue-selection/page.tsx`

- [ ] **Step 1: Add check in venue step to show error if empty**

```typescript
// frontend/src/app/venue-selection/page.tsx

// Inside the return JSX, where step === 'venue' is rendered
{step === 'venue' && (!selectedOrg?.venues || selectedOrg.venues.length === 0) ? (
    <div className="text-center py-10">
        <MapPin className="w-12 h-12 text-text-disabled mx-auto mb-4" />
        <p className="text-text-secondary font-medium">{t('noVenues')}</p>
    </div>
) : (
    // Existing venue mapping logic
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/venue-selection/page.tsx
git commit -m "ui: show empty state message for organizations with no venues"
```

### Task 5: Verification

- [ ] **Step 1: Manual check of the code**
Ensure all imports and types are correct.

- [ ] **Step 2: Verify build**
Run: `npm run build` in the frontend directory to ensure no regressions. (Optional if not possible in this env, but recommended to check types at least).

- [ ] **Step 3: Final Commit**
```bash
git commit --allow-empty -m "fix: complete org selection redirection logic"
```
