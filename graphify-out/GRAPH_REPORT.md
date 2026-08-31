# Graph Report - backend  (2026-08-31)

## Corpus Check
- 184 files · ~88,527 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1230 nodes · 3079 edges · 78 communities (66 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Purchasing & Supplier Management
- Purchasing & Supplier Management
- Purchasing & Supplier Management
- Table Orders & Floor Plan
- Attendance & Employee Shifts
- Table Orders & Floor Plan
- Production, Recipes & KDS
- Table Orders & Floor Plan
- Redis Caching & Invalidation
- Table Orders & Floor Plan
- Checklists & Audit Submissions
- Purchasing & Supplier Management
- Assets, Utensils & Maintenance
- Assets, Utensils & Maintenance
- Redis Caching & Invalidation
- Attendance & Employee Shifts
- Attendance & Employee Shifts
- Purchasing & Supplier Management
- Attendance & Employee Shifts
- POS Checkout, Payments & Invoices
- Table Orders & Floor Plan
- POS Checkout, Payments & Invoices
- Table Orders & Floor Plan
- RBAC Roles & Permissions
- Assets, Utensils & Maintenance
- Attendance & Employee Shifts
- Module create_app()
- Table Orders & Floor Plan
- Purchasing & Supplier Management
- RBAC Roles & Permissions
- Table Orders & Floor Plan
- Checklists & Audit Submissions
- Authentication & User Sessions
- Sales Catalog & Modifiers
- Sales Catalog & Modifiers
- Sales Catalog & Modifiers
- RBAC Roles & Permissions
- Attendance & Employee Shifts
- Authentication & User Sessions
- Purchasing & Supplier Management
- Sales Catalog & Modifiers
- Purchasing & Supplier Management
- Production, Recipes & KDS
- POS Checkout, Payments & Invoices
- Attendance & Employee Shifts
- Warehouse Transfers
- RBAC Roles & Permissions
- Redis Caching & Invalidation
- Authentication & User Sessions
- Table Orders & Floor Plan
- Sales Catalog & Modifiers
- Sales Catalog & Modifiers
- Purchasing & Supplier Management
- Purchasing & Supplier Management
- Authentication & User Sessions
- Attendance & Employee Shifts
- Superadmin & Multi-Tenancy
- Authentication & User Sessions
- Sales Catalog & Modifiers
- Inventory Catalog & Warehouses
- Purchasing & Supplier Management
- Authentication & User Sessions
- Backend Test Suite
- Superadmin & Multi-Tenancy
- Purchasing & Supplier Management
- Sales Catalog & Modifiers

## God Nodes (most connected - your core abstractions)
1. `get_db()` - 52 edges
2. `get_current_user()` - 47 edges
3. `invalidate_sales_config()` - 21 edges
4. `CacheManager` - 19 edges
5. `resolve_permission()` - 18 edges
6. `test_invalidation_helpers()` - 18 edges
7. `process_inventory_document()` - 15 edges
8. `get_db()` - 15 edges
9. `get_active_org_id()` - 14 edges
10. `create_inventory_document()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `test_get_active_shift_fixed_invalid_day()` --calls--> `get_active_shift_for_today()`  [INFERRED]
  tests/test_utils.py → app/attendance/utils.py
- `test_get_active_shift_fixed_valid_day()` --calls--> `get_active_shift_for_today()`  [INFERRED]
  tests/test_utils.py → app/attendance/utils.py
- `test_get_active_shift_flexible()` --calls--> `get_active_shift_for_today()`  [INFERRED]
  tests/test_utils.py → app/attendance/utils.py
- `test_cache_enabled_operations()` --uses--> `CacheManager`  [INFERRED]
  tests/test_caching.py → app/cache.py
- `test_cache_make_key()` --uses--> `CacheManager`  [INFERRED]
  tests/test_caching.py → app/cache.py

## Import Cycles
- None detected.

## Communities (78 total, 12 thin omitted)

### Community 0 - "Purchasing & Supplier Management"
Cohesion: 0.07
Nodes (85): invalidate_catalog_items(), invalidate_catalog_uom(), invalidate_catalog_warehouses(), Invalidate cached item catalog., Invalidate cached UOM presentations., Invalidate cached warehouse list., associate_warehouse(), bulk_adjust_stock() (+77 more)

### Community 1 - "Purchasing & Supplier Management"
Cohesion: 0.07
Nodes (82): approve_purchase_order(), calculate_po_totals(), calculate_supplier_metrics(), cancel_purchase_order(), create_price_list(), create_purchase_order(), create_supplier(), create_supplier_credit_note() (+74 more)

### Community 2 - "Purchasing & Supplier Management"
Cohesion: 0.09
Nodes (58): invalidate_kds(), invalidate_recipes(), Invalidate cached KDS kitchen orders., Invalidate cached recipe graph., _calculate_mrp_data(), calculate_production_needs(), cascade_from_production_cost(), complete_production_order() (+50 more)

### Community 3 - "Table Orders & Floor Plan"
Cohesion: 0.09
Nodes (54): create_customer(), create_sequence(), update_customer(), CheckoutChangeCreate, CheckoutItemCreate, CheckoutPaymentCreate, CheckoutResponse, CurrencyOut (+46 more)

### Community 4 - "Attendance & Employee Shifts"
Cohesion: 0.08
Nodes (45): add_manual_attendance(), create_absence(), create_employee_shift(), cron_check_absences(), edit_attendance_day(), export_attendance_csv(), get_attendance_alerts(), get_attendance_report() (+37 more)

### Community 5 - "Table Orders & Floor Plan"
Cohesion: 0.10
Nodes (38): invalidate_sales_catalog(), Invalidate cached sales catalog categories, items, and price lists., enqueue_event(), _json_serializer(), get_invoice_by_table_order(), create_category(), create_modifier_group(), create_sale_item() (+30 more)

### Community 6 - "Production, Recipes & KDS"
Cohesion: 0.07
Nodes (14): hash_token(), Create a short SHA-256 hash of a bearer token for use as cache key., get_current_user(), HTTPAuthorizationCredentials, mock_user(), fixture, mock_user(), fixture (+6 more)

### Community 7 - "Table Orders & Floor Plan"
Cohesion: 0.07
Nodes (34): invalidate_table_orders(), Invalidate active table orders cache for an organization., create_table(), delete_customer(), delete_floor_plan(), delete_table(), delete_table_order(), delete_tax() (+26 more)

### Community 8 - "Redis Caching & Invalidation"
Cohesion: 0.13
Nodes (31): Seeds default roles and permissions for a new organization., seed_org_roles(), get_db(), delete, get, patch, post, put (+23 more)

### Community 9 - "Table Orders & Floor Plan"
Cohesion: 0.06
Nodes (32): list_invoices(), get_active_pos_session(), get_customer(), get_invoice(), get_sale_item(), get_table_order(), list_categories(), list_currencies() (+24 more)

### Community 10 - "Checklists & Audit Submissions"
Cohesion: 0.14
Nodes (29): CreateQuestionRequest, CreateTemplateRequest, invalidate_checklist_templates(), Invalidate cached checklist templates for a venue., bulk_save_answers(), create_question(), create_submission(), create_template() (+21 more)

### Community 11 - "Purchasing & Supplier Management"
Cohesion: 0.11
Nodes (29): invalidate_admin_summary(), invalidate_attendance(), invalidate_auth_user(), invalidate_profile(), invalidate_rbac_catalog(), invalidate_supplier_metrics(), invalidate_user_rbac(), VERUM Cache Module ------------------ Optional Redis caching layer. When… (+21 more)

### Community 12 - "Assets, Utensils & Maintenance"
Cohesion: 0.11
Nodes (30): add_ticket_entry(), create_asset(), create_asset_category(), create_count_schedule(), create_utensil(), create_utensil_category(), create_utensil_count(), open_repair_ticket() (+22 more)

### Community 13 - "Assets, Utensils & Maintenance"
Cohesion: 0.12
Nodes (28): delete_inventory_document(), get_asset(), get_due_schedules(), get_inventory_dashboard_summary(), get_inventory_document_detail(), get_ticket_detail(), get_utensil_count_detail(), list_asset_categories() (+20 more)

### Community 14 - "Redis Caching & Invalidation"
Cohesion: 0.10
Nodes (15): CacheManager, Any, Store a value in cache with TTL (seconds). No-op if disabled., Delete a specific key. No-op if disabled., Delete all keys matching a pattern using SCAN (non-blocking). Never uses KEYS…, Get all hash fields for a key. Returns dict or empty dict if disabled/missing., Set a hash field. No-op if disabled., Delete a hash field. No-op if disabled. (+7 more)

### Community 15 - "Attendance & Employee Shifts"
Cohesion: 0.11
Nodes (26): change_user_password(), delete_shift(), delete_user(), delete_venue(), delete, patch, put, Delete auth user (cascades to profile). (+18 more)

### Community 16 - "Attendance & Employee Shifts"
Cohesion: 0.13
Nodes (18): calculate_overtime(), get_active_shift_for_today(), get_current_shift(), get_user_shift_identifier(), Retorna el shift_id (UUID) del usuario para una sede específica desde…, Returns the current shift based on local hour., get_active_org_id(), Resolves the active organization ID from the X-Org-ID header, or fallbacks to… (+10 more)

### Community 17 - "Purchasing & Supplier Management"
Cohesion: 0.18
Nodes (24): invalidate_inventory(), Invalidate inventory snapshot, valuation, and alert caches., cancel_inventory_document(), create_inventory_document(), get_next_document_number(), process_inventory_document(), receive_transfer_document(), InventoryDocumentCreate (+16 more)

### Community 18 - "Attendance & Employee Shifts"
Cohesion: 0.22
Nodes (21): assign_role_permissions(), create_organization(), create_override(), create_role(), create_shift(), create_user(), create_venue(), post (+13 more)

### Community 19 - "POS Checkout, Payments & Invoices"
Cohesion: 0.19
Nodes (21): callback(), disconnect(), get_quick_catalog_preview(), get_status(), import_quick_catalog(), get, patch, post (+13 more)

### Community 20 - "Table Orders & Floor Plan"
Cohesion: 0.13
Nodes (21): invalidate_sales_config(), Invalidate cached sales billing config and payment methods., create_payment_method(), create_tax(), delete_payment_method(), patch, update_config(), update_currency() (+13 more)

### Community 21 - "POS Checkout, Payments & Invoices"
Cohesion: 0.14
Nodes (18): process_checkout(), Atomic checkout: validate → create invoice → register payments → confirm →…, get_availability(), get_pos_config(), list_payment_methods(), process_checkout(), reserve_stock(), CheckoutCreate (+10 more)

### Community 22 - "Table Orders & Floor Plan"
Cohesion: 0.18
Nodes (17): confirm_invoice(), create_invoice(), get_invoice_detail(), void_invoice(), add_payment(), add_payment(), confirm_invoice(), create_floor_plan() (+9 more)

### Community 23 - "RBAC Roles & Permissions"
Cohesion: 0.17
Nodes (16): _get_db(), get_profile(), get, post, Dynamic get_db that picks up test mocks applied to main.get_db., Syncs the Supabase Auth user into public.profiles with default staff role., Returns the authenticated user's profile with their venues grouped by…, read_root() (+8 more)

### Community 24 - "Assets, Utensils & Maintenance"
Cohesion: 0.12
Nodes (17): close_ticket(), confirm_utensil_count(), patch, Closes a repair ticket. Creates a 'cierre' entry, sets ticket to 'resuelto',…, Supervisor confirms/adjusts a count., update_asset(), update_asset_category(), update_count_schedule() (+9 more)

### Community 25 - "Attendance & Employee Shifts"
Cohesion: 0.13
Nodes (15): get_admin_summary(), get_compliance_report(), get_effective_permissions(), list_organizations(), list_permissions(), list_role_permissions(), list_roles(), list_shifts() (+7 more)

### Community 26 - "Module create_app()"
Cohesion: 0.22
Nodes (9): create_app(), lifespan(), process_outbox_events(), start_outbox_worker_loop(), AsyncClient, BaseSettings, Config, Settings (+1 more)

### Community 27 - "Table Orders & Floor Plan"
Cohesion: 0.24
Nodes (13): CartItemSchema, MergeRequest, SeatSchema, SplitCheckoutCreate, TableOrderUpdate, TransferRequest, test_cart_item_schema_accepts_seats_and_sent_to_kitchen(), test_cart_item_schema_defaults_and_optional_fields() (+5 more)

### Community 28 - "Purchasing & Supplier Management"
Cohesion: 0.24
Nodes (13): mock_table_helper(), mock_user(), fixture, Helper para crear un mock de tabla de Supabase que soporta encadenamiento…, test_create_credit_note_applied_to_invoice(), test_create_credit_note_success(), test_create_return_item_not_in_receipt(), test_create_return_qty_exceeds_received() (+5 more)

### Community 29 - "RBAC Roles & Permissions"
Cohesion: 0.27
Nodes (11): get_user_permission_context(), Fetches user's permission context in minimal queries. Returns: {…, patch, An organization admin returns is_admin=True, is_superadmin=False., A staff user returns is_superadmin=False, is_admin=False., A superadmin returns is_superadmin=True, is_admin=True with minimal queries., If no org_id is provided, search profile_roles as fallback., test_no_org_falls_back_to_profile_roles() (+3 more)

### Community 30 - "Table Orders & Floor Plan"
Cohesion: 0.20
Nodes (11): mock_user(), fixture, Subsequent partial payment reuses existing invoice. When balance reaches 0,…, GET /sales/invoices/by-table-order/{table_order_id} returns partial invoice and…, GET /sales/invoices/by-table-order/{table_order_id} returns null if no active…, First partial payment creates an invoice in status='partial' and does NOT close…, _split_checkout_payload(), test_first_partial_checkout_creates_partial_invoice() (+3 more)

### Community 31 - "Checklists & Audit Submissions"
Cohesion: 0.20
Nodes (3): authorized_client(), mock_supabase_registry(), fixture

### Community 33 - "Sales Catalog & Modifiers"
Cohesion: 0.24
Nodes (10): invalidate_pos_config(), Invalidate all cached POS config for an organization., create_mode_config(), delete_mode_config(), update_mode_config(), SaleModeConfigCreate, SaleModeConfigUpdate, create_sale_mode_config() (+2 more)

### Community 34 - "Sales Catalog & Modifiers"
Cohesion: 0.24
Nodes (10): invalidate_workstations(), Invalidate cached workstations for an organization., create_workstation(), delete_workstation(), update_workstation(), WorkstationCreate, WorkstationUpdate, create_workstation() (+2 more)

### Community 35 - "Sales Catalog & Modifiers"
Cohesion: 0.31
Nodes (8): create_currency(), create_exchange_rate(), CurrencyCreate, create_currency(), create_exchange_rate(), asyncio, test_create_and_list_currencies(), test_register_and_get_exchange_rate()

### Community 36 - "RBAC Roles & Permissions"
Cohesion: 0.25
Nodes (7): check_restriction(), _get_permission_id(), Checks for a permission without admin bypass. Useful for toggleable…, override_super_admin(), asyncio, fixture, test_get_global_metrics()

### Community 37 - "Attendance & Employee Shifts"
Cohesion: 0.25
Nodes (3): authorized_client(), mock_supabase_registry(), fixture

### Community 38 - "Authentication & User Sessions"
Cohesion: 0.36
Nodes (8): make_mock_doc(), mock_user(), fixture, test_cancel_receipt_document(), test_create_inventory_document_draft(), test_process_issue_document(), test_process_receipt_document(), test_process_transfer_document_in_transit_and_receive()

### Community 40 - "Sales Catalog & Modifiers"
Cohesion: 0.22
Nodes (8): mock_user(), fixture, When workstation has customer_requirement set, it should take priority., When workstation has no override, falls back to sale_mode_config., CRUD: create a sale mode config entry., test_create_sale_mode_config(), test_resolve_pos_config_mode_fallback(), test_resolve_pos_config_workstation_override()

### Community 41 - "Purchasing & Supplier Management"
Cohesion: 0.32
Nodes (5): make_mock_doc(), mock_user(), fixture, test_create_receipt_linked_to_po(), test_process_receipt_updates_po_quantities()

### Community 43 - "Production, Recipes & KDS"
Cohesion: 0.25
Nodes (4): Verifies that if an error occurs during the complex completion process (e.g.,…, Test a scenario where: - Recipe yield is 1 Liter (but stored as 1000.0 base…, test_calculate_needs_scaling_liters_to_ml(), test_complete_order_rollback_on_failure()

### Community 44 - "POS Checkout, Payments & Invoices"
Cohesion: 0.32
Nodes (7): _checkout_payload(), mock_user(), fixture, Reject checkout when customer is required but not provided., Full checkout flow: create invoice + payment + confirm., test_checkout_customer_required_missing(), test_checkout_success()

### Community 45 - "Attendance & Employee Shifts"
Cohesion: 0.29
Nodes (3): authorized_client(), mock_supabase_registry(), fixture

### Community 46 - "Warehouse Transfers"
Cohesion: 0.48
Nodes (6): BaseModel, TransferConfirm, TransferCreate, TransferLineConfirm, TransferLineCreate, TransferResponse

### Community 47 - "RBAC Roles & Permissions"
Cohesion: 0.52
Nodes (6): get_super_admin(), Dependency that ensures the authenticated user is a Super Admin. Checks the…, asyncio, test_get_super_admin_passes_for_super_admin(), test_get_super_admin_raises_403_for_normal_user(), test_get_super_admin_raises_403_if_no_profile()

### Community 48 - "Redis Caching & Invalidation"
Cohesion: 0.48
Nodes (6): authenticated_user_mock(), client(), disable_redis_cache(), mock_db(), mock_supabase(), fixture

### Community 51 - "Sales Catalog & Modifiers"
Cohesion: 0.29
Nodes (6): mock_user(), fixture, Reserve stock when available., Reject reservation when stock insufficient and allow_negative_stock=false., test_reserve_stock_insufficient(), test_reserve_stock_success()

### Community 54 - "Purchasing & Supplier Management"
Cohesion: 0.38
Nodes (6): mock_table_helper(), mock_user(), fixture, Helper para crear un mock de tabla de Supabase que soporta encadenamiento…, test_calculate_metrics_success(), test_create_evaluation_success()

### Community 56 - "Attendance & Employee Shifts"
Cohesion: 0.47
Nodes (4): admin_token(), fixture, test_user_id(), test_venue_id()

### Community 57 - "Superadmin & Multi-Tenancy"
Cohesion: 0.40
Nodes (5): override_super_admin(), asyncio, fixture, test_list_all_organizations(), test_update_organization_status()

### Community 58 - "Authentication & User Sessions"
Cohesion: 0.40
Nodes (5): override_super_admin(), asyncio, fixture, test_list_all_users(), test_promote_to_super_admin()

### Community 59 - "Sales Catalog & Modifiers"
Cohesion: 0.50
Nodes (5): invalidate_pos_session(), Invalidate active POS session cache for an organization., open_pos_session(), PosSessionOpen, open_pos_session()

### Community 60 - "Inventory Catalog & Warehouses"
Cohesion: 0.60
Nodes (4): BaseModel, QuickCatalogImportRequest, QuickCatalogImportResponse, QuickCatalogPreviewResponse

### Community 64 - "Superadmin & Multi-Tenancy"
Cohesion: 0.67
Nodes (3): patch, test_get_profile_multi_tenant_admin_success(), test_get_profile_multi_tenant_success()

## Knowledge Gaps
- **1 isolated node(s):** `Config`
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get_current_user()` connect `Production, Recipes & KDS` to `Purchasing & Supplier Management`, `Purchasing & Supplier Management`, `Purchasing & Supplier Management`, `Table Orders & Floor Plan`, `Attendance & Employee Shifts`, `Redis Caching & Invalidation`, `Checklists & Audit Submissions`, `Assets, Utensils & Maintenance`, `Attendance & Employee Shifts`, `Purchasing & Supplier Management`, `Attendance & Employee Shifts`, `RBAC Roles & Permissions`, `Purchasing & Supplier Management`, `Table Orders & Floor Plan`, `Checklists & Audit Submissions`, `Authentication & User Sessions`, `RBAC Roles & Permissions`, `Attendance & Employee Shifts`, `Authentication & User Sessions`, `Purchasing & Supplier Management`, `Sales Catalog & Modifiers`, `Purchasing & Supplier Management`, `Production, Recipes & KDS`, `Production, Recipes & KDS`, `POS Checkout, Payments & Invoices`, `Attendance & Employee Shifts`, `Authentication & User Sessions`, `Table Orders & Floor Plan`, `Sales Catalog & Modifiers`, `Sales Catalog & Modifiers`, `Purchasing & Supplier Management`, `Purchasing & Supplier Management`, `Purchasing & Supplier Management`, `Authentication & User Sessions`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Why does `get_db()` connect `Attendance & Employee Shifts` to `Purchasing & Supplier Management`, `Purchasing & Supplier Management`, `Purchasing & Supplier Management`, `Table Orders & Floor Plan`, `Attendance & Employee Shifts`, `RBAC Roles & Permissions`, `Checklists & Audit Submissions`, `Assets, Utensils & Maintenance`, `Attendance & Employee Shifts`, `Purchasing & Supplier Management`, `Attendance & Employee Shifts`, `POS Checkout, Payments & Invoices`, `RBAC Roles & Permissions`, `Attendance & Employee Shifts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `CacheManager` connect `Redis Caching & Invalidation` to `Purchasing & Supplier Management`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `Config` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Purchasing & Supplier Management` be split into smaller, more focused modules?**
  _Cohesion score 0.06922675026123302 - nodes in this community are weakly interconnected._
- **Should `Purchasing & Supplier Management` be split into smaller, more focused modules?**
  _Cohesion score 0.07028112449799197 - nodes in this community are weakly interconnected._
- **Should `Purchasing & Supplier Management` be split into smaller, more focused modules?**
  _Cohesion score 0.08757062146892655 - nodes in this community are weakly interconnected._