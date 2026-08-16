# backend/tests/test_caching.py
import pytest
from unittest.mock import AsyncMock, patch
from app.cache import CacheManager, hash_token, VERSIONS

@pytest.mark.asyncio
async def test_cache_no_op_fallback():
    """Verify that when no REDIS_URL is configured, CacheManager operates in transparent no-op fallback."""
    cache = CacheManager()
    await cache.init(None)
    
    assert cache._enabled is False
    assert cache._redis is None
    
    # All methods should be safe no-ops
    assert await cache.get("auth:user:123") is None
    await cache.set("auth:user:123", {"data": "test"}, ttl=60)
    await cache.delete("auth:user:123")
    await cache.delete_pattern("auth:user:*")
    
    health = await cache.health()
    assert health["connected"] is False
    assert health["url_configured"] is False
    
    await cache.close()

@pytest.mark.asyncio
async def test_cache_make_key():
    """Verify key prefixing based on the module versions."""
    cache = CacheManager()
    
    # Test prefixing for some standard namespaces
    assert cache._make_key("auth:user:123") == f"v{VERSIONS['auth']}:auth:user:123"
    assert cache._make_key("inv:snapshot:abc") == f"v{VERSIONS['inv']}:inv:snapshot:abc"
    assert cache._make_key("kds:orders:xyz") == f"v{VERSIONS['kds']}:kds:orders:xyz"
    assert cache._make_key("unknown:key:123") == "v1:unknown:key:123"

@pytest.mark.asyncio
@patch("redis.asyncio.from_url")
async def test_cache_enabled_operations(mock_from_url):
    """Verify that get, set, delete, and delete_pattern work correctly when Redis is configured and mock-connected."""
    mock_redis = AsyncMock()
    mock_from_url.return_value = mock_redis
    
    cache = CacheManager()
    await cache.init("redis://localhost:6379")
    
    assert cache._enabled is True
    assert cache._redis == mock_redis
    
    # 1. Test GET Hit
    mock_redis.get.return_value = b'{"name": "Verum"}'
    res = await cache.get("auth:user:123")
    assert res == {"name": "Verum"}
    mock_redis.get.assert_called_with(f"v{VERSIONS['auth']}:auth:user:123")
    
    # 2. Test GET Miss
    mock_redis.get.return_value = None
    res = await cache.get("auth:user:456")
    assert res is None
    
    # 3. Test SET
    await cache.set("auth:user:123", {"name": "Verum"}, ttl=100)
    mock_redis.setex.assert_called_with(f"v{VERSIONS['auth']}:auth:user:123", 100, b'{"name":"Verum"}')
    
    # 4. Test DELETE
    await cache.delete("auth:user:123")
    mock_redis.delete.assert_called_with(f"v{VERSIONS['auth']}:auth:user:123")
    
    # 5. Test DELETE_PATTERN using SCAN
    mock_redis.scan.side_effect = [
        (12, [b"v1:auth:user:1", b"v1:auth:user:2"]),
        (0, [b"v1:auth:user:3"])
    ]
    await cache.delete_pattern("auth:user:*")
    assert mock_redis.scan.call_count == 2
    assert mock_redis.delete.call_count == 3  # 1 from earlier delete, 2 from delete_pattern

@pytest.mark.asyncio
async def test_hash_token_helper():
    """Verify the SHA-256 token hashing helper creates stable 16-character keys."""
    token = "secret-jwt-token-12345"
    h1 = hash_token(token)
    h2 = hash_token(token)
    
    assert h1 == h2
    assert len(h1) == 16
    assert isinstance(h1, str)

@pytest.mark.asyncio
@patch("app.cache.cache")
async def test_invalidation_helpers(mock_cache):
    """Verify that all invalidation helpers call delete / delete_pattern with correct raw key structures."""
    from app.cache import (
        invalidate_auth_user, invalidate_user_rbac, invalidate_rbac_catalog,
        invalidate_inventory, invalidate_catalog_items, invalidate_catalog_uom,
        invalidate_catalog_warehouses, invalidate_checklist_templates,
        invalidate_admin_summary, invalidate_supplier_metrics, invalidate_kds,
        invalidate_attendance, invalidate_recipes
    )
    
    mock_cache.delete = AsyncMock()
    mock_cache.delete_pattern = AsyncMock()
    
    await invalidate_auth_user("tokenhash123")
    mock_cache.delete.assert_any_call("auth:user:tokenhash123")
    
    await invalidate_user_rbac("org1", "prof1")
    mock_cache.delete.assert_any_call("rbac:context:org1:prof1")
    mock_cache.delete.assert_any_call("rbac:perms:org1:prof1")
    
    await invalidate_rbac_catalog("org1")
    mock_cache.delete.assert_any_call("rbac:catalog:perms:org1")
    
    await invalidate_inventory("org1", "wh1")
    mock_cache.delete_pattern.assert_any_call("inv:snapshot:org1:wh1:*")
    mock_cache.delete_pattern.assert_any_call("inv:valuation:org1:wh1")
    mock_cache.delete_pattern.assert_any_call("inv:alerts:org1:wh1")
    
    await invalidate_catalog_items("org1")
    mock_cache.delete.assert_any_call("catalog:items:org1")
    
    await invalidate_catalog_uom("org1")
    mock_cache.delete.assert_any_call("catalog:uom:org1")
    
    await invalidate_catalog_warehouses("org1")
    mock_cache.delete.assert_any_call("catalog:warehouses:org1")
    
    await invalidate_checklist_templates("venue1")
    mock_cache.delete.assert_any_call("catalog:templates:venue1")
    mock_cache.delete.assert_any_call("catalog:questions:venue1")
    
    await invalidate_admin_summary("org1")
    mock_cache.delete_pattern.assert_any_call("admin:summary:org1:*")
    
    await invalidate_supplier_metrics("org1", "supp1")
    mock_cache.delete.assert_any_call("supplier:metrics:org1:supp1")
    
    await invalidate_kds("org1", "wh1")
    mock_cache.delete.assert_any_call("kds:orders:org1:wh1")
    
    await invalidate_attendance("venue1", "2026-08-16")
    mock_cache.delete.assert_any_call("attendance:live:venue1:2026-08-16")
    
    await invalidate_recipes("org1")
    mock_cache.delete.assert_any_call("recipes:graph:org1")
