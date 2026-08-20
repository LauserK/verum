from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
from fastapi import HTTPException
from app.sales.schemas import InvoiceCreate, InvoiceItemCreate
from app.sales.service import get_billing_config
from app.sales.inventory_deduction import deduct_inventory_for_invoice
from app.sales.service import get_billing_config

async def create_invoice(org_id: str, payload: InvoiceCreate, user_id: str, db) -> dict:
    # 1. Fetch config
    config = await get_billing_config(org_id, db)
    
    # 2. Get next document number if sequence
    doc_number = payload.document_number
    if payload.numbering_source == 'verum_sequence' and not doc_number:
        # call PL/pgSQL get_next_doc_number
        res_seq = db.rpc("get_next_doc_number", {"p_org_id": org_id, "p_type": payload.document_type}).execute()
        doc_number = res_seq.data
        
    if not doc_number:
        raise HTTPException(400, "Document number could not be generated/provided")
        
    # 3. Resolve customer details
    cust_name = payload.customer_name or "Cliente General"
    cust_tax_id = payload.customer_tax_id
    cust_address = payload.customer_address
    if payload.customer_id:
        cust_res = db.table("customers").select("*").eq("id", str(payload.customer_id)).eq("org_id", org_id).execute()
        if cust_res.data:
            customer = cust_res.data[0]
            cust_name = customer["name"]
            cust_tax_id = customer["tax_id"]
            cust_address = customer["address"]

    # 4. Process lines and calculate taxes
    invoice_items_to_insert = []
    tax_grouping = {} # tax_id -> {tax_name, tax_rate, taxable_base, tax_amount}
    
    subtotal_sum = 0.0
    tax_sum = 0.0
    exempt_sum = 0.0
    taxable_sum = 0.0
    
    for idx, item in enumerate(payload.items):
        qty = float(item.quantity)
        price = float(item.unit_price)
        disc_pct = float(item.discount_pct)
        
        disc_amount = qty * price * (disc_pct / 100.0)
        line_subtotal = (qty * price) - disc_amount
        
        # Resolve tax
        tax_rate = 0.0
        tax_name = "Exento"
        is_exempt = True
        
        if item.tax_id:
            tax_res = db.table("taxes").select("*").eq("id", str(item.tax_id)).execute()
            if tax_res.data:
                tax_db = tax_res.data[0]
                tax_rate = float(tax_db["rate"])
                tax_name = tax_db["name"]
                is_exempt = False
                
        line_tax = 0.0 if is_exempt else (line_subtotal * tax_rate)
        line_total = line_subtotal + line_tax
        
        subtotal_sum += line_subtotal
        tax_sum += line_tax
        if is_exempt:
            exempt_sum += line_subtotal
        else:
            taxable_sum += line_subtotal
            
        # Add to tax grouping
        tid_str = str(item.tax_id) if item.tax_id else "exempt"
        if tid_str not in tax_grouping:
            tax_grouping[tid_str] = {
                "tax_id": str(item.tax_id) if item.tax_id else None,
                "tax_name": tax_name,
                "tax_rate": tax_rate,
                "taxable_base": 0.0,
                "tax_amount": 0.0
            }
        tax_grouping[tid_str]["taxable_base"] += line_subtotal
        tax_grouping[tid_str]["tax_amount"] += line_tax
        
        invoice_items_to_insert.append({
            "sale_item_id": str(item.sale_item_id) if item.sale_item_id else None,
            "variant_id": str(item.variant_id) if item.variant_id else None,
            "description": item.description,
            "product_code": item.product_code,
            "quantity": qty,
            "unit_price": price,
            "discount_pct": disc_pct,
            "discount_amount": disc_amount,
            "tax_id": str(item.tax_id) if item.tax_id else None,
            "tax_name": tax_name,
            "tax_rate": tax_rate,
            "is_exempt": is_exempt,
            "subtotal": line_subtotal,
            "tax_amount": line_tax,
            "total": line_total,
            "modifiers": item.modifiers,
            "position": idx,
            "notes": item.notes
        })

    # 5. Compute Invoice Totals
    disc_total = float(payload.discount_amount)
    subtotal_sum_net = subtotal_sum - disc_total
    
    # Adjust taxes proportionally if header discount is applied
    if disc_total > 0 and subtotal_sum > 0:
        ratio = subtotal_sum_net / subtotal_sum
        tax_sum = 0.0
        taxable_sum = 0.0
        exempt_sum = 0.0
        for tid, group in tax_grouping.items():
            group["taxable_base"] *= ratio
            group["tax_amount"] *= ratio
            tax_sum += group["tax_amount"]
            if group["tax_rate"] > 0:
                taxable_sum += group["taxable_base"]
            else:
                exempt_sum += group["taxable_base"]

    total = subtotal_sum_net + tax_sum
    
    invoice_header = {
        "org_id": org_id,
        "venue_id": str(payload.venue_id) if payload.venue_id else None,
        "workstation_id": str(payload.workstation_id) if payload.workstation_id else None,
        "document_type": payload.document_type,
        "document_number": doc_number,
        "numbering_source": payload.numbering_source,
        "customer_id": str(payload.customer_id) if payload.customer_id else None,
        "customer_name": cust_name,
        "customer_tax_id": cust_tax_id,
        "customer_address": cust_address,
        "date": str(payload.date),
        "due_date": str(payload.due_date) if payload.due_date else None,
        "status": "draft",
        "currency_code": payload.currency_code,
        "exchange_rate": float(payload.exchange_rate),
        "subtotal": subtotal_sum_net,
        "discount_amount": disc_total,
        "total_taxable": taxable_sum,
        "total_exempt": exempt_sum,
        "total_tax": tax_sum,
        "total": total,
        "amount_paid": 0.0,
        "balance_due": total,
        "related_invoice_id": str(payload.related_invoice_id) if payload.related_invoice_id else None,
        "pos_session_id": str(payload.pos_session_id) if payload.pos_session_id else None,
        "notes": payload.notes,
        "internal_notes": payload.internal_notes,
        "created_by": user_id
    }
    
    # Write to DB
    inv_res = db.table("invoices").insert(invoice_header).execute()
    invoice_id = inv_res.data[0]["id"]
    
    # Write lines
    for item in invoice_items_to_insert:
        item["invoice_id"] = invoice_id
    db.table("invoice_items").insert(invoice_items_to_insert).execute()
    
    # Write tax summary
    tax_summary_inserts = []
    for group in tax_grouping.values():
        group["invoice_id"] = invoice_id
        tax_summary_inserts.append(group)
    if tax_summary_inserts:
        db.table("invoice_tax_summary").insert(tax_summary_inserts).execute()
        
    # Auto-confirm and deduct if warehouse is provided
    if payload.warehouse_id:
        # We need a user object structure helper for python API
        from unittest.mock import MagicMock
        mock_user = MagicMock()
        mock_user.id = user_id
        await confirm_invoice(org_id, invoice_id, str(payload.warehouse_id), mock_user, db)
        
    return await get_invoice_detail(org_id, invoice_id, db)

async def get_invoice_detail(org_id: str, invoice_id: str, db) -> dict:
    inv_res = db.table("invoices").select("*, invoice_items(*), invoice_tax_summary(*)").eq("id", invoice_id).eq("org_id", org_id).execute()
    if not inv_res.data:
        raise HTTPException(404, "Invoice not found")
    invoice = inv_res.data[0]
    invoice["items"] = invoice.get("invoice_items", [])
    invoice["tax_summary"] = invoice.get("invoice_tax_summary", [])
    return invoice

async def confirm_invoice(org_id: str, invoice_id: str, warehouse_id: Optional[str], user, db) -> dict:
    inv_res = db.table("invoices").select("*").eq("id", invoice_id).eq("org_id", org_id).execute()
    if not inv_res.data:
        raise HTTPException(404, "Invoice not found")
    invoice = inv_res.data[0]
    
    if invoice["status"] != "draft":
        raise HTTPException(400, "Invoice is not in draft status")
        
    # Deduct inventory if warehouse is provided
    if warehouse_id:
        await deduct_inventory_for_invoice(org_id, invoice_id, warehouse_id, user, db)
        
    update_res = db.table("invoices").update({"status": "confirmed"}).eq("id", invoice_id).execute()
    return update_res.data[0]

async def void_invoice(org_id: str, invoice_id: str, voided_by: str, reason: str, db) -> dict:
    inv_res = db.table("invoices").select("*").eq("id", invoice_id).eq("org_id", org_id).execute()
    if not inv_res.data:
        raise HTTPException(404, "Invoice not found")
    invoice = inv_res.data[0]
    
    if invoice["status"] == "void":
        raise HTTPException(400, "Invoice is already void")
        
    update_data = {
        "status": "void",
        "voided_by": voided_by,
        "voided_at": datetime.now().isoformat(),
        "void_reason": reason
    }
    update_res = db.table("invoices").update(update_data).eq("id", invoice_id).execute()
    return update_res.data[0]
