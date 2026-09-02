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
    "sales": 1,
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

    async def hgetall(self, raw_key: str) -> dict:
        """Get all hash fields for a key. Returns dict or empty dict if disabled/missing."""
        if not self._enabled:
            return {}
        try:
            key = self._make_key(raw_key)
            data = await self._redis.hgetall(key)
            if not data:
                return {}
            # decode bytes to str if needed
            res = {}
            for k, v in data.items():
                k_str = k.decode("utf-8") if isinstance(k, bytes) else str(k)
                v_str = v.decode("utf-8") if isinstance(v, bytes) else str(v)
                res[k_str] = v_str
            return res
        except Exception as e:
            logger.warning(f"Cache HGETALL error for '{raw_key}': {e}")
            return {}

    async def hset(self, raw_key: str, field: str, value: str) -> None:
        """Set a hash field. No-op if disabled."""
        if not self._enabled:
            return
        try:
            key = self._make_key(raw_key)
            await self._redis.hset(key, field, value)
        except Exception as e:
            logger.warning(f"Cache HSET error for '{raw_key}': {e}")

    async def hdel(self, raw_key: str, field: str) -> None:
        """Delete a hash field. No-op if disabled."""
        if not self._enabled:
            return
        try:
            key = self._make_key(raw_key)
            await self._redis.hdel(key, field)
        except Exception as e:
            logger.warning(f"Cache HDEL error for '{raw_key}': {e}")

    async def expire(self, raw_key: str, ttl: int) -> None:
        """Set TTL on a key. No-op if disabled."""
        if not self._enabled:
            return
        try:
            key = self._make_key(raw_key)
            await self._redis.expire(key, ttl)
        except Exception as e:
            logger.warning(f"Cache EXPIRE error for '{raw_key}': {e}")

    async def setnx(self, raw_key: str, value: Any, ttl: int = 60) -> bool:
        """Set a key if it does not exist (atomic lock). Returns True if key was set, False otherwise."""
        if not self._enabled:
            return True
        try:
            key = self._make_key(raw_key)
            serialized = orjson.dumps(value)
            res = await self._redis.set(key, serialized, ex=ttl, nx=True)
            return bool(res)
        except Exception as e:
            logger.warning(f"Cache SETNX error for '{raw_key}': {e}")
            return True

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

    async def flush_all(self) -> bool:
        """Clear all keys in the database. Returns True if successful, False otherwise."""
        if not self._enabled:
            return False
        try:
            await self._redis.flushdb()
            self._hits = 0
            self._misses = 0
            logger.info("Redis cache flushed completely.")
            return True
        except Exception as e:
            logger.error(f"Cache FLUSHDB error: {e}")
            return False


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

async def invalidate_profile(user_id: str):
    """Invalidate cached user profile and venues across all org variants."""
    await cache.delete_pattern(f"auth:profile:{user_id}:*")

async def invalidate_user_rbac(org_id: str, profile_id: str):
    """Invalidate cached RBAC context and resolved permissions for a user."""
    await cache.delete(f"rbac:context:{org_id}:{profile_id}")
    await cache.delete(f"rbac:perms:{org_id}:{profile_id}")
    await cache.delete_pattern(f"auth:profile:{profile_id}:*")

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
    await cache.delete(f"catalog:questions:{venue_id}")

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

async def invalidate_sales_config(org_id: str):
    """Invalidate cached sales billing config and payment methods."""
    await cache.delete(f"sales:config:{org_id}")
    await cache.delete(f"sales:payment_methods:{org_id}")

async def invalidate_sales_catalog(org_id: str):
    """Invalidate cached sales catalog categories, items, and price lists."""
    await cache.delete_pattern(f"sales:catalog:{org_id}:*")

async def invalidate_pos_config(org_id: str):
    """Invalidate all cached POS config for an organization."""
    await cache.delete_pattern(f"pos:config:{org_id}:*")

async def invalidate_workstations(org_id: str):
    """Invalidate cached workstations for an organization."""
    await cache.delete_pattern(f"sales:workstations:{org_id}:*")

async def invalidate_pos_session(org_id: str):
    """Invalidate active POS session cache for an organization."""
    await cache.delete_pattern(f"pos:session:active:{org_id}:*")

async def invalidate_table_orders(org_id: str):
    """Invalidate active table orders cache for an organization."""
    await cache.delete_pattern(f"sales:table_orders:{org_id}:*")

async def invalidate_floor_plans(org_id: str):
    """Invalidate floor plans and tables cache for an organization."""
    await cache.delete_pattern(f"sales:floor_plans:{org_id}:*")




