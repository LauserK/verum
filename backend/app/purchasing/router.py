from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from uuid import UUID
from datetime import date
import dateutil.parser

from database import get_db
from app.deps import get_active_org_id, require_permission
from auth_deps import get_current_user
from app.purchasing.schemas import (
    SupplierCreate, SupplierResponse, SupplierUpdate, SupplierContactResponse,
    SupplierItemCreate, SupplierItemResponse,
    SupplierPriceListCreate, SupplierPriceListResponse, SupplierPriceListItemResponse,
    POApprovalLimitCreate, POApprovalLimitResponse,
    POApprovalConfigResponse, POApprovalConfigUpdate
)

router = APIRouter(prefix="", tags=["Purchasing"])

# --- Suppliers Endpoints ---

@router.post("/suppliers", response_model=SupplierResponse, status_code=201)
async def create_supplier(
    supplier: SupplierCreate,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.manage_suppliers"))
):
    # Auto-generate code if not provided
    if not supplier.code:
        res = db.table("suppliers").select("code").eq("org_id", org_id).execute()
        codes = [r["code"] for r in (res.data or []) if r.get("code")]
        max_num = 0
        for c in codes:
            if c.startswith("SUP-"):
                try:
                    num = int(c.split("-")[1])
                    if num > max_num:
                        max_num = num
                except (IndexError, ValueError):
                    pass
        supplier.code = f"SUP-{max_num + 1:03d}"

    supplier_dict = supplier.model_dump(exclude={"contacts"})
    supplier_dict["org_id"] = org_id

    # Insert supplier
    sup_res = db.table("suppliers").insert(supplier_dict).execute()
    if not sup_res.data:
        raise HTTPException(status_code=500, detail="Failed to create supplier")
    
    created_supplier = sup_res.data[0]
    created_supplier["contacts"] = []

    # Insert contacts if any
    if supplier.contacts:
        for contact in supplier.contacts:
            contact_dict = contact.model_dump()
            contact_dict["supplier_id"] = created_supplier["id"]
            con_res = db.table("supplier_contacts").insert(contact_dict).execute()
            if con_res.data:
                created_supplier["contacts"].append(con_res.data[0])

    return created_supplier

@router.get("/suppliers", response_model=List[SupplierResponse])
async def list_suppliers(
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.view"))
):
    res = db.table("suppliers").select("*").eq("org_id", org_id).execute()
    suppliers = res.data or []

    for sup in suppliers:
        con_res = db.table("supplier_contacts").select("*").eq("supplier_id", sup["id"]).execute()
        sup["contacts"] = con_res.data or []

    return suppliers

@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: UUID,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.view"))
):
    res = db.table("suppliers").select("*").eq("org_id", org_id).eq("id", str(supplier_id)).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    supplier = res.data[0]
    con_res = db.table("supplier_contacts").select("*").eq("supplier_id", supplier["id"]).execute()
    supplier["contacts"] = con_res.data or []
    
    return supplier

@router.patch("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: UUID,
    supplier_update: SupplierUpdate,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.manage_suppliers"))
):
    # Verify existence
    res = db.table("suppliers").select("*").eq("org_id", org_id).eq("id", str(supplier_id)).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Supplier not found")

    update_dict = supplier_update.model_dump(exclude_unset=True)
    if not update_dict:
        return res.data[0]

    upd_res = db.table("suppliers").update(update_dict).eq("id", str(supplier_id)).execute()
    if not upd_res.data:
        raise HTTPException(status_code=500, detail="Failed to update supplier")

    supplier = upd_res.data[0]
    con_res = db.table("supplier_contacts").select("*").eq("supplier_id", supplier["id"]).execute()
    supplier["contacts"] = con_res.data or []

    return supplier

# --- Supplier Items Endpoints ---

@router.post("/suppliers/{supplier_id}/items", response_model=SupplierItemResponse, status_code=201)
async def link_supplier_item(
    supplier_id: UUID,
    link: SupplierItemCreate,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.manage_suppliers"))
):
    # Verify supplier exists in org
    sup = db.table("suppliers").select("id").eq("org_id", org_id).eq("id", str(supplier_id)).execute()
    if not sup.data:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Verify item exists in org (items has org_id constraint usually)
    item = db.table("items").select("id, name").eq("org_id", org_id).eq("id", str(link.item_id)).execute()
    if not item.data:
        raise HTTPException(status_code=404, detail="Item not found")

    link_dict = link.model_dump()
    link_dict["supplier_id"] = str(supplier_id)

    res = db.table("supplier_items").insert(link_dict).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to link item")

    response_data = res.data[0]
    response_data["item_name"] = item.data[0]["name"]
    return response_data

@router.get("/suppliers/{supplier_id}/items", response_model=List[SupplierItemResponse])
async def list_supplier_items(
    supplier_id: UUID,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.view"))
):
    # Verify supplier exists in org
    sup = db.table("suppliers").select("id").eq("org_id", org_id).eq("id", str(supplier_id)).execute()
    if not sup.data:
        raise HTTPException(status_code=404, detail="Supplier not found")

    res = db.table("supplier_items").select("*, items(name)").eq("supplier_id", str(supplier_id)).execute()
    
    data = []
    for row in (res.data or []):
        item_name = row.get("items", {}).get("name") if row.get("items") else None
        data.append(SupplierItemResponse(
            supplier_id=row["supplier_id"],
            item_id=row["item_id"],
            supplier_sku=row.get("supplier_sku"),
            lead_time_days=row.get("lead_time_days"),
            is_preferred=row.get("is_preferred", False),
            item_name=item_name
        ))
    return data

# --- Supplier Price Lists Endpoints ---

@router.get("/suppliers/{supplier_id}/price-lists", response_model=List[SupplierPriceListResponse])
async def list_supplier_price_lists(
    supplier_id: UUID,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.view"))
):
    # Verify supplier exists
    sup = db.table("suppliers").select("id").eq("org_id", org_id).eq("id", str(supplier_id)).execute()
    if not sup.data:
        raise HTTPException(status_code=404, detail="Supplier not found")

    res = db.table("supplier_price_lists").select("*").eq("supplier_id", str(supplier_id)).order("created_at", desc=True).execute()
    price_lists = res.data or []

    for pl in price_lists:
        lines = db.table("supplier_price_list_items").select("*").eq("price_list_id", pl["id"]).execute()
        pl["items"] = lines.data or []

    return price_lists

@router.post("/suppliers/{supplier_id}/price-lists", response_model=SupplierPriceListResponse, status_code=201)
async def create_price_list(
    supplier_id: UUID,
    price_list: SupplierPriceListCreate,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.manage_suppliers"))
):
    # Verify supplier exists
    sup = db.table("suppliers").select("id").eq("org_id", org_id).eq("id", str(supplier_id)).execute()
    if not sup.data:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Overlap validation: query active price lists for this supplier
    existing_lists = db.table("supplier_price_lists").select("*").eq("supplier_id", str(supplier_id)).eq("is_active", True).execute()
    
    new_from = price_list.valid_from
    new_until = price_list.valid_until

    for el in (existing_lists.data or []):
        el_from = dateutil.parser.parse(el["valid_from"]).date()
        el_until = dateutil.parser.parse(el["valid_until"]).date() if el.get("valid_until") else None

        overlap = True
        if new_until is not None and el_from > new_until:
            overlap = False
        if el_until is not None and new_from > el_until:
            overlap = False

        if overlap:
            raise HTTPException(status_code=400, detail=f"Price list overlaps with an active price list '{el['name']}'")

    # Insert price list header
    list_dict = price_list.model_dump(exclude={"items"})
    list_dict["supplier_id"] = str(supplier_id)
    list_dict["valid_from"] = str(list_dict["valid_from"])
    if list_dict.get("valid_until"):
        list_dict["valid_until"] = str(list_dict["valid_until"])

    pl_res = db.table("supplier_price_lists").insert(list_dict).execute()
    if not pl_res.data:
        raise HTTPException(status_code=500, detail="Failed to create price list header")

    created_list = pl_res.data[0]
    created_list["items"] = []

    # Insert price list lines
    for item in price_list.items:
        item_dict = item.model_dump()
        item_dict["price_list_id"] = created_list["id"]
        line_res = db.table("supplier_price_list_items").insert(item_dict).execute()
        if line_res.data:
            created_list["items"].append(line_res.data[0])

    return created_list

# --- PO Approval Limits & Config ---

@router.get("/po-approval-limits", response_model=List[POApprovalLimitResponse])
async def list_po_approval_limits(
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.view"))
):
    res = db.table("po_approval_limits").select("*").eq("org_id", org_id).execute()
    return res.data or []

@router.put("/po-approval-limits", response_model=POApprovalLimitResponse)
async def update_po_approval_limit(
    limit: POApprovalLimitCreate,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.configure"))
):
    # Verify role exists and check if it is owner
    role_res = db.table("custom_roles").select("*").eq("org_id", org_id).eq("id", str(limit.role_id)).execute()
    if not role_res.data:
        raise HTTPException(status_code=404, detail="Role not found")
    
    role = role_res.data[0]
    if role["name"].lower() in ("dueño", "owner"):
        raise HTTPException(status_code=400, detail="Cannot set approval limit for owner role. It must remain unlimited (null).")

    limit_dict = limit.model_dump()
    limit_dict["org_id"] = org_id

    res = db.table("po_approval_limits").upsert(limit_dict, on_conflict="org_id, role_id").execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update approval limit")

    return res.data[0]

@router.get("/po-approval-config/{org_id_param}", response_model=POApprovalConfigResponse)
async def get_po_approval_config(
    org_id_param: UUID,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.view"))
):
    # Enforce tenant isolation
    if str(org_id_param) != org_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    res = db.table("po_approval_config").select("*").eq("org_id", org_id).execute()
    if not res.data:
        # Create default config if not found
        default_config = {
            "org_id": org_id,
            "creator_can_approve_own": False,
            "require_approval_above": 0.0
        }
        ins_res = db.table("po_approval_config").insert(default_config).execute()
        if not ins_res.data:
            raise HTTPException(status_code=500, detail="Failed to initialize approval config")
        return ins_res.data[0]

    return res.data[0]

@router.put("/po-approval-config/{org_id_param}", response_model=POApprovalConfigResponse)
async def update_po_approval_config(
    org_id_param: UUID,
    config: POApprovalConfigUpdate,
    org_id: str = Depends(get_active_org_id),
    db=Depends(get_db),
    _=Depends(require_permission("purchasing.configure"))
):
    if str(org_id_param) != org_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Get current or create default first
    res = db.table("po_approval_config").select("*").eq("org_id", org_id).execute()
    if not res.data:
        default_config = {
            "org_id": org_id,
            "creator_can_approve_own": False,
            "require_approval_above": 0.0
        }
        db.table("po_approval_config").insert(default_config).execute()

    update_dict = config.model_dump(exclude_unset=True)
    if not update_dict:
        res = db.table("po_approval_config").select("*").eq("org_id", org_id).execute()
        return res.data[0]

    upd_res = db.table("po_approval_config").update(update_dict).eq("org_id", org_id).execute()
    if not upd_res.data:
        raise HTTPException(status_code=500, detail="Failed to update approval config")

    return upd_res.data[0]
