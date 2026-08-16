# Redis Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Redis caching to the VERUM backend to eliminate redundant Supabase HTTP calls, cache expensive computations, and reduce load from high-frequency polling endpoints.

**Architecture:** A `CacheManager` singleton in `backend/app/cache.py` wraps `redis.asyncio` with a no-op fallback when `REDIS_URL` is unset. Inline `cache.get()`/`cache.set()` calls in endpoints, with grouped invalidation helpers called from write endpoints. A `/health` endpoint exposes connection status and hit/miss metrics.

**Tech Stack:** Python `redis>=5.0.0` (async client), `orjson>=3.9.0` (fast serialization), existing FastAPI + Supabase stack.

**Spec:** `docs/superpowers/specs/2026-08-16-redis-caching-design.md`

---

## Phase 1: Foundation + Auth/RBAC Caching

### Task 1: Add Dependencies and Configuration

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/config.py`

- [ ] **Step 1: Add redis and orjson to requirements.txt**

Add the two new packages under a new "Caching" section:

```text
# Caching (optional)
redis>=5.0.0
orjson>=3.9.0
```

Insert after the `# Utils` section (after line 13) in `backend/requirements.txt`.

- [ ] **Step 2: Add REDIS_URL to config.py**

Modify `backend/config.py` to add an optional `REDIS_URL` field:

```python
import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    REDIS_URL: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

settings = Settings()
```

- [ ] **Step 3: Install new dependencies**

Run:
```bash
cd backend
pip install redis>=5.0.0 orjson>=3.9.0
```

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/config.py
git commit -m "chore: add redis and orjson dependencies, REDIS_URL config"
```

---

### Task 2: Create CacheManager Core Module

**Files:**
- Create: `backend/app/cache.py`

This is the central module. It implements the `CacheManager` class with no-op fallback, versioned keys, hit/miss tracking, and all invalidation helpers.

- [ ] **Step 1: Create `backend/app/cache.py` with the full CacheManager**

```python
"""
VERUM Cache Module
------------------
Optional Redis caching layer. When REDIS_URL is not configured,
all operations are no-ops — the system works identically to before.

Usage:
    from app.cache import cache
    
    # In an endpoint:
    cached = await cache.get("inv:snapshot:org1:wh1:2026-08-16:peps")
    if cached:
        return cached
    result = compute_expensive_thing()
    await cache.set("inv:snapshot:org1:wh1:2026-08-16:peps", result, ttl=60)
    return result
    
    # Invalidation (from a write endpoint):
    await invalidate_inventory(org_id)
"""

import hashlib
import logging
from typing import Any, Optional

import orjson

logger = logging.getLogger("verum.cache")

# ── Module Version Constants (per-module) ──────────────────────────
# Bump a version to instantly orphan all cached keys for that module.
# Old keys expire naturally via TTL or LRU eviction.
VERSIONS = {
    "auth": 1,
    "rbac": 1,
    "catalog": 1,
    "inv": 1,
    "admin": 1,
    "supplier": 1,
    "kds": 1,
    "attendance": 1,
    "recipes": 1,
}


class CacheManager:
    """
    Async Redis cache with transparent no-op fallback.
    
    When Redis is not configured or unreachable, all methods
    silently return None / do nothing. Zero impact on callers.
    """

    def __init__(self):
        self._redis = None
        self._enabled = False
        self._hits = 0
        self._misses = 0

    async def init(self, redis_url: Optional[str] = None):
        """
        Initialize Redis connection. Call once at app startup.
        If redis_url is None or connection fails, enters no-op mode.
        """
        if not redis_url:
            logger.info("REDIS_URL not configured. Running without cache.")
            return

        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                redis_url,
                decode_responses=False,  # we handle bytes via orjson
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
            )
            # Test connection
            await self._redis.ping()
            self._enabled = True
            logger.info(f"Redis cache connected successfully.")
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}. Running without cache.")
            self._redis = None
            self._enabled = False

    def _make_key(self, raw_key: str) -> str:
        """Prepend version prefix based on the module namespace."""
        module = raw_key.split(":")[0]
        version = VERSIONS.get(module, 1)
        return f"v{version}:{raw_key}"

    async def get(self, raw_key: str) -> Optional[Any]:
        """Get a value from cache. Returns None on miss or if disabled."""
        if not self._enabled:
            return None
        try:
            key = self._make_key(raw_key)
            data = await self._redis.get(key)
            if data is not None:
                self._hits += 1
                return orjson.loads(data)
            self._misses += 1
            return None
        except Exception as e:
            logger.warning(f"Cache GET error for '{raw_key}': {e}")
            self._misses += 1
            return None

    async def set(self, raw_key: str, value: Any, ttl: int = 60) -> None:
        """Store a value in cache with TTL (seconds). No-op if disabled."""
        if not self._enabled:
            return
        try:
            key = self._make_key(raw_key)
            serialized = orjson.dumps(value)
            await self._redis.setex(key, ttl, serialized)
        except Exception as e:
            logger.warning(f"Cache SET error for '{raw_key}': {e}")

    async def delete(self, raw_key: str) -> None:
        """Delete a specific key. No-op if disabled."""
        if not self._enabled:
            return
        try:
            key = self._make_key(raw_key)
            await self._redis.delete(key)
        except Exception as e:
            logger.warning(f"Cache DELETE error for '{raw_key}': {e}")

    async def delete_pattern(self, raw_pattern: str) -> None:
        """
        Delete all keys matching a pattern using SCAN (non-blocking).
        Never uses KEYS command to avoid blocking Redis.
        """
        if not self._enabled:
            return
        try:
            pattern = self._make_key(raw_pattern)
            cursor = 0
            while True:
                cursor, keys = await self._redis.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    await self._redis.delete(*keys)
                if cursor == 0:
                    break
        except Exception as e:
            logger.warning(f"Cache DELETE_PATTERN error for '{raw_pattern}': {e}")

    async def health(self) -> dict:
        """Return cache health status and metrics."""
        if not self._enabled:
            return {
                "connected": False,
                "url_configured": self._redis is not None,
                "message": "Redis not configured. Running without cache."
            }
        try:
            info = await self._redis.info("memory")
            dbsize = await self._redis.dbsize()
            total = self._hits + self._misses
            hit_rate = f"{(self._hits / total * 100):.1f}%" if total > 0 else "N/A"
            return {
                "connected": True,
                "url_configured": True,
                "memory_used": info.get("used_memory_human", "unknown"),
                "memory_max": info.get("maxmemory_human", "unknown"),
                "uptime_seconds": (await self._redis.info("server")).get("uptime_in_seconds", 0),
                "stats": {
                    "total_hits": self._hits,
                    "total_misses": self._misses,
                    "hit_rate": hit_rate,
                    "active_keys": dbsize,
                }
            }
        except Exception as e:
            return {
                "connected": False,
                "url_configured": True,
                "message": f"Redis health check failed: {e}"
            }

    async def close(self):
        """Graceful shutdown."""
        if self._redis:
            await self._redis.close()


# ── Singleton ──────────────────────────────────────────────────────
cache = CacheManager()


# ── Token Hashing Helper ──────────────────────────────────────────
def hash_token(token: str) -> str:
    """Create a short SHA-256 hash of a bearer token for use as cache key."""
    return hashlib.sha256(token.encode()).hexdigest()[:16]


# ── Invalidation Helpers ──────────────────────────────────────────
# Grouped by module. Called from write endpoints after successful mutations.

async def invalidate_auth_user(token_hash: str):
    """Invalidate cached auth token validation."""
    await cache.delete(f"auth:user:{token_hash}")

async def invalidate_user_rbac(org_id: str, profile_id: str):
    """Invalidate cached RBAC context and resolved permissions for a user."""
    await cache.delete(f"rbac:context:{org_id}:{profile_id}")
    await cache.delete(f"rbac:perms:{org_id}:{profile_id}")

async def invalidate_rbac_catalog(org_id: str):
    """Invalidate cached permission catalog."""
    await cache.delete(f"rbac:catalog:perms:{org_id}")

async def invalidate_inventory(org_id: str, wh_id: str = "*"):
    """Invalidate inventory snapshot, valuation, and alert caches."""
    await cache.delete_pattern(f"inv:snapshot:{org_id}:{wh_id}:*")
    await cache.delete_pattern(f"inv:valuation:{org_id}:{wh_id}")
    await cache.delete_pattern(f"inv:alerts:{org_id}:{wh_id}")

async def invalidate_catalog_items(org_id: str):
    """Invalidate cached item catalog."""
    await cache.delete(f"catalog:items:{org_id}")

async def invalidate_catalog_uom(org_id: str):
    """Invalidate cached UOM presentations."""
    await cache.delete(f"catalog:uom:{org_id}")

async def invalidate_catalog_warehouses(org_id: str):
    """Invalidate cached warehouse list."""
    await cache.delete(f"catalog:warehouses:{org_id}")

async def invalidate_checklist_templates(venue_id: str):
    """Invalidate cached checklist templates for a venue."""
    await cache.delete(f"catalog:templates:{venue_id}")

async def invalidate_admin_summary(org_id: str):
    """Invalidate cached admin dashboard summary."""
    await cache.delete_pattern(f"admin:summary:{org_id}:*")

async def invalidate_supplier_metrics(org_id: str, supplier_id: str):
    """Invalidate cached supplier performance metrics."""
    await cache.delete(f"supplier:metrics:{org_id}:{supplier_id}")

async def invalidate_kds(org_id: str, wh_id: str):
    """Invalidate cached KDS kitchen orders."""
    await cache.delete(f"kds:orders:{org_id}:{wh_id}")

async def invalidate_attendance(venue_id: str, date: str):
    """Invalidate cached live attendance data."""
    await cache.delete(f"attendance:live:{venue_id}:{date}")

async def invalidate_recipes(org_id: str):
    """Invalidate cached recipe graph."""
    await cache.delete(f"recipes:graph:{org_id}")
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/cache.py
git commit -m "feat(cache): add CacheManager with no-op fallback and invalidation helpers"
```

---

### Task 3: App Startup Integration and /health Endpoint

**Files:**
- Modify: `backend/app/__init__.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Add cache initialization and /health to `backend/app/__init__.py`**

Add the cache import and lifecycle events to `create_app()`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager

from app.cache import cache
from config import settings
from app.purchasing.router import router as purchasing_router
from app.transfers.router import router as transfers_router
from app.catering.router import router as catering_router
from app.superadmin.router import router as superadmin_router
from app.inventory.router import router as inventory_router
from app.production.router import router as production_router
from app.attendance.router import router as attendance_router
from app.admin.router import router as admin_router
from app.checklists.router import router as checklists_router
from app.auth.router import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await cache.init(settings.REDIS_URL)
    yield
    # Shutdown
    await cache.close()


def create_app() -> FastAPI:
    app = FastAPI(title="VERUM API", lifespan=lifespan)

    # CORS for frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:3001", "https://verum-eta.vercel.app"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # GZip compression
    app.add_middleware(GZipMiddleware, minimum_size=500)

    # Health endpoint (no auth required)
    @app.get("/health")
    async def health_check():
        redis_health = await cache.health()
        return {"status": "ok", "redis": redis_health}

    # Register routers
    app.include_router(purchasing_router)
    app.include_router(transfers_router)
    app.include_router(catering_router)
    app.include_router(superadmin_router)
    app.include_router(inventory_router)
    app.include_router(production_router)
    app.include_router(attendance_router)
    app.include_router(admin_router)
    app.include_router(checklists_router)
    app.include_router(auth_router)

    return app
```

- [ ] **Step 2: Verify the app starts without REDIS_URL**

Run (without REDIS_URL in `.env`):
```bash
cd backend
python -c "from app import create_app; print('App factory OK')"
```
Expected: prints "App factory OK" with no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/app/__init__.py
git commit -m "feat(cache): integrate cache lifecycle and /health endpoint in app factory"
```

---

### Task 4: Cache Auth Token Validation

**Files:**
- Modify: `backend/auth_deps.py`

The `get_current_user` function calls `supabase.auth.get_user(token)` on every request. Cache the result keyed by a SHA-256 hash of the token.

- [ ] **Step 1: Add caching to `get_current_user` in `backend/auth_deps.py`**

Replace the full file content with:

```python
# backend/auth_deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import supabase
from app.cache import cache, hash_token

security = HTTPBearer()

AUTH_TOKEN_TTL = 300  # 5 minutes

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    token_hash = hash_token(token)

    # 1. Check cache first
    cached_user = await cache.get(f"auth:user:{token_hash}")
    if cached_user:
        # Reconstruct a minimal user-like object from cached dict
        from types import SimpleNamespace
        user = SimpleNamespace(**cached_user)
        return user

    # 2. Cache miss — call Supabase
    try:
        res = supabase.auth.get_user(token)
        if res and res.user:
            # Cache the user attributes we need downstream
            user_data = {
                "id": res.user.id,
                "email": res.user.email,
                "user_metadata": res.user.user_metadata if hasattr(res.user, 'user_metadata') else {},
            }
            await cache.set(f"auth:user:{token_hash}", user_data, ttl=AUTH_TOKEN_TTL)
            return res.user
        else:
            print("Auth error: No user returned from Supabase")
            raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Authentication exception: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
```

> **Note:** We cache a plain dict `{id, email, user_metadata}` because the Supabase `User` object is not JSON-serializable. Downstream code only accesses `.id` and occasionally `.email`, so a `SimpleNamespace` reconstruction is sufficient. If any downstream code accesses other `User` attributes, those should be added to `user_data`.

- [ ] **Step 2: Commit**

```bash
git add backend/auth_deps.py
git commit -m "feat(cache): cache auth token validation (5min TTL)"
```

---

### Task 5: Cache RBAC Permission Context

**Files:**
- Modify: `backend/permissions.py`

Cache `get_user_permission_context()` and the permission catalog lookups in `resolve_permission()` and `check_restriction()`.

- [ ] **Step 1: Add caching to `get_user_permission_context`**

At the top of `backend/permissions.py`, add the cache import:

```python
from app.cache import cache
```

Then wrap `get_user_permission_context` (currently lines 19–56):

```python
RBAC_CONTEXT_TTL = 600  # 10 minutes
RBAC_PERM_CATALOG_TTL = 3600  # 1 hour

async def get_user_permission_context(profile_id: str, db, org_id: str = None) -> dict:
    """
    Fetches user's permission context in minimal queries.
    Returns: { "is_superadmin": bool, "role_id": str|None, "is_admin": bool }
    """
    # Check cache
    if org_id:
        cache_key = f"rbac:context:{org_id}:{profile_id}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

    # 0. Check global super admin
    profile_res = db.table('profiles').select('is_superadmin').eq('id', profile_id).execute()
    is_superadmin = profile_res.data[0].get('is_superadmin', False) if profile_res.data else False

    if is_superadmin:
        result = {"is_superadmin": True, "role_id": None, "is_admin": True}
        if org_id:
            await cache.set(cache_key, result, ttl=RBAC_CONTEXT_TTL)
        return result

    # 1. Fetch user's organization-specific role
    role_id = None
    is_admin = False

    if org_id:
        po_res = db.table('profile_organizations').select('role_id, custom_roles(is_admin)').eq('profile_id', profile_id).eq('organization_id', org_id).execute()
        if po_res.data:
            role_id = po_res.data[0].get('role_id')
            custom_roles = po_res.data[0].get('custom_roles')
            if custom_roles:
                is_admin = custom_roles.get('is_admin') is True
    
    # Fallback to legacy profile_roles if no org_id or no record in profile_organizations
    if not role_id:
        role_res = db.table('profile_roles').select('role_id, custom_roles(is_admin)').eq('profile_id', profile_id).execute()
        if role_res.data:
            role_id = role_res.data[0].get('role_id')
            custom_roles = role_res.data[0].get('custom_roles')
            if custom_roles:
                is_admin = custom_roles.get('is_admin') is True

    result = {
        "is_superadmin": False,
        "role_id": role_id,
        "is_admin": is_admin
    }
    
    if org_id:
        await cache.set(cache_key, result, ttl=RBAC_CONTEXT_TTL)
    
    return result
```

- [ ] **Step 2: Cache permission ID lookups in `resolve_permission`**

The `resolve_permission` function (line 58) queries `permissions.select('id').eq('key', ...)` every time. Cache the permission catalog per org:

```python
async def _get_permission_id(permission_key: str, db, org_id: str = None) -> str | None:
    """Get permission ID from key, using cached catalog when available."""
    catalog_key = f"rbac:catalog:perms:{org_id or 'global'}"
    catalog = await cache.get(catalog_key)
    
    if catalog is None:
        # Fetch full catalog and cache it
        all_perms = db.table('permissions').select('id, key').execute()
        if all_perms.data:
            catalog = {p['key']: p['id'] for p in all_perms.data}
            await cache.set(catalog_key, catalog, ttl=RBAC_PERM_CATALOG_TTL)
        else:
            return None
    
    return catalog.get(permission_key)
```

Then update `resolve_permission` to use `_get_permission_id`:

```python
async def resolve_permission(profile_id: str, permission_key: str, db, org_id: str = None, perm_context: dict = None) -> bool:
    if perm_context is None:
        perm_context = await get_user_permission_context(profile_id, db, org_id)

    if perm_context["is_superadmin"] or perm_context["is_admin"]:
        return True

    role_id = perm_context["role_id"]

    # Fetch permission id (cached)
    perm_id = await _get_permission_id(permission_key, db, org_id)
    if not perm_id:
        return False

    # 2. Check individual override
    override_res = db.table('profile_permission_overrides').select('granted').eq('profile_id', profile_id).eq('permission_id', perm_id).execute()
    if override_res.data and len(override_res.data) > 0:
        return override_res.data[0]['granted']

    # 3. Check role permissions
    if role_id:
        rp_res = db.table('role_permissions').select('permission_id').eq('role_id', role_id).eq('permission_id', perm_id).execute()
        if rp_res.data and len(rp_res.data) > 0:
            return True

    return False
```

- [ ] **Step 3: Update `check_restriction` to use `_get_permission_id`**

```python
async def check_restriction(profile_id: str, permission_key: str, db, org_id: str = None, perm_context: dict = None) -> bool:
    """ Checks for a permission without admin bypass. Useful for toggleable restrictions. """
    if perm_context is None:
        perm_context = await get_user_permission_context(profile_id, db, org_id)

    role_id = perm_context["role_id"]

    # Fetch permission id (cached)
    perm_id = await _get_permission_id(permission_key, db, org_id)
    if not perm_id:
        return False

    # 1. Check individual override
    override_res = db.table('profile_permission_overrides').select('granted').eq('profile_id', profile_id).eq('permission_id', perm_id).execute()
    if override_res.data and len(override_res.data) > 0:
        return override_res.data[0]['granted']

    # 2. Check role permissions
    if role_id:
        rp_res = db.table('role_permissions').select('permission_id').eq('role_id', role_id).eq('permission_id', perm_id).execute()
        if rp_res.data and len(rp_res.data) > 0:
            return True

    return False
```

- [ ] **Step 4: Update `get_user_permissions` to use the cached catalog**

```python
async def get_user_permissions(profile_id: str, db, org_id: str = None) -> list[str]:
    """
    Returns the list of all permission keys that the user has.
    """
    perm_context = await get_user_permission_context(profile_id, db, org_id)
    
    # Fetch all permissions from the catalog (cached)
    catalog_key = f"rbac:catalog:perms:{org_id or 'global'}"
    catalog = await cache.get(catalog_key)
    
    if catalog is None:
        all_perms_res = db.table('permissions').select('id, key').execute()
        if not all_perms_res.data:
            return []
        catalog = {p['key']: p['id'] for p in all_perms_res.data}
        await cache.set(catalog_key, catalog, ttl=RBAC_PERM_CATALOG_TTL)
    
    # If the user is super admin or admin, they have all permissions
    if perm_context["is_superadmin"] or perm_context["is_admin"]:
        return list(catalog.keys())
        
    role_id = perm_context["role_id"]
    
    # Reverse map: id -> key
    id_to_key = {v: k for k, v in catalog.items()}
    
    granted_perm_ids = set()
    
    # 1. Add permissions from the role
    if role_id:
        rp_res = db.table('role_permissions').select('permission_id').eq('role_id', role_id).execute()
        if rp_res.data:
            for rp in rp_res.data:
                granted_perm_ids.add(rp['permission_id'])
                
    # 2. Apply individual overrides
    override_res = db.table('profile_permission_overrides').select('permission_id, granted').eq('profile_id', profile_id).execute()
    if override_res.data:
        for override in override_res.data:
            p_id = override['permission_id']
            if override['granted']:
                granted_perm_ids.add(p_id)
            else:
                granted_perm_ids.discard(p_id)
                
    # Map back to keys
    return [id_to_key[p_id] for p_id in granted_perm_ids if p_id in id_to_key]
```

- [ ] **Step 5: Commit**

```bash
git add backend/permissions.py
git commit -m "feat(cache): cache RBAC context, permission catalog, and resolution"
```

---

### Task 6: Add RBAC Invalidation Hooks to Admin Endpoints

**Files:**
- Modify: `backend/app/admin/router.py` — find endpoints that change user roles or permissions

The admin router contains endpoints for:
- Assigning/changing user roles → invalidate `rbac:context` and `rbac:perms`
- Editing role permissions → invalidate `rbac:perms` for affected users
- Editing profile permission overrides → invalidate `rbac:perms`

- [ ] **Step 1: Add cache import to `backend/app/admin/router.py`**

Add at the top imports:

```python
from app.cache import invalidate_user_rbac, invalidate_rbac_catalog
```

- [ ] **Step 2: Find and add invalidation to role assignment endpoints**

Search `backend/app/admin/router.py` for endpoints that modify `profile_organizations.role_id`, `role_permissions`, or `profile_permission_overrides`. At the end of each such endpoint (after the successful DB mutation), add:

For user role changes (where you have `profile_id` and `org_id`):
```python
await invalidate_user_rbac(org_id, profile_id)
```

For role permission edits (where all users with that role are affected):
```python
# When role permissions change, we need to invalidate all users with that role.
# Since we can't efficiently enumerate them, invalidate the catalog and rely on TTL
# for individual user permission caches.
await invalidate_rbac_catalog(org_id)
```

For profile permission override edits:
```python
await invalidate_user_rbac(org_id, profile_id)
```

> **Note:** The exact function names and line numbers depend on the admin router's structure. Search for `profile_organizations`, `role_permissions`, and `profile_permission_overrides` table mutations in the file.

- [ ] **Step 3: Commit**

```bash
git add backend/app/admin/router.py
git commit -m "feat(cache): add RBAC invalidation hooks to admin role/permission endpoints"
```

---

### Task 7: Verify Phase 1 End-to-End

**Files:** None (verification only)

- [ ] **Step 1: Run app without REDIS_URL to verify no-op mode**

Ensure `.env` does NOT have `REDIS_URL`. Start the server:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Hit the health endpoint:
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status": "ok", "redis": {"connected": false, "url_configured": false, "message": "Redis not configured. Running without cache."}}
```

Verify normal API calls still work (login, fetch items, etc.).

- [ ] **Step 2: Run existing tests to verify no regressions**

```bash
cd backend
pytest -x -q
```

Expected: All existing tests pass (since Redis is not configured during tests, CacheManager is in no-op mode).

- [ ] **Step 3: Test with Redis (if available locally)**

If you have Docker:
```bash
docker run -d --name verum-redis -p 6379:6379 redis:7-alpine
```

Add to `.env`:
```
REDIS_URL=redis://localhost:6379/0
```

Restart the server and hit `/health` again:
```bash
curl http://localhost:8000/health
```

Expected: `"connected": true` with memory stats and `"active_keys": 0`.

Make a few API calls and check `/health` again — should see `total_hits` and `total_misses` incrementing.

---

## Phase 2: Static Catalogs Cache

### Task 8: Cache Item Catalog

**Files:**
- Modify: `backend/app/production/router.py`

- [ ] **Step 1: Add cache import**

At the top of `backend/app/production/router.py`, add:
```python
from app.cache import cache, invalidate_catalog_items
```

- [ ] **Step 2: Cache the item list endpoint**

Find the endpoint that lists items (search for `def list_items` or `def get_items` or the route `/inventory/items`). Wrap it:

```python
# At the start of the function, after extracting org_id:
cache_key = f"catalog:items:{org_id}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing query logic ...

# Before returning:
await cache.set(cache_key, result, ttl=900)  # 15 minutes
return result
```

- [ ] **Step 3: Add invalidation to item CRUD**

Find the create/update/delete item endpoints in the same file. At the end of each, add:
```python
await invalidate_catalog_items(org_id)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/production/router.py
git commit -m "feat(cache): cache item catalog (15min TTL) with CRUD invalidation"
```

---

### Task 9: Cache Warehouse List

**Files:**
- Modify: `backend/app/production/router.py`

- [ ] **Step 1: Add invalidation import**

Add to existing imports at top:
```python
from app.cache import cache, invalidate_catalog_items, invalidate_catalog_warehouses
```

- [ ] **Step 2: Cache the warehouse list endpoint**

Find the warehouse list endpoint (search for route `/inventory/warehouses` or `def list_warehouses`). Wrap:

```python
cache_key = f"catalog:warehouses:{org_id}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing query logic ...

await cache.set(cache_key, result, ttl=1800)  # 30 minutes
return result
```

- [ ] **Step 3: Add invalidation to warehouse CRUD**

Find create/update/delete warehouse endpoints. At the end of each, add:
```python
await invalidate_catalog_warehouses(org_id)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/production/router.py
git commit -m "feat(cache): cache warehouse list (30min TTL) with CRUD invalidation"
```

---

### Task 10: Cache UOM Presentations

**Files:**
- Modify: `backend/app/catering/router.py` (or wherever UOM presentation CRUD lives)

- [ ] **Step 1: Add cache import**

```python
from app.cache import cache, invalidate_catalog_uom
```

- [ ] **Step 2: Cache the UOM presentations list endpoint**

Find the endpoint that lists UOM presentations. Wrap:

```python
cache_key = f"catalog:uom:{org_id}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing query logic ...

await cache.set(cache_key, result, ttl=1800)  # 30 minutes
return result
```

- [ ] **Step 3: Add invalidation to UOM presentation CRUD**

At the end of create/update/delete presentation endpoints:
```python
await invalidate_catalog_uom(org_id)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/catering/router.py
git commit -m "feat(cache): cache UOM presentations (30min TTL) with CRUD invalidation"
```

---

### Task 11: Cache Checklist Templates

**Files:**
- Modify: `backend/app/checklists/router.py`

- [ ] **Step 1: Add cache import**

```python
from app.cache import cache, invalidate_checklist_templates
```

- [ ] **Step 2: Cache checklist templates per venue**

Find the endpoint `get_checklists` (route `/checklists/{venue_id}`). After extracting `venue_id`, add:

```python
cache_key = f"catalog:templates:{venue_id}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing query logic (templates + questions + prerequisites) ...

await cache.set(cache_key, result, ttl=600)  # 10 minutes
return result
```

- [ ] **Step 3: Add invalidation to template/question admin endpoints**

Find admin endpoints for creating/updating/deleting templates and questions. At the end of each:
```python
await invalidate_checklist_templates(venue_id)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/checklists/router.py
git commit -m "feat(cache): cache checklist templates per venue (10min TTL) with invalidation"
```

---

## Phase 3: Heavy Aggregations Cache

### Task 12: Cache Inventory Snapshot

**Files:**
- Modify: `backend/app/production/router.py`

This is the highest-impact single endpoint to cache. Historical snapshots (past dates) are immutable — cache for 24h. Today's snapshot caches for 60s.

- [ ] **Step 1: Add invalidation import**

Ensure `invalidate_inventory` is imported at the top:
```python
from app.cache import cache, invalidate_catalog_items, invalidate_catalog_warehouses, invalidate_inventory
```

- [ ] **Step 2: Cache the snapshot endpoint**

Find `get_inventory_snapshot` (route `/inventory/snapshot`). At the top of the function, after extracting `org_id`, `warehouse_id`, `target_date`, and `valuation_method`:

```python
from datetime import date

wh_key = warehouse_id or "all"
cache_key = f"inv:snapshot:{org_id}:{wh_key}:{target_date}:{valuation_method}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing computation logic (all the heavy iteration) ...

# Before returning:
is_historical = str(target_date) < str(date.today())
ttl = 86400 if is_historical else 60  # 24h for past, 60s for today
await cache.set(cache_key, result, ttl=ttl)
return result
```

- [ ] **Step 3: Add invalidation to stock mutation endpoints**

Find endpoints that create stock movements (process_inventory_document, process_physical_inventory, create_transfer, etc.). At the end of each:
```python
await invalidate_inventory(org_id)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/production/router.py
git commit -m "feat(cache): cache inventory snapshot (24h historical, 60s today) with invalidation"
```

---

### Task 13: Cache Inventory Valuation and Low Stock Alerts

**Files:**
- Modify: `backend/app/production/router.py`

- [ ] **Step 1: Cache the valuation endpoint**

Find `get_inventory_valuation` (route `/inventory/valuation`). At the top, after extracting params:

```python
wh_key = warehouse_id or "all"
cache_key = f"inv:valuation:{org_id}:{wh_key}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing valuation logic ...

await cache.set(cache_key, result, ttl=180)  # 3 minutes
return result
```

- [ ] **Step 2: Cache the low stock alerts endpoint**

Find `get_low_stock_alerts` (route `/inventory/alerts/low-stock`). Wrap similarly:

```python
wh_key = warehouse_id or "all"
cache_key = f"inv:alerts:{org_id}:{wh_key}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing alert logic ...

await cache.set(cache_key, result, ttl=60)  # 1 minute
return result
```

> **Note:** Invalidation for both is already covered by `invalidate_inventory(org_id)` added in Task 12 Step 3.

- [ ] **Step 3: Commit**

```bash
git add backend/app/production/router.py
git commit -m "feat(cache): cache inventory valuation (3min) and low-stock alerts (1min)"
```

---

### Task 14: Cache Admin Dashboard Summary

**Files:**
- Modify: `backend/app/admin/router.py`

- [ ] **Step 1: Add cache import**

At the top, add:
```python
from app.cache import cache, invalidate_admin_summary
```

- [ ] **Step 2: Cache the admin summary endpoint**

Find `get_admin_summary` (route `/admin/summary`). Wrap:

```python
venue_key = venue_id or "all"
cache_key = f"admin:summary:{org_id}:{venue_key}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing 7-query aggregation ...

await cache.set(cache_key, result, ttl=30)  # 30 seconds
return result
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/admin/router.py
git commit -m "feat(cache): cache admin dashboard summary (30s TTL)"
```

---

### Task 15: Cache Supplier Metrics

**Files:**
- Modify: `backend/app/purchasing/router.py`

- [ ] **Step 1: Add cache import**

```python
from app.cache import cache, invalidate_supplier_metrics
```

- [ ] **Step 2: Cache supplier metrics endpoint**

Find `calculate_supplier_metrics` or the route that returns supplier performance. Wrap:

```python
cache_key = f"supplier:metrics:{org_id}:{supplier_id}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing 6-query computation ...

await cache.set(cache_key, result, ttl=900)  # 15 minutes
return result
```

- [ ] **Step 3: Add invalidation to receipt/return processing**

Find endpoints that process receipts or supplier returns. At the end:
```python
await invalidate_supplier_metrics(org_id, supplier_id)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/purchasing/router.py
git commit -m "feat(cache): cache supplier metrics (15min TTL) with invalidation"
```

---

### Task 16: Cache Recipe Graph

**Files:**
- Modify: `backend/app/catering/router.py`

- [ ] **Step 1: Add cache import**

```python
from app.cache import cache, invalidate_recipes
```

- [ ] **Step 2: Cache recipe list with ingredients**

Find the recipe list endpoint or the internal function that loads the full recipe tree (used by MRP). Wrap:

```python
cache_key = f"recipes:graph:{org_id}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing recipe + ingredient queries ...

await cache.set(cache_key, result, ttl=86400)  # 24 hours
return result
```

- [ ] **Step 3: Add invalidation to recipe CRUD**

At the end of create/update/delete recipe and ingredient endpoints:
```python
await invalidate_recipes(org_id)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/catering/router.py
git commit -m "feat(cache): cache recipe graph (24h TTL) with CRUD invalidation"
```

---

## Phase 4: High-Frequency Polling Cache

### Task 17: Cache KDS Kitchen Orders

**Files:**
- Modify: `backend/app/catering/router.py`

- [ ] **Step 1: Add invalidation import**

```python
from app.cache import cache, invalidate_recipes, invalidate_kds
```

- [ ] **Step 2: Cache the KDS orders endpoint**

Find `get_kds_orders` (route `/production/orders/kds`). Wrap:

```python
cache_key = f"kds:orders:{org_id}:{warehouse_id}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing query logic ...

await cache.set(cache_key, result, ttl=60)  # 1 minute
return result
```

- [ ] **Step 3: Add invalidation to order mutation endpoints**

Find endpoints that create, update status, or complete production orders. At the end:
```python
await invalidate_kds(org_id, warehouse_id)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/catering/router.py
git commit -m "feat(cache): cache KDS kitchen orders (1min TTL) with invalidation"
```

---

### Task 18: Cache Live Attendance

**Files:**
- Modify: `backend/app/attendance/router.py`

- [ ] **Step 1: Add cache import**

```python
from app.cache import cache, invalidate_attendance
from datetime import date
```

- [ ] **Step 2: Cache the live attendance endpoint**

Find `get_live_attendance` (route `/attendance/live`). Wrap:

```python
today = str(date.today())
cache_key = f"attendance:live:{venue_id}:{today}"
cached = await cache.get(cache_key)
if cached:
    return cached

# ... existing query logic ...

await cache.set(cache_key, result, ttl=15)  # 15 seconds
return result
```

- [ ] **Step 3: Add invalidation to attendance mark endpoint**

Find the endpoint that records attendance marks (clock in/out). At the end:
```python
from datetime import date
await invalidate_attendance(venue_id, str(date.today()))
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/attendance/router.py
git commit -m "feat(cache): cache live attendance (15s TTL) with invalidation on mark"
```

---

## Phase 5: Final Verification

### Task 19: Full Integration Test

- [ ] **Step 1: Run all existing tests without REDIS_URL**

```bash
cd backend
unset REDIS_URL  # ensure not set
pytest -x -q
```

Expected: All tests pass. No-op mode means zero behavioral changes.

- [ ] **Step 2: Run type/lint checks**

```bash
cd backend
python -m py_compile main.py
python -m py_compile app/cache.py
python -m py_compile auth_deps.py
python -m py_compile permissions.py
```

Expected: No compilation errors.

- [ ] **Step 3: Manual smoke test with Redis**

Start Redis (Docker or Render), set `REDIS_URL` in `.env`, restart server.

1. Hit `/health` → `"connected": true`
2. Login → first call hits Supabase, second call (within 5min) should be faster
3. Load inventory snapshot → first call slow, second call instant
4. Process an inventory document → verify snapshot cache invalidates (next load recalculates)
5. Check `/health` → verify `total_hits > 0`

- [ ] **Step 4: Final commit with all Phase 2-4 changes**

```bash
git add -A
git commit -m "feat(cache): complete Redis caching integration across all 4 phases"
```

- [ ] **Step 5: Push**

```bash
git push origin main
```
