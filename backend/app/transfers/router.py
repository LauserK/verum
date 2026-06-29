from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import pytz

from database import get_db
from app.deps import get_active_org_id, require_permission
from auth_deps import security, get_current_user
from app.transfers.schemas import TransferCreate, TransferConfirm, TransferResponse

router = APIRouter(prefix="/inventory/transfers", tags=["Inventory"])

CARACAS_TZ = pytz.timezone("America/Caracas")

@router.post("", response_model=TransferResponse)
async def create_transfer(doc: TransferCreate, org_id: str = Depends(get_active_org_id), user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("inventory.transfer"))):
    if str(doc.origin_warehouse_id) == str(doc.destination_warehouse_id):
        raise HTTPException(status_code=400, detail="Origin and destination warehouses must be different")

    # 1. Create the transfer header
    header_data = {
        "org_id": org_id,
        "origin_warehouse_id": str(doc.origin_warehouse_id),
        "destination_warehouse_id": str(doc.destination_warehouse_id),
        "status": "confirmed" if doc.auto_confirm else "in_transit",
        "notes": doc.notes,
        "created_by": user.id,
        "confirmed_by": user.id if doc.auto_confirm else None,
        "confirmed_at": datetime.now(CARACAS_TZ).isoformat() if doc.auto_confirm else None
    }
    header_res = db.table("transfer_documents").insert(header_data).execute()
    if not header_res.data:
        raise HTTPException(status_code=400, detail="Error creating transfer header")
    
    transfer_id = header_res.data[0]["id"]
    
    # 2. Process lines with FIFO logic from origin
    for line in doc.lines:
        # Get presentation factor
        factor = 1.0
        if line.presentation_id:
            pres_res = db.table("uom_presentations").select("conversion_factor").eq("id", str(line.presentation_id)).execute()
            if pres_res.data:
                factor = float(pres_res.data[0]["conversion_factor"])

        total_to_move = float(line.qty_sent_presentation) * factor
        
        # FIFO consumption from origin to compute weighted cost
        lots_res = db.table("stock_lots") \
            .select("*") \
            .eq("item_id", str(line.item_id)) \
            .eq("warehouse_id", str(doc.origin_warehouse_id)) \
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
            
            # Update lot at origin
            new_lot_qty = lot_qty - consume_qty
            db.table("stock_lots").update({
                "qty_base": new_lot_qty,
                "is_exhausted": new_lot_qty <= 0
            }).eq("id", lot["id"]).execute()
            
            # Log individual movement per lot at origin
            db.table("stock_movements").insert({
                "org_id": org_id,
                "movement_type": "transfer_out",
                "warehouse_id": str(doc.origin_warehouse_id),
                "item_id": str(line.item_id),
                "lot_id": lot["id"],
                "qty_base": -consume_qty,
                "unit_cost_base": cost_of_lot,
                "total_cost": -consume_qty * cost_of_lot,
                "reference_id": transfer_id,
                "reference_type": "transfer_document",
                "notes": f"Traslado a almacén {doc.destination_warehouse_id}",
                "created_by": user.id
            }).execute()
            
            remaining -= consume_qty
            
        # 3. Handle deficit (Negative Stock Support)
        if remaining > 0:
            db.table("stock_movements").insert({
                "org_id": org_id,
                "movement_type": "transfer_out",
                "warehouse_id": str(doc.origin_warehouse_id),
                "item_id": str(line.item_id),
                "qty_base": -remaining,
                "unit_cost_base": 0.0, 
                "total_cost": 0.0,
                "reference_id": transfer_id,
                "reference_type": "transfer_document",
                "notes": f"Traslado a almacén {doc.destination_warehouse_id} (DÉFICIT)",
                "created_by": user.id
            }).execute()

        weighted_unit_cost = total_cost_at_origin / total_to_move if total_to_move > 0 else 0.0

        # Create transfer line
        line_data = {
            "transfer_id": transfer_id,
            "item_id": str(line.item_id),
            "presentation_id": str(line.presentation_id) if line.presentation_id else None,
            "qty_sent_presentation": float(line.qty_sent_presentation),
            "qty_sent_base": total_to_move,
            "unit_cost_base": weighted_unit_cost,
            "qty_received_presentation": float(line.qty_sent_presentation) if doc.auto_confirm else None,
            "qty_received_base": total_to_move if doc.auto_confirm else None
        }
        db.table("transfer_document_lines").insert(line_data).execute()

        # Update overall stock at origin (Allows negative values)
        stock_res = db.table("stock").select("id, qty_base").eq("warehouse_id", str(doc.origin_warehouse_id)).eq("item_id", str(line.item_id)).execute()
        if stock_res.data:
            new_qty = float(stock_res.data[0]["qty_base"]) - total_to_move
            db.table("stock").update({"qty_base": new_qty}).eq("id", stock_res.data[0]["id"]).execute()
        else:
            db.table("stock").insert({
                "warehouse_id": str(doc.origin_warehouse_id),
                "item_id": str(line.item_id),
                "qty_base": -total_to_move
            }).execute()

        # 4. Immediate Reception (Auto-Confirm Logic)
        if doc.auto_confirm:
            # Add to destination inventory immediately
            lot_data = {
                "warehouse_id": str(doc.destination_warehouse_id),
                "item_id": str(line.item_id),
                "lot_number": f"TR-{str(transfer_id).replace('-', '')[:8]}",
                "qty_base": total_to_move,
                "unit_cost_base": weighted_unit_cost,
                "received_at": datetime.now(CARACAS_TZ).isoformat()
            }
            db.table("stock_lots").insert(lot_data).execute()
            
            # Log movement at destination
            db.table("stock_movements").insert({
                "org_id": org_id,
                "movement_type": "transfer_in",
                "warehouse_id": str(doc.destination_warehouse_id),
                "item_id": str(line.item_id),
                "qty_base": total_to_move,
                "unit_cost_base": weighted_unit_cost,
                "total_cost": total_to_move * weighted_unit_cost,
                "reference_id": transfer_id,
                "reference_type": "transfer_document",
                "notes": f"Traslado automático desde almacén {doc.origin_warehouse_id}",
                "created_by": user.id
            }).execute()
            
            # Update overall stock at destination
            stock_dest_res = db.table("stock").select("id, qty_base").eq("warehouse_id", str(doc.destination_warehouse_id)).eq("item_id", str(line.item_id)).execute()
            if stock_dest_res.data:
                new_dest_qty = float(stock_dest_res.data[0]["qty_base"]) + total_to_move
                db.table("stock").update({"qty_base": new_dest_qty}).eq("id", stock_dest_res.data[0]["id"]).execute()
            else:
                db.table("stock").insert({
                    "warehouse_id": str(doc.destination_warehouse_id),
                    "item_id": str(line.item_id),
                    "qty_base": total_to_move
                }).execute()

    return header_res.data[0]

@router.patch("/{transfer_id}/confirm")
async def confirm_transfer(transfer_id: UUID, doc: TransferConfirm, org_id: str = Depends(get_active_org_id), user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("inventory.transfer_confirm"))):
    # 1. Fetch transfer document
    transfer_res = db.table("transfer_documents").select("*").eq("id", str(transfer_id)).execute()
    if not transfer_res.data:
        raise HTTPException(status_code=404, detail="Transfer document not found")
    
    header = transfer_res.data[0]
    if header["status"] != "in_transit":
        raise HTTPException(status_code=400, detail="Transfer is not in transit")

    # 2. Process each confirmed line
    has_discrepancy = False
    for line in doc.lines:
        # Get original line info
        orig_line_res = db.table("transfer_document_lines").select("*").eq("id", str(line.id)).execute()
        if not orig_line_res.data:
            continue
            
        orig_line = orig_line_res.data[0]
        
        # Get factor for base quantity computation
        factor = 1.0
        if orig_line["presentation_id"]:
            pres_res = db.table("uom_presentations").select("conversion_factor").eq("id", orig_line["presentation_id"]).execute()
            if pres_res.data:
                factor = float(pres_res.data[0]["conversion_factor"])
                
        qty_received_base = float(line.qty_received_presentation) * factor
        if abs(qty_received_base - float(orig_line["qty_sent_base"])) > 0.0001:
            has_discrepancy = True
            
        # Update line with received quantities
        db.table("transfer_document_lines").update({
            "qty_received_presentation": float(line.qty_received_presentation),
            "qty_received_base": qty_received_base
        }).eq("id", str(line.id)).execute()
        
        # 3. Add to destination inventory
        if qty_received_base > 0:
            # Create new lot at destination
            lot_data = {
                "warehouse_id": header["destination_warehouse_id"],
                "item_id": orig_line["item_id"],
                "lot_number": f"TR-{str(transfer_id).replace('-', '')[:8]}",
                "qty_base": qty_received_base,
                "unit_cost_base": float(orig_line["unit_cost_base"]),
                "received_at": datetime.now(CARACAS_TZ).isoformat()
            }
            db.table("stock_lots").insert(lot_data).execute()
            
            # Log movement at destination
            db.table("stock_movements").insert({
                "org_id": org_id,
                "movement_type": "transfer_in",
                "warehouse_id": header["destination_warehouse_id"],
                "item_id": orig_line["item_id"],
                "qty_base": qty_received_base,
                "unit_cost_base": float(orig_line["unit_cost_base"]),
                "total_cost": qty_received_base * float(orig_line["unit_cost_base"]),
                "reference_id": str(transfer_id),
                "reference_type": "transfer_document",
                "notes": f"Recibido de almacén {header['origin_warehouse_id']}",
                "created_by": user.id
            }).execute()
            
            # Update overall stock at destination
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

    # 4. Finalize document status
    final_status = "confirmed_with_discrepancy" if has_discrepancy else "confirmed"
    db.table("transfer_documents").update({
        "status": final_status,
        "confirmed_by": user.id,
        "confirmed_at": datetime.now(CARACAS_TZ).isoformat(),
        "notes": doc.notes if doc.notes else header["notes"]
    }).eq("id", str(transfer_id)).execute()
    
    return {"ok": True, "status": final_status}

@router.get("")
async def list_transfers(org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("transfer_documents") \
        .select("*, origin:origin_warehouse_id(name), destination:destination_warehouse_id(name)") \
        .eq("org_id", org_id) \
        .order("created_at", desc=True) \
        .execute()
    return res.data or []

@router.get("/pending")
async def list_pending_transfers(warehouse_id: Optional[UUID] = None, org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    query = db.table("transfer_documents") \
        .select("*, origin:origin_warehouse_id(name), destination:destination_warehouse_id(name)") \
        .eq("org_id", org_id) \
        .eq("status", "in_transit")
    
    if warehouse_id:
        query = query.eq("destination_warehouse_id", str(warehouse_id))
        
    res = query.order("created_at", desc=True).execute()
    return res.data or []

@router.get("/{transfer_id}")
async def get_transfer_detail(transfer_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res_header = db.table("transfer_documents") \
        .select("*, origin:origin_warehouse_id(name), destination:destination_warehouse_id(name), profiles:created_by(full_name), confirmed_profile:confirmed_by(full_name)") \
        .eq("id", str(transfer_id)) \
        .execute()
        
    if not res_header.data:
        raise HTTPException(status_code=404, detail="Transfer not found")
        
    res_lines = db.table("transfer_document_lines") \
        .select("*, items(name, uom_base(name)), uom_presentations(name)") \
        .eq("transfer_id", str(transfer_id)) \
        .execute()
        
    return {
        "header": res_header.data[0],
        "lines": res_lines.data
    }
