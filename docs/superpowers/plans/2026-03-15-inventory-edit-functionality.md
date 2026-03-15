# Inventory Editing Functionality Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full editing capabilities for Assets, Utensils, and their Categories in the Admin UI.

**Architecture:** Extend existing management pages to handle an "editing" mode. When an edit button is clicked, the creation modal will open pre-filled with the selected item's data. Saving will trigger an `update` (PATCH) operation instead of an `insert`.

**Tech Stack:** Next.js (App Router), Supabase Client, adminApi (lib/api.ts), Lucide React.

---

## Chunk 1: Shared API and Asset Editing

### Task 1: Add updateAsset to adminApi
Ensure the frontend can send updates for assets to the backend.

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add updateAsset method**
```typescript
    updateAsset: (id: string, data: Partial<Asset>): Promise<Asset> =>
        fetchWithAuth(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/lib/api.ts
git commit -m "feat(api): add updateAsset method"
```

### Task 2: Implement Asset Editing in AssetsPage
Allow clicking "Edit" on an asset to open the modal and save changes.

**Files:**
- Modify: `frontend/src/app/admin/inventory/assets/page.tsx`

- [ ] **Step 1: Add editing state**
```typescript
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
```

- [ ] **Step 2: Implement startEdit function**
```typescript
  const startEdit = (asset: Asset) => {
    setEditingAsset(asset)
    setNewName(asset.name)
    setNewCategoryId(asset.category_id)
    setNewVenueId(asset.venue_id)
    setNewSerial(asset.serial || '')
    setNewBrand(asset.brand || '')
    setNewModel(asset.model || '')
    setShowCreate(true)
  }
```

- [ ] **Step 3: Update handleCreate to handle updates**
```typescript
  const handleSave = async () => {
    setError('')
    if (!newName || !newCategoryId || !newVenueId) {
      setError(t('inventory.assets.errors.required'))
      return
    }

    setSaving(true)
    try {
      const payload = {
        venue_id: newVenueId,
        category_id: newCategoryId,
        name: newName,
        serial: newSerial || null,
        brand: newBrand || null,
        model: newModel || null,
      }

      if (editingAsset) {
        const { data, error: err } = await supabase
          .from('assets')
          .update(payload)
          .eq('id', editingAsset.id)
          .select('*, asset_categories(name)')
          .single()
        if (err) throw err
        setAssets(prev => prev.map(a => a.id === editingAsset.id ? (data as Asset) : a))
      } else {
        // ... existing create logic ...
      }
      
      // Reset and close
      setShowCreate(false)
      setEditingAsset(null)
      // reset form fields...
    } catch (err: unknown) {
      // handle error...
    } finally {
      setSaving(false)
    }
  }
```

- [ ] **Step 4: Connect the UI Edit button**
```tsx
<button onClick={() => startEdit(asset)} ...>
```

- [ ] **Step 5: Commit**
```bash
git add frontend/src/app/admin/inventory/assets/page.tsx
git commit -m "feat(ui): implement asset editing"
```

---

## Chunk 2: Category and Utensil Editing

### Task 3: Implement Asset Category Editing
Enable editing for equipment categories.

**Files:**
- Modify: `frontend/src/app/admin/inventory/categories/page.tsx`

- [ ] **Step 1: Add editing state and startEdit logic**
- [ ] **Step 2: Update handleCreate to perform UPSERT or conditional UPDATE**
- [ ] **Step 3: Connect UI buttons**
- [ ] **Step 4: Commit**

### Task 4: Implement Utensil Editing
Enable editing for items in the utensil catalog.

**Files:**
- Modify: `frontend/src/app/admin/inventory/utensils/page.tsx`

- [ ] **Step 1: Add editing state and startEdit logic**
- [ ] **Step 2: Use adminApi.updateUtensil in the save handler**
- [ ] **Step 3: Connect UI buttons**
- [ ] **Step 4: Commit**

### Task 5: Implement Utensil Category Editing
Enable editing for utensil categories.

**Files:**
- Modify: `frontend/src/app/admin/inventory/utensils/categories/page.tsx`

- [ ] **Step 1: Add editing state and startEdit logic**
- [ ] **Step 2: Update handleCreate to handle updates**
- [ ] **Step 3: Connect UI buttons**
- [ ] **Step 4: Commit**

---
*End of Plan*
