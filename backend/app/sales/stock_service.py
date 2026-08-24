from fastapi import HTTPException
from app.cache import cache

async def _get_item_stock(warehouse_id: str, sale_item_id: str, db) -> float:
    """
    Get current stock balance for an item in a warehouse.
    Calculates from stock_movements / stock_lots.
    """
    try:
        # Sum unexhausted lots
        lots_res = db.table("stock_lots").select("qty_base").eq(
            "warehouse_id", warehouse_id
        ).eq("item_id", sale_item_id).eq("is_exhausted", False).execute()
        if lots_res.data:
            return sum(float(lot.get("qty_base", 0)) for lot in lots_res.data)

        # Alternatively sum stock_movements
        mv_res = db.table("stock_movements").select("qty_base").eq(
            "warehouse_id", warehouse_id
        ).eq("item_id", sale_item_id).execute()
        if mv_res.data:
            return sum(float(mv.get("qty_base", 0)) for mv in mv_res.data)

        return 0.0
    except Exception:
        # If any query fails, return 0.0
        return 0.0


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
        actual_stock = await _get_item_stock(warehouse_id, sale_item_id, db)

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

        # Get real stock from inventory
        actual = await _get_item_stock(warehouse_id, item_id, db)

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

