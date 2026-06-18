# Milestone 23 — Kardex Histórico, Snapshots y Valorización

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the administrator to track historical inventory levels (snapshot at any date), inspect the current FIFO inventory valuation based on active lots, and view a complete Kardex page with filters, accumulated balances, and CSV export.

---

## Architecture & Database Design

No new tables are required. The milestone operates over the existing schema:
- `stock_movements`: Tracks all chronological inputs/exits with `qty_base`, `unit_cost_base`, and `total_cost`.
- `stock_lots`: Tracks currently active (non-exhausted) lots with remaining quantities and their actual PEPS/FIFO costs.

### Formats & Calculations:
1. **Historical Snapshot (`GET /inventory/snapshot?date=YYYY-MM-DD`)**:
   - Computes the stock quantity and valuation as of the requested date.
   - For a given `date` string (e.g. `2026-05-31`), it queries all movements where `created_at <= 2026-05-31T23:59:59.999999-04:00` (end of day in Caracas timezone).
   - In Python, we group by `(item_id, warehouse_id)`.
   - `qty_on_hand = sum(qty_base)`
   - `valuation = sum(total_cost)` (which naturally defaults to the PEPS valuation of the remaining items, as exits subtract the precise cost of the lot they consumed).
2. **Current PEPS Valuation (`GET /inventory/valuation`)**:
   - Queries `stock_lots` where `is_exhausted = false` (active lots) for warehouses within the active organization.
   - For each lot, `valuation = qty_base * unit_cost_base`.
   - We group lots by `(item_id, warehouse_id)` and sum up quantities and valuations, while also returning the detailed breakdown of lots making up the remaining stock (production/expiry dates, lot numbers, received timestamps).
3. **Kardex Accumulated Balance**:
   - Running total of stock levels.
   - When viewing the Kardex list, we compute the cumulative sum of `qty_base` starting from the oldest movement to the newest.

---

## File Structure Map

*   **Backend Schemas**:
    *   Modify: `backend/schemas.py` (Appends Pydantic models for snapshots, valuations, and lot details)
*   **Backend API Endpoints**:
    *   Modify: `backend/main.py` (Registers `GET /inventory/snapshot` and `GET /inventory/valuation`)
*   **Backend Unit Tests**:
    *   Create: `backend/tests/test_m23_valuation.py` (Verifies calculations, timezone limits, and PEPS grouping)
*   **Frontend API Client**:
    *   Modify: `frontend/src/lib/api.ts` (Adds snapshot and valuation methods to `adminApi`)
*   **Frontend Components & Pages**:
    *   Create: `frontend/src/app/admin/inventory/snapshot/page.tsx` (Date-picker, warehouse selector, table view and export of snapshot)
    *   Modify: `frontend/src/app/admin/inventory/kardex/page.tsx` (Adds accumulated balance column, CSV exporter, date range and movement type filters)

---

## Implementation Tasks

### Task 1: Backend Schemas

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Write Pydantic Models**
  Add the following schemas to `backend/schemas.py`:
  ```python
  class StockSnapshotItem(BaseModel):
      item_id: UUID
      item_name: str
      item_code: Optional[str] = None
      uom_name: Optional[str] = None
      warehouse_id: UUID
      warehouse_name: str
      qty_on_hand: float
      valuation: float

  class StockSnapshotResponse(BaseModel):
      date: str
      items: List[StockSnapshotItem]
      total_valuation: float

  class StockValuationLotDetail(BaseModel):
      lot_id: UUID
      lot_number: Optional[str] = None
      qty_base: float
      unit_cost_base: float
      valuation: float
      production_date: Optional[str] = None
      expiry_date: Optional[str] = None
      received_at: str

  class StockValuationItem(BaseModel):
      item_id: UUID
      item_name: str
      item_code: Optional[str] = None
      uom_name: Optional[str] = None
      warehouse_id: UUID
      warehouse_name: str
      qty_on_hand: float
      valuation: float
      lots_detail: List[StockValuationLotDetail]

  class StockValuationResponse(BaseModel):
      items: List[StockValuationItem]
      total_valuation: float
  ```

---

### Task 2: Backend Routes

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Create snapshot endpoint**
  Implement `GET /inventory/snapshot?date=YYYY-MM-DD` grouping movements by item and warehouse. Use EOD Caracas Timezone (`23:59:59.999999-04:00`) as the upper bound for the snapshot.
- [ ] **Step 2: Create valuation endpoint**
  Implement `GET /inventory/valuation` grouping active `stock_lots` (where `is_exhausted = false`) by item and warehouse, including the detailed lots array.

---

### Task 3: Backend Unit Tests

**Files:**
- Create: `backend/tests/test_m23_valuation.py`

- [ ] **Step 1: Write tests for snapshot logic**
  - Seed mock inputs/outputs with different timestamps.
  - Call `/inventory/snapshot?date=2026-05-31` and verify the balance only includes movements before that date.
- [ ] **Step 2: Write tests for valuation logic**
  - Seed mock lots with different costs and quantities.
  - Call `/inventory/valuation` and assert total valuation matches active lot `qty * cost` sums.

---

### Task 4: Frontend API client

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Declare API helper calls**
  Register `getInventorySnapshot(date: string, warehouseId?: string)` and `getInventoryValuation(warehouseId?: string)` inside `adminApi`.

---

### Task 5: Frontend Snapshot Screen

**Files:**
- Create: `frontend/src/app/admin/inventory/snapshot/page.tsx`

- [ ] **Step 1: Design clean UI**
  - Date Picker (HTML date input or custom datepicker matching layout).
  - Warehouse selector.
  - Table: Código, Artículo, Almacén, Stock Físico, U.M., Valorización ($).
  - Top summary cards: "Items Totales", "Stock Consolidado", "Valor del Inventario ($)".
  - Export CSV / Print button.

---

### Task 6: Frontend Kardex Enhancements

**Files:**
- Modify: `frontend/src/app/admin/inventory/kardex/page.tsx`

- [ ] **Step 1: Compute and display running accumulated balance**
  - When movements load, compute running total sequentially from the oldest movement (last index) to the newest (index 0).
  - Show "Saldo Acumulado" as a dedicated column in the table.
- [ ] **Step 2: Add CSV exporter**
  - Button to convert the filtered table items to a CSV file and download it.
- [ ] **Step 3: Add date range and type filters**
  - Implement date range picker (`fecha inicio`, `fecha fin`).
  - Implement movement type filter (dropdown multi-select or single select for `purchase`, `production_in`, `sale`, etc.).
