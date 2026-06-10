# Item Detail View and Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a comprehensive detail view for items to manage their basic info, unit conversions (presentations), warehouse associations, and view their specific movement history.

**Architecture:** A new dynamic route `/admin/inventory/items/[id]` using a tabbed UI for clear separation of concerns.

**Tech Stack:** Next.js (App Router), FastAPI, Lucide Icons, Tailwind CSS.

---

### Task 1: Backend - Item Detail & Stock Endpoints

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add GET single item endpoint**

```python
@app.get("/inventory/items/{item_id}", response_model=ItemResponse, tags=["Inventory"])
async def get_item(item_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("items").select("*").eq("id", str(item_id)).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Item not found")
    return res.data
```

- [ ] **Step 2: Add endpoint to get stock by item**

```python
@app.get("/inventory/items/{item_id}/stock", tags=["Inventory"])
async def get_item_stock(item_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("stock").select("*, warehouses(name)").eq("item_id", str(item_id)).execute()
    return res.data
```

- [ ] **Step 3: Add endpoint to associate warehouse**

```python
@app.post("/inventory/items/{item_id}/stock", tags=["Inventory"])
async def associate_warehouse(item_id: UUID, body: dict, db=Depends(get_db), _=Depends(require_permission("inventory.manage_items"))):
    warehouse_id = body.get("warehouse_id")
    db.table("stock").upsert({
        "item_id": str(item_id),
        "warehouse_id": warehouse_id,
        "qty_base": 0
    }, on_conflict="item_id,warehouse_id").execute()
    return {"ok": True}
```

---

### Task 2: Frontend - API & Detail Page Implementation

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/app/admin/inventory/items/[id]/page.tsx`
- Modify: `frontend/src/app/admin/inventory/items/page.tsx` (linking)

- [ ] **Step 1: Update API Client**
Add `getInventoryItem`, `getItemStock`, and `associateWarehouseToItem`.

- [ ] **Step 2: Implement Detail Page Shell**
Create the dynamic route with Tabs: General, Presentations, Warehouses, History.

- [ ] **Step 3: Implement Presentations Tab**
Allow creating new `uom_presentations` and toggling them for the current item.

- [ ] **Step 4: Implement Warehouses Tab**
List warehouses currently associated and show a selector to add new ones.

- [ ] **Step 5: Implement History Tab**
Fetch and display a filtered Kardex for this specific `item_id`.

- [ ] **Step 6: Update Items Main List**
Make the item name a Link to the detail page.
