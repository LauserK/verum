from fastapi import APIRouter, Depends, Header, HTTPException
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import pytz
import uuid

from database import get_db
from app.deps import get_active_org_id, require_permission
from auth_deps import security, get_current_user
from permissions import resolve_permission

# Import schemas
from app.inventory.schemas import (
    CreateAssetCategoryRequest, UpdateAssetCategoryRequest, CreateAssetRequest, UpdateAssetRequest, AssetReviewRequest,
    CreateUtensilCategoryRequest, UpdateUtensilCategoryRequest, CreateUtensilRequest, UpdateUtensilRequest,
    CreateTicketRequest, CreateTicketEntryRequest, CloseTicketRequest,
    UtensilMovementRequest, UtensilCountItemSchema, CreateUtensilCountRequest, ConfirmCountItemSchema, ConfirmCountRequest,
    CreateCountScheduleRequest, UpdateCountScheduleRequest,
    InventoryDocumentLineSchema, InventoryDocumentCreate, InventoryDocumentUpdate,
    InventoryDocumentLineResponse, InventoryDocumentResponse,
    TransferReceiveLineSchema, TransferReceiveRequest
)

CARACAS_TZ = pytz.timezone("America/Caracas")

router = APIRouter(prefix="", tags=["Inventory"])

# ── Inventory: Assets Endpoints (M8) ─────────────────────

@router.get("/asset-categories")
async def list_asset_categories(db=Depends(get_db), org_id: str = Depends(get_active_org_id)):
    res = db.table("asset_categories").select("*").eq("org_id", org_id).execute()
    return res.data or []

@router.post("/asset-categories")
async def create_asset_category(body: CreateAssetCategoryRequest, db=Depends(get_db), _=Depends(require_permission("inventory_assets.manage_categories" if False else "inventory_assets.create"))): # Using create as generic admin fallback for now
    res = db.table("asset_categories").insert(body.dict(exclude_none=True)).execute()
    return res.data[0]

@router.patch("/asset-categories/{category_id}")
async def update_asset_category(category_id: str, body: UpdateAssetCategoryRequest, db=Depends(get_db), _=Depends(require_permission("inventory_assets.edit"))):
    payload = body.dict(exclude_none=True)
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("asset_categories").update(payload).eq("id", category_id).execute()
    return res.data[0] if res.data else {}

@router.get("/assets")
async def list_assets(venue_id: Optional[str] = None, status: Optional[str] = None, category_id: Optional[str] = None, include_archived: bool = False, db=Depends(get_db), _=Depends(require_permission("inventory_assets.view")), org_id: str = Depends(get_active_org_id)):
    query = db.table("assets").select("*, asset_categories(name)").eq("org_id", org_id)
    if venue_id:
        query = query.eq("venue_id", venue_id)
    if status:
        query = query.eq("status", status)
    elif not include_archived:
        query = query.neq("status", "baja")
    if category_id:
        query = query.eq("category_id", category_id)
        
    res = query.execute()
    return res.data or []

@router.post("/assets")
async def create_asset(body: CreateAssetRequest, db=Depends(get_db), _=Depends(require_permission("inventory_assets.create"))):
    import uuid
    payload = body.dict(exclude_none=True)
    payload["qr_code"] = str(uuid.uuid4())
    res = db.table("assets").insert(payload).execute()
    return res.data[0]

@router.get("/assets/{asset_id}")
async def get_asset(asset_id: str, db=Depends(get_db), _=Depends(require_permission("inventory_assets.view"))):
    res = db.table("assets").select("*, asset_categories(name)").eq("id", asset_id).execute()
    if not res.data:
        raise HTTPException(404, "Asset not found")
    return res.data[0]

@router.patch("/assets/{asset_id}")
async def update_asset(asset_id: str, body: UpdateAssetRequest, db=Depends(get_db), _=Depends(require_permission("inventory_assets.edit"))):
    payload = body.dict(exclude_none=True)
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("assets").update(payload).eq("id", asset_id).execute()
    return res.data[0] if res.data else {}

@router.get("/assets/qr/{qr_code}")
async def resolve_asset_by_qr(qr_code: str, db=Depends(get_db), current_user=Depends(get_current_user)):
    # Any authenticated user can scan a QR to get the asset summary
    res = db.table("assets").select("*, asset_categories(name, icon, review_interval_days)").eq("qr_code", qr_code).execute()
    if not res.data:
        raise HTTPException(404, "Asset not found for this QR")
    return res.data[0]

@router.post("/assets/{asset_id}/review")
async def review_asset(asset_id: str, body: AssetReviewRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("inventory_assets.review"))):
    from datetime import datetime, timezone
    
    now_iso = datetime.now(timezone.utc).isoformat()

    # Insert review log
    review_data = {
        "asset_id": asset_id,
        "reviewed_by": current_user.id,
        "notes": body.notes,
        "photo_url": body.photo_url
    }
    db.table("asset_reviews").insert(review_data).execute()
    
    # Update asset last_reviewed_at
    res = db.table("assets").update({"last_reviewed_at": now_iso}).eq("id", asset_id).execute()
    
    # Auto-create closed ticket for the review history
    ticket_data = {
        "asset_id": asset_id,
        "opened_by": current_user.id,
        "title": "Revisión Preventiva",
        "priority": "baja",
        "status": "resuelto",
        "closed_at": now_iso,
        "closed_by": current_user.id
    }
    ticket_res = db.table("repair_tickets").insert(ticket_data).execute()
    
    if ticket_res.data:
        ticket = ticket_res.data[0]
        entry_data = {
            "ticket_id": ticket["id"],
            "created_by": current_user.id,
            "type": "nota",
            "description": body.notes or "Revisión preventiva completada sin novedades.",
            "status_after": "resuelto"
        }
        db.table("repair_ticket_entries").insert(entry_data).execute()
    
    return {"ok": True, "asset": res.data[0] if res.data else None}


# ── Inventory: Utensils Endpoints (M10) ───────────────────

@router.get("/utensil-categories")
async def list_utensil_categories(db=Depends(get_db), org_id: str = Depends(get_active_org_id)):
    res = db.table("utensil_categories").select("*").eq("org_id", org_id).execute()
    return res.data or []

@router.post("/utensil-categories")
async def create_utensil_category(body: CreateUtensilCategoryRequest, db=Depends(get_db), _=Depends(require_permission("inventory_utensils.manage_categories" if False else "inventory_utensils.create"))): # Using create as generic admin fallback for now
    res = db.table("utensil_categories").insert(body.dict(exclude_none=True)).execute()
    return res.data[0]

@router.patch("/utensil-categories/{category_id}")
async def update_utensil_category(category_id: str, body: UpdateUtensilCategoryRequest, db=Depends(get_db), _=Depends(require_permission("inventory_utensils.manage_items" if False else "inventory_utensils.edit"))):
    payload = body.dict(exclude_none=True)
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("utensil_categories").update(payload).eq("id", category_id).execute()
    return res.data[0] if res.data else {}

@router.get("/utensils")
async def list_utensils(category_id: Optional[str] = None, include_archived: bool = False, db=Depends(get_db), org_id: str = Depends(get_active_org_id)):
    query = db.table("utensils").select("*, utensil_categories(name)").eq("org_id", org_id)
    if not include_archived:
        query = query.eq("is_active", True)
    if category_id:
        query = query.eq("category_id", category_id)
        
    res = query.execute()
    return res.data or []

@router.post("/utensils")
async def create_utensil(body: CreateUtensilRequest, db=Depends(get_db), _=Depends(require_permission("inventory_utensils.manage_items" if False else "inventory_utensils.create"))):
    payload = body.dict(exclude_none=True)
    res = db.table("utensils").insert(payload).execute()
    return res.data[0]

@router.patch("/utensils/{utensil_id}")
async def update_utensil(utensil_id: str, body: UpdateUtensilRequest, db=Depends(get_db), _=Depends(require_permission("inventory_utensils.manage_items" if False else "inventory_utensils.edit"))):
    payload = body.dict(exclude_none=True)
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("utensils").update(payload).eq("id", utensil_id).execute()
    return res.data[0] if res.data else {}

# ── Inventory: Repair Tickets Endpoints (M9) ─────────────

@router.post("/assets/{asset_id}/tickets")
async def open_repair_ticket(
    asset_id: str,
    body: CreateTicketRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_assets.report_fault")),
):
    """Opens a new repair ticket for an asset. Sets asset status to 'en_reparacion'."""
    try:
        # Check asset exists
        asset_res = db.table("assets").select("id, status").eq("id", asset_id).execute()
        if not asset_res.data:
            raise HTTPException(404, "Asset not found")

        # Check no open ticket already exists
        existing = (
            db.table("repair_tickets")
            .select("id")
            .eq("asset_id", asset_id)
            .neq("status", "resuelto")
            .execute()
        )
        if existing.data and len(existing.data) > 0:
            raise HTTPException(400, "This asset already has an open ticket")

        # Create ticket
        ticket_data = {
            "asset_id": asset_id,
            "opened_by": current_user.id,
            "title": body.title,
            "priority": body.priority,
        }
        ticket_res = db.table("repair_tickets").insert(ticket_data).execute()
        ticket = ticket_res.data[0]

        # Create initial entry (apertura)
        entry_data = {
            "ticket_id": ticket["id"],
            "created_by": current_user.id,
            "type": "nota",
            "description": body.description,
            "attachments": [body.photo_url] if body.photo_url else None,
            "status_after": "abierto",
        }
        db.table("repair_ticket_entries").insert(entry_data).execute()

        # Update asset status
        db.table("assets").update({"status": "en_reparacion"}).eq("id", asset_id).execute()

        return ticket

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assets/{asset_id}/tickets")
async def list_asset_tickets(
    asset_id: str,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_assets.view")),
):
    """Returns all tickets for an asset (active and closed), with cost summary."""
    try:
        res = (
            db.table("repair_tickets")
            .select("*, profiles!repair_tickets_opened_by_fkey(full_name)")
            .eq("asset_id", asset_id)
            .order("opened_at", desc=True)
            .execute()
        )
        tickets = res.data or []

        # Enrich with cost data from entries
        ticket_ids = [t["id"] for t in tickets]
        if ticket_ids:
            entries_res = (
                db.table("repair_ticket_entries")
                .select("ticket_id, cost, type")
                .in_("ticket_id", ticket_ids)
                .execute()
            )
            # Aggregate costs per ticket
            cost_map: dict = {}
            entry_count_map: dict = {}
            for e in (entries_res.data or []):
                tid = e["ticket_id"]
                if tid not in cost_map:
                    cost_map[tid] = 0
                    entry_count_map[tid] = 0
                if e.get("cost"):
                    cost_map[tid] += float(e["cost"])
                entry_count_map[tid] += 1

            for t in tickets:
                t["total_cost"] = cost_map.get(t["id"], 0)
                t["entry_count"] = entry_count_map.get(t["id"], 0)

        return tickets

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets")
async def list_tickets(
    venue_id: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_assets.view")),
    org_id: str = Depends(get_active_org_id),
):
    query = (
        db.table("repair_tickets")
        .select("*, assets!inner(id, name, venue_id, org_id), profiles!repair_tickets_opened_by_fkey(full_name)")
        .eq("assets.org_id", org_id)
        .order("opened_at", desc=True)
    )
    if venue_id:
        query = query.eq("assets.venue_id", venue_id)
    if status:
        if status == "active":
            query = query.neq("status", "resuelto")
        else:
            query = query.eq("status", status)
    if priority:
        query = query.eq("priority", priority)
    
    res = query.execute()
    return res.data or []


@router.get("/tickets/{ticket_id}")
async def get_ticket_detail(
    ticket_id: str,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_assets.view")),
):
    """Returns a ticket with all its entries ordered chronologically."""
    try:
        # Get ticket
        ticket_res = (
            db.table("repair_tickets")
            .select("*, assets(id, name, qr_code, venue_id, status), profiles!repair_tickets_opened_by_fkey(full_name)")
            .eq("id", ticket_id)
            .execute()
        )
        if not ticket_res.data:
            raise HTTPException(404, "Ticket not found")

        ticket = ticket_res.data[0]

        # Get entries
        entries_res = (
            db.table("repair_ticket_entries")
            .select("*, profiles!repair_ticket_entries_created_by_fkey(full_name)")
            .eq("ticket_id", ticket_id)
            .order("created_at")
            .execute()
        )
        ticket["entries"] = entries_res.data or []

        # Calculate total cost
        total_cost = sum(
            float(e["cost"]) for e in ticket["entries"] if e.get("cost")
        )
        ticket["total_cost"] = total_cost

        return ticket

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tickets/{ticket_id}/entries")
async def add_ticket_entry(
    ticket_id: str,
    body: CreateTicketEntryRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_assets.add_ticket_entry")),
):
    """
    Adds an entry to a ticket. Updates ticket status per status_after.
    Does NOT update asset.last_reviewed_at (only closing does that).
    If user selects status_after='resuelto' but lacks close_ticket permission,
    entry is saved with status_after='en_progreso' instead.
    """
    try:
        # Check ticket exists and is not closed
        ticket_res = (
            db.table("repair_tickets")
            .select("id, asset_id, status")
            .eq("id", ticket_id)
            .execute()
        )
        if not ticket_res.data:
            raise HTTPException(404, "Ticket not found")

        ticket = ticket_res.data[0]
        if ticket["status"] == "resuelto":
            raise HTTPException(400, "Cannot add entries to a closed ticket")

        # Check if user is trying to close via entry
        effective_status = body.status_after
        if body.status_after == "resuelto":
            has_close = await resolve_permission(
                current_user.id, "inventory_assets.close_ticket", db
            )
            if not has_close:
                # Downgrade to en_progreso, don't block the entry
                effective_status = "en_progreso"

        # Create entry
        entry_data = {
            "ticket_id": ticket_id,
            "created_by": current_user.id,
            "type": body.type,
            "description": body.description,
            "technician": body.technician,
            "cost": body.cost,
            "attachments": body.attachments,
            "next_action": body.next_action,
            "status_after": effective_status,
        }
        entry_res = db.table("repair_ticket_entries").insert(entry_data).execute()

        # Update ticket status if status_after provided
        if effective_status:
            update_data: dict = {"status": effective_status}
            if effective_status == "resuelto":
                now_iso = datetime.now(timezone.utc).isoformat()
                update_data["closed_at"] = now_iso
                update_data["closed_by"] = current_user.id
                # Also update asset
                db.table("assets").update({
                    "status": "operativo",
                    "last_reviewed_at": now_iso,
                }).eq("id", ticket["asset_id"]).execute()

            db.table("repair_tickets").update(update_data).eq("id", ticket_id).execute()

        return entry_res.data[0] if entry_res.data else {"ok": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/tickets/{ticket_id}/close")
async def close_ticket(
    ticket_id: str,
    body: CloseTicketRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_assets.close_ticket")),
):
    """
    Closes a repair ticket. Creates a 'cierre' entry, sets ticket to 'resuelto',
    updates asset status to 'operativo' and asset.last_reviewed_at.
    """
    try:
        # Get ticket
        ticket_res = (
            db.table("repair_tickets")
            .select("id, asset_id, status")
            .eq("id", ticket_id)
            .execute()
        )
        if not ticket_res.data:
            raise HTTPException(404, "Ticket not found")

        ticket = ticket_res.data[0]
        if ticket["status"] == "resuelto":
            raise HTTPException(400, "Ticket is already closed")

        now_iso = datetime.now(timezone.utc).isoformat()

        # Create cierre entry
        entry_data = {
            "ticket_id": ticket_id,
            "created_by": current_user.id,
            "type": "cierre",
            "description": body.description,
            "cost": body.cost,
            "attachments": body.attachments,
            "status_after": "resuelto",
        }
        db.table("repair_ticket_entries").insert(entry_data).execute()

        # Close ticket
        db.table("repair_tickets").update({
            "status": "resuelto",
            "closed_at": now_iso,
            "closed_by": current_user.id,
        }).eq("id", ticket_id).execute()

        # Update asset: back to operativo + update last_reviewed_at
        db.table("assets").update({
            "status": "operativo",
            "last_reviewed_at": now_iso,
        }).eq("id", ticket["asset_id"]).execute()

        return {"ok": True, "closed_at": now_iso}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Inventory: Utensil Movements & Counts Endpoints (M11) ──

@router.post("/utensil-movements")
async def record_utensil_movement(
    body: UtensilMovementRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.manage_items")),
):
    """
    Records an inventory movement (entry, exit, transfer).
    """
    try:
        # Get org_id from utensil
        ut_res = db.table("utensils").select("org_id").eq("id", body.utensil_id).single().execute()
        if not ut_res.data:
            raise HTTPException(404, "Utensil not found")
        org_id = ut_res.data["org_id"]

        movement_data = {
            "org_id": org_id,
            "utensil_id": body.utensil_id,
            "from_venue_id": body.from_venue_id,
            "to_venue_id": body.to_venue_id,
            "quantity": body.quantity,
            "type": body.type,
            "created_by": current_user.id,
            "notes": body.notes,
        }
        res = db.table("utensil_movements").insert(movement_data).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/utensil-counts")
async def create_utensil_count(
    body: CreateUtensilCountRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.count")),
):
    """
    Staff submits a physical count for a venue.
    """
    try:
        # 1. Create count header
        count_data = {
            "venue_id": body.venue_id,
            "created_by": current_user.id,
            "status": "pending",
            "schedule_id": body.schedule_id,
        }
        count_res = db.table("utensil_counts").insert(count_data).execute()
        count_id = count_res.data[0]["id"]

        # 2. Create count items
        items_data = [
            {
                "count_id": count_id,
                "utensil_id": item.utensil_id,
                "initial_count": item.count,
            }
            for item in body.items
        ]
        db.table("utensil_count_items").insert(items_data).execute()

        # 3. Update schedule if exists
        if body.schedule_id:
            now_iso = datetime.now(timezone.utc).isoformat()
            
            # Fetch schedule to get frequency
            sched_res = db.table("count_schedules").select("frequency, next_due").eq("id", body.schedule_id).single().execute()
            if sched_res.data:
                freq = sched_res.data["frequency"]
                
                updates = {"last_completed_at": now_iso}
                
                if freq == "one_time":
                    updates["is_active"] = False
                else:
                    from datetime import timedelta
                    current_due = datetime.fromisoformat(sched_res.data["next_due"]) if "T" in sched_res.data["next_due"] else datetime.strptime(sched_res.data["next_due"], "%Y-%m-%d")
                    # simple calculation, could be more complex depending on timezone
                    if freq == "daily":
                        next_due = current_due + timedelta(days=1)
                    elif freq == "weekly":
                        next_due = current_due + timedelta(days=7)
                    elif freq == "biweekly":
                        next_due = current_due + timedelta(days=14)
                    elif freq == "monthly":
                        next_due = current_due + timedelta(days=30) # approx
                    else:
                        next_due = current_due
                        
                    updates["next_due"] = next_due.strftime("%Y-%m-%d")

                db.table("count_schedules").update(updates).eq("id", body.schedule_id).execute()

        return {"id": count_id, "status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/utensil-counts")
async def list_utensil_counts(
    venue_id: Optional[str] = None,
    status: Optional[str] = None,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.view")),
):
    """
    Lists utensil counts with optional filters.
    """
    query = db.table("utensil_counts").select("*, profiles!utensil_counts_created_by_fkey(full_name)")
    if venue_id:
        query = query.eq("venue_id", venue_id)
    if status:
        query = query.eq("status", status)
    
    res = query.order("created_at", desc=True).execute()
    return res.data


@router.get("/utensil-counts/{count_id}")
async def get_utensil_count_detail(
    count_id: str,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.view")),
):
    """
    Returns full detail of a specific count.
    """
    # Header
    count_res = db.table("utensil_counts").select("*, profiles!utensil_counts_created_by_fkey(full_name), venues(name)").eq("id", count_id).single().execute()
    if not count_res.data:
        raise HTTPException(404, "Count not found")
    
    result = count_res.data

    if result.get("confirmed_by"):
        conf_res = db.table("profiles").select("full_name").eq("id", result["confirmed_by"]).single().execute()
        if conf_res.data:
            result["confirmed_by_user"] = conf_res.data["full_name"]

    # Items
    items_res = db.table("utensil_count_items").select("*, utensils(name, unit)").eq("count_id", count_id).execute()
    
    result["items"] = items_res.data
    return result


@router.patch("/utensil-counts/{count_id}/confirm")
async def confirm_utensil_count(
    count_id: str,
    body: ConfirmCountRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.confirm_count")),
):
    """
    Supervisor confirms/adjusts a count.
    """
    try:
        # 1. Update items with confirmed quantities
        for item in body.items:
            db.table("utensil_count_items").update({
                "confirmed_count": item.confirmed_count
            }).eq("count_id", count_id).eq("utensil_id", item.utensil_id).execute()

        # 2. Update header status
        now_iso = datetime.now(timezone.utc).isoformat()
        db.table("utensil_counts").update({
            "status": "confirmed",
            "confirmed_at": now_iso,
            "confirmed_by": current_user.id
        }).eq("id", count_id).execute()

        return {"ok": True, "confirmed_at": now_iso}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Inventory: Count Schedules Endpoints (M11.2) ──
@router.post("/count-schedules")
async def create_count_schedule(
    body: CreateCountScheduleRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.manage_items"))
):
    try:
        # Get org_id from venue
        venue_res = db.table("venues").select("org_id").eq("id", body.venue_id).single().execute()
        if not venue_res.data:
            raise HTTPException(404, "Venue not found")
            
        schedule_data = {
            "org_id": venue_res.data["org_id"],
            "venue_id": body.venue_id,
            "assigned_to": body.assigned_to,
            "name": body.name,
            "frequency": body.frequency,
            "scope": body.scope,
            "category_id": body.category_id,
            "next_due": body.next_due,
            "created_by": current_user.id
        }
        
        res = db.table("count_schedules").insert(schedule_data).execute()
        schedule_id = res.data[0]["id"]
        
        # Insert specific items if scope is custom
        if body.scope == "custom" and body.item_ids:
            items_data = [{"schedule_id": schedule_id, "item_id": item_id} for item_id in body.item_ids]
            db.table("count_schedule_items").insert(items_data).execute()
            
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/count-schedules")
async def list_count_schedules(
    venue_id: Optional[str] = None,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.view"))
):
    query = db.table("count_schedules").select("*, profiles!count_schedules_assigned_to_fkey(full_name), venues(name)").order("created_at", desc=True)
    if venue_id:
        query = query.eq("venue_id", venue_id)
    
    res = query.execute()
    schedules = res.data or []
    
    # Attach items if it's a custom scope
    for s in schedules:
        if s["scope"] == "custom":
            items_res = db.table("count_schedule_items").select("item_id").eq("schedule_id", s["id"]).execute()
            s["item_ids"] = [i["item_id"] for i in (items_res.data or [])]
            
    return schedules

@router.patch("/count-schedules/{schedule_id}")
async def update_count_schedule(
    schedule_id: str,
    body: UpdateCountScheduleRequest,
    db=Depends(get_db),
    _=Depends(require_permission("inventory_utensils.manage_items"))
):
    try:
        payload = body.dict(exclude_none=True, exclude={"item_ids"})
        
        if payload:
            res = db.table("count_schedules").update(payload).eq("id", schedule_id).execute()
            if not res.data:
                raise HTTPException(404, "Schedule not found")

        # Update specific items if scope changed to custom or custom items changed
        if body.scope == "custom" and body.item_ids is not None:
            # Delete old items
            db.table("count_schedule_items").delete().eq("schedule_id", schedule_id).execute()
            # Insert new items
            if body.item_ids:
                items_data = [{"schedule_id": schedule_id, "item_id": item_id} for item_id in body.item_ids]
                db.table("count_schedule_items").insert(items_data).execute()
        elif body.scope in ["all", "category"]:
             # Ensure no items exist if scope is no longer custom
             db.table("count_schedule_items").delete().eq("schedule_id", schedule_id).execute()

        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/count-schedules/due")
async def get_due_schedules(
    venue_id: str,
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Returns schedules that are due for the current user's venue.
    Filters by next_due <= today and is_active = true.
    """
    try:
        today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
        
        # We need to find schedules that are active, due on or before today, 
        # for the specific venue, and either unassigned or assigned to this user.
        res = db.table("count_schedules").select("*") \
            .eq("venue_id", venue_id) \
            .eq("is_active", True) \
            .lte("next_due", today) \
            .execute()
            
        schedules = res.data or []
        
        # Filter assigned_to in python (easier than complex OR in postgrest sometimes)
        valid_schedules = [s for s in schedules if not s.get("assigned_to") or s.get("assigned_to") == current_user.id]
        
        # Attach items if it's a custom scope
        for s in valid_schedules:
            if s["scope"] == "custom":
                items_res = db.table("count_schedule_items").select("item_id").eq("schedule_id", s["id"]).execute()
                s["item_ids"] = [i["item_id"] for i in (items_res.data or [])]
                
        return valid_schedules
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Inventory: Dashboard (M10 & M12) ──

@router.get("/inventory/dashboard/summary")
async def get_inventory_dashboard_summary(
    venue_id: Optional[str] = None,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission("inventory_assets.view")),
    org_id: str = Depends(get_active_org_id)
):
    try:
        # 1. Asset Status Scorecards
        assets_query = db.table("assets").select("id, status").eq("org_id", org_id)
        if venue_id:
            assets_query = assets_query.eq("venue_id", venue_id)
        assets_res = assets_query.execute()
        assets = assets_res.data or []
        
        asset_stats = {
            "total": len(assets),
            "operativo": sum(1 for a in assets if a["status"] == "operativo"),
            "en_reparacion": sum(1 for a in assets if a["status"] == "en_reparacion"),
            "baja": sum(1 for a in assets if a["status"] == "baja")
        }

        # 2. Active Tickets
        # Repair tickets belong to assets, so we filter by the asset's org_id
        tickets_query = db.table("repair_tickets").select("*, assets!inner(name, org_id)").eq("assets.org_id", org_id).neq("status", "resuelto").order("opened_at", desc=True).limit(5)
        if venue_id:
            # We don't have venue_id on repair_tickets, it's on assets
            tickets_query = tickets_query.eq("assets.venue_id", venue_id)
        active_tickets = tickets_query.execute().data or []

        # 3. Pending Utensil Counts
        counts_query = db.table("utensil_counts").select("*, profiles!utensil_counts_created_by_fkey(full_name), venues(name)").eq("status", "pending").order("created_at", desc=True).limit(5)
        if venue_id:
            counts_query = counts_query.eq("venue_id", venue_id)
        pending_counts = counts_query.execute().data or []

        # 4. Due Schedules (Utensils)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        sched_query = db.table("count_schedules").select("*, venues(name)").eq("org_id", org_id).eq("is_active", True).lte("next_due", today)
        if venue_id:
            sched_query = sched_query.eq("venue_id", venue_id)
        due_schedules = sched_query.execute().data or []

        return {
            "asset_stats": asset_stats,
            "active_tickets": active_tickets,
            "pending_counts": pending_counts,
            "due_schedules": due_schedules
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Unified Inventory Documents Endpoints ─────────────────

async def get_next_document_number(db, org_id: str, doc_type: str) -> str:
    res = db.table("inventory_document_sequences").select("last_value").eq("org_id", org_id).eq("document_type", doc_type).execute()
    if res.data:
        next_val = int(res.data[0]["last_value"]) + 1
        db.table("inventory_document_sequences").update({"last_value": next_val}).eq("org_id", org_id).eq("document_type", doc_type).execute()
    else:
        next_val = 1
        db.table("inventory_document_sequences").insert({"org_id": org_id, "document_type": doc_type, "last_value": 1}).execute()
        
    prefix = "ING" if doc_type == "receipt" else "EGR" if doc_type == "issue" else "TRA"
    return f"{prefix}-{next_val:04d}"


@router.post("/inventory/documents", response_model=InventoryDocumentResponse)
async def create_inventory_document(
    doc: InventoryDocumentCreate,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    bypass_auth: bool = False
):
    # Check permissions dynamically based on document type
    required_perm = "inventory.receive" if doc.document_type == "receipt" else "inventory.issue" if doc.document_type == "issue" else "inventory.transfer"
    if not bypass_auth and not await resolve_permission(user.id, required_perm, db, org_id):
        raise HTTPException(status_code=403, detail="Not authorized to create this type of document")

    if doc.document_type == "transfer" and not doc.destination_warehouse_id:
        raise HTTPException(status_code=400, detail="Destination warehouse is required for transfer documents")
        
    if doc.document_type == "transfer" and str(doc.warehouse_id) == str(doc.destination_warehouse_id):
        raise HTTPException(status_code=400, detail="Origin and destination warehouses must be different")

    doc_number = await get_next_document_number(db, org_id, doc.document_type)
    
    header_data = {
        "org_id": org_id,
        "document_type": doc.document_type,
        "document_number": doc_number,
        "status": "draft",
        "warehouse_id": str(doc.warehouse_id),
        "destination_warehouse_id": str(doc.destination_warehouse_id) if doc.destination_warehouse_id else None,
        "supplier": doc.supplier,
        "reason": doc.reason,
        "notes": doc.notes,
        "created_by": user.id,
        "po_id": str(doc.po_id) if doc.po_id else None,
        "supplier_id": str(doc.supplier_id) if doc.supplier_id else None
    }
    
    res = db.table("inventory_documents").insert(header_data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Error creating document header")
        
    doc_id = res.data[0]["id"]
    
    # Process lines to compute base quantities
    for line in doc.lines:
        factor = 1.0
        if line.presentation_id:
            pres_res = db.table("uom_presentations").select("conversion_factor").eq("id", str(line.presentation_id)).execute()
            if pres_res.data:
                factor = float(pres_res.data[0]["conversion_factor"])
                
        qty_base = float(line.qty_presentation) * factor
        
        po_qty_ordered_base = None
        discrepancy_base = None
        if line.po_line_id:
            pol_res = db.table("purchase_order_lines").select("qty_ordered_base").eq("id", str(line.po_line_id)).execute()
            if pol_res.data:
                po_qty_ordered_base = float(pol_res.data[0]["qty_ordered_base"])
                discrepancy_base = qty_base - po_qty_ordered_base
                
        line_data = {
            "document_id": doc_id,
            "item_id": str(line.item_id),
            "qty_presentation": line.qty_presentation,
            "presentation_id": str(line.presentation_id) if line.presentation_id else None,
            "qty_base": qty_base,
            "unit_cost_presentation": line.unit_cost_presentation,
            "unit_cost_base": (line.unit_cost_presentation / factor) if (line.unit_cost_presentation is not None and factor > 0) else None,
            "lot_number": line.lot_number,
            "expiry_date": line.expiry_date,
            "po_line_id": str(line.po_line_id) if line.po_line_id else None,
            "po_qty_ordered_base": po_qty_ordered_base,
            "discrepancy_base": discrepancy_base
        }
        db.table("inventory_document_lines").insert(line_data).execute()

    ret = res.data[0]
    if doc.auto_confirm and doc.document_type == "transfer":
        from app.inventory.schemas import TransferReceiveRequest, TransferReceiveLineSchema
        await process_inventory_document(UUID(doc_id), org_id, user, db, bypass_auth=True)
        res_lines = db.table("inventory_document_lines").select("id, qty_presentation").eq("document_id", doc_id).execute()
        rec_lines = []
        for rl in (res_lines.data or []):
            rec_lines.append(TransferReceiveLineSchema(
                id=rl["id"],
                qty_received_presentation=rl["qty_presentation"]
            ))
        await receive_transfer_document(UUID(doc_id), TransferReceiveRequest(notes=doc.notes, lines=rec_lines), org_id, user, db, bypass_auth=True)
        if isinstance(ret, dict):
            ret = {**ret, "status": "confirmed"}

    return ret


@router.get("/inventory/documents", response_model=List[InventoryDocumentResponse])
async def list_inventory_documents(
    doc_type: Optional[str] = None,
    status: Optional[str] = None,
    warehouse_id: Optional[UUID] = None,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db)
):
    query = db.table("inventory_documents") \
        .select("*, warehouse:warehouse_id(name), destination_warehouse:destination_warehouse_id(name), creator:created_by(full_name)") \
        .eq("org_id", org_id)
        
    if doc_type:
        query = query.eq("document_type", doc_type)
    if status:
        query = query.eq("status", status)
    if warehouse_id:
        query = query.or_(f"warehouse_id.eq.{warehouse_id},destination_warehouse_id.eq.{warehouse_id}")
        
    res = query.order("created_at", desc=True).execute()
    
    # Flatten names for serialization
    data = []
    for doc in (res.data or []):
        doc["warehouse_name"] = doc.get("warehouse", {}).get("name") if doc.get("warehouse") else None
        doc["destination_warehouse_name"] = doc.get("destination_warehouse", {}).get("name") if doc.get("destination_warehouse") else None
        doc["creator_name"] = doc.get("creator", {}).get("full_name") if doc.get("creator") else None
        data.append(doc)
        
    return data


@router.get("/inventory/documents/{id}")
async def get_inventory_document_detail(
    id: UUID,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db)
):
    res_header = db.table("inventory_documents") \
        .select("*, warehouse:warehouse_id(name), destination_warehouse:destination_warehouse_id(name), creator:created_by(full_name), processor:processed_by(full_name), canceller:cancelled_by(full_name)") \
        .eq("id", str(id)) \
        .execute()
        
    if not res_header.data:
        raise HTTPException(status_code=404, detail="Document not found")
        
    header = res_header.data[0]
    header["warehouse_name"] = header.get("warehouse", {}).get("name") if header.get("warehouse") else None
    header["destination_warehouse_name"] = header.get("destination_warehouse", {}).get("name") if header.get("destination_warehouse") else None
    header["creator_name"] = header.get("creator", {}).get("full_name") if header.get("creator") else None
    header["processor_name"] = header.get("processor", {}).get("full_name") if header.get("processor") else None
    header["canceller_name"] = header.get("canceller", {}).get("full_name") if header.get("canceller") else None
    
    res_lines = db.table("inventory_document_lines") \
        .select("*, items(name, code, uom_base(name)), uom_presentations(name)") \
        .eq("document_id", str(id)) \
        .execute()
        
    lines = []
    for line in (res_lines.data or []):
        line["item_name"] = line.get("items", {}).get("name") if line.get("items") else None
        line["presentation_name"] = line.get("uom_presentations", {}).get("name") if line.get("uom_presentations") else None
        lines.append(line)
        
    return {
        "header": header,
        "lines": lines
    }


@router.put("/inventory/documents/{id}", response_model=InventoryDocumentResponse)
async def update_inventory_document(
    id: UUID,
    doc: InventoryDocumentUpdate,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db)
):
    res_header = db.table("inventory_documents").select("status").eq("id", str(id)).execute()
    if not res_header.data:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if res_header.data[0]["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only documents in draft status can be modified")
        
    payload = doc.dict(exclude_none=True, exclude={"lines"})
    if payload:
        db.table("inventory_documents").update(payload).eq("id", str(id)).execute()
        
    if doc.lines is not None:
        # Delete existing lines and re-insert
        db.table("inventory_document_lines").delete().eq("document_id", str(id)).execute()
        
        for line in doc.lines:
            factor = 1.0
            if line.presentation_id:
                pres_res = db.table("uom_presentations").select("conversion_factor").eq("id", str(line.presentation_id)).execute()
                if pres_res.data:
                    factor = float(pres_res.data[0]["conversion_factor"])
                    
            qty_base = float(line.qty_presentation) * factor
            
            po_qty_ordered_base = None
            discrepancy_base = None
            if line.po_line_id:
                pol_res = db.table("purchase_order_lines").select("qty_ordered_base").eq("id", str(line.po_line_id)).execute()
                if pol_res.data:
                    po_qty_ordered_base = float(pol_res.data[0]["qty_ordered_base"])
                    discrepancy_base = qty_base - po_qty_ordered_base
            
            line_data = {
                "document_id": str(id),
                "item_id": str(line.item_id),
                "qty_presentation": line.qty_presentation,
                "presentation_id": str(line.presentation_id) if line.presentation_id else None,
                "qty_base": qty_base,
                "unit_cost_presentation": line.unit_cost_presentation,
                "unit_cost_base": (line.unit_cost_presentation / factor) if (line.unit_cost_presentation is not None and factor > 0) else None,
                "lot_number": line.lot_number,
                "expiry_date": line.expiry_date,
                "po_line_id": str(line.po_line_id) if line.po_line_id else None,
                "po_qty_ordered_base": po_qty_ordered_base,
                "discrepancy_base": discrepancy_base
            }
            db.table("inventory_document_lines").insert(line_data).execute()
            
    final_res = db.table("inventory_documents").select("*").eq("id", str(id)).execute()
    return final_res.data[0]


@router.delete("/inventory/documents/{id}")
async def delete_inventory_document(
    id: UUID,
    db = Depends(get_db)
):
    res_header = db.table("inventory_documents").select("status").eq("id", str(id)).execute()
    if not res_header.data:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if res_header.data[0]["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft documents can be deleted")
        
    db.table("inventory_documents").delete().eq("id", str(id)).execute()
    return {"ok": True}


@router.post("/inventory/documents/{id}/process", response_model=InventoryDocumentResponse)
async def process_inventory_document(
    id: UUID,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    bypass_auth: bool = False
):
    res_header = db.table("inventory_documents").select("*").eq("id", str(id)).execute()
    if not res_header.data:
        raise HTTPException(status_code=404, detail="Document not found")
        
    header = res_header.data[0]
    if header["status"] != "draft":
        raise HTTPException(status_code=400, detail="Document is not in draft status")
        
    lines_res = db.table("inventory_document_lines").select("*").eq("document_id", str(id)).execute()
    lines = lines_res.data or []
    
    if not lines:
        raise HTTPException(status_code=400, detail="Cannot process an empty document")

    # 1. Process Stock Actions based on document type
    if header["document_type"] == "receipt":
        # Check permissions
        if not bypass_auth and not await resolve_permission(user.id, "inventory.receive", db, org_id):
            raise HTTPException(status_code=403, detail="Not authorized to process receipts")
            
        for line in lines:
            # Create stock lot
            lot_data = {
                "warehouse_id": header["warehouse_id"],
                "item_id": line["item_id"],
                "lot_number": line["lot_number"] or f"LT-{str(uuid.uuid4()).replace('-', '')[:8].upper()}",
                "qty_base": float(line["qty_base"]),
                "unit_cost_base": float(line["unit_cost_base"] or 0),
                "expiry_date": line["expiry_date"]
            }
            lot_res = db.table("stock_lots").insert(lot_data).execute()
            lot_id = lot_res.data[0]["id"]
            
            # Increment stock
            stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", header["warehouse_id"]).eq("item_id", line["item_id"]).execute()
            if stock_res.data:
                new_qty = float(stock_res.data[0]["qty_base"]) + float(line["qty_base"])
                db.table("stock").update({"qty_base": new_qty}).eq("id", stock_res.data[0]["id"]).execute()
            else:
                db.table("stock").insert({
                    "warehouse_id": header["warehouse_id"],
                    "item_id": line["item_id"],
                    "qty_base": float(line["qty_base"])
                }).execute()
                
            # Log movement
            db.table("stock_movements").insert({
                "org_id": org_id,
                "movement_type": "purchase",
                "warehouse_id": header["warehouse_id"],
                "item_id": line["item_id"],
                "lot_id": lot_id,
                "qty_base": float(line["qty_base"]),
                "unit_cost_base": float(line["unit_cost_base"] or 0),
                "total_cost": float(line["qty_base"]) * float(line["unit_cost_base"] or 0),
                "reference_id": str(id),
                "reference_type": "inventory_document",
                "created_by": user.id
            }).execute()
            
            # Update last purchase cost on items and cascade to parent recipes
            from app.catering.router import update_item_cost_and_cascade
            item_uuid = UUID(str(line["item_id"]))
            await update_item_cost_and_cascade(db, org_id, item_uuid, float(line["unit_cost_base"] or 0))
            
        # Update purchase order if linked
        if header.get("po_id"):
            po_id = header["po_id"]
            for line in lines:
                if line.get("po_line_id"):
                    po_line_id = line["po_line_id"]
                    # Get current PO line quantities
                    pol_res = db.table("purchase_order_lines").select("qty_ordered_base, qty_received_base").eq("id", str(po_line_id)).execute()
                    if pol_res.data:
                        po_line_data = pol_res.data[0]
                        qty_ordered = float(po_line_data["qty_ordered_base"])
                        curr_received = float(po_line_data["qty_received_base"] or 0)
                        
                        new_received = curr_received + float(line["qty_base"])
                        new_pending = max(0.0, qty_ordered - new_received)
                        
                        # Determine line status
                        line_status = 'received' if new_pending <= 0 else 'partially_received'
                        
                        db.table("purchase_order_lines").update({
                            "qty_received_base": new_received,
                            "qty_pending_base": new_pending,
                            "status": line_status
                        }).eq("id", str(po_line_id)).execute()
            
            # Recalculate global PO status
            all_lines_res = db.table("purchase_order_lines").select("qty_ordered_base, qty_received_base, status").eq("po_id", str(po_id)).execute()
            if all_lines_res.data:
                total_lines = len(all_lines_res.data)
                received_or_cancelled_count = sum(1 for l in all_lines_res.data if l["status"] in ('received', 'cancelled'))
                partially_received_count = sum(1 for l in all_lines_res.data if l["status"] == 'partially_received')
                total_received_qty = sum(float(l["qty_received_base"] or 0) for l in all_lines_res.data)
                
                if received_or_cancelled_count == total_lines:
                    global_status = 'received'
                elif partially_received_count > 0 or total_received_qty > 0:
                    global_status = 'partially_received'
                else:
                    global_status = 'sent'
                
                db.table("purchase_orders").update({"status": global_status}).eq("id", str(po_id)).execute()
                
        # Update status
        db.table("inventory_documents").update({
            "status": "confirmed",
            "processed_by": user.id,
            "processed_at": datetime.now(CARACAS_TZ).isoformat()
        }).eq("id", str(id)).execute()

    elif header["document_type"] == "issue":
        if not bypass_auth and not await resolve_permission(user.id, "inventory.issue", db, org_id):
            raise HTTPException(status_code=403, detail="Not authorized to process issue documents")
            
        for line in lines:
            total_to_consume = float(line["qty_base"])
            
            # FIFO consumption from stock_lots
            lots_res = db.table("stock_lots") \
                .select("*") \
                .eq("item_id", line["item_id"]) \
                .eq("warehouse_id", header["warehouse_id"]) \
                .filter("qty_base", "gt", 0) \
                .order("received_at", desc=False) \
                .execute()
                
            remaining = total_to_consume
            for lot in (lots_res.data or []):
                if remaining <= 0:
                    break
                lot_qty = float(lot["qty_base"])
                consume_qty = min(remaining, lot_qty)
                
                db.table("stock_lots").update({
                    "qty_base": lot_qty - consume_qty,
                    "is_exhausted": (lot_qty - consume_qty) <= 0
                }).eq("id", lot["id"]).execute()
                
                db.table("stock_movements").insert({
                    "org_id": org_id,
                    "movement_type": "adjustment_out" if header["reason"] == "adjustment" else "sale",
                    "warehouse_id": header["warehouse_id"],
                    "item_id": line["item_id"],
                    "lot_id": lot["id"],
                    "qty_base": -consume_qty,
                    "unit_cost_base": float(lot["unit_cost_base"]),
                    "total_cost": -consume_qty * float(lot["unit_cost_base"]),
                    "reference_id": str(id),
                    "reference_type": "inventory_document",
                    "notes": header["notes"],
                    "created_by": user.id
                }).execute()
                
                remaining -= consume_qty
                
            # Log deficit
            if remaining > 0:
                db.table("stock_movements").insert({
                    "org_id": org_id,
                    "movement_type": "adjustment_out" if header["reason"] == "adjustment" else "sale",
                    "warehouse_id": header["warehouse_id"],
                    "item_id": line["item_id"],
                    "qty_base": -remaining,
                    "unit_cost_base": 0.0,
                    "total_cost": 0.0,
                    "reference_id": str(id),
                    "reference_type": "inventory_document",
                    "notes": f"Defecto de stock (DÉFICIT)",
                    "created_by": user.id
                }).execute()
                
            # Update stock
            stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", header["warehouse_id"]).eq("item_id", line["item_id"]).execute()
            if stock_res.data:
                new_qty = max(0.0, float(stock_res.data[0]["qty_base"]) - total_to_consume)
                db.table("stock").update({"qty_base": new_qty}).eq("id", stock_res.data[0]["id"]).execute()
                
        db.table("inventory_documents").update({
            "status": "confirmed",
            "processed_by": user.id,
            "processed_at": datetime.now(CARACAS_TZ).isoformat()
        }).eq("id", str(id)).execute()

    elif header["document_type"] == "transfer":
        if not bypass_auth and not await resolve_permission(user.id, "inventory.transfer", db, org_id):
            raise HTTPException(status_code=403, detail="Not authorized to process transfers")
            
        for line in lines:
            total_to_move = float(line["qty_base"])
            
            # FIFO consumption from origin
            lots_res = db.table("stock_lots") \
                .select("*") \
                .eq("item_id", line["item_id"]) \
                .eq("warehouse_id", header["warehouse_id"]) \
                .filter("qty_base", "gt", 0) \
                .order("received_at", desc=False) \
                .execute()
                
            remaining = total_to_move
            total_cost_at_origin = 0.0
            
            for lot in (lots_res.data or []):
                if remaining <= 0:
                    break
                lot_qty = float(lot["qty_base"])
                consume_qty = min(remaining, lot_qty)
                cost_of_lot = float(lot["unit_cost_base"])
                
                total_cost_at_origin += consume_qty * cost_of_lot
                
                db.table("stock_lots").update({
                    "qty_base": lot_qty - consume_qty,
                    "is_exhausted": (lot_qty - consume_qty) <= 0
                }).eq("id", lot["id"]).execute()
                
                db.table("stock_movements").insert({
                    "org_id": org_id,
                    "movement_type": "transfer_out",
                    "warehouse_id": header["warehouse_id"],
                    "item_id": line["item_id"],
                    "lot_id": lot["id"],
                    "qty_base": -consume_qty,
                    "unit_cost_base": cost_of_lot,
                    "total_cost": -consume_qty * cost_of_lot,
                    "reference_id": str(id),
                    "reference_type": "inventory_document",
                    "notes": f"Traslado a almacén {header['destination_warehouse_id']}",
                    "created_by": user.id
                }).execute()
                
                remaining -= consume_qty
                
            # Log deficit
            if remaining > 0:
                db.table("stock_movements").insert({
                    "org_id": org_id,
                    "movement_type": "transfer_out",
                    "warehouse_id": header["warehouse_id"],
                    "item_id": line["item_id"],
                    "qty_base": -remaining,
                    "unit_cost_base": 0.0,
                    "total_cost": 0.0,
                    "reference_id": str(id),
                    "reference_type": "inventory_document",
                    "notes": f"Traslado a almacén {header['destination_warehouse_id']} (DÉFICIT)",
                    "created_by": user.id
                }).execute()
                
            weighted_unit_cost = total_cost_at_origin / total_to_move if total_to_move > 0 else 0.0
            
            # Save weighted unit cost to the line
            db.table("inventory_document_lines").update({
                "unit_cost_base": weighted_unit_cost
            }).eq("id", line["id"]).execute()
            
            # Update stock at origin
            stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", header["warehouse_id"]).eq("item_id", line["item_id"]).execute()
            if stock_res.data:
                new_qty = float(stock_res.data[0]["qty_base"]) - total_to_move
                db.table("stock").update({"qty_base": new_qty}).eq("id", stock_res.data[0]["id"]).execute()
            else:
                db.table("stock").insert({
                    "warehouse_id": header["warehouse_id"],
                    "item_id": line["item_id"],
                    "qty_base": -total_to_move
                }).execute()
                
        db.table("inventory_documents").update({
            "status": "in_transit",
            "processed_by": user.id,
            "processed_at": datetime.now(CARACAS_TZ).isoformat()
        }).eq("id", str(id)).execute()
        
    final_doc = db.table("inventory_documents").select("*").eq("id", str(id)).execute()
    return final_doc.data[0]


@router.post("/inventory/documents/{id}/receive", response_model=InventoryDocumentResponse)
async def receive_transfer_document(
    id: UUID,
    req: TransferReceiveRequest,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    bypass_auth: bool = False
):
    if not bypass_auth and not await resolve_permission(user.id, "inventory.transfer_confirm", db, org_id):
        raise HTTPException(status_code=403, detail="Not authorized to confirm transfers")

    res_header = db.table("inventory_documents").select("*").eq("id", str(id)).execute()
    if not res_header.data:
        raise HTTPException(status_code=404, detail="Document not found")
        
    header = res_header.data[0]
    if header["document_type"] != "transfer" or header["status"] != "in_transit":
        raise HTTPException(status_code=400, detail="Document is not an in-transit transfer")
        
    has_discrepancy = False
    
    # Process receipt lines
    for line in req.lines:
        orig_line_res = db.table("inventory_document_lines").select("*").eq("id", str(line.id)).execute()
        if not orig_line_res.data:
            continue
        orig_line = orig_line_res.data[0]
        
        factor = 1.0
        if orig_line["presentation_id"]:
            pres_res = db.table("uom_presentations").select("conversion_factor").eq("id", orig_line["presentation_id"]).execute()
            if pres_res.data:
                factor = float(pres_res.data[0]["conversion_factor"])
                
        qty_received_base = float(line.qty_received_presentation) * factor
        if abs(qty_received_base - float(orig_line["qty_base"])) > 0.0001:
            has_discrepancy = True
            
        db.table("inventory_document_lines").update({
            "qty_received_presentation": line.qty_received_presentation,
            "qty_received_base": qty_received_base
        }).eq("id", str(line.id)).execute()
        
        # Add stock at destination
        if qty_received_base > 0:
            lot_data = {
                "warehouse_id": header["destination_warehouse_id"],
                "item_id": orig_line["item_id"],
                "lot_number": f"TR-{str(id).replace('-', '')[:8].upper()}",
                "qty_base": qty_received_base,
                "unit_cost_base": float(orig_line["unit_cost_base"] or 0),
                "received_at": datetime.now(CARACAS_TZ).isoformat()
            }
            lot_res = db.table("stock_lots").insert(lot_data).execute()
            lot_id = lot_res.data[0]["id"]
            
            db.table("stock_movements").insert({
                "org_id": org_id,
                "movement_type": "transfer_in",
                "warehouse_id": header["destination_warehouse_id"],
                "item_id": orig_line["item_id"],
                "lot_id": lot_id,
                "qty_base": qty_received_base,
                "unit_cost_base": float(orig_line["unit_cost_base"] or 0),
                "total_cost": qty_received_base * float(orig_line["unit_cost_base"] or 0),
                "reference_id": str(id),
                "reference_type": "inventory_document",
                "notes": f"Recibido de almacén {header['warehouse_id']}",
                "created_by": user.id
            }).execute()
            
            stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", header["destination_warehouse_id"]).eq("item_id", orig_line["item_id"]).execute()
            if stock_res.data:
                new_qty = float(stock_res.data[0]["qty_base"]) + qty_received_base
                db.table("stock").update({"qty_base": new_qty}).eq("id", stock_res.data[0]["id"]).execute()
            else:
                db.table("stock").insert({
                    "warehouse_id": header["destination_warehouse_id"],
                    "item_id": orig_line["item_id"],
                    "qty_base": qty_received_base
                }).execute()
                
    final_status = "confirmed" # Unified to confirmed, discrepancies visible in lines
    db.table("inventory_documents").update({
        "status": final_status,
        "processed_by": user.id,
        "processed_at": datetime.now(CARACAS_TZ).isoformat(),
        "notes": req.notes if req.notes else header["notes"]
    }).eq("id", str(id)).execute()
    
    final_doc = db.table("inventory_documents").select("*").eq("id", str(id)).execute()
    return final_doc.data[0]


@router.post("/inventory/documents/{id}/cancel", response_model=InventoryDocumentResponse)
async def cancel_inventory_document(
    id: UUID,
    org_id: str = Depends(get_active_org_id),
    user = Depends(get_current_user),
    db = Depends(get_db),
    bypass_auth: bool = False
):
    res_header = db.table("inventory_documents").select("*").eq("id", str(id)).execute()
    if not res_header.data:
        raise HTTPException(status_code=404, detail="Document not found")
        
    header = res_header.data[0]
    if header["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Document is already cancelled")
        
    # Check permissions based on document type
    required_perm = "inventory.receive" if header["document_type"] == "receipt" else "inventory.issue" if header["document_type"] == "issue" else "inventory.transfer"
    if not bypass_auth and not await resolve_permission(user.id, required_perm, db, org_id):
        raise HTTPException(status_code=403, detail="Not authorized to cancel this document")

    # If it was in draft, just mark as cancelled
    if header["status"] == "draft":
        db.table("inventory_documents").update({
            "status": "cancelled",
            "cancelled_by": user.id,
            "cancelled_at": datetime.now(CARACAS_TZ).isoformat()
        }).eq("id", str(id)).execute()
        
        final_doc = db.table("inventory_documents").select("*").eq("id", str(id)).execute()
        return final_doc.data[0]

    # Reversion logic for executed documents
    if header["document_type"] == "receipt":
        # 1. We look at movements to deduct the exact quantity
        movs_res = db.table("stock_movements").select("*").eq("reference_id", str(id)).eq("reference_type", "inventory_document").execute()
        for mov in (movs_res.data or []):
            if mov["lot_id"]:
                # Subtract from lot
                lot_res = db.table("stock_lots").select("qty_base").eq("id", mov["lot_id"]).execute()
                if lot_res.data:
                    new_lot_qty = max(0.0, float(lot_res.data[0]["qty_base"]) - float(mov["qty_base"]))
                    db.table("stock_lots").update({
                        "qty_base": new_lot_qty,
                        "is_exhausted": new_lot_qty <= 0
                    }).eq("id", mov["lot_id"]).execute()
            
            # Subtract from stock
            stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", header["warehouse_id"]).eq("item_id", mov["item_id"]).execute()
            if stock_res.data:
                new_stock_qty = max(0.0, float(stock_res.data[0]["qty_base"]) - float(mov["qty_base"]))
                db.table("stock").update({"qty_base": new_stock_qty}).eq("id", stock_res.data[0]["id"]).execute()
                
            # Log compensating movement
            db.table("stock_movements").insert({
                "org_id": org_id,
                "movement_type": "adjustment_out",
                "warehouse_id": header["warehouse_id"],
                "item_id": mov["item_id"],
                "lot_id": mov["lot_id"],
                "qty_base": -float(mov["qty_base"]),
                "unit_cost_base": float(mov["unit_cost_base"]),
                "total_cost": -float(mov["qty_base"]) * float(mov["unit_cost_base"]),
                "reference_id": str(id),
                "reference_type": "inventory_document",
                "notes": "Cancelación de ingreso",
                "created_by": user.id
            }).execute()

    elif header["document_type"] == "issue":
        # 1. Find the FIFO logs from stock_movements
        movs_res = db.table("stock_movements").select("*").eq("reference_id", str(id)).eq("reference_type", "inventory_document").execute()
        for mov in (movs_res.data or []):
            if mov["lot_id"]:
                # Add back to lot
                lot_res = db.table("stock_lots").select("qty_base").eq("id", mov["lot_id"]).execute()
                if lot_res.data:
                    new_lot_qty = float(lot_res.data[0]["qty_base"]) + abs(float(mov["qty_base"]))
                    db.table("stock_lots").update({
                        "qty_base": new_lot_qty,
                        "is_exhausted": new_lot_qty <= 0
                    }).eq("id", mov["lot_id"]).execute()
            
            # Add back to stock
            stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", header["warehouse_id"]).eq("item_id", mov["item_id"]).execute()
            if stock_res.data:
                new_stock_qty = float(stock_res.data[0]["qty_base"]) + abs(float(mov["qty_base"]))
                db.table("stock").update({"qty_base": new_stock_qty}).eq("id", stock_res.data[0]["id"]).execute()
                
            # Log compensating movement
            db.table("stock_movements").insert({
                "org_id": org_id,
                "movement_type": "adjustment_in",
                "warehouse_id": header["warehouse_id"],
                "item_id": mov["item_id"],
                "lot_id": mov["lot_id"],
                "qty_base": abs(float(mov["qty_base"])),
                "unit_cost_base": float(mov["unit_cost_base"]),
                "total_cost": abs(float(mov["qty_base"])) * float(mov["unit_cost_base"]),
                "reference_id": str(id),
                "reference_type": "inventory_document",
                "notes": "Cancelación de egreso",
                "created_by": user.id
            }).execute()

    elif header["document_type"] == "transfer":
        # 1. Reverse origin deduction (always exists if status != draft)
        movs_res = db.table("stock_movements") \
            .select("*") \
            .eq("reference_id", str(id)) \
            .eq("reference_type", "inventory_document") \
            .eq("movement_type", "transfer_out") \
            .execute()
            
        for mov in (movs_res.data or []):
            if mov["lot_id"]:
                # Add back to origin lot
                lot_res = db.table("stock_lots").select("qty_base").eq("id", mov["lot_id"]).execute()
                if lot_res.data:
                    new_lot_qty = float(lot_res.data[0]["qty_base"]) + abs(float(mov["qty_base"]))
                    db.table("stock_lots").update({
                        "qty_base": new_lot_qty,
                        "is_exhausted": new_lot_qty <= 0
                    }).eq("id", mov["lot_id"]).execute()
                    
            # Add back to origin stock
            stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", header["warehouse_id"]).eq("item_id", mov["item_id"]).execute()
            if stock_res.data:
                new_stock_qty = float(stock_res.data[0]["qty_base"]) + abs(float(mov["qty_base"]))
                db.table("stock").update({"qty_base": new_stock_qty}).eq("id", stock_res.data[0]["id"]).execute()
                
            # Log origin compensating movement
            db.table("stock_movements").insert({
                "org_id": org_id,
                "movement_type": "transfer_in",
                "warehouse_id": header["warehouse_id"],
                "item_id": mov["item_id"],
                "lot_id": mov["lot_id"],
                "qty_base": abs(float(mov["qty_base"])),
                "unit_cost_base": float(mov["unit_cost_base"]),
                "total_cost": abs(float(mov["qty_base"])) * float(mov["unit_cost_base"]),
                "reference_id": str(id),
                "reference_type": "inventory_document",
                "notes": "Cancelación de traslado (Origen)",
                "created_by": user.id
            }).execute()

        # 2. Reverse destination reception (if status == confirmed)
        if header["status"] == "confirmed":
            dest_movs_res = db.table("stock_movements") \
                .select("*") \
                .eq("reference_id", str(id)) \
                .eq("reference_type", "inventory_document") \
                .eq("movement_type", "transfer_in") \
                .neq("warehouse_id", header["warehouse_id"]) \
                .execute()
                
            for mov in (dest_movs_res.data or []):
                if mov["lot_id"]:
                    # Deduct from destination lot
                    lot_res = db.table("stock_lots").select("qty_base").eq("id", mov["lot_id"]).execute()
                    if lot_res.data:
                        new_lot_qty = max(0.0, float(lot_res.data[0]["qty_base"]) - float(mov["qty_base"]))
                        db.table("stock_lots").update({
                            "qty_base": new_lot_qty,
                            "is_exhausted": new_lot_qty <= 0
                        }).eq("id", mov["lot_id"]).execute()
                        
                # Deduct from destination stock
                stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", header["destination_warehouse_id"]).eq("item_id", mov["item_id"]).execute()
                if stock_res.data:
                    new_stock_qty = max(0.0, float(stock_res.data[0]["qty_base"]) - float(mov["qty_base"]))
                    db.table("stock").update({"qty_base": new_stock_qty}).eq("id", stock_res.data[0]["id"]).execute()
                    
                # Log destination compensating movement
                db.table("stock_movements").insert({
                    "org_id": org_id,
                    "movement_type": "transfer_out",
                    "warehouse_id": header["destination_warehouse_id"],
                    "item_id": mov["item_id"],
                    "lot_id": mov["lot_id"],
                    "qty_base": -float(mov["qty_base"]),
                    "unit_cost_base": float(mov["unit_cost_base"]),
                    "total_cost": -float(mov["qty_base"]) * float(mov["unit_cost_base"]),
                    "reference_id": str(id),
                    "reference_type": "inventory_document",
                    "notes": "Cancelación de traslado (Destino)",
                    "created_by": user.id
                }).execute()

    db.table("inventory_documents").update({
        "status": "cancelled",
        "cancelled_by": user.id,
        "cancelled_at": datetime.now(CARACAS_TZ).isoformat()
    }).eq("id", str(id)).execute()
    
    final_doc = db.table("inventory_documents").select("*").eq("id", str(id)).execute()
    return final_doc.data[0]
