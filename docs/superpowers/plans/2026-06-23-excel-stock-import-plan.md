# Plan de Implementación — Importador de Stock desde Excel (M23.5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a new tab in the Excel import utility page (`/admin/inventory/import-utility`) to bulk adjust inventory stock levels of existing items in a selected warehouse.

---

## Architecture & Database Design

No new tables are required. The process operates over the existing schema:
- `items`: Reads item definitions and `last_purchase_cost`.
- `stock`: Updates current total quantities per item and warehouse.
- `stock_lots`: Manages active inventory batches. Creates new lots for positive adjustments, and consumes existing lots chronologically (FIFO/PEPS) for negative adjustments.
- `stock_movements`: Logs adjustments as `adjustment_in` (inputs) or `adjustment_out` (exits).

---

## File Structure Map

*   **Backend Schemas**:
    *   Modify: `backend/schemas.py` (Appends Pydantic models for bulk stock adjustment requests and responses)
*   **Backend API Endpoints**:
    *   Modify: `backend/main.py` (Registers `POST /inventory/bulk-adjust-stock`)
*   **Backend Unit Tests**:
    *   Create: `backend/tests/test_bulk_stock_adjust.py` (Verifies bulk adjustment logic: positive, negative FIFO, missing codes, zero differences)
*   **Frontend API Client**:
    *   Modify: `frontend/src/lib/api.ts` (Adds `bulkAdjustStock` method to `adminApi`)
*   **Frontend UI Component**:
    *   Modify: `frontend/src/app/admin/inventory/import-utility/page.tsx` (Adds tabs layout, warehouse selector, stock file uploader, preview table, and execution progress handler)

---

## Implementation Tasks

### Task 1: Backend Schemas

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Write Pydantic Models**
  Add the following schemas to `backend/schemas.py`:
  ```python
  class StockAdjustItem(BaseModel):
      item_code: str
      qty_counted: float

  class BulkStockAdjustRequest(BaseModel):
      warehouse_id: UUID
      adjustments: List[StockAdjustItem]

  class StockAdjustResult(BaseModel):
      item_code: str
      status: str  # "success" or "error"
      error_message: Optional[str] = None
      qty_expected: Optional[float] = None
      qty_counted: Optional[float] = None
      difference: Optional[float] = None

  class BulkStockAdjustResponse(BaseModel):
      results: List[StockAdjustResult]
  ```

---

### Task 2: Backend Routes

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Implement `POST /inventory/bulk-adjust-stock`**
  Write the endpoint logic in `backend/main.py`:
  - Fetch item definitions by `code` in the active organization.
  - For each adjustment:
    - Get `qty_expected` from the `stock` table (default to `0.0` if not present).
    - Compute `difference = qty_counted - qty_expected`.
    - If `difference > 0` (Positive Adjustment):
      - Retrieve the item's `last_purchase_cost` (default to `0.0` if null).
      - Insert a new lot in `stock_lots` (qty_base = difference, lot_number = "AJUSTE-IMPORTACION").
      - Log a movement in `stock_movements` (type = "adjustment_in").
      - Update or insert in `stock`.
    - If `difference < 0` (Negative Adjustment):
      - Query non-exhausted lots for the item in that warehouse, ordered by `received_at` asc.
      - Decrement their quantities in FIFO order, setting `is_exhausted = true` when they reach 0.
      - Log movements in `stock_movements` (type = "adjustment_out") for each lot with its actual cost.
      - Update overall `stock` table.
  - Return a summary list of results.

---

### Task 3: Backend Unit Tests

**Files:**
- Create: `backend/tests/test_bulk_stock_adjust.py`

- [ ] **Step 1: Write tests for bulk adjustment logic**
  - Verify positive adjustment creates a lot with correct cost and logs `adjustment_in`.
  - Verify negative adjustment consumes active lots chronologically (FIFO) and logs `adjustment_out`.
  - Verify items with invalid codes return appropriate error statuses in the response list.
  - Verify items with zero difference are skipped without writing movements.

---

### Task 4: Frontend API client

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Declare API helper calls**
  Register `bulkAdjustStock(warehouseId: string, adjustments: { item_code: string; qty_counted: number }[])` inside `adminApi` targeting `POST /inventory/bulk-adjust-stock`.

---

### Task 5: Frontend UI (Pestañas Separadas)

**Files:**
- Modify: `frontend/src/app/admin/inventory/import-utility/page.tsx`

- [ ] **Step 1: Add UI state for tabs**
  Introduce a tab selector state (`activeTab: 'catalog' | 'stock'`). By default, it displays the original catalog import utility.
- [ ] **Step 2: Add Warehouse Selector & Stock File Uploader**
  In the new "Importar Stock" tab:
  - Add a dropdown to select the target Warehouse (required).
  - Add a file selector for uploading the stock Excel file.
- [ ] **Step 3: Implement Excel Parser for Stock Tab**
  - Mapear la **Columna A** como Código (`code`) y la **Columna B** como Cantidad (`qty`).
  - Si la celda de cantidad está en blanco, se asume `0.0` (como se acordó).
- [ ] **Step 4: Implement Preview Table**
  - Show Estado, Código, Artículo (local catalog lookup by code), Cantidad a Registrar, and Status Details.
  - If a code doesn't exist in local items, show an alert in red: `"Artículo no registrado"`.
- [ ] **Step 5: Implement execution progress and calls**
  - Button "Ejecutar Carga de Stock". Send the parsed adjustments to the backend in chunks or a single call.
  - Display loader/progress during execution and mark rows with checkmarks/errors upon completion.
