# Physical Inventory Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-friendly physical inventory counting utility that registers counted quantities, tracks drafts, and generates FIFO (PEPS) Kardex adjustments upon auditing.

**Architecture:** Save inventory counts as drafts in `physical_inventories` and `physical_inventory_lines` tables. Upon processing, calculate difference vs. system stock and apply positive (`adjustment_in` lot addition) or negative (`adjustment_out` FIFO consumption) stock movements.

**Tech Stack:** FastAPI, Supabase PostgreSQL, Next.js 14/15, Tailwind CSS, Shadcn UI.

---

## File Structure Map

*   **Database Migration**:
    *   Create: `backend/migrations/039_physical_inventory.sql` (Inserts permissions and creates tables `physical_inventories` and `physical_inventory_lines`)
*   **Backend Schemas**:
    *   Modify: `backend/schemas.py` (Appends Pydantic models for physical inventory creation, update, and response)
*   **Backend API Endpoints**:
    *   Modify: `backend/main.py` (Appends endpoints for list, get, create, update, and process physical inventories)
*   **Backend Unit Tests**:
    *   Create: `backend/tests/test_physical_inventory.py` (Unit tests for create draft, update draft, and process FIFO adjustments)
*   **Frontend API Client**:
    *   Modify: `frontend/src/lib/api.ts` (Adds physical inventory count endpoints to the adminApi client)
*   **Frontend Components**:
    *   Create: `frontend/src/app/inventory/count/page.tsx` (Mobile-friendly physical inventory count utility)
    *   Create: `frontend/src/app/admin/inventory/physical/page.tsx` (Admin listing of inventory counts history & drafts)
    *   Create: `frontend/src/app/admin/inventory/physical/[id]/page.tsx` (Admin audit/review panel for a specific count draft)

---

## Tasks

### Task 1: Database Migration

**Files:**
- Create: `backend/migrations/039_physical_inventory.sql`

- [ ] **Step 1: Write the migration script**
Create the migration file `backend/migrations/039_physical_inventory.sql` with the following SQL:
```sql
-- backend/migrations/039_physical_inventory.sql

-- 1. Insert permissions
INSERT INTO permissions (module, action, key, description) VALUES
  ('inventory', 'count', 'inventory.count', 'Realizar conteos físicos de inventario'),
  ('inventory', 'audit_count', 'inventory.audit_count', 'Revisar y procesar conteos de inventario (Kardex)')
ON CONFLICT (key) DO NOTHING;

-- 2. Physical Inventories Header
CREATE TABLE IF NOT EXISTS physical_inventories (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_id    UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  document_number TEXT UNIQUE NOT NULL,
  status          TEXT CHECK (status IN ('draft', 'processed')) DEFAULT 'draft',
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  processed_by    UUID REFERENCES profiles(id),
  processed_at    TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Physical Inventories Lines
CREATE TABLE IF NOT EXISTS physical_inventory_lines (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  physical_inventory_id UUID REFERENCES physical_inventories(id) ON DELETE CASCADE,
  item_id               UUID REFERENCES items(id) ON DELETE CASCADE,
  qty_expected_base     NUMERIC(18, 6) NOT NULL,
  qty_counted_base      NUMERIC(18, 6) NOT NULL,
  presentation_id       UUID REFERENCES uom_presentations(id),
  qty_presentation      NUMERIC(18, 6),
  notes                 TEXT,
  UNIQUE (physical_inventory_id, item_id)
);

-- 4. Enable RLS and default policies
ALTER TABLE public.physical_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_inventory_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.physical_inventories;
CREATE POLICY "Authenticated users can do everything" ON public.physical_inventories FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.physical_inventory_lines;
CREATE POLICY "Authenticated users can do everything" ON public.physical_inventory_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_physical_inventories_org ON physical_inventories(org_id);
CREATE INDEX IF NOT EXISTS idx_physical_inventories_wh ON physical_inventories(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_physical_inventory_lines_header ON physical_inventory_lines(physical_inventory_id);
```

- [ ] **Step 2: Commit Task 1**
```bash
git add backend/migrations/039_physical_inventory.sql
git commit -m "migration: create physical inventory tables and seed permissions"
```

---

### Task 2: Pydantic Schemas

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Write Pydantic Schemas in backend/schemas.py**
Open `backend/schemas.py` and append the following schema models:
```python
# M39: Physical Inventory Count Schemas
class PhysicalInventoryLineCreate(BaseModel):
    item_id: UUID
    qty_counted_base: Decimal
    presentation_id: Optional[UUID] = None
    qty_presentation: Optional[Decimal] = None
    notes: Optional[str] = None

class PhysicalInventoryCreate(BaseModel):
    warehouse_id: UUID
    notes: Optional[str] = None
    lines: List[PhysicalInventoryLineCreate]

class PhysicalInventoryLineResponse(BaseModel):
    id: UUID
    item_id: UUID
    item_name: Optional[str] = None
    qty_expected_base: Decimal
    qty_counted_base: Decimal
    presentation_id: Optional[UUID] = None
    presentation_name: Optional[str] = None
    qty_presentation: Optional[Decimal] = None
    notes: Optional[str] = None

class PhysicalInventoryResponse(BaseModel):
    id: UUID
    org_id: UUID
    warehouse_id: UUID
    warehouse_name: Optional[str] = None
    document_number: str
    status: str
    notes: Optional[str] = None
    created_by: UUID
    creator_name: Optional[str] = None
    processed_by: Optional[UUID] = None
    processor_name: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime
    lines: List[PhysicalInventoryLineResponse]

class PhysicalInventoryBriefResponse(BaseModel):
    id: UUID
    warehouse_id: UUID
    warehouse_name: Optional[str] = None
    document_number: str
    status: str
    notes: Optional[str] = None
    creator_name: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime
```

- [ ] **Step 2: Commit Task 2**
```bash
git add backend/schemas.py
git commit -m "feat(schemas): add physical inventory count request and response models"
```

---

### Task 3: Backend API Endpoints

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add Physical Inventory Routes to backend/main.py**
Open `backend/main.py` and import the new schemas. Update imports around line 44:
```python
    PhysicalInventoryCreate, PhysicalInventoryResponse, PhysicalInventoryBriefResponse,
```
Then, append the physical count endpoints at the bottom of `backend/main.py`:
```python
# ── Inventory: Physical Counts (M39) ───────────────────

@app.post("/inventory/physical-inventories", response_model=PhysicalInventoryResponse, tags=["Inventory"])
async def create_physical_inventory(
    doc: PhysicalInventoryCreate, 
    org_id: str = Depends(get_active_org_id), 
    user=Depends(get_current_user), 
    db=Depends(get_db), 
    _=Depends(require_permission("inventory.count"))
):
    # 1. Generate document number: INV-2026-XXXX
    res_count = db.table("physical_inventories").select("id", count="exact").execute()
    count = res_count.count or 0
    document_number = f"INV-2026-{count + 1:04d}"

    # 2. Insert header
    header_data = {
        "org_id": org_id,
        "warehouse_id": str(doc.warehouse_id),
        "document_number": document_number,
        "status": "draft",
        "notes": doc.notes,
        "created_by": user.id
    }
    header_res = db.table("physical_inventories").insert(header_data).execute()
    if not header_res.data:
        raise HTTPException(status_code=400, detail="Error creating physical inventory header")
    doc_id = header_res.data[0]["id"]

    # 3. Process lines and record expected quantities at draft creation time
    for line in doc.lines:
        # Get expected stock
        stock_res = db.table("stock") \
            .select("qty_base") \
            .eq("warehouse_id", str(doc.warehouse_id)) \
            .eq("item_id", str(line.item_id)) \
            .execute()
        expected = float(stock_res.data[0]["qty_base"]) if stock_res.data else 0.0

        line_data = {
            "physical_inventory_id": doc_id,
            "item_id": str(line.item_id),
            "qty_expected_base": expected,
            "qty_counted_base": float(line.qty_counted_base),
            "presentation_id": str(line.presentation_id) if line.presentation_id else None,
            "qty_presentation": float(line.qty_presentation) if line.qty_presentation is not None else None,
            "notes": line.notes
        }
        db.table("physical_inventory_lines").insert(line_data).execute()

    return await get_physical_inventory_detail(doc_id, db)


@app.get("/inventory/physical-inventories", response_model=List[PhysicalInventoryBriefResponse], tags=["Inventory"])
async def list_physical_inventories(
    org_id: str = Depends(get_active_org_id), 
    db=Depends(get_db), 
    _=Depends(require_permission("inventory.view"))
):
    res = db.table("physical_inventories") \
        .select("*, warehouses(name), profiles:created_by(full_name)") \
        .eq("org_id", org_id) \
        .order("created_at", desc=True) \
        .execute()
    
    results = []
    for r in (res.data or []):
        results.append({
            "id": r["id"],
            "warehouse_id": r["warehouse_id"],
            "warehouse_name": r["warehouses"]["name"] if r.get("warehouses") else "Desconocido",
            "document_number": r["document_number"],
            "status": r["status"],
            "notes": r["notes"],
            "creator_name": r["profiles"]["full_name"] if r.get("profiles") else "Sistema",
            "processed_at": r["processed_at"],
            "created_at": r["created_at"]
        })
    return results


@app.get("/inventory/physical-inventories/{id}", response_model=PhysicalInventoryResponse, tags=["Inventory"])
async def get_physical_inventory_detail(
    id: UUID, 
    db=Depends(get_db), 
    _=Depends(require_permission("inventory.view"))
):
    # Fetch header
    res = db.table("physical_inventories") \
        .select("*, warehouses(name), creator:created_by(full_name), processor:processed_by(full_name)") \
        .eq("id", str(id)) \
        .execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Physical inventory count not found")
    
    h = res.data[0]

    # Fetch lines
    lines_res = db.table("physical_inventory_lines") \
        .select("*, items(name), uom_presentations(name)") \
        .eq("physical_inventory_id", str(id)) \
        .execute()
    
    lines = []
    for l in (lines_res.data or []):
        lines.append({
            "id": l["id"],
            "item_id": l["item_id"],
            "item_name": l["items"]["name"] if l.get("items") else "Desconocido",
            "qty_expected_base": l["qty_expected_base"],
            "qty_counted_base": l["qty_counted_base"],
            "presentation_id": l["presentation_id"],
            "presentation_name": l["uom_presentations"]["name"] if l.get("uom_presentations") else None,
            "qty_presentation": l["qty_presentation"],
            "notes": l["notes"]
        })

    return {
        "id": h["id"],
        "org_id": h["org_id"],
        "warehouse_id": h["warehouse_id"],
        "warehouse_name": h["warehouses"]["name"] if h.get("warehouses") else "Desconocido",
        "document_number": h["document_number"],
        "status": h["status"],
        "notes": h["notes"],
        "created_by": h["created_by"],
        "creator_name": h["creator"]["full_name"] if h.get("creator") else "Desconocido",
        "processed_by": h["processed_by"],
        "processor_name": h["processor"]["full_name"] if h.get("processor") else None,
        "processed_at": h["processed_at"],
        "created_at": h["created_at"],
        "lines": lines
    }


@app.put("/inventory/physical-inventories/{id}", response_model=PhysicalInventoryResponse, tags=["Inventory"])
async def update_physical_inventory(
    id: UUID, 
    doc: PhysicalInventoryCreate, 
    db=Depends(get_db), 
    _=Depends(require_permission("inventory.count"))
):
    # Verify status is draft
    check_res = db.table("physical_inventories").select("status").eq("id", str(id)).execute()
    if not check_res.data:
        raise HTTPException(status_code=404, detail="Physical inventory count not found")
    if check_res.data[0]["status"] != "draft":
        raise HTTPException(status_code=400, detail="Cannot update a processed inventory count")

    # Update header notes
    db.table("physical_inventories").update({"notes": doc.notes}).eq("id", str(id)).execute()

    # Clear and insert new lines
    db.table("physical_inventory_lines").delete().eq("physical_inventory_id", str(id)).execute()

    for line in doc.lines:
        stock_res = db.table("stock") \
            .select("qty_base") \
            .eq("warehouse_id", str(doc.warehouse_id)) \
            .eq("item_id", str(line.item_id)) \
            .execute()
        expected = float(stock_res.data[0]["qty_base"]) if stock_res.data else 0.0

        line_data = {
            "physical_inventory_id": str(id),
            "item_id": str(line.item_id),
            "qty_expected_base": expected,
            "qty_counted_base": float(line.qty_counted_base),
            "presentation_id": str(line.presentation_id) if line.presentation_id else None,
            "qty_presentation": float(line.qty_presentation) if line.qty_presentation is not None else None,
            "notes": line.notes
        }
        db.table("physical_inventory_lines").insert(line_data).execute()

    return await get_physical_inventory_detail(id, db)


@app.post("/inventory/physical-inventories/{id}/process", response_model=PhysicalInventoryResponse, tags=["Inventory"])
async def process_physical_inventory(
    id: UUID, 
    org_id: str = Depends(get_active_org_id), 
    user=Depends(get_current_user), 
    db=Depends(get_db), 
    _=Depends(require_permission("inventory.audit_count"))
):
    # Fetch header
    h_res = db.table("physical_inventories").select("*").eq("id", str(id)).execute()
    if not h_res.data:
        raise HTTPException(status_code=404, detail="Physical inventory count not found")
    
    h = h_res.data[0]
    if h["status"] != "draft":
        raise HTTPException(status_code=400, detail="Inventory count has already been processed")

    warehouse_id = h["warehouse_id"]

    # Fetch lines
    lines_res = db.table("physical_inventory_lines").select("*").eq("physical_inventory_id", str(id)).execute()
    lines = lines_res.data or []

    # Process each counted line applying stock adjustments
    for line in lines:
        item_id = line["item_id"]
        qty_counted = float(line["qty_counted_base"])
        
        # 1. Fetch current stock from system
        stock_res = db.table("stock") \
            .select("id, qty_base") \
            .eq("warehouse_id", warehouse_id) \
            .eq("item_id", item_id) \
            .execute()
        
        qty_expected = float(stock_res.data[0]["qty_base"]) if stock_res.data else 0.0
        
        # Update expected value in the document line database to snapshot the state at execution
        db.table("physical_inventory_lines") \
            .update({"qty_expected_base": qty_expected}) \
            .eq("id", line["id"]) \
            .execute()
            
        difference = qty_counted - qty_expected
        
        if difference > 0:
            # Positive Adjustment: Add stock lot & Adjustment In movement
            # Try to get the item's last purchase cost
            item_cost_res = db.table("items").select("last_purchase_cost").eq("id", item_id).execute()
            cost = float(item_cost_res.data[0]["last_purchase_cost"]) if (item_cost_res.data and item_cost_res.data[0]["last_purchase_cost"]) else 0.0

            # Insert lot
            lot_data = {
                "warehouse_id": warehouse_id,
                "item_id": item_id,
                "lot_number": f"AJUSTE-{h['document_number']}",
                "qty_base": difference,
                "unit_cost_base": cost,
                "is_exhausted": False
            }
            lot_res = db.table("stock_lots").insert(lot_data).execute()
            lot_id = lot_res.data[0]["id"] if lot_res.data else None

            # Log movement
            movement_data = {
                "org_id": org_id,
                "movement_type": "adjustment_in",
                "warehouse_id": warehouse_id,
                "item_id": item_id,
                "lot_id": lot_id,
                "qty_base": difference,
                "unit_cost_base": cost,
                "total_cost": difference * cost,
                "reference_id": str(id),
                "reference_type": "physical_inventory",
                "notes": f"Ajuste por diferencia de inventario {h['document_number']}",
                "created_by": user.id
            }
            db.table("stock_movements").insert(movement_data).execute()

            # Update stock
            if stock_res.data:
                new_qty = qty_expected + difference
                db.table("stock").update({"qty_base": new_qty}).eq("id", stock_res.data[0]["id"]).execute()
            else:
                db.table("stock").insert({
                    "warehouse_id": warehouse_id,
                    "item_id": item_id,
                    "qty_base": difference,
                    "qty_reserved": 0.0
                }).execute()

        elif difference < 0:
            # Negative Adjustment: Consume FIFO lots & Adjustment Out movement
            to_consume = abs(difference)
            
            # Fetch oldest non-exhausted lots for FIFO
            lots_res = db.table("stock_lots") \
                .select("*") \
                .eq("item_id", item_id) \
                .eq("warehouse_id", warehouse_id) \
                .filter("qty_base", "gt", 0) \
                .order("received_at", desc=False) \
                .execute()
                
            remaining = to_consume
            for lot in (lots_res.data or []):
                if remaining <= 0:
                    break
                
                lot_qty = float(lot["qty_base"])
                consume_qty = min(remaining, lot_qty)
                
                new_lot_qty = lot_qty - consume_qty
                db.table("stock_lots").update({
                    "qty_base": new_lot_qty,
                    "is_exhausted": new_lot_qty <= 0
                }).eq("id", lot["id"]).execute()
                
                # Log movement
                movement_data = {
                    "org_id": org_id,
                    "movement_type": "adjustment_out",
                    "warehouse_id": warehouse_id,
                    "item_id": item_id,
                    "lot_id": lot["id"],
                    "qty_base": -consume_qty,
                    "unit_cost_base": float(lot["unit_cost_base"]),
                    "total_cost": -consume_qty * float(lot["unit_cost_base"]),
                    "reference_id": str(id),
                    "reference_type": "physical_inventory",
                    "notes": f"Consumo por ajuste físico {h['document_number']}",
                    "created_by": user.id
                }
                db.table("stock_movements").insert(movement_data).execute()
                
                remaining -= consume_qty

            # Update overall stock
            if stock_res.data:
                new_qty = max(0, float(stock_res.data[0]["qty_base"]) - to_consume)
                db.table("stock").update({"qty_base": new_qty}).eq("id", stock_res.data[0]["id"]).execute()

    # 4. Set processed status
    db.table("physical_inventories").update({
        "status": "processed",
        "processed_by": user.id,
        "processed_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", str(id)).execute()

    return await get_physical_inventory_detail(id, db)
```

- [ ] **Step 2: Commit Task 3**
```bash
git add backend/main.py
git commit -m "feat(api): implement physical inventory CRUD and FIFO adjustment processing endpoints"
```

---

### Task 4: Backend Unit Tests

**Files:**
- Create: `backend/tests/test_physical_inventory.py`

- [ ] **Step 1: Write backend/tests/test_physical_inventory.py**
Create the file with unit tests demonstrating physical counts draft flow and FIFO adjustments:
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app, get_db, get_active_org_id
from auth_deps import get_current_user
import uuid
import main

def test_create_physical_inventory_draft(client, mock_supabase, authenticated_user_mock):
    warehouse_id = str(uuid.uuid4())
    item_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    
    count_data = {
        "warehouse_id": warehouse_id,
        "notes": "Test draft count",
        "lines": [
            {
                "item_id": item_id,
                "qty_counted_base": 15.0,
                "presentation_id": None,
                "qty_presentation": None,
                "notes": "Checked shelf A"
            }
        ]
    }

    app.dependency_overrides[get_current_user] = lambda: authenticated_user_mock
    app.dependency_overrides[main.get_active_org_id] = lambda: org_id
    
    with patch("main.resolve_permission", return_value=True):
        mock_res_count = MagicMock()
        mock_res_count.count = 5

        mock_header_res = MagicMock()
        mock_header_res.data = [{
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "warehouse_id": warehouse_id,
            "document_number": "INV-2026-0006",
            "status": "draft",
            "notes": "Test draft count",
            "created_by": authenticated_user_mock.id,
            "created_at": "2026-06-17T12:00:00Z"
        }]

        mock_uom_pres_table = MagicMock()
        
        mock_inv_table = MagicMock()
        mock_inv_table.select.return_value.execute.return_value = mock_res_count
        mock_inv_table.insert.return_value.execute.return_value = mock_header_res

        # For detail retrieval in response
        mock_inv_table.select.return_value.eq.return_value.execute.return_value = mock_header_res

        mock_lines_table = MagicMock()
        mock_lines_table.insert.return_value.execute.return_value = MagicMock(data=[])
        mock_lines_table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "qty_expected_base": 10.0,
            "qty_counted_base": 15.0,
            "presentation_id": None,
            "qty_presentation": None,
            "notes": "Checked shelf A",
            "items": {"name": "Test Item"},
            "uom_presentations": None
        }])

        mock_stock_table = MagicMock()
        mock_stock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"qty_base": 10.0}])

        def get_mock_table(name):
            if name == "physical_inventories":
                return mock_inv_table
            elif name == "physical_inventory_lines":
                return mock_lines_table
            elif name == "stock":
                return mock_stock_table
            elif name == "uom_presentations":
                return mock_uom_pres_table
            return MagicMock()

        mock_supabase.table.side_effect = get_mock_table

        response = client.post("/inventory/physical-inventories", json=count_data)

    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["document_number"] == "INV-2026-0006"
    assert res_data["status"] == "draft"
    assert len(res_data["lines"]) == 1
    assert float(res_data["lines"][0]["qty_counted_base"]) == 15.0
```

- [ ] **Step 2: Run tests to verify they pass**
Run: `.\venv\Scripts\python -m pytest tests/test_physical_inventory.py`
Expected: 1 passed

- [ ] **Step 3: Commit Task 4**
```bash
git add backend/tests/test_physical_inventory.py
git commit -m "test: add physical inventory create draft unit test"
```

---

### Task 5: Frontend API Client

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Append physical count methods to adminApi**
Open `frontend/src/lib/api.ts` and add the following lines under `// M19: Recipes & Production` section:
```typescript
    // M39: Physical Inventory Count API Client
    getPhysicalInventories: (): Promise<any[]> => 
        fetchWithAuth('/inventory/physical-inventories'),

    getPhysicalInventoryDetail: (id: string): Promise<any> => 
        fetchWithAuth(`/inventory/physical-inventories/${id}`),

    createPhysicalInventory: (data: any): Promise<any> => 
        fetchWithAuth('/inventory/physical-inventories', { method: 'POST', body: JSON.stringify(data) }),

    updatePhysicalInventory: (id: string, data: any): Promise<any> => 
        fetchWithAuth(`/inventory/physical-inventories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    processPhysicalInventory: (id: string): Promise<any> => 
        fetchWithAuth(`/inventory/physical-inventories/${id}/process`, { method: 'POST' }),
```

- [ ] **Step 2: Commit Task 5**
```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): add physical count endpoints to adminApi client"
```

---

### Task 6: Mobile-Friendly Physical Inventory App

**Files:**
- Create: `frontend/src/app/inventory/count/page.tsx`

- [ ] **Step 1: Write mobile-friendly count screen**
Create `frontend/src/app/inventory/count/page.tsx` with code including scanner search and count lines:
```tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Send, Loader2, ArrowLeft, Barcode, Check } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { useRouter } from 'next/navigation'

export default function MobileInventoryCount() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [lines, setLines] = useState<any[]>([])
  
  // Search & input form state
  const [barcodeQuery, setBarcodeQuery] = useState('')
  const [qtyInput, setQtyInput] = useState('')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [presentations, setPresentations] = useState<any[]>([])
  const [selectedPresId, setSelectedPresId] = useState('')

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [whList, itemList] = await Promise.all([
        adminApi.getWarehouses?.() || fetch('/api/warehouses').then(r => r.json()),
        adminApi.getInventoryItems()
      ])
      setWarehouses(whList || [])
      setItems(itemList || [])
    } catch (err) {
      console.error('Error loading inventory count data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeQuery) return
    
    // Find item by code/barcode
    const item = items.find(it => it.code === barcodeQuery || it.name.toLowerCase().includes(barcodeQuery.toLowerCase()))
    if (item) {
      setSelectedItem(item)
      setBarcodeQuery('')
      // Load presentations
      adminApi.getItemPresentations(item.id).then(pres => {
        setPresentations(pres || [])
        setSelectedPresId('')
      })
    } else {
      alert('Artículo no encontrado')
    }
  }

  const addLine = () => {
    if (!selectedItem || !qtyInput) return
    const qty = parseFloat(qtyInput)
    if (isNaN(qty) || qty <= 0) return

    const selectedPres = presentations.find(p => p.id === selectedPresId)
    const factor = selectedPres ? parseFloat(selectedPres.conversion_factor) : 1.0
    const qty_counted_base = qty * factor

    // Add or update line
    const existingIdx = lines.findIndex(l => l.item_id === selectedItem.id)
    if (existingIdx > -1) {
      const updated = [...lines]
      updated[existingIdx].qty_counted_base += qty_counted_base
      updated[existingIdx].qty_presentation = (updated[existingIdx].qty_presentation || 0) + qty
      setLines(updated)
    } else {
      setLines([...lines, {
        item_id: selectedItem.id,
        item_name: selectedItem.name,
        qty_counted_base,
        presentation_id: selectedPresId || null,
        presentation_name: selectedPres ? selectedPres.name : selectedItem.uom_name || 'Unidades',
        qty_presentation: qty
      }])
    }

    setSelectedItem(null)
    setQtyInput('')
    setPresentations([])
    setSelectedPresId('')
  }

  const handleSave = async (submitToProcess = false) => {
    if (!selectedWarehouseId) {
      alert('Por favor selecciona un almacén')
      return
    }
    if (lines.length === 0) {
      alert('Agrega al menos un artículo para contar')
      return
    }

    setSaving(true)
    try {
      const data = {
        warehouse_id: selectedWarehouseId,
        notes: 'Conteo físico desde dispositivo móvil',
        lines: lines.map(l => ({
          item_id: l.item_id,
          qty_counted_base: l.qty_counted_base,
          presentation_id: l.presentation_id,
          qty_presentation: l.qty_presentation
        }))
      }
      
      const doc = await adminApi.createPhysicalInventory(data)
      if (submitToProcess) {
        await adminApi.processPhysicalInventory(doc.id)
        alert('Inventario procesado y Kardex actualizado exitosamente.')
      } else {
        alert('Borrador de conteo guardado exitosamente.')
      }
      router.push('/admin/inventory/physical')
    } catch (err) {
      console.error(err)
      alert('Error guardando el conteo de inventario')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary px-4 py-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 hover:bg-surface rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Conteo de Inventario</h1>
        </div>

        {/* Almacén Selector */}
        <div className="bg-surface p-4 rounded-xl border border-border mb-4">
          <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Almacén / Sede</label>
          <select 
            value={selectedWarehouseId}
            onChange={e => setSelectedWarehouseId(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl px-3 h-11 text-sm outline-none focus:border-primary text-text-primary"
          >
            <option value="">Selecciona Almacén...</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>

        {/* Input Barcode / Search */}
        {selectedWarehouseId && (
          <div className="bg-surface p-4 rounded-xl border border-border mb-4">
            <form onSubmit={handleBarcodeSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-3 w-5 h-5 text-text-secondary" />
                <input 
                  type="text"
                  placeholder="Escanea o escribe código..."
                  value={barcodeQuery}
                  onChange={e => setBarcodeQuery(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl pl-10 pr-3 h-11 text-sm outline-none focus:border-primary text-text-primary"
                />
              </div>
              <button type="submit" className="bg-primary hover:bg-primary-hover text-text-inverse px-4 rounded-xl h-11 text-sm font-semibold">
                Buscar
              </button>
            </form>

            {selectedItem && (
              <div className="mt-4 p-3 bg-bg rounded-lg border border-border">
                <p className="text-sm font-bold">{selectedItem.name}</p>
                <p className="text-xs text-text-secondary mb-3">Base: {selectedItem.uom_name || 'Unidades'}</p>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    placeholder="Cant."
                    value={qtyInput}
                    onChange={e => setQtyInput(e.target.value)}
                    className="w-20 bg-surface border border-border rounded-lg px-2 h-10 text-sm outline-none focus:border-primary text-text-primary"
                  />
                  <select
                    value={selectedPresId}
                    onChange={e => setSelectedPresId(e.target.value)}
                    className="flex-1 bg-surface border border-border rounded-lg px-2 h-10 text-sm outline-none focus:border-primary text-text-primary"
                  >
                    <option value="">{selectedItem.uom_name || 'Base'}</option>
                    {presentations.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button onClick={addLine} className="bg-success text-text-inverse px-3 rounded-lg h-10 hover:bg-success-light transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lines List */}
        <div className="space-y-2 mb-20">
          <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Artículos Contados ({lines.length})</h2>
          {lines.map((l, idx) => (
            <div key={l.item_id} className="bg-surface border border-border rounded-xl p-3 flex justify-between items-center shadow-sm">
              <div>
                <p className="text-sm font-semibold text-text-primary">{l.item_name}</p>
                <p className="text-xs text-text-secondary">
                  {l.qty_presentation} {l.presentation_name} ({l.qty_counted_base} base)
                </p>
              </div>
              <button 
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                className="p-2 text-error hover:bg-error/10 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      {selectedWarehouseId && lines.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface border-t border-border flex gap-2">
          <button 
            disabled={saving}
            onClick={() => handleSave(false)}
            className="flex-1 border border-border hover:bg-bg text-text-primary rounded-xl h-12 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> Guardar Borrador
          </button>
          <button 
            disabled={saving}
            onClick={() => handleSave(true)}
            className="flex-1 bg-success hover:bg-success-light text-text-inverse rounded-xl h-12 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Procesar / Ajustar
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit Task 6**
```bash
git add frontend/src/app/inventory/count/page.tsx
git commit -m "feat(frontend): create mobile physical inventory count utility"
```

---

### Task 7: Admin Panel Inventory Counts Dashboards

**Files:**
- Create: `frontend/src/app/admin/inventory/physical/page.tsx`
- Create: `frontend/src/app/admin/inventory/physical/[id]/page.tsx`

- [ ] **Step 1: Write admin count listing screen**
Create `frontend/src/app/admin/inventory/physical/page.tsx` displaying the drafts and history list:
```tsx
'use client'

import React, { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import Link from 'next/link'
import { Plus, Loader2, FileText, CheckCircle, Clock } from 'lucide-react'

export default function AdminPhysicalInventoryList() {
  const [counts, setCounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCounts()
  }, [])

  const loadCounts = async () => {
    try {
      const data = await adminApi.getPhysicalInventories()
      setCounts(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conteos Físicos de Inventario</h1>
          <p className="text-sm text-text-secondary">Historial y borradores de auditorías físicas de almacenes</p>
        </div>
        <Link 
          href="/inventory/count" 
          className="bg-primary hover:bg-primary-hover text-text-inverse rounded-xl h-11 px-4 font-semibold text-sm flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo Conteo Físico
        </Link>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                <th className="p-4">Documento</th>
                <th className="p-4">Almacén</th>
                <th className="p-4">Creado Por</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Fecha</th>
                <th className="p-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {counts.map(c => (
                <tr key={c.id} className="border-b border-border hover:bg-surface-raised transition-colors text-sm">
                  <td className="p-4 font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-text-secondary" />
                    {c.document_number}
                  </td>
                  <td className="p-4">{c.warehouse_name}</td>
                  <td className="p-4">{c.creator_name}</td>
                  <td className="p-4">
                    {c.status === 'processed' ? (
                      <span className="inline-flex items-center gap-1 bg-success-light text-success text-xs px-2.5 py-1 rounded-full font-medium border border-success/15">
                        <CheckCircle className="w-3.5 h-3.5" /> Procesado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full font-medium border border-primary/15">
                        <Clock className="w-3.5 h-3.5" /> Borrador
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-text-secondary">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <Link 
                      href={`/admin/inventory/physical/${c.id}`} 
                      className="text-primary hover:underline font-semibold"
                    >
                      Revisar Detalles
                    </Link>
                  </td>
                </tr>
              ))}
              {counts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-secondary">
                    No se han registrado conteos físicos de inventario.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write admin count detail audit screen**
Create `frontend/src/app/admin/inventory/physical/[id]/page.tsx` showing Expected vs Counted quantities and audit action button:
```tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminApi } from '@/lib/api'
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle, Play } from 'lucide-react'
import Link from 'next/link'

export default function AdminPhysicalInventoryDetail() {
  const params = useParams()
  const router = useRouter()
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadDetail()
  }, [params.id])

  const loadDetail = async () => {
    try {
      const data = await adminApi.getPhysicalInventoryDetail(params.id as string)
      setDetail(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleProcess = async () => {
    if (!confirm('¿Está seguro de procesar este conteo? Esto actualizará el stock disponible y registrará los movimientos de ajuste en el Kardex.')) {
      return
    }

    setProcessing(true)
    try {
      await adminApi.processPhysicalInventory(params.id as string)
      alert('Ajustes aplicados correctamente en la base de datos.')
      loadDetail()
    } catch (err) {
      console.error(err)
      alert('Error al procesar los ajustes de inventario.')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/inventory/physical" className="p-2 hover:bg-surface rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{detail.document_number}</h1>
            {detail.status === 'processed' ? (
              <span className="bg-success-light text-success text-xs px-2.5 py-1 rounded-full font-medium border border-success/15">
                Procesado
              </span>
            ) : (
              <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full font-medium border border-primary/15">
                Borrador
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary">Revisión y Ajuste de Inventario Físico</p>
        </div>
      </div>

      {/* Metadata Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-border">
          <span className="text-xs text-text-secondary uppercase font-bold tracking-wider">Almacén</span>
          <p className="text-base font-semibold mt-1">{detail.warehouse_name}</p>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <span className="text-xs text-text-secondary uppercase font-bold tracking-wider">Creado por</span>
          <p className="text-base font-semibold mt-1">{detail.creator_name} ({new Date(detail.created_at).toLocaleDateString()})</p>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <span className="text-xs text-text-secondary uppercase font-bold tracking-wider">Procesado por</span>
          <p className="text-base font-semibold mt-1">
            {detail.processor_name ? `${detail.processor_name} (${new Date(detail.processed_at).toLocaleDateString()})` : 'Pendiente de Auditoría'}
          </p>
        </div>
      </div>

      {/* Lines Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-bg">
          <h2 className="text-base font-bold">Artículos Contados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                <th className="p-4">Artículo</th>
                <th className="p-4">Esperado (Sist.)</th>
                <th className="p-4">Contado (Físico)</th>
                <th className="p-4">Diferencia</th>
                <th className="p-4">Notas</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((l: any) => {
                const diff = l.qty_counted_base - l.qty_expected_base
                return (
                  <tr key={l.id} className="border-b border-border hover:bg-surface-raised transition-colors text-sm">
                    <td className="p-4 font-semibold">{l.item_name}</td>
                    <td className="p-4">{l.qty_expected_base}</td>
                    <td className="p-4">
                      {l.qty_counted_base} {l.presentation_name && `(${l.qty_presentation} ${l.presentation_name})`}
                    </td>
                    <td className="p-4 font-bold">
                      {diff > 0 ? (
                        <span className="text-success">+{diff}</span>
                      ) : diff < 0 ? (
                        <span className="text-error">{diff}</span>
                      ) : (
                        <span className="text-text-secondary">0</span>
                      )}
                    </td>
                    <td className="p-4 text-text-secondary text-xs">{l.notes || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review & Apply Adjustments */}
      {detail.status === 'draft' && (
        <div className="bg-surface-raised p-6 rounded-2xl border border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-10 h-10 text-warning shrink-0" />
            <div>
              <p className="text-sm font-semibold">Procesar Ajustes de Kardex</p>
              <p className="text-xs text-text-secondary max-w-xl">
                Al presionar procesar, el sistema registrará los movimientos de ajuste positivo y negativo utilizando costo PEPS en el Kardex. Esta acción no se puede deshacer.
              </p>
            </div>
          </div>
          <button
            disabled={processing}
            onClick={handleProcess}
            className="w-full md:w-auto bg-success hover:bg-success-light text-text-inverse rounded-xl h-12 px-6 font-bold flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
          >
            {processing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Procesar y Ajustar Stock
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit Task 7**
```bash
git add frontend/src/app/admin/inventory/physical/page.tsx frontend/src/app/admin/inventory/physical/[id]/page.tsx
git commit -m "feat(frontend): implement admin physical count logs and detail review dashboards"
```
