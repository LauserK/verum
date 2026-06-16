# Catering & MRP Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the frontend interfaces for Catering Planning and MRP, allowing users to create event requirements, calculate production/purchase needs, and generate orders or PDF reports.

**Architecture:** 
- **API Client:** Extend `lib/api.ts` with catering and MRP endpoints.
- **Listing:** A clean, searchable list of catering events.
- **MRP Console:** A 3-column dashboard for analyzing requirements, production plans, and deficits.
- **Reporting:** Client-side PDF generation for purchase lists.

**Tech Stack:** React, Tailwind CSS, Lucide Icons, @react-pdf/renderer.

---

### Task 1: Update API Client

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add Catering & MRP Types**
Add the following interfaces to `frontend/src/lib/api.ts`:
```typescript
export interface CateringRequestLine {
    item_id: string
    qty_base: number
    presentation_id?: string | null
    qty_presentation?: number | null
    items?: { name: string, uom_base: { name: string } }
}

export interface CateringRequest {
    id: string
    name: string
    event_date: string | null
    status: 'planning' | 'confirmed' | 'cancelled'
    notes: string | null
    created_at: string
    lines?: CateringRequestLine[]
}

export interface MRPProductionPlan {
    item_id: string
    item_name: string
    uom_name: string
    qty_to_produce: number
    recipe_id: string
}

export interface MRPPurchaseList {
    item_id: string
    item_name: string
    uom_name: string
    qty_needed: number
    qty_available: number
    qty_deficit: number
}

export interface MRPResultResponse {
    production_plan: MRPProductionPlan[]
    purchase_list: MRPPurchaseList[]
}
```

- [ ] **Step 2: Add API Methods**
Add the following methods to the `adminApi` object:
```typescript
    // Catering & MRP
    getCateringRequests: (): Promise<CateringRequest[]> =>
        fetchWithAuth('/production/catering'),
    
    getCateringRequest: (id: string): Promise<CateringRequest> =>
        fetchWithAuth(`/production/catering/${id}`),
    
    createCateringRequest: (data: any): Promise<CateringRequest> =>
        fetchWithAuth('/production/catering', { method: 'POST', body: JSON.stringify(data) }),
    
    generateMRPPlan: (reqId: string, warehouseId: string): Promise<MRPResultResponse> =>
        fetchWithAuth(`/production/catering/${reqId}/plan`, { 
            method: 'POST', 
            body: JSON.stringify({ warehouse_id: warehouseId }) 
        }),
    
    generateMRPOrders: (reqId: string, data: { warehouse_id: string, target_warehouse_id: string, scheduled_date: string }): Promise<any> =>
        fetchWithAuth(`/production/catering/${reqId}/generate-orders`, { 
            method: 'POST', 
            body: JSON.stringify(data) 
        }),
```

---

### Task 2: Create Catering List Page

**Files:**
- Create: `frontend/src/app/admin/production/catering/page.tsx`

- [ ] **Step 1: Implement the listing page**
Build a page that lists catering requests with status badges, search functionality, and a "New Request" button. Use the established "Verum" aesthetic (dark mode, rounded corners, subtle gradients).

- [ ] **Step 2: Add Create Modal**
Add a modal or simple form to create a new catering request (name, date, notes). (Note: Adding items can be a separate step or included in the creation).

---

### Task 3: Create PDF Component

**Files:**
- Create: `frontend/src/components/production/MRPPurchaseListPDF.tsx`

- [ ] **Step 1: Implement PDF template**
Use `@react-pdf/renderer` to create a professional purchase list report.
Columns: Item, Needed, Available, To Buy (Deficit).

---

### Task 4: Create MRP Console Page

**Files:**
- Create: `frontend/src/app/admin/production/catering/[id]/page.tsx`

- [ ] **Step 1: Implement the 3-column layout**
1. **Requirements:** List of items requested in the catering event.
2. **Production Plan:** Results from `generateMRPPlan` (Production items). Button: "Generate Orders".
3. **Purchase List:** Results from `generateMRPPlan` (Raw materials). Button: "Export PDF".

- [ ] **Step 2: Add Warehouse Selection**
The MRP calculation needs a `warehouse_id`. Add a selector for the production warehouse.

- [ ] **Step 3: Implement "Generate Orders" Logic**
Open a modal to select target warehouse and scheduled date before calling `generateMRPOrders`.

---

### Task 5: Integration & Verification

- [ ] **Step 1: Link from Production Dashboard**
Ensure there's a way to navigate to `/admin/production/catering`.

- [ ] **Step 2: Verify End-to-End**
Create a request -> Run MRP -> Generate Orders -> Check if orders appear in `/admin/production/orders`.
