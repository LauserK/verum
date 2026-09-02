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


async def validate_checkout_stock(org_id: str, warehouse_id: str, items: list, db):
    """
    Validates that there is sufficient stock for all checkout items where allow_negative_stock is False.
    Raises HTTPException(409) if any item has insufficient stock.
    """
    if not warehouse_id or not items:
        return

    # 1. Group requested quantities by sale_item_id
    requested_qty_by_item: dict[str, float] = {}
    for item in items:
        sale_item_id = getattr(item, "sale_item_id", None) or (item.get("sale_item_id") if isinstance(item, dict) else None)
        if sale_item_id:
            iid = str(sale_item_id)
            qty = float(getattr(item, "quantity", 1) or (item.get("quantity", 1) if isinstance(item, dict) else 1))
            requested_qty_by_item[iid] = requested_qty_by_item.get(iid, 0.0) + qty

    if not requested_qty_by_item:
        return

    # 2. Fetch allow_negative_stock and names for these items
    items_to_check = list(requested_qty_by_item.keys())
    res = db.table("sale_items").select("id, name, allow_negative_stock").in_("id", items_to_check).eq("org_id", org_id).execute()
    sale_items_map = {str(si["id"]): si for si in (res.data or [])}

    strict_items = [
        iid for iid, si in sale_items_map.items()
        if not si.get("allow_negative_stock", False)
    ]

    if not strict_items:
        return  # All items allow selling without stock

    # 3. Read current stock for strict items in 1 batch
    stock_by_item: dict[str, float] = {}
    try:
        lots_res = db.table("stock_lots").select("item_id, qty_base").eq(
            "warehouse_id", warehouse_id
        ).in_("item_id", strict_items).eq("is_exhausted", False).execute()
        for lot in (lots_res.data or []):
            iid = str(lot.get("item_id") or "")
            if iid:
                stock_by_item[iid] = stock_by_item.get(iid, 0.0) + float(lot.get("qty_base") or 0)
    except Exception as e:
        print("[CHECKOUT STOCK VALIDATION] Error reading lots:", e)

    # Missing in lots? Check movements
    missing_items = [iid for iid in strict_items if iid not in stock_by_item]
    if missing_items:
        try:
            mv_res = db.table("stock_movements").select("item_id, qty_base").eq(
                "warehouse_id", warehouse_id
            ).in_("item_id", missing_items).execute()
            for mv in (mv_res.data or []):
                iid = str(mv.get("item_id") or "")
                if iid:
                    stock_by_item[iid] = stock_by_item.get(iid, 0.0) + float(mv.get("qty_base") or 0)
        except Exception as e:
            print("[CHECKOUT STOCK VALIDATION] Error reading movements:", e)

    # 4. Check stock availability against requested qty
    insufficient = []
    for iid in strict_items:
        available = stock_by_item.get(iid, 0.0)
        requested = requested_qty_by_item.get(iid, 0.0)
        if available < requested:
            item_name = sale_items_map.get(iid, {}).get("name", "Producto")
            insufficient.append({
                "item_id": iid,
                "name": item_name,
                "available": available,
                "requested": requested
            })

    if insufficient:
        first = insufficient[0]
        raise HTTPException(
            status_code=409,
            detail=f"Stock insuficiente para {first['name']}. Disponible: {first['available']}, Solicitado: {first['requested']}"
        )


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
    """Get available stock (real - reserved) for all sale items in bulk (O(1) database round trips)."""
    cache_key = f"sales:stock:availability:{org_id}:{warehouse_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    # 1. Get all active sale items
    items_res = db.table("sale_items").select(
        "id, allow_negative_stock"
    ).eq("org_id", org_id).eq("is_active", True).execute()

    sale_items = items_res.data or []
    if not sale_items:
        await cache.set(cache_key, [], ttl=20)
        return []

    # 2. Bulk fetch all stock lots for this warehouse in a single query
    stock_by_item: dict[str, float] = {}
    try:
        lots_res = db.table("stock_lots").select("item_id, qty_base").eq(
            "warehouse_id", warehouse_id
        ).eq("is_exhausted", False).execute()
        for lot in (lots_res.data or []):
            iid = str(lot.get("item_id") or "")
            if iid:
                stock_by_item[iid] = stock_by_item.get(iid, 0.0) + float(lot.get("qty_base") or 0)
    except Exception as e:
        print("[STOCK BULK] Error reading lots:", e)

    # 3. For any items not in stock_lots, fallback to stock_movements in 1 bulk query
    missing_items = [item["id"] for item in sale_items if item["id"] not in stock_by_item]
    if missing_items:
        try:
            mv_res = db.table("stock_movements").select("item_id, qty_base").eq(
                "warehouse_id", warehouse_id
            ).in_("item_id", missing_items).execute()
            for mv in (mv_res.data or []):
                iid = str(mv.get("item_id") or "")
                if iid:
                    stock_by_item[iid] = stock_by_item.get(iid, 0.0) + float(mv.get("qty_base") or 0)
        except Exception as e:
            print("[STOCK BULK] Error reading movements:", e)

    # 4. Assemble stock response in memory
    result = []
    for item in sale_items:
        item_id = item["id"]
        allow_neg = item.get("allow_negative_stock", False)
        actual = stock_by_item.get(item_id, 0.0)

        result.append({
            "sale_item_id": item_id,
            "available_stock": actual,
            "allow_negative_stock": allow_neg
        })

    # Cache for 20s
    await cache.set(cache_key, result, ttl=20)
    return result

