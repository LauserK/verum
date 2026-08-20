# Verum POS & Sales Admin Frontend Specification
**Date:** 2026-08-20
**Module:** Sales & Point of Sale (POS)
**Status:** Approved for Implementation

## 1. Overview
The Verum Sales module frontend is split into two distinct user experiences to optimize operational speed for cashiers while maintaining robust management controls for administrators:
1. **Dedicated POS App (`/pos`)**: A fullscreen, distraction-free environment optimized for touch (tablets/terminals), high-speed input, and blind cashier control.
2. **Sales Admin Module (`/admin/sales`)**: Embedded within the main ERP desktop dashboard, providing advanced invoice creation, reporting, and catalog configuration.

## 2. Global Architecture & Setup
- **Framework:** Next.js App Router (assuming Verum standard) / React
- **Styling:** Tailwind CSS with the Verum Dark Theme Design System (optimized for POS environments to reduce eye strain).
- **State Management:** Zustand or React Context for the POS Cart & Session. React Query for API data fetching and caching.
- **Backend Communication:** Strict usage of REST APIs (`/api/v1/sales/*`). No direct Supabase client calls from the frontend for data mutation, ensuring all business logic (TDD backend) is respected.

## 3. Dedicated POS Application (`/pos`)
### 3.1 Cashier Session Control
- **Route:** `/pos/session`
- **Behavior:** The `/pos` route must check for an active `POSSession`. If no session is open, the cashier is blocked and forced to enter the **Opening Balance** (Fondo de Caja).
- **End of Shift:** The cashier must perform a **Blind Cash Count** (Arqueo Ciego), where they input the physical cash counted without knowing the system's expected total.

### 3.2 Dine-in Table Map (Floor Plan)
- **Route:** `/pos/map`
- **Behavior:** The default landing view when "Dine-in" (Mesa) order type is active.
- **UI:** A graphical canvas showing tables.
- **Statuses:** Green (Libre/Available), Red (Ocupada/Occupied with current total), Yellow (Cuenta Pedida/Bill Requested).
- **Actions:** Clicking a free table starts a new order and navigates to the terminal. Clicking an occupied table opens the active ticket.
- **Tabs:** Header tabs allow quick switching to "Para Llevar" (Takeaway) or "Delivery" to skip the map and go directly to the terminal.

### 3.3 Hybrid Sale Terminal
- **Route:** `/pos/terminal`
- **Layout:** Split pane design (65% Catalog / 35% Ticket).
- **Left Pane (Catalog):** 
    - Search bar (supports barcode scanner input buffer).
    - Horizontal scrollable category pills.
    - Grid of product cards with large tap targets (minimum 44x44px).
- **Right Pane (Ticket/Minuta):**
    - Header showing Order Type (Mesa X, Llevar) and Customer selection.
    - List of line items with quantity steppers (+ / -) and active modifiers.
    - Fixed bottom footer with massive "PAGAR" button displaying the total.

### 3.4 Smart Modifiers Flow
- **Behavior:** 
    - When a product is tapped, if it has **Required Modifiers** (e.g., Meat temperature), a modal immediately blocks the UI to force selection.
    - If modifiers are purely **Optional** (e.g., extra sauces), the product is added instantly to the ticket to save time, and the cashier can tap the line item in the ticket to open an inline or side panel to add extras.

### 3.5 Checkout & Multi-Currency Payments
- **UI:** A modal or slide-over from the ticket when "PAGAR" is pressed.
- **Features:** 
    - Supports split payments.
    - Automatically displays surcharges based on the selected payment method (e.g., +5% for international cards, configured via backend).
    - Input keypad optimized for touch (Numpad) to enter tendered cash and calculate change.

## 4. Sales Admin Module (`/admin/sales`)
### 4.1 Invoice History & Management
- **Route:** `/admin/sales/invoices`
- **UI:** Data table with filters (Status, Date, Customer). Actions to view details, print PDF, or Void (Anular) an invoice.

### 4.2 Unified Manual Invoice Editor
- **Route:** `/admin/sales/invoices/new`
- **UI:** A "Document Template" layout (similar to modern accounting software like Xero or QuickBooks).
- **Behavior:** Designed for B2B or back-office sales. Includes a large form to select the customer, add line items row by row, apply global discounts, and set payment terms.

### 4.3 Customers & Config
- **Routes:** `/admin/sales/customers`, `/admin/sales/config`
- **UI:** Standard CRUD tables to manage client data, credit limits, POS workstations, sequence numbering, and payment methods.

## 5. Next Steps for Implementation
1. Scaffold the Next.js routes for both `/pos` and `/admin/sales`.
2. Implement POS Layout Shell (Navigation, Dark Theme config).
3. Build the Session Control guard (`/pos/session`).
4. Develop the POS Terminal Catalog & Cart state management.
5. Connect UI to Backend APIs.
