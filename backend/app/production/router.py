from fastapi import APIRouter, Depends, Header, HTTPException
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timezone
import pytz

from database import get_db
from app.deps import get_active_org_id, require_permission
from auth_deps import security, get_current_user
from permissions import resolve_permission

# Import schemas
from app.production.schemas import (
    UOMBase, UOMPresentationCreate, UOMPresentationResponse,
    ItemCategoryCreate, ItemCategoryResponse,
    ItemCreate, ItemResponse, ItemUpdate,
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    StockMovementResponse, PurchaseReceiptLineCreate, PurchaseReceiptCreate, PurchaseReceiptResponse,
    IssueDocumentLineCreate, IssueDocumentCreate, IssueDocumentResponse,
    PhysicalInventoryLineCreate, PhysicalInventoryCreate, PhysicalInventoryLineResponse, PhysicalInventoryResponse, PhysicalInventoryBriefResponse,
    StockSnapshotItem, StockSnapshotResponse, StockValuationLotDetail, StockValuationItem, StockValuationResponse,
    StockAdjustItem, BulkStockAdjustRequest, StockAdjustResult, BulkStockAdjustResponse,
    LowStockAlertItem
)

CARACAS_TZ = pytz.timezone("America/Caracas")

router = APIRouter(prefix="", tags=["Production"])

# ── Production & Inventory Endpoints (M16) ───────────────

@router.post("/inventory/warehouses", response_model=WarehouseResponse, tags=["Inventory"])
async def create_warehouse(warehouse: WarehouseCreate, org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.manage_warehouses"))):
    data = {
        "org_id": org_id,
        "venue_id": str(warehouse.venue_id) if warehouse.venue_id else None,
        "name": warehouse.name,
        "type": warehouse.type
    }
    
    res = db.table("warehouses").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Error creating warehouse")
    return res.data[0]

@router.put("/inventory/warehouses/{warehouse_id}", response_model=WarehouseResponse, tags=["Inventory"])
async def update_warehouse(warehouse_id: UUID, warehouse: WarehouseUpdate, org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.manage_warehouses"))):
    update_data = {}
    if warehouse.name is not None:
        update_data["name"] = warehouse.name
    if warehouse.type is not None:
        update_data["type"] = warehouse.type
    if warehouse.is_active is not None:
        update_data["is_active"] = warehouse.is_active
    
    if "venue_id" in warehouse.model_dump(exclude_unset=True):
         val = warehouse.model_dump(exclude_unset=True)["venue_id"]
         update_data["venue_id"] = str(val) if val else None

    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    res = db.table("warehouses").update(update_data).eq("id", str(warehouse_id)).eq("org_id", org_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Warehouse not found or not in org")

    return res.data[0]

@router.get("/inventory/warehouses", response_model=List[WarehouseResponse], tags=["Inventory"])
async def list_warehouses(org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("warehouses").select("*").eq("org_id", org_id).execute()
    return res.data

@router.post("/inventory/items", response_model=ItemResponse, tags=["Inventory"])
async def create_item(item: ItemCreate, org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.manage_items"))):
    data = {
        "org_id": org_id,
        "code": item.code,
        "name": item.name,
        "type": item.type,
        "category_id": str(item.category_id) if item.category_id else None,
        "base_uom_id": str(item.base_uom_id),
        "yield_alert_enabled": item.yield_alert_enabled,
        "yield_alert_threshold_pct": item.yield_alert_threshold_pct,
        "shelf_life_days": item.shelf_life_days,
        "last_purchase_cost": item.last_purchase_cost,
        "last_purchase_cost_updated_at": datetime.now(CARACAS_TZ).isoformat() if item.last_purchase_cost is not None else None
    }
    
    res = db.table("items").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Error creating item")
    
    item_id = res.data[0]["id"]
    
    # Create default presentations if any
    if item.presentations:
        for p in item.presentations:
            p_data = {
                "org_id": org_id,
                "name": p.name,
                "base_uom_id": str(item.base_uom_id),
                "conversion_factor": p.conversion_factor,
                "is_default": p.is_default
            }
            db.table("uom_presentations").insert(p_data).execute()

    # Fetch with uom_name join
    item_res = db.table("items") \
        .select("*, uom_base(name)") \
        .eq("id", item_id) \
        .execute()
    
    if not item_res.data:
        raise HTTPException(status_code=400, detail="Error fetching created item")
        
    created_item = item_res.data[0]
    if created_item.get("uom_base"):
        created_item["uom_name"] = created_item["uom_base"].get("name")
        del created_item["uom_base"]
        
    return created_item

@router.get("/inventory/items", response_model=List[ItemResponse], tags=["Inventory"])
async def list_items(org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("items") \
        .select("*, uom_base(name)") \
        .eq("org_id", org_id) \
        .eq("is_active", True) \
        .execute()
    
    # Flatten uom_base.name to uom_name
    for item in res.data:
        if item.get("uom_base"):
            item["uom_name"] = item["uom_base"].get("name")
            del item["uom_base"]
            
    return res.data or []

@router.get("/inventory/lots/resolve/{lot_number}", tags=["Inventory"])
async def resolve_lot_number(lot_number: str, org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("stock_lots") \
        .select("*, items(*, uom_base(name)), warehouses!inner(org_id)") \
        .eq("lot_number", lot_number) \
        .eq("warehouses.org_id", org_id) \
        .execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
        
    lot = res.data[0]
    item = lot.get("items")
    if not item:
        raise HTTPException(status_code=404, detail="Artículo asociado al lote no encontrado")
         
    if item.get("uom_base"):
        item["uom_name"] = item["uom_base"].get("name")
        del item["uom_base"]
        
    return {
        "item": item,
        "lot_number": lot.get("lot_number"),
        "expiry_date": lot.get("expiry_date"),
        "unit_cost_base": lot.get("unit_cost_base")
    }

@router.patch("/inventory/items/{item_id}", response_model=ItemResponse, tags=["Inventory"])
async def update_item(item_id: UUID, item: ItemUpdate, db=Depends(get_db), _=Depends(require_permission("inventory.manage_items"))):
    # Convert model to dict and handle UUID serialization
    full_data = item.dict(exclude_none=True)
    
    # Exclude 'presentations' as it's not a column in the 'items' table
    if "presentations" in full_data:
        del full_data["presentations"]
        
    update_data = {k: (str(v) if isinstance(v, UUID) else v) 
                   for k, v in full_data.items()}
    
    if "last_purchase_cost" in update_data:
        update_data["last_purchase_cost_updated_at"] = datetime.now(CARACAS_TZ).isoformat()
        
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    res = db.table("items").update(update_data).eq("id", str(item_id)).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Item not found")
        
    # Fetch with uom_name join
    item_res = db.table("items") \
        .select("*, uom_base(name)") \
        .eq("id", str(item_id)) \
        .execute()
        
    updated_item = item_res.data[0]
    if updated_item.get("uom_base"):
        updated_item["uom_name"] = updated_item["uom_base"].get("name")
        del updated_item["uom_base"]
        
    return updated_item

@router.delete("/inventory/items/{item_id}", tags=["Inventory"])
async def delete_item(item_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.manage_items"))):
    # Soft delete: just inactivate
    db.table("items").update({"is_active": False}).eq("id", str(item_id)).execute()
    return {"ok": True}

@router.get("/inventory/items/{item_id}", response_model=ItemResponse, tags=["Inventory"])
async def get_item(item_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("items") \
        .select("*, uom_base(name)") \
        .eq("id", str(item_id)) \
        .execute()
        
    if not res.data:
        raise HTTPException(status_code=404, detail="Item not found")
        
    item = res.data[0]
    if item.get("uom_base"):
        item["uom_name"] = item["uom_base"].get("name")
        del item["uom_base"]
        
    return item

@router.get("/inventory/items/{item_id}/stock", tags=["Inventory"])
async def get_item_stock(item_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("stock").select("*, warehouses(name)").eq("item_id", str(item_id)).execute()
    return res.data or []

@router.post("/inventory/items/{item_id}/stock", tags=["Inventory"])
async def associate_warehouse(item_id: UUID, body: dict, db=Depends(get_db), _=Depends(require_permission("inventory.manage_items"))):
    warehouse_id = body.get("warehouse_id")
    if not warehouse_id:
        raise HTTPException(400, "warehouse_id is required")
    db.table("stock").upsert({
        "item_id": str(item_id),
        "warehouse_id": warehouse_id,
        "qty_base": 0
    }, on_conflict="item_id,warehouse_id").execute()
    return {"ok": True}

@router.get("/inventory/item-categories", response_model=List[ItemCategoryResponse], tags=["Inventory"])
async def list_item_categories(org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("item_categories").select("*").eq("org_id", org_id).execute()
    return res.data or []

@router.post("/inventory/item-categories", response_model=ItemCategoryResponse, tags=["Inventory"])
async def create_item_category(category: ItemCategoryCreate, org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.manage_categories"))):
    data = {
        "org_id": org_id,
        "name": category.name,
        "description": category.description,
        "is_active": True 
    }
    res = db.table("item_categories").insert(data).execute()
    if not res.data or len(res.data) == 0:
        raise HTTPException(status_code=400, detail="Error creating category in database")
    return res.data[0]

@router.patch("/inventory/item-categories/{category_id}", response_model=ItemCategoryResponse, tags=["Inventory"])
async def update_item_category(category_id: UUID, category: ItemCategoryCreate, db=Depends(get_db), _=Depends(require_permission("inventory.manage_categories"))):
    # Fix UUID serialization
    update_data = {k: (str(v) if isinstance(v, UUID) else v) 
                   for k, v in category.dict(exclude_none=True).items()}
    
    res = db.table("item_categories").update(update_data).eq("id", str(category_id)).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Category not found")
    return res.data[0]

@router.delete("/inventory/item-categories/{category_id}", tags=["Inventory"])
async def delete_item_category(category_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.manage_categories"))):
    # Soft delete for categories too
    db.table("item_categories").update({"is_active": False}).eq("id", str(category_id)).execute()
    return {"ok": True}

@router.get("/inventory/uom-base", response_model=List[UOMBase], tags=["Inventory"])
async def list_uom_base(db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("uom_base").select("*").execute()
    return res.data

@router.get("/inventory/uom-presentations", response_model=List[UOMPresentationResponse], tags=["Inventory"])
async def list_uom_presentations(org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("uom_presentations").select("*").eq("org_id", org_id).execute()
    return res.data or []

@router.post("/inventory/uom-presentations", response_model=UOMPresentationResponse, tags=["Inventory"])
async def create_uom_presentation(pres: UOMPresentationCreate, org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.manage_items"))):
    data = {
        "org_id": org_id,
        "name": pres.name,
        "base_uom_id": str(pres.base_uom_id),
        "conversion_factor": pres.conversion_factor,
        "is_default": pres.is_default
    }
    res = db.table("uom_presentations").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Error creating presentation")
    return res.data[0]

@router.delete("/inventory/uom-presentations/{pres_id}", tags=["Inventory"])
async def delete_uom_presentation(pres_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.manage_items"))):
    db.table("uom_presentations").delete().eq("id", str(pres_id)).execute()
    return {"ok": True}

@router.get("/inventory/items/{item_id}/presentations", tags=["Inventory"])
async def get_item_presentations(
    item_id: UUID, 
    db=Depends(get_db), 
    org_id: str = Depends(get_active_org_id),
    current_user = Depends(get_current_user)
):
    # Safely get user id
    user_id = getattr(current_user, "id", None) or current_user.get("id")
    
    # Allow if has inventory.view OR production.view OR production.execute
    has_inv = await resolve_permission(user_id, "inventory.view", db, org_id)
    has_prod_v = await resolve_permission(user_id, "production.view", db, org_id)
    has_prod_e = await resolve_permission(user_id, "production.execute", db, org_id)
    
    if not (has_inv or has_prod_v or has_prod_e):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # 1. Get the item to know its base_uom_id
    item_res = db.table("items").select("base_uom_id, org_id").eq("id", str(item_id)).single().execute()
    if not item_res.data:
        raise HTTPException(status_code=404, detail="Item not found")

    base_uom_id = item_res.data["base_uom_id"]
    item_org_id = item_res.data["org_id"]

    # 2. Get all global presentations for this base unit OR org-specific ones OR those with no org_id (global fallback)
    query = db.table("uom_presentations") \
        .select("*") \
        .eq("base_uom_id", base_uom_id) \
        .or_(f"is_global.eq.true,org_id.eq.{item_org_id},org_id.is.null")
    
    res_all = query.execute()
    
    print(f"DEBUG: get_item_presentations for item {item_id}")
    print(f"  base_uom_id: {base_uom_id}")
    print(f"  item_org_id: {item_org_id}")
    print(f"  Found {len(res_all.data or [])} presentations")
    for p in (res_all.data or []):
        print(f"    - {p['name']} (global={p['is_global']}, org={p['org_id']})")

    return res_all.data or []

@router.post("/inventory/items/{item_id}/presentations/{pres_id}", tags=["Inventory"])
async def enable_item_presentation(item_id: UUID, pres_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.manage_items"))):
    db.table("item_uom_presentations").upsert({
        "item_id": str(item_id),
        "presentation_id": str(pres_id)
    }).execute()
    return {"ok": True}

@router.delete("/inventory/items/{item_id}/presentations/{pres_id}", tags=["Inventory"])
async def disable_item_presentation(item_id: UUID, pres_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.manage_items"))):
    db.table("item_uom_presentations") \
        .delete() \
        .eq("item_id", str(item_id)) \
        .eq("presentation_id", str(pres_id)) \
        .execute()
    return {"ok": True}

# ── Production & Inventory Endpoints (M17) ───────────────

@router.post("/inventory/purchase-receipts", response_model=PurchaseReceiptResponse, tags=["Inventory"])
async def create_purchase_receipt(receipt: PurchaseReceiptCreate, org_id: str = Depends(get_active_org_id), user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("inventory.receive"))):
    # 1. Create the receipt header
    receipt_data = {
        "org_id": org_id,
        "warehouse_id": str(receipt.warehouse_id),
        "supplier": receipt.supplier,
        "receipt_number": receipt.receipt_number,
        "date": receipt.date,
        "status": "confirmed", # Directly confirmed for M17 simplicity
        "created_by": user.id,
        "confirmed_at": datetime.now(CARACAS_TZ).isoformat()
    }
    
    res = db.table("purchase_receipts").insert(receipt_data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Error creating purchase receipt")
    
    receipt_id = res.data[0]["id"]
    
    # 2. Process lines
    for line in receipt.lines:
        # Get presentation for conversion
        factor = 1.0
        if line.presentation_id:
            pres_res = db.table("uom_presentations").select("conversion_factor").eq("id", str(line.presentation_id)).execute()
            if pres_res.data:
                factor = float(pres_res.data[0]["conversion_factor"])
        
        qty_base = float(line.qty_presentation) * factor
        unit_cost_base = float(line.unit_cost_presentation) / factor
        
        # Insert receipt line
        line_data = {
            "receipt_id": receipt_id,
            "item_id": str(line.item_id),
            "qty_base": qty_base,
            "presentation_id": str(line.presentation_id) if line.presentation_id else None,
            "qty_presentation": line.qty_presentation,
            "unit_cost_base": unit_cost_base,
            "expiry_date": line.expiry_date,
            "lot_number": line.lot_number
        }
        db.table("purchase_receipt_lines").insert(line_data).execute()
        
        # Create stock lot
        lot_data = {
            "warehouse_id": str(receipt.warehouse_id),
            "item_id": str(line.item_id),
            "lot_number": line.lot_number,
            "qty_base": qty_base,
            "unit_cost_base": unit_cost_base,
            "expiry_date": line.expiry_date
        }
        lot_res = db.table("stock_lots").insert(lot_data).execute()
        lot_id = lot_res.data[0]["id"]
        
        # Update stock table (manual increment)
        stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", str(receipt.warehouse_id)).eq("item_id", str(line.item_id)).execute()
        if stock_res.data:
            new_qty = float(stock_res.data[0]["qty_base"]) + qty_base
            db.table("stock").update({"qty_base": new_qty}).eq("id", stock_res.data[0]["id"]).execute()
        else:
            db.table("stock").insert({
                "warehouse_id": str(receipt.warehouse_id),
                "item_id": str(line.item_id),
                "qty_base": qty_base
            }).execute()
            
        # Log movement
        movement_data = {
            "org_id": org_id,
            "movement_type": "purchase",
            "warehouse_id": str(receipt.warehouse_id),
            "item_id": str(line.item_id),
            "lot_id": lot_id,
            "qty_base": qty_base,
            "unit_cost_base": unit_cost_base,
            "total_cost": qty_base * unit_cost_base,
            "reference_id": receipt_id,
            "reference_type": "purchase_receipt",
            "created_by": user.id
        }
        db.table("stock_movements").insert(movement_data).execute()

        # Update last purchase cost in items
        db.table("items").update({
            "last_purchase_cost": unit_cost_base,
            "last_purchase_cost_updated_at": datetime.now(CARACAS_TZ).isoformat()
        }).eq("id", str(line.item_id)).execute()

    return res.data[0]

@router.post("/inventory/issue-documents", response_model=IssueDocumentResponse, tags=["Inventory"])
async def create_issue_document(doc: IssueDocumentCreate, org_id: str = Depends(get_active_org_id), user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("inventory.issue"))):
    # 1. Create the issue header
    reason_db = doc.reason
    notes_db = doc.notes
    if reason_db not in ('sale', 'adjustment', 'waste', 'internal_consumption'):
        # Fallback for constraint safety in case migration 041 is not yet applied
        notes_db = f"[Motivo: {reason_db}] {notes_db or ''}".strip()
        reason_db = 'adjustment'

    header_data = {
        "org_id": org_id,
        "warehouse_id": str(doc.warehouse_id),
        "reason": reason_db,
        "notes": notes_db,
        "status": "confirmed",
        "created_by": user.id
    }
    header_res = db.table("issue_documents").insert(header_data).execute()
    if not header_res.data:
        raise HTTPException(status_code=400, detail="Error creating issue document header")
    
    doc_id = header_res.data[0]["id"]
    
    # 2. Process lines with FIFO logic
    for line in doc.lines:
        # Get presentation for conversion
        factor = 1.0
        if line.presentation_id:
            pres_res = db.table("uom_presentations").select("conversion_factor").eq("id", str(line.presentation_id)).execute()
            if pres_res.data:
                factor = float(pres_res.data[0]["conversion_factor"])

        total_to_consume = float(line.qty_presentation) * factor
        
        # Create issue line
        line_data = {
            "issue_id": doc_id,
            "item_id": str(line.item_id),
            "qty_base": total_to_consume,
            "presentation_id": str(line.presentation_id) if line.presentation_id else None,
            "qty_presentation": float(line.qty_presentation)
        }
        db.table("issue_document_lines").insert(line_data).execute()

        # FIFO logic: get oldest non-exhausted lots
        lots_res = db.table("stock_lots") \
            .select("*") \
            .eq("item_id", str(line.item_id)) \
            .eq("warehouse_id", str(doc.warehouse_id)) \
            .filter("qty_base", "gt", 0) \
            .order("received_at", desc=False) \
            .execute()
            
        remaining = total_to_consume
        for lot in (lots_res.data or []):
            if remaining <= 0:
                break
                
            lot_qty = float(lot["qty_base"])
            consume_qty = min(remaining, lot_qty)
            
            # Update lot
            new_lot_qty = lot_qty - consume_qty
            db.table("stock_lots").update({
                "qty_base": new_lot_qty,
                "is_exhausted": new_lot_qty <= 0
            }).eq("id", lot["id"]).execute()
            
            # Log movement
            movement_data = {
                "org_id": org_id,
                "movement_type": "adjustment_out" if reason_db == "adjustment" else "sale",
                "warehouse_id": str(doc.warehouse_id),
                "item_id": str(line.item_id),
                "lot_id": lot["id"],
                "qty_base": -consume_qty, # Negative for exits
                "unit_cost_base": float(lot["unit_cost_base"]),
                "total_cost": -consume_qty * float(lot["unit_cost_base"]),
                "reference_id": doc_id,
                "reference_type": "issue_document",
                "notes": notes_db,
                "created_by": user.id
            }
            db.table("stock_movements").insert(movement_data).execute()
            
            remaining -= consume_qty
            
        # Update overall stock
        stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", str(doc.warehouse_id)).eq("item_id", str(line.item_id)).execute()
        if stock_res.data:
            new_qty = max(0, float(stock_res.data[0]["qty_base"]) - total_to_consume)
            db.table("stock").update({"qty_base": new_qty}).eq("id", stock_res.data[0]["id"]).execute()

    return header_res.data[0]

@router.get("/inventory/kardex", response_model=List[StockMovementResponse], tags=["Inventory"])
async def get_kardex(
    item_id: Optional[UUID] = None, 
    warehouse_id: Optional[UUID] = None, 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None, 
    movement_type: Optional[str] = None, 
    org_id: str = Depends(get_active_org_id), 
    db=Depends(get_db), 
    _=Depends(require_permission("inventory.view"))
):
    query = db.table("stock_movements").select("*, items(name, uom_base(name)), warehouses(name)").eq("org_id", org_id)
    
    if item_id:
        query = query.eq("item_id", str(item_id))
    if warehouse_id:
        query = query.eq("warehouse_id", str(warehouse_id))
    if start_date:
        query = query.gte("created_at", f"{start_date}T00:00:00-04:00")
    if end_date:
        query = query.lte("created_at", f"{end_date}T23:59:59.999999-04:00")
    if movement_type:
        query = query.eq("movement_type", movement_type)
        
    res = query.order("created_at", desc=True).execute()
    return res.data

@router.get("/inventory/snapshot", response_model=StockSnapshotResponse, tags=["Inventory"])
async def get_inventory_snapshot(
    date: str,
    warehouse_id: Optional[UUID] = None,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("inventory.view"))
):
    target_timestamp = f"{date}T23:59:59.999999-04:00"
    
    # Initialize all active items and warehouses of this organization to 0.0 stock and valuation
    items_res = db.table("items").select("id, name, code, uom_base(name)").eq("org_id", org_id).eq("is_active", True).execute()
    active_items = items_res.data or []
    
    if warehouse_id:
        wh_res = db.table("warehouses").select("id, name").eq("org_id", org_id).eq("id", str(warehouse_id)).execute()
    else:
        wh_res = db.table("warehouses").select("id, name").eq("org_id", org_id).eq("is_active", True).execute()
    active_warehouses = wh_res.data or []
    
    grouped = {}
    for wh in active_warehouses:
        for item in active_items:
            uom_base = item.get("uom_base") or {}
            uom_name = uom_base.get("name") if isinstance(uom_base, dict) else ""
            key = (item["id"], wh["id"])
            grouped[key] = {
                "item_id": item["id"],
                "item_name": item.get("name") or "Unknown",
                "item_code": item.get("code"),
                "uom_name": uom_name,
                "warehouse_id": wh["id"],
                "warehouse_name": wh.get("name") or "Unknown",
                "qty_on_hand": 0.0,
                "valuation": 0.0
            }

    query = db.table("stock_movements") \
        .select("item_id, warehouse_id, qty_base, total_cost, items(name, code, uom_base(name)), warehouses(name)") \
        .eq("org_id", org_id) \
        .lte("created_at", target_timestamp)
        
    if warehouse_id:
        query = query.eq("warehouse_id", str(warehouse_id))
        
    res = query.execute()
    movements = res.data or []
    
    for mv in movements:
        item = mv.get("items") or {}
        wh = mv.get("warehouses") or {}
        uom_base = item.get("uom_base") or {}
        uom_name = uom_base.get("name") if isinstance(uom_base, dict) else ""
        
        key = (mv["item_id"], mv["warehouse_id"])
        if key not in grouped:
            grouped[key] = {
                "item_id": mv["item_id"],
                "item_name": item.get("name") or "Unknown",
                "item_code": item.get("code"),
                "uom_name": uom_name,
                "warehouse_id": mv["warehouse_id"],
                "warehouse_name": wh.get("name") or "Unknown",
                "qty_on_hand": 0.0,
                "valuation": 0.0
            }
            
        grouped[key]["qty_on_hand"] += float(mv["qty_base"])
        grouped[key]["valuation"] += float(mv["total_cost"] or 0.0)
        
    items_list = []
    total_val = 0.0
    for key, data in grouped.items():
        data["qty_on_hand"] = round(data["qty_on_hand"], 4)
        data["valuation"] = round(data["valuation"], 2)
        items_list.append(data)
        total_val += data["valuation"]
        
    return {
        "date": date,
        "items": items_list,
        "total_valuation": round(total_val, 2)
    }

@router.get("/inventory/valuation", response_model=StockValuationResponse, tags=["Inventory"])
async def get_inventory_valuation(
    warehouse_id: Optional[UUID] = None,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("inventory.view"))
):
    wh_res = db.table("warehouses").select("id, name").eq("org_id", org_id).execute()
    if not wh_res.data:
        return {"items": [], "total_valuation": 0.0}
        
    wh_ids = [w["id"] for w in wh_res.data]
    wh_names = {w["id"]: w["name"] for w in wh_res.data}
    
    query = db.table("stock_lots") \
        .select("id, warehouse_id, item_id, lot_number, qty_base, unit_cost_base, production_date, expiry_date, received_at, items(name, code, uom_base(name))") \
        .in_("warehouse_id", wh_ids) \
        .eq("is_exhausted", False)
        
    if warehouse_id:
        query = query.eq("warehouse_id", str(warehouse_id))
        
    lots_res = query.execute()
    lots = lots_res.data or []
    
    grouped = {}
    for lot in lots:
        item = lot.get("items") or {}
        uom_base = item.get("uom_base") or {}
        uom_name = uom_base.get("name") if isinstance(uom_base, dict) else ""
        
        key = (lot["item_id"], lot["warehouse_id"])
        if key not in grouped:
            grouped[key] = {
                "item_id": lot["item_id"],
                "item_name": item.get("name") or "Unknown",
                "item_code": item.get("code"),
                "uom_name": uom_name,
                "warehouse_id": lot["warehouse_id"],
                "warehouse_name": wh_names.get(lot["warehouse_id"]) or "Unknown",
                "qty_on_hand": 0.0,
                "valuation": 0.0,
                "lots_detail": []
            }
            
        qty = float(lot["qty_base"])
        cost = float(lot["unit_cost_base"])
        val = qty * cost
        
        grouped[key]["qty_on_hand"] += qty
        grouped[key]["valuation"] += val
        
        received_str = str(lot["received_at"])
        
        grouped[key]["lots_detail"].append({
            "lot_id": lot["id"],
            "lot_number": lot["lot_number"],
            "qty_base": round(qty, 4),
            "unit_cost_base": round(cost, 4),
            "valuation": round(val, 2),
            "production_date": lot["production_date"],
            "expiry_date": lot["expiry_date"],
            "received_at": received_str
        })
        
    items_list = []
    total_val = 0.0
    for key, data in grouped.items():
        data["qty_on_hand"] = round(data["qty_on_hand"], 4)
        data["valuation"] = round(data["valuation"], 2)
        items_list.append(data)
        total_val += data["valuation"]
        
    return {
        "items": items_list,
        "total_valuation": round(total_val, 2)
    }

@router.get("/inventory/alerts/low-stock", response_model=List[LowStockAlertItem], tags=["Inventory"])
async def get_low_stock_alerts(
    warehouse_id: Optional[UUID] = None,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("inventory.view"))
):
    wh_res = db.table("warehouses").select("id, name").eq("org_id", org_id).execute()
    if not wh_res.data:
        return []
    wh_ids = [w["id"] for w in wh_res.data]
    wh_names = {w["id"]: w["name"] for w in wh_res.data}
    
    stock_query = db.table("stock").select("*, items(name, code, min_stock, uom_base(code))").in_("warehouse_id", wh_ids)
    if warehouse_id:
        stock_query = stock_query.eq("warehouse_id", str(warehouse_id))
        
    stock_res = stock_query.execute()
    alerts = []
    
    for s in (stock_res.data or []):
        item = s.get("items")
        if not item:
            continue
        
        qty_base = float(s["qty_base"] or 0)
        qty_reserved = float(s["qty_reserved"] or 0)
        qty_available = qty_base - qty_reserved
        min_stock = float(item.get("min_stock") or 0)
        
        if qty_available < min_stock:
            uom_code = "un"
            if item.get("uom_base") and isinstance(item["uom_base"], dict):
                uom_code = item["uom_base"].get("code") or "un"
                
            alerts.append({
                "item_id": s["item_id"],
                "item_name": item.get("name") or "Unknown",
                "item_code": item.get("code"),
                "uom_code": uom_code,
                "warehouse_name": wh_names.get(s["warehouse_id"]) or "Unknown",
                "qty_base": qty_base,
                "qty_reserved": qty_reserved,
                "qty_available": qty_available,
                "min_stock": min_stock
            })
            
    alerts.sort(key=lambda x: x["qty_available"])
    return alerts

@router.get("/inventory/purchase-receipts", tags=["Inventory"])
async def list_purchase_receipts(org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("purchase_receipts") \
        .select("*, warehouses(name)") \
        .eq("org_id", org_id) \
        .order("created_at", desc=True) \
        .execute()
    return res.data or []

@router.get("/inventory/issue-documents", tags=["Inventory"])
async def list_issue_documents(org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("issue_documents") \
        .select("*, warehouses(name)") \
        .eq("org_id", org_id) \
        .order("created_at", desc=True) \
        .execute()
    return res.data or []

@router.get("/inventory/purchase-receipts/{receipt_id}", tags=["Inventory"])
async def get_purchase_receipt_detail(receipt_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    # Get header with warehouse and creator name
    res_header = db.table("purchase_receipts").select("*, warehouses(name), profiles:created_by(full_name)").eq("id", str(receipt_id)).execute()
    if not res_header.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    # Get lines with item, base UOM and presentation names
    res_lines = db.table("purchase_receipt_lines") \
        .select("*, items(name, uom_base(name)), uom_presentations(name)") \
        .eq("receipt_id", str(receipt_id)) \
        .execute()

    return {
        "header": res_header.data[0],
        "lines": res_lines.data
    }

@router.get("/inventory/issue-documents/{issue_id}", tags=["Inventory"])
async def get_issue_document_detail(issue_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    # Get header with warehouse and creator name
    res_header = db.table("issue_documents").select("*, warehouses(name), profiles:created_by(full_name)").eq("id", str(issue_id)).execute()
    if not res_header.data:
        raise HTTPException(status_code=404, detail="Issue document not found")

    # Get lines with item, base UOM and presentation names
    res_lines = db.table("issue_document_lines") \
        .select("*, items(name, uom_base(name)), uom_presentations(name)") \
        .eq("issue_id", str(issue_id)) \
        .execute()

    return {
        "header": res_header.data[0],
        "lines": res_lines.data
    }

@router.get("/inventory/movements/reference/{reference_id}", tags=["Inventory"])
async def get_movements_by_reference(reference_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    # Join with items, warehouses and also lot info if available
    res = db.table("stock_movements") \
        .select("*, items(name), warehouses(name), stock_lots(lot_number)") \
        .eq("reference_id", str(reference_id)) \
        .execute()
    return res.data

# ── Inventory: Physical Counts (M39) ───────────────────

@router.post("/inventory/physical-inventories", response_model=PhysicalInventoryResponse, tags=["Inventory"])
async def create_physical_inventory(
    doc: PhysicalInventoryCreate, 
    org_id: str = Depends(get_active_org_id), 
    user=Depends(get_current_user), 
    db=Depends(get_db), 
    _=Depends(require_permission("inventory.count"))
):
    # 1. Generate document number: INV-2026-XXXX
    res_count = db.table("physical_inventories").select("id", count="exact").execute()
    count = res_count.count or 0
    document_number = f"INV-2026-{count + 1:04d}"

    # 2. Insert header
    header_data = {
        "org_id": org_id,
        "warehouse_id": str(doc.warehouse_id),
        "document_number": document_number,
        "status": "draft",
        "notes": doc.notes,
        "created_by": user.id
    }
    header_res = db.table("physical_inventories").insert(header_data).execute()
    if not header_res.data:
        raise HTTPException(status_code=400, detail="Error creating physical inventory header")
    doc_id = header_res.data[0]["id"]

    # 3. Process lines and record expected quantities at draft creation time
    for line in doc.lines:
        # Get expected stock
        stock_res = db.table("stock") \
            .select("qty_base") \
            .eq("warehouse_id", str(doc.warehouse_id)) \
            .eq("item_id", str(line.item_id)) \
            .execute()
        expected = float(stock_res.data[0]["qty_base"]) if stock_res.data else 0.0

        line_data = {
            "physical_inventory_id": doc_id,
            "item_id": str(line.item_id),
            "qty_expected_base": expected,
            "qty_counted_base": float(line.qty_counted_base),
            "presentation_id": str(line.presentation_id) if line.presentation_id else None,
            "qty_presentation": float(line.qty_presentation) if line.qty_presentation is not None else None,
            "notes": line.notes
        }
        db.table("physical_inventory_lines").insert(line_data).execute()

    return await get_physical_inventory_detail(doc_id, db)

@router.get("/inventory/physical-inventories", response_model=List[PhysicalInventoryBriefResponse], tags=["Inventory"])
async def list_physical_inventories(
    org_id: str = Depends(get_active_org_id), 
    db=Depends(get_db), 
    _=Depends(require_permission("inventory.view"))
):
    res = db.table("physical_inventories") \
        .select("*, warehouses(name), profiles:created_by(full_name)") \
        .eq("org_id", org_id) \
        .order("created_at", desc=True) \
        .execute()
    
    results = []
    for r in (res.data or []):
        results.append({
            "id": r["id"],
            "warehouse_id": r["warehouse_id"],
            "warehouse_name": r["warehouses"]["name"] if r.get("warehouses") else "Desconocido",
            "document_number": r["document_number"],
            "status": r["status"],
            "notes": r["notes"],
            "creator_name": r["profiles"]["full_name"] if r.get("profiles") else "Sistema",
            "processed_at": r["processed_at"],
            "created_at": r["created_at"]
        })
    return results

@router.get("/inventory/physical-inventories/{id}", response_model=PhysicalInventoryResponse, tags=["Inventory"])
async def get_physical_inventory_detail(
    id: UUID, 
    db=Depends(get_db), 
    _=Depends(require_permission("inventory.view"))
):
    # Fetch header
    res = db.table("physical_inventories") \
        .select("*, warehouses(name), creator:created_by(full_name), processor:processed_by(full_name)") \
        .eq("id", str(id)) \
        .execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Physical inventory count not found")
    
    h = res.data[0]

    # Fetch lines
    lines_res = db.table("physical_inventory_lines") \
        .select("*, items(name), uom_presentations(name)") \
        .eq("physical_inventory_id", str(id)) \
        .execute()
    
    lines = []
    for l in (lines_res.data or []):
        lines.append({
            "id": l["id"],
            "item_id": l["item_id"],
            "item_name": l["items"]["name"] if l.get("items") else "Desconocido",
            "qty_expected_base": l["qty_expected_base"],
            "qty_counted_base": l["qty_counted_base"],
            "presentation_id": l["presentation_id"],
            "presentation_name": l["uom_presentations"]["name"] if l.get("uom_presentations") else None,
            "qty_presentation": l["qty_presentation"],
            "notes": l["notes"]
        })

    return {
        "id": h["id"],
        "org_id": h["org_id"],
        "warehouse_id": h["warehouse_id"],
        "warehouse_name": h["warehouses"]["name"] if h.get("warehouses") else "Desconocido",
        "document_number": h["document_number"],
        "status": h["status"],
        "notes": h["notes"],
        "created_by": h["created_by"],
        "creator_name": h["creator"]["full_name"] if h.get("creator") else "Desconocido",
        "processed_by": h.get("processed_by"),
        "processor_name": h["processor"]["full_name"] if h.get("processor") else None,
        "processed_at": h.get("processed_at"),
        "created_at": h["created_at"],
        "lines": lines
    }

@router.put("/inventory/physical-inventories/{id}", response_model=PhysicalInventoryResponse, tags=["Inventory"])
async def update_physical_inventory(
    id: UUID, 
    doc: PhysicalInventoryCreate, 
    db=Depends(get_db), 
    _=Depends(require_permission("inventory.count"))
):
    # Verify status is draft
    check_res = db.table("physical_inventories").select("status").eq("id", str(id)).execute()
    if not check_res.data:
        raise HTTPException(status_code=404, detail="Physical inventory count not found")
    if check_res.data[0]["status"] != "draft":
        raise HTTPException(status_code=400, detail="Cannot update a processed inventory count")

    # Update header notes
    db.table("physical_inventories").update({"notes": doc.notes}).eq("id", str(id)).execute()

    # Clear and insert new lines
    db.table("physical_inventory_lines").delete().eq("physical_inventory_id", str(id)).execute()

    for line in doc.lines:
        stock_res = db.table("stock") \
            .select("qty_base") \
            .eq("warehouse_id", str(doc.warehouse_id)) \
            .eq("item_id", str(line.item_id)) \
            .execute()
        expected = float(stock_res.data[0]["qty_base"]) if stock_res.data else 0.0

        line_data = {
            "physical_inventory_id": str(id),
            "item_id": str(line.item_id),
            "qty_expected_base": expected,
            "qty_counted_base": float(line.qty_counted_base),
            "presentation_id": str(line.presentation_id) if line.presentation_id else None,
            "qty_presentation": float(line.qty_presentation) if line.qty_presentation is not None else None,
            "notes": line.notes
        }
        db.table("physical_inventory_lines").insert(line_data).execute()

    return await get_physical_inventory_detail(id, db)

@router.post("/inventory/physical-inventories/{id}/process", response_model=PhysicalInventoryResponse, tags=["Inventory"])
async def process_physical_inventory(
    id: UUID, 
    org_id: str = Depends(get_active_org_id), 
    user=Depends(get_current_user), 
    db=Depends(get_db), 
    _=Depends(require_permission("inventory.audit_count"))
):
    # Fetch header
    h_res = db.table("physical_inventories").select("*").eq("id", str(id)).execute()
    if not h_res.data:
        raise HTTPException(status_code=404, detail="Physical inventory count not found")
    
    h = h_res.data[0]
    if h["status"] != "draft":
        raise HTTPException(status_code=400, detail="Inventory count has already been processed")

    warehouse_id = h["warehouse_id"]

    # Fetch lines
    lines_res = db.table("physical_inventory_lines").select("*").eq("physical_inventory_id", str(id)).execute()
    lines = lines_res.data or []

    # Process each counted line applying stock adjustments
    for line in lines:
        item_id = line["item_id"]
        qty_counted = float(line["qty_counted_base"])
        
        # 1. Fetch current stock from system
        stock_res = db.table("stock") \
            .select("id, qty_base") \
            .eq("warehouse_id", warehouse_id) \
            .eq("item_id", item_id) \
            .execute()
        
        qty_expected = float(stock_res.data[0]["qty_base"]) if stock_res.data else 0.0
        
        # Update expected value in the document line database to snapshot the state at execution
        db.table("physical_inventory_lines") \
            .update({"qty_expected_base": qty_expected}) \
            .eq("id", line["id"]) \
            .execute()
            
        difference = qty_counted - qty_expected
        
        if difference > 0:
            # Positive Adjustment: Add stock lot & Adjustment In movement
            # Try to get the item's last purchase cost
            item_cost_res = db.table("items").select("last_purchase_cost").eq("id", item_id).execute()
            cost = float(item_cost_res.data[0]["last_purchase_cost"]) if (item_cost_res.data and item_cost_res.data[0]["last_purchase_cost"]) else 0.0

            # Insert lot
            lot_data = {
                "warehouse_id": warehouse_id,
                "item_id": item_id,
                "lot_number": f"AJUSTE-{h['document_number']}",
                "qty_base": difference,
                "unit_cost_base": cost,
                "is_exhausted": False
            }
            lot_res = db.table("stock_lots").insert(lot_data).execute()
            lot_id = lot_res.data[0]["id"] if lot_res.data else None

            # Log movement
            movement_data = {
                "org_id": org_id,
                "movement_type": "adjustment_in",
                "warehouse_id": warehouse_id,
                "item_id": item_id,
                "lot_id": lot_id,
                "qty_base": difference,
                "unit_cost_base": cost,
                "total_cost": difference * cost,
                "reference_id": str(id),
                "reference_type": "physical_inventory",
                "notes": f"Ajuste por diferencia de inventario {h['document_number']}",
                "created_by": user.id
            }
            db.table("stock_movements").insert(movement_data).execute()

            # Update stock
            if stock_res.data:
                new_qty = qty_expected + difference
                db.table("stock").update({"qty_base": new_qty}).eq("id", stock_res.data[0]["id"]).execute()
            else:
                db.table("stock").insert({
                    "warehouse_id": warehouse_id,
                    "item_id": item_id,
                    "qty_base": difference,
                    "qty_reserved": 0.0
                }).execute()

        elif difference < 0:
            # Negative Adjustment: Consume FIFO lots & Adjustment Out movement
            to_consume = abs(difference)
            
            # Fetch oldest non-exhausted lots for FIFO
            lots_res = db.table("stock_lots") \
                .select("*") \
                .eq("item_id", item_id) \
                .eq("warehouse_id", warehouse_id) \
                .filter("qty_base", "gt", 0) \
                .order("received_at", desc=False) \
                .execute()
                
            remaining = to_consume
            for lot in (lots_res.data or []):
                if remaining <= 0:
                    break
                
                lot_qty = float(lot["qty_base"])
                consume_qty = min(remaining, lot_qty)
                
                new_lot_qty = lot_qty - consume_qty
                db.table("stock_lots").update({
                    "qty_base": new_lot_qty,
                    "is_exhausted": new_lot_qty <= 0
                }).eq("id", lot["id"]).execute()
                
                # Log movement
                movement_data = {
                    "org_id": org_id,
                    "movement_type": "adjustment_out",
                    "warehouse_id": warehouse_id,
                    "item_id": item_id,
                    "lot_id": lot["id"],
                    "qty_base": -consume_qty,
                    "unit_cost_base": float(lot["unit_cost_base"]),
                    "total_cost": -consume_qty * float(lot["unit_cost_base"]),
                    "reference_id": str(id),
                    "reference_type": "physical_inventory",
                    "notes": f"Consumo por ajuste físico {h['document_number']}",
                    "created_by": user.id
                }
                db.table("stock_movements").insert(movement_data).execute()
                
                remaining -= consume_qty

            # Update overall stock
            if stock_res.data:
                new_qty = max(0, float(stock_res.data[0]["qty_base"]) - to_consume)
                db.table("stock").update({"qty_base": new_qty}).eq("id", stock_res.data[0]["id"]).execute()

    # 4. Set processed status
    db.table("physical_inventories").update({
        "status": "processed",
        "processed_by": user.id,
        "processed_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", str(id)).execute()

    return await get_physical_inventory_detail(id, db)

@router.post("/inventory/bulk-adjust-stock", response_model=BulkStockAdjustResponse, tags=["Inventory"])
async def bulk_adjust_stock(
    body: BulkStockAdjustRequest,
    org_id: str = Depends(get_active_org_id),
    user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory.audit_count"))
):
    # Verify warehouse exists and belongs to active org
    wh_res = db.table("warehouses").select("id").eq("id", str(body.warehouse_id)).eq("org_id", org_id).execute()
    if not wh_res.data:
        raise HTTPException(status_code=404, detail="Warehouse not found or access denied")

    results = []
    for adj in body.adjustments:
        item_code = adj.item_code
        qty_counted = adj.qty_counted
        
        # 1. Fetch item
        item_res = db.table("items").select("id, last_purchase_cost").eq("code", item_code).eq("org_id", org_id).execute()
        if not item_res.data:
            results.append(StockAdjustResult(
                item_code=item_code,
                status="error",
                error_message="Artículo no registrado",
                qty_counted=qty_counted
            ))
            continue
            
        item = item_res.data[0]
        item_id = item["id"]
        last_purchase_cost = float(item["last_purchase_cost"]) if item.get("last_purchase_cost") is not None else 0.0
        
        # 2. Get expected quantity in stock
        stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", str(body.warehouse_id)).eq("item_id", str(item_id)).execute()
        qty_expected = float(stock_res.data[0]["qty_base"]) if stock_res.data else 0.0
        
        difference = qty_counted - qty_expected
        
        if difference == 0.0:
            results.append(StockAdjustResult(
                item_code=item_code,
                status="success",
                qty_expected=qty_expected,
                qty_counted=qty_counted,
                difference=0.0
            ))
            continue
            
        # 3. Process adjustments
        try:
            if difference > 0.0:
                # Positive Adjustment
                # Create stock lot
                lot_data = {
                    "warehouse_id": str(body.warehouse_id),
                    "item_id": str(item_id),
                    "lot_number": "AJUSTE-IMPORTACION",
                    "qty_base": difference,
                    "unit_cost_base": last_purchase_cost,
                    "is_exhausted": False
                }
                lot_res = db.table("stock_lots").insert(lot_data).execute()
                if not lot_res.data:
                    raise Exception("Error creating stock lot")
                lot_id = lot_res.data[0]["id"]
                
                # Log movement
                movement_data = {
                    "org_id": org_id,
                    "movement_type": "adjustment_in",
                    "warehouse_id": str(body.warehouse_id),
                    "item_id": str(item_id),
                    "lot_id": lot_id,
                    "qty_base": difference,
                    "unit_cost_base": last_purchase_cost,
                    "total_cost": difference * last_purchase_cost,
                    "created_by": user.id,
                    "notes": "Ajuste de stock por importación de Excel"
                }
                db.table("stock_movements").insert(movement_data).execute()
                
                # Update stock
                if stock_res.data:
                    db.table("stock").update({
                        "qty_base": qty_expected + difference
                    }).eq("id", stock_res.data[0]["id"]).execute()
                else:
                    db.table("stock").insert({
                        "warehouse_id": str(body.warehouse_id),
                        "item_id": str(item_id),
                        "qty_base": difference
                    }).execute()
                    
            else:
                # Negative Adjustment
                qty_to_consume = abs(difference)
                
                # Fetch non-exhausted lots for this item/warehouse, ordered by received_at asc
                lots_res = db.table("stock_lots") \
                    .select("id, qty_base, unit_cost_base") \
                    .eq("item_id", str(item_id)) \
                    .eq("warehouse_id", str(body.warehouse_id)) \
                    .eq("is_exhausted", False) \
                    .order("received_at", desc=False) \
                    .execute()
                
                remaining = qty_to_consume
                available_lots = lots_res.data or []
                
                for lot in available_lots:
                    if remaining <= 0.0:
                        break
                    lot_qty = float(lot["qty_base"])
                    consume_qty = min(remaining, lot_qty)
                    
                    new_lot_qty = lot_qty - consume_qty
                    db.table("stock_lots").update({
                        "qty_base": new_lot_qty,
                        "is_exhausted": new_lot_qty <= 0.0
                    }).eq("id", lot["id"]).execute()
                    
                    # Log movement
                    movement_data = {
                        "org_id": org_id,
                        "movement_type": "adjustment_out",
                        "warehouse_id": str(body.warehouse_id),
                        "item_id": str(item_id),
                        "lot_id": lot["id"],
                        "qty_base": -consume_qty,
                        "unit_cost_base": float(lot["unit_cost_base"]),
                        "total_cost": -consume_qty * float(lot["unit_cost_base"]),
                        "created_by": user.id,
                        "notes": "Ajuste de stock por importación de Excel"
                    }
                    db.table("stock_movements").insert(movement_data).execute()
                    
                    remaining -= consume_qty
                
                # Discrepancy: if remaining > 0, log adjustment_out without lot_id
                if remaining > 0.0:
                    movement_data = {
                        "org_id": org_id,
                        "movement_type": "adjustment_out",
                        "warehouse_id": str(body.warehouse_id),
                        "item_id": str(item_id),
                        "lot_id": None,
                        "qty_base": -remaining,
                        "unit_cost_base": last_purchase_cost,
                        "total_cost": -remaining * last_purchase_cost,
                        "created_by": user.id,
                        "notes": "Ajuste de stock por importación de Excel (ajuste de diferencia sin lote)"
                    }
                    db.table("stock_movements").insert(movement_data).execute()
                
                # Update main stock table to physical counted qty
                if stock_res.data:
                    db.table("stock").update({
                        "qty_base": max(0.0, qty_counted)
                    }).eq("id", stock_res.data[0]["id"]).execute()
                else:
                    db.table("stock").insert({
                        "warehouse_id": str(body.warehouse_id),
                        "item_id": str(item_id),
                        "qty_base": max(0.0, qty_counted)
                    }).execute()
                    
            results.append(StockAdjustResult(
                item_code=item_code,
                status="success",
                qty_expected=qty_expected,
                qty_counted=qty_counted,
                difference=difference
            ))
            
        except Exception as e:
            results.append(StockAdjustResult(
                item_code=item_code,
                status="error",
                error_message=str(e),
                qty_expected=qty_expected,
                qty_counted=qty_counted,
                difference=difference
            ))
            
    return BulkStockAdjustResponse(results=results)
