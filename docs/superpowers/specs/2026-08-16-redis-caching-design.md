# Redis Caching Design — VERUM

**Date:** 2026-08-16  
**Status:** Approved  

---

## 1. Problem Statement

VERUM's backend communicates with the database exclusively through the Supabase Python SDK (PostgREST), meaning every `.execute()` call is an **HTTP round-trip** (30–100ms on cloud). The RBAC/permission system alone executes **4 to 9 HTTP calls** before endpoint logic even begins. Heavy endpoints like inventory snapshot iterate over thousands of rows in Python memory. High-frequency polling screens (KDS, live attendance) compound this latency.

Redis caching addresses all of these by storing computed results in memory, eliminating redundant HTTP calls and recalculations.

## 2. Design Constraints

- **Redis is optional.** If the `REDIS_URL` environment variable is not set, or Redis becomes unreachable at runtime, the system operates identically to today — zero errors, zero degradation. Logs inform at startup.
- **Infrastructure:** Render Redis free tier (25MB memory, 50 connections). Estimated usage: 10–20MB across all 4 phases.
- **Eviction policy:** `allkeys-lru` — Redis auto-evicts least-recently-used keys if memory fills up.
- **Serialization:** `orjson` for speed and compactness (~6x faster than `json.dumps`, native Pydantic support).

## 3. Architecture

### 3.1 CacheManager (Singleton)

New module: `backend/app/cache.py`

```
CacheManager
├── init(redis_url: str | None)        → Async Redis connection or no-op mode
├── get(key: str) -> dict | None       → Deserialize from cache, increment hit/miss counter
├── set(key: str, data, ttl: int)      → Serialize and store with TTL
├── delete(key: str)                   → Remove specific key
├── delete_pattern(pattern: str)       → SCAN + DEL (non-blocking, never uses KEYS)
├── health() -> dict                   → Connection status + hit/miss metrics
└── close()                            → Graceful shutdown
```

**No-op mode:** When `REDIS_URL` is absent, `CacheManager` initializes as a pass-through:
- `get()` always returns `None`
- `set()` and `delete()` do nothing
- `health()` returns `{"connected": false, "url_configured": false}`

This eliminates the need for any `if redis_enabled:` checks in endpoint code.

### 3.2 Key Format

```
v{version}:{module}:{entity}:{identifiers}
```

- **version**: Integer per module, stored as constants in `cache.py`. Bumping the version instantly orphans all old keys for that module (they expire via TTL or LRU eviction).
- **module**: Namespace (`auth`, `rbac`, `catalog`, `inv`, `admin`, `supplier`, `kds`, `attendance`, `recipes`)
- **entity**: What's cached (`user`, `context`, `perms`, `snapshot`, `valuation`, etc.)
- **identifiers**: Org ID, warehouse ID, date, user ID, etc.

Example keys:
- `v1:auth:user:sha256_abc123`
- `v1:rbac:perms:org-uuid:profile-uuid`
- `v1:inv:snapshot:org-uuid:wh-uuid:2026-08-16:peps`
- `v1:catalog:items:org-uuid`

### 3.3 Invalidation Strategy

**Three layers, in order of priority:**

1. **Explicit invalidation (primary):** Write endpoints (POST/PUT/PATCH/DELETE) call invalidation helpers after successful mutations. This ensures data freshness on every write.
2. **TTL expiration (safety net):** Every key has a TTL. If an invalidation call is missed or fails, the stale data self-expires.
3. **Version bumping (emergency/migration):** Incrementing a module's version constant orphans all existing keys for that module without touching Redis.

### 3.4 Invalidation Helpers

Grouped by module in `backend/app/cache.py` to avoid string duplication:

```python
async def invalidate_auth_user(token_hash: str):
    await cache.delete(f"auth:user:{token_hash}")

async def invalidate_user_rbac(org_id: str, profile_id: str):
    await cache.delete(f"rbac:context:{org_id}:{profile_id}")
    await cache.delete(f"rbac:perms:{org_id}:{profile_id}")

async def invalidate_rbac_catalog(org_id: str):
    await cache.delete(f"rbac:catalog:perms:{org_id}")

async def invalidate_inventory(org_id: str, wh_id: str = "*"):
    await cache.delete_pattern(f"inv:snapshot:{org_id}:{wh_id}:*")
    await cache.delete_pattern(f"inv:valuation:{org_id}:{wh_id}")
    await cache.delete_pattern(f"inv:alerts:{org_id}:{wh_id}")

async def invalidate_catalog_items(org_id: str):
    await cache.delete(f"catalog:items:{org_id}")

async def invalidate_catalog_uom(org_id: str):
    await cache.delete(f"catalog:uom:{org_id}")

async def invalidate_catalog_warehouses(org_id: str):
    await cache.delete(f"catalog:warehouses:{org_id}")

async def invalidate_checklist_templates(venue_id: str):
    await cache.delete(f"catalog:templates:{venue_id}")

async def invalidate_admin_summary(org_id: str):
    await cache.delete_pattern(f"admin:summary:{org_id}:*")

async def invalidate_supplier_metrics(org_id: str, supplier_id: str):
    await cache.delete(f"supplier:metrics:{org_id}:{supplier_id}")

async def invalidate_kds(org_id: str, wh_id: str):
    await cache.delete(f"kds:orders:{org_id}:{wh_id}")

async def invalidate_attendance(venue_id: str, date: str):
    await cache.delete(f"attendance:live:{venue_id}:{date}")

async def invalidate_recipes(org_id: str):
    await cache.delete(f"recipes:graph:{org_id}")
```

### 3.5 Integration Pattern

**Reading (caching):** Inline in endpoint functions. No decorators.

```python
async def get_inventory_snapshot(org_id, wh_id, date, method, ...):
    cache_key = f"inv:snapshot:{org_id}:{wh_id}:{date}:{method}"
    
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    # ... existing computation logic unchanged ...
    
    ttl = 86400 if date < today else 60  # past dates are immutable
    await cache.set(cache_key, result, ttl=ttl)
    return result
```

**Writing (invalidation):** Appended at the end of successful write operations.

```python
async def process_inventory_document(org_id, ...):
    # ... existing processing logic unchanged ...
    
    await invalidate_inventory(org_id)
```

### 3.6 Graceful Degradation

- **Startup without `REDIS_URL`:** CacheManager enters no-op mode. Log: `"INFO: REDIS_URL not configured. Running without cache."`
- **Startup with bad `REDIS_URL`:** Connection attempt fails. CacheManager enters no-op mode. Log: `"WARNING: Could not connect to Redis at {url}. Running without cache."`
- **Runtime disconnection:** All cache operations are wrapped in try/except. On failure, the operation is skipped (get returns None, set/delete are no-ops), a warning is logged, and the request proceeds normally hitting the database directly. No retry loops.

## 4. Implementation Phases

### Phase 1: Auth & RBAC Cache

**Impact:** Eliminates 4–9 HTTP calls on every authenticated request across the entire system.

| Key | Data | TTL | Invalidation Trigger |
|---|---|---|---|
| `v1:auth:user:{token_hash}` | Supabase `get_user()` result | 5 min | Logout, token expiry |
| `v1:rbac:context:{org}:{profile}` | `{is_superadmin, role_id, is_admin}` | 10 min | Admin changes user's role |
| `v1:rbac:perms:{org}:{profile}` | Set of resolved permission keys | 10 min | Role permissions or profile overrides edited |
| `v1:rbac:catalog:perms:{org}` | Dict `{permission_key: id}` | 1 hour | Admin adds/modifies permission catalog |

**Files modified:**
- `backend/app/cache.py` — New file (CacheManager + helpers)
- `backend/config.py` — Add `REDIS_URL` setting
- `backend/requirements.txt` — Add `redis>=5.0.0`, `orjson>=3.9.0`
- `backend/auth_deps.py` — Cache `get_user()` result by token hash
- `backend/app/deps.py` — Cache org resolution and permission checks
- `backend/permissions.py` — Cache `get_user_permission_context()` and `resolve_permission()`
- `backend/app/admin/router.py` — Add invalidation calls to user role/permission update endpoints
- `backend/app/auth/router.py` — Add invalidation on logout
- `backend/main.py` — Initialize CacheManager on startup, register `/health` endpoint

### Phase 2: Static Catalogs Cache

**Impact:** Eliminates repeated catalog queries (items, UOMs, warehouses, checklist templates).

| Key | Data | TTL | Invalidation Trigger |
|---|---|---|---|
| `v1:catalog:items:{org}` | Active items + UOM + taxes | 15 min | CRUD on items |
| `v1:catalog:uom:{org}` | UOM presentations + conversion factors | 30 min | CRUD on presentations |
| `v1:catalog:warehouses:{org}` | Warehouse list | 30 min | CRUD on warehouses |
| `v1:catalog:templates:{venue}` | Checklist templates + questions | 10 min | Admin edits templates/questions |

**Files modified:**
- `backend/app/production/router.py` — Cache item list and warehouse list endpoints; add invalidation to item/warehouse CRUD
- `backend/app/catering/router.py` — Cache UOM presentations; add invalidation to presentation CRUD
- `backend/app/checklists/router.py` — Cache templates per venue; add invalidation to template/question CRUD

### Phase 3: Heavy Aggregations Cache

**Impact:** Caches expensive multi-query, multi-iteration computations.

| Key | Data | TTL | Invalidation Trigger |
|---|---|---|---|
| `v1:inv:snapshot:{org}:{wh}:{date}:{method}` | Calculated snapshot | Past: 24h, Today: 60s | Stock movement recorded |
| `v1:inv:valuation:{org}:{wh}` | Lot-level valuation breakdown | 3 min | Receipt/issue processed |
| `v1:inv:alerts:{org}:{wh}` | Low stock alerts | 60s | Stock movement |
| `v1:admin:summary:{org}:{venue}` | Admin dashboard (7 queries aggregated) | 30s | Periodic TTL refresh |
| `v1:supplier:metrics:{org}:{supplier}` | On-time %, accuracy %, return rate | 15 min | Receipt/return processed |
| `v1:recipes:graph:{org}` | Full recipe tree + ingredients | 24h | CRUD on recipes/ingredients |

**Files modified:**
- `backend/app/production/router.py` — Cache snapshot, valuation, low-stock alerts; invalidation in `process_inventory_document`, stock movement creation, physical inventory processing
- `backend/app/admin/router.py` — Cache admin summary
- `backend/app/purchasing/router.py` — Cache supplier metrics; invalidation in receipt/return processing
- `backend/app/catering/router.py` — Cache recipe graph; invalidation in recipe/ingredient CRUD

### Phase 4: High-Frequency Polling Cache

**Impact:** Reduces DB load from screens that poll every few seconds.

| Key | Data | TTL | Invalidation Trigger |
|---|---|---|---|
| `v1:kds:orders:{org}:{wh}` | Active kitchen orders | 1 min | Order created/updated/completed |
| `v1:attendance:live:{venue}:{date}` | Active on-duty staff | 15s | Attendance mark event |

**Files modified:**
- `backend/app/catering/router.py` — Cache KDS orders; invalidation on order status change
- `backend/app/attendance/router.py` — Cache live attendance; invalidation on attendance mark

## 5. Health & Metrics Endpoint

**`GET /health`** — No authentication required.

When Redis is connected:
```json
{
  "status": "ok",
  "redis": {
    "connected": true,
    "url_configured": true,
    "memory_used": "8.3MB",
    "memory_max": "25MB",
    "uptime_seconds": 86420,
    "stats": {
      "total_hits": 14520,
      "total_misses": 1830,
      "hit_rate": "88.8%",
      "active_keys": 347
    }
  }
}
```

When Redis is not configured:
```json
{
  "status": "ok",
  "redis": {
    "connected": false,
    "url_configured": false,
    "message": "Redis not configured. Running without cache."
  }
}
```

Hit/miss counters are in-memory in the CacheManager (not stored in Redis). They reset on process restart, which is acceptable — they serve to validate cache effectiveness at a given moment.

## 6. Dependencies

| Package | Version | Purpose |
|---|---|---|
| `redis` | >=5.0.0 | Async Redis client (`redis.asyncio`) |
| `orjson` | >=3.9.0 | Fast JSON serialization (6x faster than stdlib) |

## 7. Configuration

New environment variable in `backend/config.py`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_URL` | No | `None` | Redis connection URL. When absent, cache operates in no-op mode. Example: `redis://red-xxxxx:6379` |

## 8. Memory Budget (Render Free Tier — 25MB)

| Phase | Estimated Usage | Notes |
|---|---|---|
| Phase 1 (Auth/RBAC) | 1–3 MB | Proportional to concurrent active users |
| Phase 2 (Catalogs) | 2–5 MB | Proportional to item catalog size |
| Phase 3 (Aggregations) | 5–10 MB | Snapshots are the heaviest payloads |
| Phase 4 (Polling) | 1–2 MB | Few keys, short TTLs |
| **Total** | **~10–20 MB** | Fits within 25MB with margin |

With `allkeys-lru` eviction, if memory fills up, Redis automatically removes the least-recently-used keys. No manual memory management needed.

## 9. Testing Strategy

- **Unit tests for CacheManager:** Test no-op mode, get/set/delete, TTL expiry, delete_pattern, health output.
- **Integration tests:** Verify that endpoints return cached data on second call, that invalidation helpers clear the right keys, and that write endpoints trigger correct invalidation.
- **No-op mode test:** Run the full test suite without `REDIS_URL` set to confirm zero regressions.
