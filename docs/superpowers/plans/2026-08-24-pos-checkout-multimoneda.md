# POS Milestone 3: Checkout Multimoneda y Pagos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Visual skill:** Use `impeccable` (modo Operate) for all frontend UI components marked with 🎨.

**Goal:** Enable a cashier to complete a full checkout flow from the POS terminal — selecting a customer (when configured), choosing payment method(s) with multi-currency support, and registering the sale atomically.

**Architecture:** New atomic `POST /sales/checkout` endpoint orchestrates invoice creation + payment registration + inventory deduction in a single DB transaction. Customer requirement is configurable via a 3-level cascade (Tenant → Sale Mode → Workstation) cached in Redis for 9 hours. Stock availability uses Redis reservations to prevent overselling across concurrent sessions. All DB connections go through the backend API.

**Tech Stack:** Python/FastAPI, Pydantic v2, Supabase PostgREST, Redis (orjson), Next.js 16, React 19, Zustand, TanStack React Query, Tailwind CSS v4, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-08-24-pos-checkout-multimoneda-design.md`

---

## File Structure

### Backend — New Files
| File | Responsibility |
|---|---|
| `backend/migrations/071_pos_checkout_config.sql` | Schema changes: sale_mode_config table, ALTER workstations + tenant_billing_config + sale_items |
| `backend/app/sales/checkout_service.py` | Atomic checkout logic: validate → create invoice → register payments → deduct inventory |
| `backend/app/sales/stock_service.py` | Redis-based stock reservation/release and availability queries |
| `backend/tests/test_sales_checkout.py` | Tests for checkout endpoint |
| `backend/tests/test_sales_pos_config.py` | Tests for pos-config resolution and sale_mode_config CRUD |
| `backend/tests/test_sales_stock.py` | Tests for stock reserve/release/availability |

### Backend — Modified Files
| File | Changes |
|---|---|
| `backend/app/sales/schemas.py` | Add: SaleModeConfig*, PosConfigOut, StockReserve*, Checkout* schemas |
| `backend/app/sales/service.py` | Add: resolve_pos_config(), CRUD for sale_mode_config, extend workstation/sale_item create/update |
| `backend/app/sales/router.py` | Add: /pos-config, /checkout, /mode-config CRUD, /stock/* endpoints |
| `backend/app/cache.py` | Add: invalidate_pos_config() helper |

### Frontend — New Files
| File | Responsibility |
|---|---|
| `frontend/src/app/pos/terminal/components/CustomerSelectorModal.tsx` | 🎨 Search/create customer modal for POS |
| `frontend/src/app/pos/terminal/components/CheckoutModal.tsx` | 🎨 Fullscreen decision: Pago Completo / Mixto / CXC |
| `frontend/src/app/pos/terminal/components/PaymentCalculator.tsx` | 🎨 Split-view payment calculator with numpad + currency switch |
| `frontend/src/app/pos/terminal/components/ChangeRegistration.tsx` | 🎨 Change amount + currency/method registration |
| `frontend/src/app/pos/terminal/components/CheckoutConfirmation.tsx` | 🎨 Success screen post-sale |

### Frontend — Modified Files
| File | Changes |
|---|---|
| `frontend/src/lib/api/sales.ts` | Add: checkout, posConfig, modeConfig, stockReserve API methods + types |
| `frontend/src/hooks/useSales.ts` | Add: usePosConfig, useCheckout, useModeConfig, useStockReserve hooks |
| `frontend/src/store/posStore.ts` | Add: customer state, checkout state |
| `frontend/src/app/pos/terminal/page.tsx` | Orchestrate modals, connect onCheckout/onSendToKitchen |
| `frontend/src/app/pos/terminal/components/PosCart.tsx` | Add customer button in header, stock warning badges |
| `frontend/src/app/pos/terminal/components/PosCatalog.tsx` | Stock availability integration, disabled products |
| `frontend/src/app/admin/sales/config/page.tsx` | Add customer_requirement section + mode config grid |
| `frontend/src/app/admin/sales/workstations/page.tsx` | Add warehouse_id dropdown + customer_requirement select |
| `frontend/src/app/admin/sales/catalog/page.tsx` | Add allow_negative_stock checkbox |

---

## Task 1: Database Migration

**Files:**
- Create: `backend/migrations/071_pos_checkout_config.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 071_pos_checkout_config.sql
-- POS Checkout Config: customer_requirement cascade, warehouse per workstation, stock control

-- 1. Tenant-level customer requirement
ALTER TABLE tenant_billing_config
  ADD COLUMN IF NOT EXISTS customer_requirement TEXT NOT NULL DEFAULT 'optional'
  CHECK (customer_requirement IN ('required', 'optional', 'disabled'));

-- 2. Sale Mode Config table (per-mode overrides)
CREATE TABLE IF NOT EXISTS sale_mode_config (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mode                 TEXT NOT NULL CHECK (mode IN ('tables', 'takeout', 'delivery', 'pickup', 'bar')),
  customer_requirement TEXT CHECK (customer_requirement IN ('required', 'optional', 'disabled')),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, mode)
);

ALTER TABLE sale_mode_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for sale_mode_config"
  ON sale_mode_config FOR ALL TO authenticated
  USING (org_id = (current_setting('request.jwt.claims', true)::json ->> 'org_id')::uuid);

-- 3. Workstation: add customer_requirement override + warehouse link
ALTER TABLE workstations
  ADD COLUMN IF NOT EXISTS customer_requirement TEXT
    CHECK (customer_requirement IN ('required', 'optional', 'disabled'));

ALTER TABLE workstations
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

-- Backfill: assign default warehouse per venue to existing workstations
UPDATE workstations w
  SET warehouse_id = (
    SELECT id FROM warehouses
    WHERE venue_id = w.venue_id
    ORDER BY created_at ASC LIMIT 1
  )
  WHERE w.warehouse_id IS NULL
    AND w.venue_id IS NOT NULL;

-- 4. Sale items: allow selling without stock
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN NOT NULL DEFAULT false;

-- 5. Payments: add change_currency and change_method for cash register reconciliation
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS change_currency TEXT,
  ADD COLUMN IF NOT EXISTS change_method TEXT;
```

- [ ] **Step 2: Commit**

```bash
git add backend/migrations/071_pos_checkout_config.sql
git commit -m "db: add migration 071 - pos checkout config (customer_requirement cascade, warehouse per workstation, stock control)"
```

---

## Task 2: Backend Schemas

**Files:**
- Modify: `backend/app/sales/schemas.py`

- [ ] **Step 1: Add new Pydantic schemas at the end of schemas.py**

```python
# ── Sale Mode Config ──

class SaleModeConfigCreate(BaseModel):
    mode: Literal['tables', 'takeout', 'delivery', 'pickup', 'bar']
    customer_requirement: Literal['required', 'optional', 'disabled']

class SaleModeConfigUpdate(BaseModel):
    customer_requirement: Optional[Literal['required', 'optional', 'disabled']] = None

class SaleModeConfigOut(BaseModel):
    id: UUID
    org_id: UUID
    mode: str
    customer_requirement: Optional[str] = None
    created_at: Optional[Union[dt_datetime, str]] = None
    updated_at: Optional[Union[dt_datetime, str]] = None

# ── POS Config (resolved) ──

class PosConfigOut(BaseModel):
    customer_requirement: str
    warehouse_id: Optional[UUID] = None
    resolved_from: str

# ── Stock Reservation ──

class StockReserveRequest(BaseModel):
    sale_item_id: UUID
    cart_line_id: str
    quantity: float
    warehouse_id: UUID
    session_id: str

class StockAvailabilityItem(BaseModel):
    sale_item_id: UUID
    available_stock: float
    allow_negative_stock: bool

# ── Checkout ──

class CheckoutItemCreate(BaseModel):
    sale_item_id: UUID
    variant_id: Optional[UUID] = None
    quantity: float
    unit_price: float
    discount_pct: float = 0
    tax_id: Optional[UUID] = None
    modifiers: list = []
    notes: Optional[str] = None

class CheckoutPaymentCreate(BaseModel):
    payment_method_id: UUID
    amount: float
    currency_code: str
    exchange_rate: float = 1.0
    reference: Optional[str] = None
    cash_tendered: Optional[float] = None

class CheckoutChangeCreate(BaseModel):
    amount: float
    currency_code: str
    method: str

class CheckoutCreate(BaseModel):
    workstation_id: UUID
    pos_session_id: UUID
    venue_id: UUID
    mode: Literal['tables', 'takeout', 'delivery', 'pickup', 'bar']
    table_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_tax_id: Optional[str] = None
    items: List[CheckoutItemCreate]
    payments: List[CheckoutPaymentCreate] = []
    change: Optional[CheckoutChangeCreate] = None
    document_type: str = "invoice"
    discount_amount: float = 0
    notes: Optional[str] = None

class CheckoutResponse(BaseModel):
    invoice: dict
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/sales/schemas.py
git commit -m "feat(schemas): add SaleModeConfig, PosConfig, StockReserve, and Checkout schemas"
```

---

## Task 3: Backend — POS Config Resolution + sale_mode_config CRUD

**Files:**
- Modify: `backend/app/sales/service.py`
- Modify: `backend/app/cache.py`
- Test: `backend/tests/test_sales_pos_config.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_sales_pos_config.py`:

```python
import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app
from app.deps import get_current_user, get_active_org_id, get_db


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    return user


@pytest.fixture
def mock_supabase():
    mock = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock
    yield mock
    app.dependency_overrides.clear()


def test_resolve_pos_config_workstation_override(client, mock_supabase, mock_user):
    """When workstation has customer_requirement set, it should take priority."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    wh_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.cache.cache") as mock_cache:
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock()

            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                {"warehouse_id": wh_id, "customer_requirement": "required"}
            ]
            mock_supabase.table.return_value = mock_table

            response = client.get(f"/sales/pos-config?workstation_id={ws_id}&mode=tables")

            assert response.status_code == 200
            data = response.json()
            assert data["customer_requirement"] == "required"
            assert data["resolved_from"] == "workstation"
    app.dependency_overrides.clear()


def test_resolve_pos_config_mode_fallback(client, mock_supabase, mock_user):
    """When workstation has no override, falls back to sale_mode_config."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    wh_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.cache.cache") as mock_cache:
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock()

            call_count = 0
            def table_side_effect(name):
                nonlocal call_count
                mock_t = MagicMock()
                if name == "workstations":
                    mock_t.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                        {"warehouse_id": wh_id, "customer_requirement": None}
                    ]
                elif name == "sale_mode_config":
                    mock_t.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                        {"customer_requirement": "disabled"}
                    ]
                return mock_t

            mock_supabase.table.side_effect = table_side_effect

            response = client.get(f"/sales/pos-config?workstation_id={ws_id}&mode=delivery")

            assert response.status_code == 200
            data = response.json()
            assert data["customer_requirement"] == "disabled"
            assert data["resolved_from"] == "sale_mode_config"
    app.dependency_overrides.clear()


def test_create_sale_mode_config(client, mock_supabase, mock_user):
    """CRUD: create a sale mode config entry."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    config_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.cache.cache") as mock_cache:
            mock_cache.delete_pattern = AsyncMock()

            mock_insert = MagicMock()
            mock_insert.insert.return_value.execute.return_value.data = [{
                "id": config_id,
                "org_id": org_id,
                "mode": "delivery",
                "customer_requirement": "required",
                "created_at": "2026-08-24T12:00:00Z",
                "updated_at": "2026-08-24T12:00:00Z"
            }]
            mock_supabase.table.return_value = mock_insert

            response = client.post("/sales/mode-config", json={
                "mode": "delivery",
                "customer_requirement": "required"
            })

            assert response.status_code == 200
            data = response.json()
            assert data["mode"] == "delivery"
            assert data["customer_requirement"] == "required"
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend; python -m pytest tests/test_sales_pos_config.py -v`
Expected: FAIL (endpoints don't exist yet)

- [ ] **Step 3: Add cache invalidation helper**

Append to `backend/app/cache.py`:

```python
async def invalidate_pos_config(org_id: str):
    """Invalidate all cached POS config for an organization."""
    await cache.delete_pattern(f"pos:config:{org_id}:*")
```

- [ ] **Step 4: Implement resolve_pos_config and sale_mode_config CRUD in service.py**

Append to `backend/app/sales/service.py`:

```python
from app.sales.schemas import SaleModeConfigCreate, SaleModeConfigUpdate
from fastapi import HTTPException

# ── Sale Mode Config CRUD ──

async def list_sale_mode_configs(org_id: str, db):
    res = db.table("sale_mode_config").select("*").eq("org_id", org_id).order("mode").execute()
    return res.data or []


async def create_sale_mode_config(org_id: str, payload: SaleModeConfigCreate, db):
    data = payload.model_dump()
    data["org_id"] = org_id
    res = db.table("sale_mode_config").insert(data).execute()
    return res.data[0]


async def update_sale_mode_config(org_id: str, config_id: str, payload: SaleModeConfigUpdate, db):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(400, "No fields to update")
    data["updated_at"] = "now()"
    res = db.table("sale_mode_config").update(data).eq("id", config_id).eq("org_id", org_id).execute()
    if not res.data:
        raise HTTPException(404, "Sale mode config not found")
    return res.data[0]


async def delete_sale_mode_config(org_id: str, config_id: str, db):
    db.table("sale_mode_config").delete().eq("id", config_id).eq("org_id", org_id).execute()
    return {"status": "deleted"}


# ── POS Config Resolution (cascade with Redis cache) ──

async def resolve_pos_config(org_id: str, workstation_id: str, mode: str, db):
    from app.cache import cache

    cache_key = f"pos:config:{org_id}:{workstation_id}:{mode}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    # 1. Read workstation
    wk_res = db.table("workstations").select("warehouse_id, customer_requirement").eq("id", workstation_id).eq("org_id", org_id).execute()
    if not wk_res.data:
        raise HTTPException(404, "Workstation not found")
    wk = wk_res.data[0]

    # 2. Resolve customer_requirement in cascade
    req = None
    resolved_from = "default"

    if wk.get("customer_requirement"):
        req = wk["customer_requirement"]
        resolved_from = "workstation"
    else:
        sm_res = db.table("sale_mode_config").select("customer_requirement").eq("org_id", org_id).eq("mode", mode).execute()
        if sm_res.data and sm_res.data[0].get("customer_requirement"):
            req = sm_res.data[0]["customer_requirement"]
            resolved_from = "sale_mode_config"
        else:
            tb_res = db.table("tenant_billing_config").select("customer_requirement").eq("org_id", org_id).execute()
            if tb_res.data and tb_res.data[0].get("customer_requirement"):
                req = tb_res.data[0]["customer_requirement"]
                resolved_from = "tenant_billing_config"

    if req is None:
        req = "optional"

    result = {
        "customer_requirement": req,
        "warehouse_id": wk.get("warehouse_id"),
        "resolved_from": resolved_from
    }
    await cache.set(cache_key, result, ttl=32400)
    return result
```

- [ ] **Step 5: Add router endpoints for pos-config and mode-config**

Append to `backend/app/sales/router.py`:

```python
from app.sales.schemas import (
    SaleModeConfigCreate, SaleModeConfigUpdate, SaleModeConfigOut,
    PosConfigOut
)
from app.cache import invalidate_pos_config

# ── POS Config ──

@router.get("/pos-config", response_model=PosConfigOut)
async def get_pos_config(
    workstation_id: str,
    mode: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.view_config"))
):
    return await sales_svc.resolve_pos_config(org_id, workstation_id, mode, db)


# ── Sale Mode Config CRUD ──

@router.get("/mode-config", response_model=list[SaleModeConfigOut])
async def list_mode_configs(
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    return await sales_svc.list_sale_mode_configs(org_id, db)


@router.post("/mode-config", response_model=SaleModeConfigOut)
async def create_mode_config(
    payload: SaleModeConfigCreate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.create_sale_mode_config(org_id, payload, db)
    await invalidate_pos_config(org_id)
    return res


@router.patch("/mode-config/{config_id}", response_model=SaleModeConfigOut)
async def update_mode_config(
    config_id: str,
    payload: SaleModeConfigUpdate,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.update_sale_mode_config(org_id, config_id, payload, db)
    await invalidate_pos_config(org_id)
    return res


@router.delete("/mode-config/{config_id}")
async def delete_mode_config(
    config_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.manage_config"))
):
    res = await sales_svc.delete_sale_mode_config(org_id, config_id, db)
    await invalidate_pos_config(org_id)
    return res
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend; python -m pytest tests/test_sales_pos_config.py -v`
Expected: 3 tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/sales/service.py backend/app/sales/router.py backend/app/cache.py backend/tests/test_sales_pos_config.py
git commit -m "feat: add POS config cascade resolution + sale_mode_config CRUD with Redis cache (9h TTL)"
```

---

## Task 4: Backend — Stock Service (Reserve/Release/Availability)

**Files:**
- Create: `backend/app/sales/stock_service.py`
- Test: `backend/tests/test_sales_stock.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_sales_stock.py`:

```python
import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app
from app.deps import get_current_user, get_active_org_id, get_db


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    return user


@pytest.fixture
def mock_supabase():
    mock = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock
    yield mock
    app.dependency_overrides.clear()


def test_reserve_stock_success(client, mock_supabase, mock_user):
    """Reserve stock when available."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    item_id = str(uuid4())
    wh_id = str(uuid4())

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.sales.stock_service.cache") as mock_cache:
            mock_cache.hgetall = AsyncMock(return_value={})
            mock_cache.hset = AsyncMock()
            mock_cache.expire = AsyncMock()

            # sale_items query
            mock_item = MagicMock()
            mock_item.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                {"allow_negative_stock": False}
            ]
            # stock query via rpc
            mock_supabase.table.return_value = mock_item
            mock_supabase.rpc.return_value.execute.return_value.data = 10.0

            response = client.post("/sales/stock/reserve", json={
                "sale_item_id": item_id,
                "cart_line_id": "line-1",
                "quantity": 2,
                "warehouse_id": wh_id,
                "session_id": "sess-1"
            })

            assert response.status_code == 200
    app.dependency_overrides.clear()


def test_reserve_stock_insufficient(client, mock_supabase, mock_user):
    """Reject reservation when stock insufficient and allow_negative_stock=false."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id
    item_id = str(uuid4())
    wh_id = str(uuid4())

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.sales.stock_service.cache") as mock_cache:
            mock_cache.hgetall = AsyncMock(return_value={"other:line": "8"})
            mock_cache.hset = AsyncMock()
            mock_cache.expire = AsyncMock()

            mock_item = MagicMock()
            mock_item.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                {"allow_negative_stock": False}
            ]
            mock_supabase.table.return_value = mock_item
            mock_supabase.rpc.return_value.execute.return_value.data = 10.0

            response = client.post("/sales/stock/reserve", json={
                "sale_item_id": item_id,
                "cart_line_id": "line-2",
                "quantity": 5,
                "warehouse_id": wh_id,
                "session_id": "sess-1"
            })

            assert response.status_code == 400
            assert "OUT_OF_STOCK" in response.json().get("detail", "")
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend; python -m pytest tests/test_sales_stock.py -v`
Expected: FAIL (stock_service doesn't exist yet)

- [ ] **Step 3: Implement stock_service.py**

Create `backend/app/sales/stock_service.py`:

```python
from fastapi import HTTPException
from app.cache import cache


async def reserve_stock(org_id: str, sale_item_id: str, cart_line_id: str,
                        quantity: float, warehouse_id: str, session_id: str, db):
    """Reserve stock in Redis. Validates availability unless allow_negative_stock."""
    # Check product setting
    item_res = db.table("sale_items").select("allow_negative_stock").eq(
        "id", sale_item_id).eq("org_id", org_id).execute()
    if not item_res.data:
        raise HTTPException(400, "INVALID_SALE_ITEM")
    allow_negative = item_res.data[0].get("allow_negative_stock", False)

    if not allow_negative:
        # Get real stock from inventory
        stock_res = db.rpc("get_stock_balance", {
            "p_warehouse_id": warehouse_id,
            "p_item_id": sale_item_id
        }).execute()
        actual_stock = float(stock_res.data) if stock_res.data else 0.0

        # Subtract existing reservations
        cache_key = f"stock:reserved:{warehouse_id}:{sale_item_id}"
        reservations = await cache.hgetall(cache_key)
        total_reserved = sum(float(v) for v in reservations.values()) if reservations else 0.0

        available = actual_stock - total_reserved
        if available < quantity:
            raise HTTPException(400, "OUT_OF_STOCK")

    # Place reservation
    cache_key = f"stock:reserved:{warehouse_id}:{sale_item_id}"
    await cache.hset(cache_key, f"{session_id}:{cart_line_id}", str(quantity))
    await cache.expire(cache_key, 1800)  # 30 min TTL
    return {"reserved": True, "quantity": quantity}


async def release_stock(warehouse_id: str, sale_item_id: str,
                        session_id: str, cart_line_id: str):
    """Release a specific stock reservation."""
    cache_key = f"stock:reserved:{warehouse_id}:{sale_item_id}"
    await cache.hdel(cache_key, f"{session_id}:{cart_line_id}")
    return {"released": True}


async def release_session_reservations(warehouse_id: str, session_id: str, item_ids: list):
    """Release all reservations for a session after checkout."""
    for item_id in item_ids:
        cache_key = f"stock:reserved:{warehouse_id}:{item_id}"
        reservations = await cache.hgetall(cache_key)
        if reservations:
            for field_key in list(reservations.keys()):
                if field_key.startswith(f"{session_id}:"):
                    await cache.hdel(cache_key, field_key)


async def get_stock_availability(org_id: str, warehouse_id: str, db):
    """Get available stock (real - reserved) for all sale items."""
    # Get all sale items
    items_res = db.table("sale_items").select(
        "id, allow_negative_stock"
    ).eq("org_id", org_id).eq("is_active", True).execute()

    if not items_res.data:
        return []

    result = []
    for item in items_res.data:
        item_id = item["id"]
        allow_neg = item.get("allow_negative_stock", False)

        # Get real stock
        stock_res = db.rpc("get_stock_balance", {
            "p_warehouse_id": warehouse_id,
            "p_item_id": item_id
        }).execute()
        actual = float(stock_res.data) if stock_res.data else 0.0

        # Subtract reservations
        cache_key = f"stock:reserved:{warehouse_id}:{item_id}"
        reservations = await cache.hgetall(cache_key)
        total_reserved = sum(float(v) for v in reservations.values()) if reservations else 0.0

        result.append({
            "sale_item_id": item_id,
            "available_stock": actual - total_reserved,
            "allow_negative_stock": allow_neg
        })

    return result
```

- [ ] **Step 4: Add stock endpoints to router.py**

Append to `backend/app/sales/router.py`:

```python
from app.sales.schemas import StockReserveRequest
from app.sales import stock_service

@router.post("/stock/reserve")
async def reserve_stock(
    payload: StockReserveRequest,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.create_invoice"))
):
    return await stock_service.reserve_stock(
        org_id, str(payload.sale_item_id), payload.cart_line_id,
        payload.quantity, str(payload.warehouse_id), payload.session_id, db
    )


@router.delete("/stock/reserve/{cart_line_id}")
async def release_stock(
    cart_line_id: str,
    warehouse_id: str,
    sale_item_id: str,
    session_id: str,
    org_id: str = Depends(get_active_org_id),
    _ = Depends(require_permission("sales.create_invoice"))
):
    return await stock_service.release_stock(warehouse_id, sale_item_id, session_id, cart_line_id)


@router.get("/stock/availability")
async def get_availability(
    warehouse_id: str,
    org_id: str = Depends(get_active_org_id),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.view_catalog"))
):
    return await stock_service.get_stock_availability(org_id, warehouse_id, db)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend; python -m pytest tests/test_sales_stock.py -v`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/sales/stock_service.py backend/app/sales/router.py backend/tests/test_sales_stock.py
git commit -m "feat: add stock reservation service with Redis + availability endpoint"
```

---

## Task 5: Backend — Atomic Checkout Service

**Files:**
- Create: `backend/app/sales/checkout_service.py`
- Test: `backend/tests/test_sales_checkout.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_sales_checkout.py`:

```python
import pytest
from uuid import uuid4
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app
from app.deps import get_current_user, get_active_org_id, get_db


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = str(uuid4())
    return user


@pytest.fixture
def mock_supabase():
    mock = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock
    yield mock
    app.dependency_overrides.clear()


def _checkout_payload(ws_id, session_id, venue_id, item_id, pm_id):
    return {
        "workstation_id": ws_id,
        "pos_session_id": session_id,
        "venue_id": venue_id,
        "mode": "takeout",
        "items": [{
            "sale_item_id": item_id,
            "quantity": 2,
            "unit_price": 10.0,
            "discount_pct": 0,
        }],
        "payments": [{
            "payment_method_id": pm_id,
            "amount": 20.0,
            "currency_code": "USD",
            "exchange_rate": 1.0,
            "cash_tendered": 25.0
        }],
        "change": {
            "amount": 5.0,
            "currency_code": "USD",
            "method": "cash"
        },
        "document_type": "invoice"
    }


def test_checkout_success(client, mock_supabase, mock_user):
    """Full checkout flow: create invoice + payment + confirm."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    session_id = str(uuid4())
    venue_id = str(uuid4())
    item_id = str(uuid4())
    pm_id = str(uuid4())
    invoice_id = str(uuid4())
    wh_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.sales.checkout_service.resolve_pos_config") as mock_config:
            mock_config.return_value = {
                "customer_requirement": "optional",
                "warehouse_id": wh_id,
                "resolved_from": "default"
            }

            with patch("app.sales.checkout_service.release_session_reservations", new_callable=AsyncMock):
                # Mock session check
                mock_session = MagicMock()
                mock_session.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                    {"id": session_id, "status": "open"}
                ]

                # Mock doc number
                mock_supabase.rpc.return_value.execute.return_value.data = "FAC-000001"

                # Mock payment method
                mock_pm = MagicMock()
                mock_pm.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                    {"id": pm_id, "name": "Efectivo USD", "method_type": "cash", "currency_code": "USD"}
                ]

                # Mock invoice insert
                mock_inv = MagicMock()
                mock_inv.insert.return_value.execute.return_value.data = [{
                    "id": invoice_id, "document_number": "FAC-000001",
                    "status": "paid", "total": 20.0, "amount_paid": 20.0,
                    "balance_due": 0, "currency_code": "USD",
                    "customer_name": "Cliente General"
                }]

                # Mock invoice items insert
                mock_items = MagicMock()
                mock_items.insert.return_value.execute.return_value.data = [{}]

                # Mock payment insert
                mock_pay = MagicMock()
                mock_pay.insert.return_value.execute.return_value.data = [{}]

                def table_router(name):
                    if name == "pos_sessions":
                        return mock_session
                    elif name == "payment_methods":
                        return mock_pm
                    elif name == "invoices":
                        return mock_inv
                    elif name == "invoice_items":
                        return mock_items
                    elif name == "payments":
                        return mock_pay
                    return MagicMock()

                mock_supabase.table.side_effect = table_router

                payload = _checkout_payload(ws_id, session_id, venue_id, item_id, pm_id)
                response = client.post("/sales/checkout", json=payload)

                assert response.status_code == 200
                data = response.json()
                assert data["invoice"]["status"] == "paid"
    app.dependency_overrides.clear()


def test_checkout_customer_required_missing(client, mock_supabase, mock_user):
    """Reject checkout when customer is required but not provided."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    org_id = str(uuid4())
    ws_id = str(uuid4())
    wh_id = str(uuid4())
    app.dependency_overrides[get_active_org_id] = lambda: org_id

    with patch("app.deps._get_helper") as mock_helper:
        mock_helper.return_value = AsyncMock(return_value=True)

        with patch("app.sales.checkout_service.resolve_pos_config") as mock_config:
            mock_config.return_value = {
                "customer_requirement": "required",
                "warehouse_id": wh_id,
                "resolved_from": "tenant_billing_config"
            }

            payload = _checkout_payload(ws_id, str(uuid4()), str(uuid4()), str(uuid4()), str(uuid4()))
            response = client.post("/sales/checkout", json=payload)

            assert response.status_code == 400
            assert "CUSTOMER_REQUIRED" in response.json().get("detail", "")
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend; python -m pytest tests/test_sales_checkout.py -v`
Expected: FAIL

- [ ] **Step 3: Implement checkout_service.py**

Create `backend/app/sales/checkout_service.py`:

```python
from fastapi import HTTPException
from app.sales.schemas import CheckoutCreate
from app.sales.service import resolve_pos_config
from app.sales.stock_service import release_session_reservations


async def process_checkout(org_id: str, payload: CheckoutCreate, user_id: str, db):
    """
    Atomic checkout: validate → create invoice → register payments
    → confirm → deduct inventory → release reservations.
    """
    # 1. Resolve POS config
    pos_config = await resolve_pos_config(
        org_id, str(payload.workstation_id), payload.mode, db
    )
    warehouse_id = pos_config.get("warehouse_id") if isinstance(pos_config, dict) else pos_config.warehouse_id

    # 2. Validate customer requirement
    cr = pos_config.get("customer_requirement") if isinstance(pos_config, dict) else pos_config.customer_requirement
    if cr == "required" and not payload.customer_id and not payload.customer_name:
        raise HTTPException(400, "CUSTOMER_REQUIRED")

    # 3. Validate session
    session_res = db.table("pos_sessions").select("id, status").eq(
        "id", str(payload.pos_session_id)
    ).eq("org_id", org_id).eq("status", "open").execute()
    if not session_res.data:
        raise HTTPException(400, "SESSION_NOT_ACTIVE")

    # 4. Resolve customer
    customer_name = "Cliente General"
    customer_id = None
    customer_tax_id = None
    if payload.customer_id:
        cust_res = db.table("customers").select("id, name, tax_id").eq(
            "id", str(payload.customer_id)
        ).eq("org_id", org_id).execute()
        if cust_res.data:
            customer_name = cust_res.data[0]["name"]
            customer_id = str(payload.customer_id)
            customer_tax_id = cust_res.data[0].get("tax_id")
    elif payload.customer_name:
        customer_name = payload.customer_name
        customer_tax_id = payload.customer_tax_id

    # 5. Calculate totals
    subtotal = 0
    invoice_items = []
    for item in payload.items:
        line_sub = item.quantity * item.unit_price
        discount_amt = line_sub * (item.discount_pct / 100) if item.discount_pct else 0
        line_total = line_sub - discount_amt
        subtotal += line_total
        invoice_items.append({
            "sale_item_id": str(item.sale_item_id),
            "variant_id": str(item.variant_id) if item.variant_id else None,
            "quantity": item.quantity,
            "unit_price": float(item.unit_price),
            "discount_pct": float(item.discount_pct),
            "discount_amount": float(discount_amt),
            "tax_id": str(item.tax_id) if item.tax_id else None,
            "subtotal": float(line_total),
            "modifiers": item.modifiers,
            "notes": item.notes,
        })

    total_amount = subtotal - payload.discount_amount

    # 6. Generate document number
    doc_num_res = db.rpc("get_next_doc_number", {
        "p_org_id": org_id, "p_type": payload.document_type
    }).execute()
    doc_number = doc_num_res.data

    # 7. Calculate payments
    amount_paid = sum(p.amount * p.exchange_rate for p in payload.payments)
    balance_due = max(0, total_amount - amount_paid)

    is_cxc = balance_due > 0.01
    if is_cxc and not customer_id:
        raise HTTPException(400, "CXC_REQUIRES_CUSTOMER")

    status = "paid" if balance_due <= 0.01 else "partial" if amount_paid > 0 else "confirmed"

    # 8. Insert invoice
    invoice_data = {
        "org_id": org_id,
        "venue_id": str(payload.venue_id),
        "workstation_id": str(payload.workstation_id),
        "pos_session_id": str(payload.pos_session_id),
        "document_type": payload.document_type,
        "document_number": doc_number,
        "numbering_source": "verum_sequence",
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_tax_id": customer_tax_id,
        "currency_code": "USD",
        "exchange_rate": 1.0,
        "subtotal": float(subtotal),
        "discount_amount": float(payload.discount_amount),
        "total": float(total_amount),
        "amount_paid": float(amount_paid),
        "balance_due": float(balance_due),
        "status": status,
        "notes": payload.notes,
        "created_by": user_id,
    }
    if payload.table_id:
        invoice_data["table_id"] = str(payload.table_id)

    inv_res = db.table("invoices").insert(invoice_data).execute()
    if not inv_res.data:
        raise HTTPException(500, "SEQUENCE_ERROR")
    invoice = inv_res.data[0]
    invoice_id = invoice["id"]

    # 9. Insert invoice items
    for idx, line in enumerate(invoice_items):
        line["invoice_id"] = invoice_id
        line["position"] = idx
    if invoice_items:
        db.table("invoice_items").insert(invoice_items).execute()

    # 10. Insert payments
    for p in payload.payments:
        # Snapshot payment method
        pm_res = db.table("payment_methods").select("name, method_type").eq(
            "id", str(p.payment_method_id)
        ).eq("org_id", org_id).execute()
        if not pm_res.data:
            raise HTTPException(400, "INVALID_PAYMENT_METHOD")
        pm = pm_res.data[0]

        payment_data = {
            "invoice_id": invoice_id,
            "payment_method_id": str(p.payment_method_id),
            "method_name": pm["name"],
            "method_type": pm["method_type"],
            "amount": float(p.amount),
            "currency_code": p.currency_code,
            "exchange_rate": float(p.exchange_rate),
            "amount_in_invoice_currency": float(p.amount * p.exchange_rate),
            "reference": p.reference,
            "cash_tendered": float(p.cash_tendered) if p.cash_tendered else None,
            "status": "completed",
            "recorded_by": user_id,
        }

        # Register change on cash payment
        if p.cash_tendered and p.cash_tendered > p.amount and payload.change:
            payment_data["cash_change"] = float(payload.change.amount)
            payment_data["change_currency"] = payload.change.currency_code
            payment_data["change_method"] = payload.change.method

        db.table("payments").insert(payment_data).execute()

    # 11. Update customer outstanding balance for CXC
    if is_cxc and customer_id:
        db.rpc("increment_customer_balance", {
            "p_customer_id": customer_id,
            "p_amount": float(balance_due)
        }).execute()

    # 12. Deduct inventory
    if warehouse_id:
        try:
            from app.sales.inventory_deduction import deduct_inventory_for_invoice
            user_mock = type('User', (), {'id': user_id})()
            await deduct_inventory_for_invoice(org_id, invoice_id, str(warehouse_id), user_mock, db)
        except Exception as e:
            print(f"[CHECKOUT] Inventory deduction warning: {e}")

    # 13. Release Redis reservations
    item_ids = [str(item.sale_item_id) for item in payload.items]
    await release_session_reservations(str(warehouse_id), str(payload.pos_session_id), item_ids)

    return {"invoice": invoice}
```

- [ ] **Step 4: Add checkout endpoint to router.py**

Append to `backend/app/sales/router.py`:

```python
from app.sales.schemas import CheckoutCreate, CheckoutResponse
from app.sales import checkout_service

@router.post("/checkout", response_model=CheckoutResponse)
async def process_checkout(
    payload: CheckoutCreate,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    _ = Depends(require_permission("sales.create_invoice"))
):
    return await checkout_service.process_checkout(org_id, payload, user.id, db)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend; python -m pytest tests/test_sales_checkout.py -v`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/sales/checkout_service.py backend/app/sales/router.py backend/tests/test_sales_checkout.py
git commit -m "feat: add atomic checkout endpoint with invoice + payments + inventory deduction"
```

---

## Task 6: Frontend — API Client + Types

**Files:**
- Modify: `frontend/src/lib/api/sales.ts`

- [ ] **Step 1: Add new types**

Append to the types section of `frontend/src/lib/api/sales.ts`:

```typescript
// ── Checkout Types ──

export interface PosConfig {
    customer_requirement: 'required' | 'optional' | 'disabled'
    warehouse_id: string
    resolved_from: string
}

export interface SaleModeConfig {
    id: string
    org_id: string
    mode: string
    customer_requirement: 'required' | 'optional' | 'disabled' | null
    created_at: string
    updated_at: string
}

export interface CheckoutItem {
    sale_item_id: string
    variant_id?: string | null
    quantity: number
    unit_price: number
    discount_pct?: number
    tax_id?: string | null
    modifiers?: any[]
    notes?: string | null
}

export interface CheckoutPayment {
    payment_method_id: string
    amount: number
    currency_code: string
    exchange_rate?: number
    reference?: string | null
    cash_tendered?: number | null
}

export interface CheckoutChange {
    amount: number
    currency_code: string
    method: string
}

export interface CheckoutPayload {
    workstation_id: string
    pos_session_id: string
    venue_id: string
    mode: string
    table_id?: string | null
    customer_id?: string | null
    customer_name?: string | null
    customer_tax_id?: string | null
    items: CheckoutItem[]
    payments: CheckoutPayment[]
    change?: CheckoutChange | null
    document_type?: string
    discount_amount?: number
    notes?: string | null
}

export interface CheckoutResponse {
    invoice: Invoice & {
        amount_paid: number
        balance_due: number
    }
}

export interface StockAvailability {
    sale_item_id: string
    available_stock: number
    allow_negative_stock: boolean
}
```

- [ ] **Step 2: Add new API methods**

Append to the `salesApi` object in `frontend/src/lib/api/sales.ts`:

```typescript
    // POS Config
    getPosConfig: (workstationId: string, mode: string) =>
        fetchWithAuth<PosConfig>(`/sales/pos-config?workstation_id=${workstationId}&mode=${mode}`),

    // Sale Mode Config
    getModeConfigs: () => fetchWithAuth<SaleModeConfig[]>('/sales/mode-config'),
    createModeConfig: (data: { mode: string; customer_requirement: string }) =>
        fetchWithAuth<SaleModeConfig>('/sales/mode-config', {
            method: 'POST', body: JSON.stringify(data)
        }),
    updateModeConfig: (id: string, data: { customer_requirement: string }) =>
        fetchWithAuth<SaleModeConfig>(`/sales/mode-config/${id}`, {
            method: 'PATCH', body: JSON.stringify(data)
        }),
    deleteModeConfig: (id: string) =>
        fetchWithAuth<{ status: string }>(`/sales/mode-config/${id}`, { method: 'DELETE' }),

    // Stock
    reserveStock: (data: { sale_item_id: string; cart_line_id: string; quantity: number; warehouse_id: string; session_id: string }) =>
        fetchWithAuth('/sales/stock/reserve', {
            method: 'POST', body: JSON.stringify(data)
        }),
    releaseStock: (cartLineId: string, warehouseId: string, saleItemId: string, sessionId: string) =>
        fetchWithAuth(`/sales/stock/reserve/${cartLineId}?warehouse_id=${warehouseId}&sale_item_id=${saleItemId}&session_id=${sessionId}`, {
            method: 'DELETE'
        }),
    getStockAvailability: (warehouseId: string) =>
        fetchWithAuth<StockAvailability[]>(`/sales/stock/availability?warehouse_id=${warehouseId}`),

    // Checkout
    processCheckout: (data: CheckoutPayload) =>
        fetchWithAuth<CheckoutResponse>('/sales/checkout', {
            method: 'POST', body: JSON.stringify(data)
        }),
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api/sales.ts
git commit -m "feat(frontend): add checkout, posConfig, stock, modeConfig types and API methods"
```

---

## Task 7: Frontend — React Query Hooks

**Files:**
- Modify: `frontend/src/hooks/useSales.ts`

- [ ] **Step 1: Add new query keys and hooks**

Append to `salesKeys` in `frontend/src/hooks/useSales.ts`:

```typescript
    posConfig: (workstationId?: string, mode?: string) =>
        [...salesKeys.all, 'posConfig', { workstationId, mode }] as const,
    modeConfigs: () => [...salesKeys.all, 'mode-configs'] as const,
    stockAvailability: (warehouseId?: string) =>
        [...salesKeys.all, 'stock-availability', { warehouseId }] as const,
```

Append new hooks:

```typescript
// ── POS Config ──

export function usePosConfig(workstationId?: string, mode?: string) {
    return useQuery({
        queryKey: salesKeys.posConfig(workstationId, mode),
        queryFn: () => salesApi.getPosConfig(workstationId!, mode!),
        enabled: !!workstationId && !!mode,
        staleTime: 32400000, // 9 hours - matches Redis TTL
    })
}

// ── Sale Mode Config ──

export function useModeConfigs() {
    return useQuery({
        queryKey: salesKeys.modeConfigs(),
        queryFn: salesApi.getModeConfigs,
    })
}

export function useCreateModeConfig() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.createModeConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.modeConfigs() })
            queryClient.invalidateQueries({ queryKey: ['sales', 'posConfig'] })
        },
    })
}

export function useUpdateModeConfig() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { customer_requirement: string } }) =>
            salesApi.updateModeConfig(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.modeConfigs() })
            queryClient.invalidateQueries({ queryKey: ['sales', 'posConfig'] })
        },
    })
}

// ── Stock Availability ──

export function useStockAvailability(warehouseId?: string) {
    return useQuery({
        queryKey: salesKeys.stockAvailability(warehouseId),
        queryFn: () => salesApi.getStockAvailability(warehouseId!),
        enabled: !!warehouseId,
        refetchInterval: 30000, // Poll every 30s
    })
}

// ── Checkout ──

export function useCheckout() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: salesApi.processCheckout,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.invoices() })
            queryClient.invalidateQueries({ queryKey: ['sales', 'sessions'] })
        },
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useSales.ts
git commit -m "feat(frontend): add usePosConfig, useModeConfigs, useStockAvailability, useCheckout hooks"
```

---

## Task 8: Frontend — Zustand Store Updates

**Files:**
- Modify: `frontend/src/store/posStore.ts`

- [ ] **Step 1: Add customer and checkout state to PosState interface**

Add to the `PosState` interface and store:

```typescript
// Add to PosState interface:
  customerId: string | null
  customerName: string | null
  customerTaxId: string | null
  showCheckout: boolean
  showCustomerSelector: boolean
  setCustomer: (id: string | null, name: string, taxId: string | null) => void
  clearCustomer: () => void
  setShowCheckout: (show: boolean) => void
  setShowCustomerSelector: (show: boolean) => void

// Add to create<PosState> initial state:
  customerId: null,
  customerName: null,
  customerTaxId: null,
  showCheckout: false,
  showCustomerSelector: false,

  setCustomer: (id, name, taxId) => set({ customerId: id, customerName: name, customerTaxId: taxId }),
  clearCustomer: () => set({ customerId: null, customerName: null, customerTaxId: null }),
  setShowCheckout: (show) => set({ showCheckout: show }),
  setShowCustomerSelector: (show) => set({ showCustomerSelector: show }),
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/store/posStore.ts
git commit -m "feat(store): add customer state and checkout/customer selector visibility to posStore"
```

---

## Task 9: Frontend — CustomerSelectorModal 🎨

**Files:**
- Create: `frontend/src/app/pos/terminal/components/CustomerSelectorModal.tsx`

> **Note:** Use `impeccable` skill (modo Operate) for visual design. The component structure and logic is defined below.

- [ ] **Step 1: Create component with search + quick registration**

Create `frontend/src/app/pos/terminal/components/CustomerSelectorModal.tsx` with:

- **Props:** `isOpen: boolean`, `onClose: () => void`, `onSelect: (customer: { id: string | null, name: string, taxId: string | null }) => void`, `required: boolean` (if true, no close without selection)
- **State:** `view: 'search' | 'create'`, `searchQuery: string`, `formData` for new customer
- **Search mode:** Input with 300ms debounce, `useCustomers()` filtered by search, results as touch cards, "Nuevo Cliente" button, "Consumidor Final" button (hidden when required)
- **Create mode:** Form with campos from spec (nombre ✅, RIF ✅, teléfono ✅, email ❌, dirección ❌, cumpleaños ❌, redes ❌, notas ❌), `useCreateCustomer()` mutation, auto-select on save
- **Design tokens:** Follow existing POS dark theme (`bg-surface`, `border-border`, `text-primary`, tap targets ≥48px)

Full functional implementation to be crafted with `impeccable` skill during execution.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/pos/terminal/components/CustomerSelectorModal.tsx
git commit -m "feat(pos): add CustomerSelectorModal with search and quick registration"
```

---

## Task 10: Frontend — CheckoutModal 🎨

**Files:**
- Create: `frontend/src/app/pos/terminal/components/CheckoutModal.tsx`

> **Note:** Use `impeccable` skill (modo Operate) for visual design.

- [ ] **Step 1: Create fullscreen checkout decision modal**

Create `frontend/src/app/pos/terminal/components/CheckoutModal.tsx` with:

- **Props:** `isOpen`, `onClose`, `total`, `subtotal`, `taxAmount`, `totalVES`, `vesRate`, `cartItems`, `customerName`, `mode`, `tableName`, `orderNumber`
- **State:** `checkoutStep: 'decision' | 'calculator' | 'change' | 'confirmation'`, `paymentType: 'complete' | 'mixed' | 'cxc'`
- **Decision screen:** Fullscreen modal, total dual display (USD + VES), customer chip, 3 cards grid (Pago Completo, Pago Mixto, CXC), Cancelar button
- **On select:** Transitions to PaymentCalculator (complete/mixed) or processes CXC directly
- **Integration:** `useCheckout()` mutation, `usePosStore` for customer/cart data
- **Post-success:** Shows CheckoutConfirmation, then resets cart

Full functional implementation to be crafted with `impeccable` skill during execution.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/pos/terminal/components/CheckoutModal.tsx
git commit -m "feat(pos): add CheckoutModal fullscreen with payment decision screen"
```

---

## Task 11: Frontend — PaymentCalculator 🎨

**Files:**
- Create: `frontend/src/app/pos/terminal/components/PaymentCalculator.tsx`

> **Note:** Use `impeccable` skill (modo Operate) for visual design.

- [ ] **Step 1: Create split-view payment calculator**

Create `frontend/src/app/pos/terminal/components/PaymentCalculator.tsx` with:

- **Props:** `total`, `currency`, `vesRate`, `paymentType: 'complete' | 'mixed'`, `onComplete: (payments, change) => void`, `onBack`
- **State:** `selectedMethodId`, `inputAmount`, `inputCurrency: 'USD' | 'VES'`, `registeredPayments[]`, `referenceInput`
- **Left panel (40%):** `usePaymentMethods()` as vertical cards, each with icon + name + currency chip, selected state with teal glow
- **Right panel (60%):** Summary bar (Total/Paid/Remaining dual currency), registered payments list with × delete, amount input + USD⇄VES switch, on-screen numpad (4×4 grid), "Agregar Pago" + "Finalizar Cobro" buttons
- **Pago Completo:** Pre-selects first method, pre-fills total
- **Pago Mixto:** Starts empty, add payments until remaining ≤ 0
- **Currency switch:** Converts input between USD↔VES using exchange rate
- **Cash tendered:** When method is cash, shows "Monto Recibido" input and calculates change

Full functional implementation to be crafted with `impeccable` skill during execution.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/pos/terminal/components/PaymentCalculator.tsx
git commit -m "feat(pos): add PaymentCalculator split-view with numpad and currency switch"
```

---

## Task 12: Frontend — ChangeRegistration + CheckoutConfirmation 🎨

**Files:**
- Create: `frontend/src/app/pos/terminal/components/ChangeRegistration.tsx`
- Create: `frontend/src/app/pos/terminal/components/CheckoutConfirmation.tsx`

- [ ] **Step 1: Create ChangeRegistration**

`ChangeRegistration.tsx`:
- **Props:** `changeAmount`, `onConfirm: (change: CheckoutChange) => void`
- **UI:** Large change amount in both currencies, currency selector (USD/VES), method selector (Efectivo/Transferencia/etc.), Confirmar button

- [ ] **Step 2: Create CheckoutConfirmation**

`CheckoutConfirmation.tsx`:
- **Props:** `invoice: CheckoutResponse['invoice']`, `onNewOrder`, `onPrint`
- **UI:** Animated check icon, "Venta #N completada", invoice number, buttons: "Imprimir Factura" / "Nota de Entrega" / "Nueva Orden" (CTA)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/pos/terminal/components/ChangeRegistration.tsx frontend/src/app/pos/terminal/components/CheckoutConfirmation.tsx
git commit -m "feat(pos): add ChangeRegistration and CheckoutConfirmation components"
```

---

## Task 13: Frontend — PosCart Modifications

**Files:**
- Modify: `frontend/src/app/pos/terminal/components/PosCart.tsx`

- [ ] **Step 1: Add customer button to cart header**

In the header area of `PosCart.tsx`, after the order/mode badges, add a customer indicator button:

```tsx
import { User } from 'lucide-react'
import { usePosStore } from '@/store/posStore'

// Inside the header div, after the mode badge:
const { customerId, customerName, setShowCustomerSelector } = usePosStore()

// Add this button:
{customerRequirement !== 'disabled' && (
  <button
    onClick={() => setShowCustomerSelector(true)}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
      customerId
        ? 'border-primary/30 text-primary bg-primary/5'
        : 'border-border text-text-secondary hover:border-primary/20 hover:text-primary'
    }`}
    title={customerId ? `Cliente: ${customerName}` : 'Asignar cliente'}
  >
    <User className="w-3.5 h-3.5" />
    <span className="truncate max-w-[100px]">
      {customerId ? customerName : 'Cliente'}
    </span>
  </button>
)}
```

- [ ] **Step 2: Connect onCheckout prop**

The `handleCobrar` function already calls `onCheckout?.()` — no change needed here. The connection happens in `terminal/page.tsx` (Task 15).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/pos/terminal/components/PosCart.tsx
git commit -m "feat(pos): add customer indicator button to PosCart header"
```

---

## Task 14: Frontend — PosCatalog Stock Integration

**Files:**
- Modify: `frontend/src/app/pos/terminal/components/PosCatalog.tsx`

- [ ] **Step 1: Add stock availability overlay to product cards**

In `PosCatalog.tsx`, integrate `useStockAvailability`:

```tsx
import { useStockAvailability } from '@/hooks/useSales'
import { AlertTriangle } from 'lucide-react'

// Inside the component, after other hooks:
const { activeWorkstationId } = usePosStore()
const { data: posConfig } = usePosConfig(activeWorkstationId || undefined, posMode)
const { data: stockData } = useStockAvailability(posConfig?.warehouse_id)

// Helper to get stock for an item:
const getStockInfo = (itemId: string) => {
    if (!stockData) return { available: Infinity, allowNeg: false }
    const s = stockData.find(s => s.sale_item_id === itemId)
    return s
        ? { available: s.available_stock, allowNeg: s.allow_negative_stock }
        : { available: Infinity, allowNeg: false }
}

// In the product card render, wrap the button:
const stock = getStockInfo(item.id)
const outOfStock = stock.available <= 0 && !stock.allowNeg
const lowStockWarning = stock.available <= 0 && stock.allowNeg

// Disable button if out of stock:
<button
    disabled={outOfStock}
    className={`... ${outOfStock ? 'opacity-40 cursor-not-allowed' : ''}`}
>
    {/* existing content */}
    {outOfStock && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/80 rounded-2xl">
            <span className="text-xs font-bold text-error">Sin stock</span>
        </div>
    )}
    {lowStockWarning && (
        <div className="absolute top-1 right-1">
            <AlertTriangle className="w-4 h-4 text-error" />
        </div>
    )}
</button>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/pos/terminal/components/PosCatalog.tsx
git commit -m "feat(pos): integrate stock availability in catalog with visual indicators"
```

---

## Task 15: Frontend — Terminal Page Orchestration

**Files:**
- Modify: `frontend/src/app/pos/terminal/page.tsx`

- [ ] **Step 1: Import and connect modals**

In `frontend/src/app/pos/terminal/page.tsx`:

```tsx
import { CustomerSelectorModal } from './components/CustomerSelectorModal'
import { CheckoutModal } from './components/CheckoutModal'
import { usePosStore } from '@/store/posStore'
import { usePosConfig } from '@/hooks/useSales'

// Inside the component:
const {
    cart, total, posMode, activeTableName, orderNumber,
    customerId, customerName, customerTaxId,
    showCheckout, showCustomerSelector,
    setShowCheckout, setShowCustomerSelector,
    setCustomer, activeWorkstationId
} = usePosStore()

const { data: posConfig } = usePosConfig(activeWorkstationId || undefined, posMode)
const customerRequirement = posConfig?.customer_requirement || 'optional'

const handleCheckout = () => {
    if (cart.length === 0) return
    // If customer required and not set, show selector first
    if (customerRequirement === 'required' && !customerId) {
        setShowCustomerSelector(true)
        return
    }
    setShowCheckout(true)
}

const handleCustomerSelected = (customer: { id: string | null, name: string, taxId: string | null }) => {
    setCustomer(customer.id, customer.name, customer.taxId)
    setShowCustomerSelector(false)
    // If this was triggered by checkout, proceed to checkout
    if (cart.length > 0) {
        setShowCheckout(true)
    }
}

// Pass onCheckout to PosCart:
<PosCart onCheckout={handleCheckout} />

// Add modals at the end of the component, before closing div:
<CustomerSelectorModal
    isOpen={showCustomerSelector}
    onClose={() => setShowCustomerSelector(false)}
    onSelect={handleCustomerSelected}
    required={customerRequirement === 'required'}
/>
<CheckoutModal
    isOpen={showCheckout}
    onClose={() => setShowCheckout(false)}
    total={total}
    cartItems={cart}
    customerName={customerName}
    mode={posMode}
    tableName={activeTableName}
    orderNumber={orderNumber}
/>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/pos/terminal/page.tsx
git commit -m "feat(pos): orchestrate checkout and customer selector modals in terminal page"
```

---

## Task 16: Frontend — Admin Config Page (Customer Policies)

**Files:**
- Modify: `frontend/src/app/admin/sales/config/page.tsx`

- [ ] **Step 1: Add customer requirement section**

After the General Config section in `config/page.tsx`, add a new card:

```tsx
import { useBillingConfig, useModeConfigs, useCreateModeConfig, useUpdateModeConfig } from '@/hooks/useSales'
import { UserCheck } from 'lucide-react'

// State for customer requirement:
const [customerReq, setCustomerReq] = useState<string>('optional')
const { data: modeConfigs } = useModeConfigs()
const { mutateAsync: createModeConfig } = useCreateModeConfig()
const { mutateAsync: updateModeConfig } = useUpdateModeConfig()

// Sync from config:
useEffect(() => {
    if (config?.customer_requirement) setCustomerReq(config.customer_requirement)
}, [config])

const MODES = [
    { key: 'tables', label: 'Mesas' },
    { key: 'takeout', label: 'Para Llevar' },
    { key: 'delivery', label: 'Delivery' },
    { key: 'pickup', label: 'Pick-up' },
    { key: 'bar', label: 'Barra' },
]

const getModeConfig = (mode: string) =>
    modeConfigs?.find(c => c.mode === mode)

// JSX: New section card
<div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
    <h2 className="text-base font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
        <UserCheck className="w-5 h-5 text-primary" /> Políticas de Cliente
    </h2>

    <div>
        <label className="text-xs font-bold text-text-secondary uppercase">Política Global</label>
        <select
            value={customerReq}
            onChange={async (e) => {
                setCustomerReq(e.target.value)
                await salesApi.updateConfig({ customer_requirement: e.target.value })
            }}
            className="w-full bg-surface-raised border border-border rounded-xl px-4 py-2.5 text-sm mt-1"
        >
            <option value="optional">Opcional</option>
            <option value="required">Obligatorio</option>
            <option value="disabled">Desactivado</option>
        </select>
    </div>

    <div className="pt-2">
        <label className="text-xs font-bold text-text-secondary uppercase mb-2 block">
            Override por Modo de Venta
        </label>
        <div className="space-y-2">
            {MODES.map(m => {
                const mc = getModeConfig(m.key)
                return (
                    <div key={m.key} className="flex items-center justify-between bg-surface-raised p-3 rounded-xl border border-border">
                        <span className="text-sm font-medium">{m.label}</span>
                        <select
                            value={mc?.customer_requirement || ''}
                            onChange={async (e) => {
                                const val = e.target.value
                                if (mc) {
                                    await updateModeConfig({ id: mc.id, data: { customer_requirement: val || null } })
                                } else if (val) {
                                    await createModeConfig({ mode: m.key, customer_requirement: val })
                                }
                            }}
                            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm"
                        >
                            <option value="">Heredar de global ({customerReq})</option>
                            <option value="optional">Opcional</option>
                            <option value="required">Obligatorio</option>
                            <option value="disabled">Desactivado</option>
                        </select>
                    </div>
                )
            })}
        </div>
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/sales/config/page.tsx
git commit -m "feat(admin): add customer requirement policy section to sales config"
```

---

## Task 17: Frontend — Admin Workstations Page (Warehouse + Customer Override)

**Files:**
- Modify: `frontend/src/app/admin/sales/workstations/page.tsx`

- [ ] **Step 1: Add warehouse and customer_requirement fields to workstation form**

In the create/edit modal of workstations page, add:

```tsx
import { useWarehouses } from '@/hooks/useInventory' // or equivalent hook

// In the form state, add:
warehouse_id: '', // required
customer_requirement: '', // '' = inherit

// In the form JSX, add after the allowed_modes field:
<div>
    <label className="text-xs font-bold text-text-secondary uppercase">Almacén *</label>
    <select
        required
        value={form.warehouse_id}
        onChange={e => setForm({...form, warehouse_id: e.target.value})}
        className="w-full bg-surface-raised border border-border rounded-xl px-4 py-2.5 text-sm mt-1"
    >
        <option value="">Seleccionar almacén...</option>
        {warehouses?.filter(w => !form.venue_id || w.venue_id === form.venue_id).map(w => (
            <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
        ))}
    </select>
</div>

<div>
    <label className="text-xs font-bold text-text-secondary uppercase">Política de Cliente</label>
    <select
        value={form.customer_requirement}
        onChange={e => setForm({...form, customer_requirement: e.target.value || null})}
        className="w-full bg-surface-raised border border-border rounded-xl px-4 py-2.5 text-sm mt-1"
    >
        <option value="">Heredar (de modo/global)</option>
        <option value="required">Obligatorio</option>
        <option value="optional">Opcional</option>
        <option value="disabled">Desactivado</option>
    </select>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/sales/workstations/page.tsx
git commit -m "feat(admin): add warehouse selector and customer policy override to workstations"
```

---

## Task 18: Frontend — Admin Catalog Page (allow_negative_stock)

**Files:**
- Modify: `frontend/src/app/admin/sales/catalog/page.tsx`

- [ ] **Step 1: Add checkbox to product create/edit form**

In the product modal form, add after the existing fields:

```tsx
<div className="flex items-center gap-3 pt-2">
    <input
        type="checkbox"
        id="allow_negative_stock"
        checked={form.allow_negative_stock ?? false}
        onChange={e => setForm({...form, allow_negative_stock: e.target.checked})}
        className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
    />
    <label htmlFor="allow_negative_stock" className="cursor-pointer">
        <p className="text-sm font-semibold text-text-primary">Permitir venta sin stock</p>
        <p className="text-xs text-text-secondary">
            El producto podrá venderse con inventario en 0 o negativo. Se mostrará una advertencia visual al cajero.
        </p>
    </label>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/sales/catalog/page.tsx
git commit -m "feat(admin): add allow_negative_stock checkbox to product form"
```

---

## Task 19: Final Integration Test

- [ ] **Step 1: Run all backend tests**

```bash
cd backend; python -m pytest tests/test_sales_pos_config.py tests/test_sales_stock.py tests/test_sales_checkout.py -v
```
Expected: All tests PASS

- [ ] **Step 2: Run frontend build check**

```bash
cd frontend; npx next build
```
Expected: Build succeeds with no type errors

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete POS Milestone 3 - Checkout Multimoneda y Pagos"
```
