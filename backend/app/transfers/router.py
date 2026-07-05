from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime
import pytz

from database import get_db
from app.deps import get_active_org_id, require_permission
from auth_deps import security, get_current_user
from app.transfers.schemas import TransferCreate, TransferConfirm, TransferResponse

router = APIRouter(prefix="/inventory/transfers", tags=["Inventory"])

CARACAS_TZ = pytz.timezone("America/Caracas")

@router.post("", response_model=Any)
async def create_transfer(doc: TransferCreate, org_id: str = Depends(get_active_org_id), user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("inventory.transfer"))):
    if str(doc.origin_warehouse_id) == str(doc.destination_warehouse_id):
        raise HTTPException(status_code=400, detail="Origin and destination warehouses must be different")

    from app.inventory.router import create_inventory_document, process_inventory_document, receive_transfer_document
    from app.inventory.schemas import InventoryDocumentCreate, InventoryDocumentLineSchema, TransferReceiveRequest, TransferReceiveLineSchema

    lines = []
    for line in doc.lines:
        lines.append(InventoryDocumentLineSchema(
            item_id=line.item_id,
            qty_presentation=line.qty_sent_presentation,
            presentation_id=line.presentation_id
        ))

    doc_create = InventoryDocumentCreate(
        document_type="transfer",
        warehouse_id=doc.origin_warehouse_id,
        destination_warehouse_id=doc.destination_warehouse_id,
        notes=doc.notes,
        lines=lines
    )

    new_doc = await create_inventory_document(doc_create, org_id, user, db, bypass_auth=True)
    await process_inventory_document(new_doc["id"], org_id, user, db, bypass_auth=True)

    if doc.auto_confirm:
        # Fetch the lines to confirm receipt
        res_lines = db.table("inventory_document_lines").select("id, qty_presentation").eq("document_id", new_doc["id"]).execute()
        rec_lines = []
        for rl in (res_lines.data or []):
            rec_lines.append(TransferReceiveLineSchema(
                id=rl["id"],
                qty_received_presentation=rl["qty_presentation"]
            ))
        await receive_transfer_document(new_doc["id"], TransferReceiveRequest(notes=doc.notes, lines=rec_lines), org_id, user, db, bypass_auth=True)

    return {
        "id": new_doc["id"],
        "status": "confirmed" if doc.auto_confirm else "in_transit",
        "origin_warehouse_id": doc.origin_warehouse_id,
        "destination_warehouse_id": doc.destination_warehouse_id,
        "created_at": datetime.now(CARACAS_TZ)
    }

@router.patch("/{transfer_id}/confirm")
async def confirm_transfer(transfer_id: UUID, confirm: TransferConfirm, org_id: str = Depends(get_active_org_id), user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("inventory.transfer_confirm"))):
    from app.inventory.router import receive_transfer_document
    from app.inventory.schemas import TransferReceiveRequest, TransferReceiveLineSchema

    rec_lines = []
    for line in confirm.lines:
        rec_lines.append(TransferReceiveLineSchema(
            id=line.id,
            qty_received_presentation=line.qty_received_presentation
        ))

    res = await receive_transfer_document(transfer_id, TransferReceiveRequest(notes=confirm.notes, lines=rec_lines), org_id, user, db, bypass_auth=True)
    return {"ok": True, "status": res["status"]}

@router.get("")
async def list_transfers(org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res = db.table("inventory_documents") \
        .select("*, origin:warehouse_id(name), destination:destination_warehouse_id(name)") \
        .eq("org_id", org_id) \
        .eq("document_type", "transfer") \
        .order("created_at", desc=True) \
        .execute()
    data = []
    for doc in (res.data or []):
        doc["origin_warehouse_id"] = doc["warehouse_id"]
        doc["origin"] = doc.get("origin")
        doc["destination"] = doc.get("destination")
        data.append(doc)
    return data

@router.get("/pending")
async def list_pending_transfers(warehouse_id: Optional[UUID] = None, org_id: str = Depends(get_active_org_id), db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    query = db.table("inventory_documents") \
        .select("*, origin:warehouse_id(name), destination:destination_warehouse_id(name)") \
        .eq("org_id", org_id) \
        .eq("document_type", "transfer") \
        .eq("status", "in_transit")
    
    if warehouse_id:
        query = query.eq("destination_warehouse_id", str(warehouse_id))
        
    res = query.order("created_at", desc=True).execute()
    
    data = []
    for doc in (res.data or []):
        doc["origin_warehouse_id"] = doc["warehouse_id"]
        doc["origin"] = doc.get("origin")
        doc["destination"] = doc.get("destination")
        data.append(doc)
    return data

@router.get("/{transfer_id}")
async def get_transfer_detail(transfer_id: UUID, db=Depends(get_db), _=Depends(require_permission("inventory.view"))):
    res_header = db.table("inventory_documents") \
        .select("*, origin:warehouse_id(name), destination:destination_warehouse_id(name), profiles:created_by(full_name), confirmed_profile:processed_by(full_name)") \
        .eq("id", str(transfer_id)) \
        .execute()
        
    if not res_header.data:
        raise HTTPException(status_code=404, detail="Transfer not found")
        
    header = res_header.data[0]
    header["origin_warehouse_id"] = header["warehouse_id"]
    header["origin"] = header.get("origin")
    header["destination"] = header.get("destination")
    header["profiles"] = header.get("profiles")
    header["confirmed_profile"] = header.get("confirmed_profile")

    res_lines = db.table("inventory_document_lines") \
        .select("*, items(name, uom_base(name)), uom_presentations(name)") \
        .eq("document_id", str(transfer_id)) \
        .execute()
        
    lines = []
    for line in (res_lines.data or []):
        line["qty_sent_presentation"] = line["qty_presentation"]
        line["qty_sent_base"] = line["qty_base"]
        lines.append(line)
        
    return {
        "header": header,
        "lines": lines
    }
