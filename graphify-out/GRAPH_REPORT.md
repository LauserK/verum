# Graph Report - Verum  (2026-08-22)

## Corpus Check
- 454 files · ~348,029 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1931 nodes · 4454 edges · 144 communities (109 shown, 35 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Purchasing Module (0)
- Purchase Orders & Procurement (1)
- Inventory & Warehouse Operations (2)
- Hooks Module (3)
- Admin, Roles & Security (4)
- Purchase Orders & Procurement (5)
- Attendance & Shifts Management (6)
- Operational Checklists (7)
- Production Module (8)
- Frontend API Client (9)
- Frontend API Client (10)
- Admin, Roles & Security (11)
- Production Module (12)
- Caching & Cache Invalidation (13)
- Operational Checklists (14)
- Purchase Orders & Procurement (15)
- Inventory & Warehouse Operations (16)
- Catering Module (17)
- Catering Module (18)
- Inventory & Warehouse Operations (19)
- Inventory & Warehouse Operations (20)
- Operational Checklists (21)
- Sales Module (22)
- Frontend Module (23)
- Sales Module (24)
- Operational Checklists (25)
- Admin, Roles & Security (26)
- Transfers Module (27)
- Sales Module (28)
- Caching & Cache Invalidation (29)
- Frontend Module (30)
- Frontend Module (31)
- Purchase Orders & Procurement (32)
- Sales Module (33)
- Integrations Module (34)
- Tests Module (35)
- Inventory & Warehouse Operations (36)
- Suppliers & Invoicing (37)
- Tests Module (38)
- Admin, Roles & Security (39)
- Integrations Module (40)
- Suppliers & Invoicing (41)
- Admin, Roles & Security (42)
- Scripts Module (43)
- Scripts Module (44)
- Purchase Orders & Procurement (45)
- Inventory & Warehouse Operations (46)
- Admin, Roles & Security (47)
- Operational Checklists (48)
- Purchase Orders & Procurement (49)
- Sales Module (50)
- Tests Module (51)
- Purchase Orders & Procurement (52)
- Sales Module (53)
- Admin, Roles & Security (54)
- Inventory & Warehouse Operations (55)
- Purchase Orders & Procurement (56)
- Frontend Module (57)
- Admin, Roles & Security (58)
- Tests Module (59)
- Tests Module (61)
- Attendance & Shifts Management (62)
- Inventory & Warehouse Operations (63)
- Purchase Orders & Procurement (64)
- Transfers Module (65)
- Tests Module (66)
- Inventory & Warehouse Operations (67)
- Suppliers & Invoicing (68)
- Suppliers & Invoicing (69)
- Purchase Orders & Procurement (70)
- Inventory & Warehouse Operations (71)
- Kds Module (72)
- Tests Module (73)
- Attendance & Shifts Management (74)
- Admin, Roles & Security (75)
- Admin, Roles & Security (76)
- Inventory & Warehouse Operations (77)
- Inventory & Warehouse Operations (78)
- Inventory & Warehouse Operations (79)
- Inventory & Warehouse Operations (80)
- Inventory & Warehouse Operations (81)
- Inventory & Warehouse Operations (82)
- Admin, Roles & Security (83)
- Purchase Orders & Procurement (84)
- App Module (85)
- Tests Module (86)
- Tests Module (87)
- Inventory & Warehouse Operations (88)
- Inventory & Warehouse Operations (89)
- Purchase Orders & Procurement (90)
- Src Module (91)
- Purchase Orders & Procurement (92)
- Tests Module (93)
- Attendance & Shifts Management (94)
- Admin, Roles & Security (95)
- Admin, Roles & Security (96)
- Purchase Orders & Procurement (97)
- Purchase Orders & Procurement (98)
- Admin, Roles & Security (99)
- Attendance & Shifts Management (100)
- Admin, Roles & Security (101)
- Purchasing Module (102)
- Sales Module (103)
- Frontend Module (104)
- Frontend Module (105)
- Frontend Module (106)
- Frontend Module (107)
- Frontend Module (108)
- Frontend Module (109)
- Frontend Module (110)
- Frontend Module (111)
- Frontend Module (112)
- Frontend Module (113)
- Frontend Module (114)
- Frontend Module (115)
- Frontend Module (116)
- Frontend Module (117)
- Frontend Module (118)
- Frontend Module (119)
- Frontend Module (120)
- Purchase Orders & Procurement (121)
- Run_Tests.Sh Module (127)

## God Nodes (most connected - your core abstractions)
1. `useTranslations()` - 116 edges
2. `useVenue()` - 65 edges
3. `adminApi` - 64 edges
4. `get_db()` - 52 edges
5. `get_current_user()` - 40 edges
6. `getProfile()` - 30 edges
7. `fetchWithAuth()` - 25 edges
8. `Profile` - 20 edges
9. `InventoryItem` - 20 edges
10. `useProfile()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `update_venue()` --uses--> `UpdateVenueRequest`  [INFERRED]
  backend/app/admin/router.py → backend/app/admin/schemas.py
- `update_user()` --uses--> `UpdateUserRequest`  [INFERRED]
  backend/app/admin/router.py → backend/app/admin/schemas.py
- `update_shift()` --uses--> `UpdateShiftRequest`  [INFERRED]
  backend/app/admin/router.py → backend/app/admin/schemas.py
- `super_create_organization()` --uses--> `CreateOrgRequest`  [INFERRED]
  backend/app/superadmin/router.py → backend/app/admin/schemas.py
- `super_create_org_venue()` --uses--> `CreateVenueRequest`  [INFERRED]
  backend/app/superadmin/router.py → backend/app/admin/schemas.py

## Import Cycles
- None detected.

## Communities (144 total, 35 thin omitted)

### Community 0 - "Purchasing Module (0)"
Cohesion: 0.05
Nodes (95): approve_purchase_order(), calculate_po_totals(), calculate_supplier_metrics(), cancel_purchase_order(), create_price_list(), create_purchase_order(), create_supplier(), create_supplier_credit_note() (+87 more)

### Community 1 - "Purchase Orders & Procurement (1)"
Cohesion: 0.05
Nodes (43): AttendanceReportRow, AttendanceReportsPage(), AssetsPage(), Category, Venue, ConfirmTransferPage(), PendingTransfersPage(), UtensilCategoriesPage() (+35 more)

### Community 2 - "Inventory & Warehouse Operations (2)"
Cohesion: 0.07
Nodes (36): DocumentLine, ParsedPriceRow, ParsedRow, ParsedStockRow, GroupByOption, InventorySnapshotPage(), SortField, NewPurchaseOrderPage() (+28 more)

### Community 3 - "Hooks Module (3)"
Cohesion: 0.07
Nodes (48): CategoryModal(), CategoryModalProps, PRESET_ICONS, ModifierGroupModal(), ModifierGroupModalProps, SaleItemModal(), SaleItemModalProps, SearchableItemSelectProps (+40 more)

### Community 4 - "Admin, Roles & Security (4)"
Cohesion: 0.05
Nodes (25): InvoiceLineState, PurchaseOrdersPage(), SuperAdminDashboard(), GlobalUsersManagement(), Props, SortableQuestionItem(), SortableQuestionItemProps, Props (+17 more)

### Community 5 - "Purchase Orders & Procurement (5)"
Cohesion: 0.08
Nodes (36): LeaveRequest, AdminAttendancePage(), ShiftsManagementPage(), ChecklistDashboard(), DatePicker, GeneralAdminDashboard(), InventoryDashboardPage(), NavItem (+28 more)

### Community 6 - "Attendance & Shifts Management (6)"
Cohesion: 0.07
Nodes (51): add_manual_attendance(), create_absence(), create_employee_shift(), cron_check_absences(), edit_attendance_day(), export_attendance_csv(), get_attendance_alerts(), get_attendance_report() (+43 more)

### Community 7 - "Operational Checklists (7)"
Cohesion: 0.07
Nodes (34): CategoriesPage(), Category, AdminTicketsPage(), Ticket, Venue, AdminLayout(), checkAccess(), DashboardPage() (+26 more)

### Community 8 - "Production Module (8)"
Cohesion: 0.11
Nodes (44): invalidate_catalog_warehouses(), Invalidate cached warehouse list., associate_warehouse(), create_item(), create_item_category(), create_physical_inventory(), create_warehouse(), delete_item() (+36 more)

### Community 9 - "Frontend API Client (9)"
Cohesion: 0.07
Nodes (30): RecipesPage(), DispatchItem, MRPDispatchListPrint, Props, MRPPurchaseListPrint, Props, Props, RecipeBundlePrint (+22 more)

### Community 10 - "Frontend API Client (10)"
Cohesion: 0.05
Nodes (36): ReceiveLineState, Props, PurchaseOrderPrintTemplate, POApprovalAction, POApprovalConfigResponse, POApprovalConfigUpdate, POApprovalLimitCreate, POApprovalLimitResponse (+28 more)

### Community 11 - "Admin, Roles & Security (11)"
Cohesion: 0.11
Nodes (38): assign_role_permissions(), create_organization(), create_override(), create_role(), create_shift(), create_user(), create_venue(), get_admin_summary() (+30 more)

### Community 12 - "Production Module (12)"
Cohesion: 0.15
Nodes (35): bulk_adjust_stock(), create_uom_presentation(), BulkStockAdjustRequest, BulkStockAdjustResponse, IssueDocumentCreate, IssueDocumentLineCreate, IssueDocumentResponse, ItemCreate (+27 more)

### Community 13 - "Caching & Cache Invalidation (13)"
Cohesion: 0.10
Nodes (33): invalidate_admin_summary(), invalidate_auth_user(), invalidate_catalog_items(), invalidate_catalog_uom(), invalidate_inventory(), invalidate_rbac_catalog(), invalidate_recipes(), invalidate_supplier_metrics() (+25 more)

### Community 14 - "Operational Checklists (14)"
Cohesion: 0.09
Nodes (25): LeaveRequest, ChecklistPage(), init(), LibraryModal(), IntegrationStatus, VerumQuickCard(), useAutoSave(), attendanceApi (+17 more)

### Community 15 - "Purchase Orders & Procurement (15)"
Cohesion: 0.10
Nodes (22): CheckQuestion(), Props, iconMap, MultiOptionQuestion(), Props, NumberQuestion(), Props, Props (+14 more)

### Community 16 - "Inventory & Warehouse Operations (16)"
Cohesion: 0.08
Nodes (12): hash_token(), Create a short SHA-256 hash of a bearer token for use as cache key., get_current_user(), mock_user(), fixture, mock_user(), fixture, mock_user() (+4 more)

### Community 17 - "Catering Module (17)"
Cohesion: 0.16
Nodes (31): create_catering_request(), mark_lot_printed(), patch, put, update_catering_request(), update_catering_request_status(), update_production_order_status(), CalculateProductionNeedsRequest (+23 more)

### Community 18 - "Catering Module (18)"
Cohesion: 0.09
Nodes (31): invalidate_kds(), Invalidate cached KDS kitchen orders., _calculate_mrp_data(), calculate_production_needs(), cascade_from_production_cost(), complete_production_order(), create_production_order(), create_recipe() (+23 more)

### Community 19 - "Inventory & Warehouse Operations (19)"
Cohesion: 0.11
Nodes (30): add_ticket_entry(), create_asset(), create_asset_category(), create_count_schedule(), create_utensil(), create_utensil_category(), create_utensil_count(), open_repair_ticket() (+22 more)

### Community 20 - "Inventory & Warehouse Operations (20)"
Cohesion: 0.11
Nodes (29): cancel_inventory_document(), delete_inventory_document(), get_asset(), get_due_schedules(), get_inventory_dashboard_summary(), get_inventory_document_detail(), get_ticket_detail(), get_utensil_count_detail() (+21 more)

### Community 21 - "Operational Checklists (21)"
Cohesion: 0.14
Nodes (27): invalidate_checklist_templates(), Invalidate cached checklist templates for a venue., bulk_save_answers(), create_question(), create_submission(), create_template(), delete_question(), delete_template() (+19 more)

### Community 22 - "Sales Module (22)"
Cohesion: 0.13
Nodes (28): CurrencyOut, CurrencyUpdate, CustomerOut, DocumentSequenceOut, ExchangeRateOut, InvoiceItemCreate, InvoiceItemOut, InvoiceOut (+20 more)

### Community 23 - "Frontend Module (23)"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 24 - "Sales Module (24)"
Cohesion: 0.11
Nodes (27): get_config(), get_customer(), get_invoice(), list_categories(), list_currencies(), list_customers(), list_exchange_rates(), list_modifier_groups() (+19 more)

### Community 25 - "Operational Checklists (25)"
Cohesion: 0.11
Nodes (26): change_user_password(), delete_shift(), delete_user(), delete_venue(), delete, patch, put, Delete auth user (cascades to profile). (+18 more)

### Community 26 - "Admin, Roles & Security (26)"
Cohesion: 0.17
Nodes (24): Seeds default roles and permissions for a new organization., seed_org_roles(), get_db(), delete, get, patch, post, put (+16 more)

### Community 27 - "Transfers Module (27)"
Cohesion: 0.21
Nodes (21): create_inventory_document(), get_next_document_number(), process_inventory_document(), receive_transfer_document(), InventoryDocumentCreate, InventoryDocumentLineSchema, TransferReceiveLineSchema, TransferReceiveRequest (+13 more)

### Community 28 - "Sales Module (28)"
Cohesion: 0.17
Nodes (22): create_customer(), create_sale_item(), create_sequence(), get_sale_item(), list_sale_items(), update_sale_item(), CustomerCreate, DocumentSequenceCreate (+14 more)

### Community 29 - "Caching & Cache Invalidation (29)"
Cohesion: 0.13
Nodes (11): CacheManager, Any, Store a value in cache with TTL (seconds). No-op if disabled., Delete a specific key. No-op if disabled., Delete all keys matching a pattern using SCAN (non-blocking). Never uses KEYS…, Return cache health status and metrics., Clear all keys in the database. Returns True if successful, False otherwise., Async Redis cache with transparent no-op fallback. When Redis is not configured… (+3 more)

### Community 30 - "Frontend Module (30)"
Cohesion: 0.11
Nodes (19): browser-image-compression, class-variance-authority, clsx, @dnd-kit/sortable, dependencies, browser-image-compression, class-variance-authority, clsx (+11 more)

### Community 31 - "Frontend Module (31)"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+11 more)

### Community 32 - "Purchase Orders & Procurement (32)"
Cohesion: 0.13
Nodes (12): geistMono, geistSans, metadata, ConnectionErrorGuard(), I18nProvider(), PermissionErrorGuard(), QueryProvider(), Theme (+4 more)

### Community 33 - "Sales Module (33)"
Cohesion: 0.14
Nodes (18): invalidate_sales_catalog(), Invalidate cached sales catalog categories, items, and price lists., create_category(), create_modifier_group(), delete_customer(), delete_modifier_group(), delete_sale_item(), delete_tax() (+10 more)

### Community 34 - "Integrations Module (34)"
Cohesion: 0.22
Nodes (15): enqueue_event(), _json_serializer(), callback(), disconnect(), get_status(), get, patch, post (+7 more)

### Community 35 - "Tests Module (35)"
Cohesion: 0.18
Nodes (16): check_restriction(), _get_permission_id(), get_user_permission_context(), get_user_permissions(), Checks for a permission without admin bypass. Useful for toggleable…, Returns the list of all permission keys that the user has., Fetches user's permission context in minimal queries. Returns: {…, patch (+8 more)

### Community 36 - "Inventory & Warehouse Operations (36)"
Cohesion: 0.12
Nodes (17): close_ticket(), confirm_utensil_count(), patch, Closes a repair ticket. Creates a 'cierre' entry, sets ticket to 'resuelto',…, Supervisor confirms/adjusts a count., update_asset(), update_asset_category(), update_count_schedule() (+9 more)

### Community 37 - "Suppliers & Invoicing (37)"
Cohesion: 0.20
Nodes (15): confirm_invoice(), create_invoice(), get_invoice_detail(), void_invoice(), add_payment(), add_payment(), confirm_invoice(), create_invoice() (+7 more)

### Community 38 - "Tests Module (38)"
Cohesion: 0.21
Nodes (12): get_active_shift_for_today(), get_current_shift(), get_user_shift_identifier(), Retorna el shift_id (UUID) del usuario para una sede específica desde…, Returns the current shift based on local hour., VERUM Backend — main.py ----------------------- This file is the entry point…, test_edit_attendance_day(), test_get_active_shift_fixed_invalid_day() (+4 more)

### Community 39 - "Admin, Roles & Security (39)"
Cohesion: 0.19
Nodes (14): _get_db(), get_profile(), get, post, Dynamic get_db that picks up test mocks applied to main.get_db., Syncs the Supabase Auth user into public.profiles with default staff role., Returns the authenticated user's profile with their venues grouped by…, read_root() (+6 more)

### Community 40 - "Integrations Module (40)"
Cohesion: 0.24
Nodes (8): create_app(), lifespan(), process_outbox_events(), start_outbox_worker_loop(), Config, Settings, BaseSettings, FastAPI

### Community 41 - "Suppliers & Invoicing (41)"
Cohesion: 0.24
Nodes (13): mock_table_helper(), mock_user(), fixture, Helper para crear un mock de tabla de Supabase que soporta encadenamiento…, test_create_credit_note_applied_to_invoice(), test_create_credit_note_success(), test_create_return_item_not_in_receipt(), test_create_return_qty_exceeds_received() (+5 more)

### Community 42 - "Admin, Roles & Security (42)"
Cohesion: 0.19
Nodes (8): ProductionOrdersPage(), LabelConfigModal(), LabelConfigModalProps, LabelConfig, LabelsPrintLayout, LabelsPrintLayoutProps, ProductionOrderDetailResponse, ProductionOrderResponse

### Community 43 - "Scripts Module (43)"
Cohesion: 0.21
Nodes (7): CodeQualityChecker, main(), Main class for code quality checker functionality, Execute the main functionality, Validate the target path exists and is accessible, Perform the main analysis or operation, Generate and display the report

### Community 44 - "Scripts Module (44)"
Cohesion: 0.21
Nodes (7): main(), PrAnalyzer, Main class for pr analyzer functionality, Execute the main functionality, Validate the target path exists and is accessible, Perform the main analysis or operation, Generate and display the report

### Community 45 - "Purchase Orders & Procurement (45)"
Cohesion: 0.21
Nodes (7): main(), Main class for review report generator functionality, Execute the main functionality, Validate the target path exists and is accessible, Perform the main analysis or operation, Generate and display the report, ReviewReportGenerator

### Community 46 - "Inventory & Warehouse Operations (46)"
Cohesion: 0.23
Nodes (9): InventoryDocumentsPage(), fetchItemPresentations(), handleCancelDocument(), handleProcessDocument(), handleReceiveTransfer(), handleSaveDocument(), loadData(), resetNewDoc() (+1 more)

### Community 47 - "Admin, Roles & Security (47)"
Cohesion: 0.24
Nodes (10): get_super_admin(), Dependency that ensures the authenticated user is a Super Admin. Checks the…, override_super_admin(), asyncio, fixture, test_get_global_metrics(), asyncio, test_get_super_admin_passes_for_super_admin() (+2 more)

### Community 48 - "Operational Checklists (48)"
Cohesion: 0.20
Nodes (3): authorized_client(), mock_supabase_registry(), fixture

### Community 50 - "Sales Module (50)"
Cohesion: 0.24
Nodes (10): invalidate_sales_config(), Invalidate cached sales billing config and payment methods., create_payment_method(), create_tax(), update_config(), PaymentMethodCreate, TenantBillingConfigUpdate, create_payment_method() (+2 more)

### Community 51 - "Tests Module (51)"
Cohesion: 0.31
Nodes (9): create_currency(), create_exchange_rate(), CurrencyCreate, ExchangeRateCreate, create_currency(), create_exchange_rate(), asyncio, test_create_and_list_currencies() (+1 more)

### Community 52 - "Purchase Orders & Procurement (52)"
Cohesion: 0.22
Nodes (8): BulkQRCodePrint, QRCodePrint, Asset, BulkQRCodePrint, BulkQRCodePrintProps, Venue, QRCodePrint, QRCodePrintProps

### Community 53 - "Sales Module (53)"
Cohesion: 0.28
Nodes (9): patch, update_category(), update_currency(), update_customer(), CustomerUpdate, SaleCategoryUpdate, update_currency(), update_customer() (+1 more)

### Community 54 - "Admin, Roles & Security (54)"
Cohesion: 0.25
Nodes (3): authorized_client(), mock_supabase_registry(), fixture

### Community 55 - "Inventory & Warehouse Operations (55)"
Cohesion: 0.36
Nodes (8): make_mock_doc(), mock_user(), fixture, test_cancel_receipt_document(), test_create_inventory_document_draft(), test_process_issue_document(), test_process_receipt_document(), test_process_transfer_document_in_transit_and_receive()

### Community 57 - "Frontend Module (57)"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, start, version

### Community 58 - "Admin, Roles & Security (58)"
Cohesion: 0.43
Nodes (7): BaseModel, SuperAdminOrgDetail, SuperAdminUserDetail, SuperAdminUserInOrg, SuperAdminUserOrgAdd, SuperAdminUserOrgUpdate, UserOrgDetail

### Community 59 - "Tests Module (59)"
Cohesion: 0.32
Nodes (5): make_mock_doc(), mock_user(), fixture, test_create_receipt_linked_to_po(), test_process_receipt_updates_po_quantities()

### Community 61 - "Tests Module (61)"
Cohesion: 0.25
Nodes (4): Verifies that if an error occurs during the complex completion process (e.g.,…, Test a scenario where: - Recipe yield is 1 Liter (but stored as 1000.0 base…, test_calculate_needs_scaling_liters_to_ml(), test_complete_order_rollback_on_failure()

### Community 62 - "Attendance & Shifts Management (62)"
Cohesion: 0.29
Nodes (3): authorized_client(), mock_supabase_registry(), fixture

### Community 63 - "Inventory & Warehouse Operations (63)"
Cohesion: 0.36
Nodes (6): ItemsPage(), handleDelete(), handleSave(), loadData(), openEdit(), Row()

### Community 64 - "Purchase Orders & Procurement (64)"
Cohesion: 0.39
Nodes (6): OrgManagementModal(), handleAddUser(), handleAddVenue(), handleDeleteVenue(), handleRemoveUser(), loadData()

### Community 65 - "Transfers Module (65)"
Cohesion: 0.48
Nodes (6): BaseModel, TransferConfirm, TransferCreate, TransferLineConfirm, TransferLineCreate, TransferResponse

### Community 66 - "Tests Module (66)"
Cohesion: 0.48
Nodes (6): authenticated_user_mock(), client(), disable_redis_cache(), mock_db(), mock_supabase(), fixture

### Community 69 - "Suppliers & Invoicing (69)"
Cohesion: 0.38
Nodes (6): mock_table_helper(), mock_user(), fixture, Helper para crear un mock de tabla de Supabase que soporta encadenamiento…, test_calculate_metrics_success(), test_create_evaluation_success()

### Community 71 - "Inventory & Warehouse Operations (71)"
Cohesion: 0.29
Nodes (5): entryColors, entryIcons, entryLabels, TicketDetail, TicketEntry

### Community 72 - "Kds Module (72)"
Cohesion: 0.43
Nodes (6): KDSPage(), fetchProfile(), handleAction(), handleFinalize(), initProfile(), loadKDSData()

### Community 74 - "Attendance & Shifts Management (74)"
Cohesion: 0.47
Nodes (4): admin_token(), fixture, test_user_id(), test_venue_id()

### Community 75 - "Admin, Roles & Security (75)"
Cohesion: 0.40
Nodes (5): override_super_admin(), asyncio, fixture, test_list_all_organizations(), test_update_organization_status()

### Community 76 - "Admin, Roles & Security (76)"
Cohesion: 0.40
Nodes (5): override_super_admin(), asyncio, fixture, test_list_all_users(), test_promote_to_super_admin()

### Community 77 - "Inventory & Warehouse Operations (77)"
Cohesion: 0.47
Nodes (4): ItemCategoriesPage(), handleDelete(), handleSave(), loadCategories()

### Community 78 - "Inventory & Warehouse Operations (78)"
Cohesion: 0.60
Nodes (6): ItemDetailPage(), handleAddUnit(), handleAssociateWarehouse(), handleSaveChanges(), handleToggleGlobalUnit(), loadAllData()

### Community 79 - "Inventory & Warehouse Operations (79)"
Cohesion: 0.47
Nodes (4): KardexPage(), fetchMovementDetail(), handlePrintFromModal(), handleShowDetail()

### Community 83 - "Admin, Roles & Security (83)"
Cohesion: 0.40
Nodes (3): MRPConsolePage(), handleMarkCompleted(), loadData()

### Community 84 - "Purchase Orders & Procurement (84)"
Cohesion: 0.60
Nodes (6): UserManagementModal(), handleAddOrg(), handleRemoveOrg(), handleUpdateOrg(), loadData(), loadOrgAssets()

### Community 85 - "App Module (85)"
Cohesion: 0.40
Nodes (3): get_active_org_id(), Resolves the active organization ID from the X-Org-ID header, or fallbacks to…, require_permission()

### Community 88 - "Inventory & Warehouse Operations (88)"
Cohesion: 0.50
Nodes (3): WarehousesPage(), handleSave(), loadWarehouses()

### Community 89 - "Inventory & Warehouse Operations (89)"
Cohesion: 0.40
Nodes (3): AssetDetail, Ticket, TicketEntry

### Community 90 - "Purchase Orders & Procurement (90)"
Cohesion: 0.40
Nodes (4): DAYS_OF_WEEK, FREQUENCIES, ScheduleEditor(), ScheduleEditorProps

### Community 91 - "Src Module (91)"
Cohesion: 0.60
Nodes (3): config, middleware(), updateSession()

### Community 93 - "Tests Module (93)"
Cohesion: 0.67
Nodes (3): patch, test_get_profile_multi_tenant_admin_success(), test_get_profile_multi_tenant_success()

### Community 94 - "Attendance & Shifts Management (94)"
Cohesion: 0.83
Nodes (4): AdminAbsencesPage(), handleManualSubmit(), handleReview(), loadData()

### Community 95 - "Admin, Roles & Security (95)"
Cohesion: 0.67
Nodes (3): CateringListPage(), handleCreate(), loadRequests()

### Community 96 - "Admin, Roles & Security (96)"
Cohesion: 0.67
Nodes (3): OrganizationsManagement(), handleCreateOrg(), loadOrgs()

### Community 97 - "Purchase Orders & Procurement (97)"
Cohesion: 0.50
Nodes (3): QuestionConfig, QuestionConfigEditor(), QuestionConfigEditorProps

### Community 100 - "Attendance & Shifts Management (100)"
Cohesion: 1.00
Nodes (3): LeaveRequestsPage(), handleSubmit(), loadRequests()

### Community 101 - "Admin, Roles & Security (101)"
Cohesion: 1.00
Nodes (3): SuperAdminCachePage(), handleFlush(), loadHealth()

## Knowledge Gaps
- **197 isolated node(s):** `Config`, `eslintConfig`, `nextConfig`, `name`, `version` (+192 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get_current_user()` connect `Inventory & Warehouse Operations (16)` to `Purchasing Module (0)`, `Attendance & Shifts Management (6)`, `Production Module (8)`, `Admin, Roles & Security (11)`, `Catering Module (17)`, `Inventory & Warehouse Operations (20)`, `Operational Checklists (21)`, `Sales Module (24)`, `Admin, Roles & Security (26)`, `Transfers Module (27)`, `Tests Module (35)`, `Tests Module (38)`, `Admin, Roles & Security (39)`, `Suppliers & Invoicing (41)`, `Operational Checklists (48)`, `Purchase Orders & Procurement (49)`, `Admin, Roles & Security (54)`, `Inventory & Warehouse Operations (55)`, `Purchase Orders & Procurement (56)`, `Tests Module (59)`, `Tests Module (60)`, `Tests Module (61)`, `Attendance & Shifts Management (62)`, `Inventory & Warehouse Operations (67)`, `Suppliers & Invoicing (68)`, `Suppliers & Invoicing (69)`, `App Module (85)`, `Tests Module (86)`, `Tests Module (87)`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `get_db()` connect `Operational Checklists (25)` to `Purchasing Module (0)`, `Integrations Module (34)`, `Tests Module (35)`, `Attendance & Shifts Management (6)`, `Admin, Roles & Security (39)`, `Production Module (8)`, `Integrations Module (40)`, `Tests Module (38)`, `Admin, Roles & Security (11)`, `Catering Module (17)`, `Inventory & Warehouse Operations (20)`, `Operational Checklists (21)`, `App Module (85)`, `Sales Module (24)`, `Transfers Module (27)`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `useTranslations()` connect `Purchase Orders & Procurement (1)` to `Inventory & Warehouse Operations (2)`, `Admin, Roles & Security (4)`, `Purchase Orders & Procurement (5)`, `Operational Checklists (7)`, `Frontend API Client (9)`, `Operational Checklists (14)`, `Purchase Orders & Procurement (15)`, `Admin, Roles & Security (42)`, `Inventory & Warehouse Operations (63)`, `Inventory & Warehouse Operations (77)`, `Inventory & Warehouse Operations (78)`, `Inventory & Warehouse Operations (79)`, `Inventory & Warehouse Operations (80)`, `Inventory & Warehouse Operations (81)`, `Inventory & Warehouse Operations (82)`, `Admin, Roles & Security (83)`, `Inventory & Warehouse Operations (88)`, `Admin, Roles & Security (95)`, `Admin, Roles & Security (96)`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `Config`, `eslintConfig`, `nextConfig` to the rest of the system?**
  _197 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Purchasing Module (0)` be split into smaller, more focused modules?**
  _Cohesion score 0.05262027491408935 - nodes in this community are weakly interconnected._
- **Should `Purchase Orders & Procurement (1)` be split into smaller, more focused modules?**
  _Cohesion score 0.050724637681159424 - nodes in this community are weakly interconnected._
- **Should `Inventory & Warehouse Operations (2)` be split into smaller, more focused modules?**
  _Cohesion score 0.06944444444444445 - nodes in this community are weakly interconnected._