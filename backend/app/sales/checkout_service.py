from datetime import datetime
from fastapi import HTTPException
from app.sales.schemas import CheckoutCreate
from app.sales.service import resolve_pos_config
from app.sales.stock_service import release_session_reservations


async def process_checkout(org_id: str, payload: CheckoutCreate, user_id: str, db):
    """
    Atomic checkout: validate → create invoice → register payments
    → confirm → deduct inventory → release reservations.
    """
    # 1. Resolve POS config
    pos_config = await resolve_pos_config(
        org_id, str(payload.workstation_id), payload.mode, db
    )
    warehouse_id = pos_config.get("warehouse_id") if isinstance(pos_config, dict) else pos_config.warehouse_id

    # 2. Validate customer requirement
    cr = pos_config.get("customer_requirement") if isinstance(pos_config, dict) else pos_config.customer_requirement
    if cr == "required" and not payload.customer_id and not payload.customer_name:
        raise HTTPException(400, "CUSTOMER_REQUIRED")

    # 3. Validate session
    session_res = db.table("pos_sessions").select("id, status").eq(
        "id", str(payload.pos_session_id)
    ).eq("org_id", org_id).eq("status", "open").execute()
    if not session_res.data:
        raise HTTPException(400, "SESSION_NOT_ACTIVE")

    # 4. Resolve customer
    customer_name = "Cliente General"
    customer_id = None
    customer_tax_id = None
    if payload.customer_id:
        cust_res = db.table("customers").select("id, name, tax_id").eq(
            "id", str(payload.customer_id)
        ).eq("org_id", org_id).execute()
        if cust_res.data:
            customer_name = cust_res.data[0]["name"]
            customer_id = str(payload.customer_id)
            customer_tax_id = cust_res.data[0].get("tax_id")
    elif payload.customer_name:
        customer_name = payload.customer_name
        customer_tax_id = payload.customer_tax_id

    # 5. Calculate totals
    subtotal = 0
    invoice_items = []
    for item in payload.items:
        line_sub = item.quantity * item.unit_price
        discount_amt = line_sub * (item.discount_pct / 100) if item.discount_pct else 0
        line_total = line_sub - discount_amt
        subtotal += line_total
        invoice_items.append({
            "sale_item_id": str(item.sale_item_id),
            "variant_id": str(item.variant_id) if item.variant_id else None,
            "quantity": item.quantity,
            "unit_price": float(item.unit_price),
            "discount_pct": float(item.discount_pct),
            "discount_amount": float(discount_amt),
            "tax_id": str(item.tax_id) if item.tax_id else None,
            "subtotal": float(line_total),
            "modifiers": item.modifiers,
            "notes": item.notes,
        })

    total_amount = subtotal - payload.discount_amount

    # 6. Generate document number (auto-provision sequence if missing)
    doc_number = None
    try:
        doc_num_res = db.rpc("get_next_doc_number", {
            "p_org_id": org_id, "p_type": payload.document_type
        }).execute()
        doc_number = doc_num_res.data
    except Exception:
        # Check / create sequence in table directly
        seq_res = db.table("document_sequences").select("*").eq("org_id", org_id).eq("document_type", payload.document_type).execute()
        if not seq_res.data:
            prefix = "INV-" if payload.document_type == "invoice" else "TKT-"
            db.table("document_sequences").insert({
                "org_id": org_id,
                "document_type": payload.document_type,
                "prefix": prefix,
                "next_number": 2,
                "padding": 8
            }).execute()
            doc_number = f"{prefix}00000001"
        else:
            cur = seq_res.data[0]
            nxt = cur.get("next_number", 1)
            pfx = cur.get("prefix", "INV-")
            pad = cur.get("padding", 8)
            db.table("document_sequences").update({"next_number": nxt + 1}).eq("id", cur["id"]).execute()
            doc_number = f"{pfx}{str(nxt).zfill(pad)}"

    if not doc_number:
        doc_number = f"INV-{int(datetime.now().timestamp())}"

    # 7. Calculate payments
    amount_paid = sum(p.amount * p.exchange_rate for p in payload.payments)
    balance_due = max(0, total_amount - amount_paid)

    is_cxc = balance_due > 0.01
    if is_cxc and not customer_id:
        raise HTTPException(400, "CXC_REQUIRES_CUSTOMER")

    status = "paid" if balance_due <= 0.01 else "partial" if amount_paid > 0 else "confirmed"

    # 8. Insert invoice
    invoice_data = {
        "org_id": org_id,
        "venue_id": str(payload.venue_id),
        "workstation_id": str(payload.workstation_id),
        "pos_session_id": str(payload.pos_session_id),
        "document_type": payload.document_type,
        "document_number": doc_number,
        "numbering_source": "verum_sequence",
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_tax_id": customer_tax_id,
        "currency_code": "USD",
        "exchange_rate": 1.0,
        "subtotal": float(subtotal),
        "discount_amount": float(payload.discount_amount),
        "total": float(total_amount),
        "amount_paid": float(amount_paid),
        "balance_due": float(balance_due),
        "status": status,
        "notes": payload.notes,
        "created_by": user_id,
    }
    if payload.table_id:
        invoice_data["table_id"] = str(payload.table_id)

    inv_res = db.table("invoices").insert(invoice_data).execute()
    if not inv_res.data:
        raise HTTPException(500, "SEQUENCE_ERROR")
    invoice = inv_res.data[0]
    invoice_id = invoice["id"]

    # 9. Insert invoice items
    for idx, line in enumerate(invoice_items):
        line["invoice_id"] = invoice_id
        line["position"] = idx
    if invoice_items:
        db.table("invoice_items").insert(invoice_items).execute()

    # 10. Insert payments
    for p in payload.payments:
        # Snapshot payment method
        pm_res = db.table("payment_methods").select("name, method_type").eq(
            "id", str(p.payment_method_id)
        ).eq("org_id", org_id).execute()
        if not pm_res.data:
            raise HTTPException(400, "INVALID_PAYMENT_METHOD")
        pm = pm_res.data[0]

        payment_data = {
            "invoice_id": invoice_id,
            "payment_method_id": str(p.payment_method_id),
            "method_name": pm["name"],
            "method_type": pm["method_type"],
            "amount": float(p.amount),
            "currency_code": p.currency_code,
            "exchange_rate": float(p.exchange_rate),
            "amount_in_invoice_currency": float(p.amount * p.exchange_rate),
            "reference": p.reference,
            "cash_tendered": float(p.cash_tendered) if p.cash_tendered else None,
            "status": "completed",
            "recorded_by": user_id,
        }

        # Register change on cash payment
        if p.cash_tendered and p.cash_tendered > p.amount and payload.change:
            payment_data["cash_change"] = float(payload.change.amount)
            payment_data["change_currency"] = payload.change.currency_code
            payment_data["change_method"] = payload.change.method

        db.table("payments").insert(payment_data).execute()

    # 11. Update customer outstanding balance for CXC
    if is_cxc and customer_id:
        db.rpc("increment_customer_balance", {
            "p_customer_id": customer_id,
            "p_amount": float(balance_due)
        }).execute()

    # 12. Deduct inventory
    if warehouse_id:
        try:
            from app.sales.inventory_deduction import deduct_inventory_for_invoice
            user_mock = type('User', (), {'id': user_id})()
            await deduct_inventory_for_invoice(org_id, invoice_id, str(warehouse_id), user_mock, db)
        except Exception as e:
            print(f"[CHECKOUT] Inventory deduction warning: {e}")

    # 13. Release Redis reservations
    item_ids = [str(item.sale_item_id) for item in payload.items]
    await release_session_reservations(str(warehouse_id), str(payload.pos_session_id), item_ids)

    return {"invoice": invoice}
