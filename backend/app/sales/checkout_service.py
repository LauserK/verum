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

    # 4.5 Resolve table_order_id if applicable
    table_order_id = str(payload.table_order_id) if payload.table_order_id else None
    if not table_order_id and payload.table_id:
        try:
            t_res = db.table("pos_table_orders").select("id").eq("org_id", org_id).eq("table_id", str(payload.table_id)).in_("status", ["active", "pre_bill"]).limit(1).execute()
            if t_res.data:
                table_order_id = str(t_res.data[0]["id"])
            else:
                table_order_id = str(payload.table_id)
        except Exception:
            table_order_id = str(payload.table_id)

    # 4.6 Check for existing partial invoice if is_partial
    existing_invoice = None
    if payload.is_partial and (table_order_id or payload.table_id):
        search_ids = [i for i in [table_order_id, str(payload.table_id) if payload.table_id else None] if i]
        for s_id in search_ids:
            try:
                inv_query = db.table("invoices").select("*").eq("org_id", org_id).eq("table_order_id", s_id).eq("status", "partial").order("created_at", desc=True).limit(1).execute()
                if inv_query.data:
                    existing_invoice = inv_query.data[0]
                    break
            except Exception:
                pass

    if existing_invoice:
        invoice = existing_invoice
        invoice_id = invoice["id"]
        this_payment_total = sum(p.amount * p.exchange_rate for p in payload.payments)
        prev_paid = float(invoice.get("amount_paid") or 0)
        amount_paid = prev_paid + float(this_payment_total)
        total_amount = float(invoice.get("total") or 0)
        balance_due = max(0.0, round(total_amount - amount_paid, 2))
        status = "paid" if balance_due <= 0.01 else "partial"

        db.table("invoices").update({
            "amount_paid": amount_paid,
            "balance_due": balance_due,
            "status": status,
            "updated_at": "now()"
        }).eq("id", invoice_id).execute()

        invoice["amount_paid"] = amount_paid
        invoice["balance_due"] = balance_due
        invoice["status"] = status
    else:
        # 5. Calculate totals
        sale_item_ids = [str(item.sale_item_id) for item in payload.items]
        items_res = db.table("sale_items").select("id, name").in_("id", sale_item_ids).execute()
        item_names = {i["id"]: i["name"] for i in items_res.data}
        
        variant_ids = [str(item.variant_id) for item in payload.items if item.variant_id]
        variant_names = {}
        if variant_ids:
            var_res = db.table("sale_item_variants").select("id, name").in_("id", variant_ids).execute()
            variant_names = {v["id"]: v["name"] for v in var_res.data}

        tax_ids = [str(item.tax_id) for item in payload.items if item.tax_id]
        taxes_dict = {}
        if tax_ids:
            tax_res = db.table("taxes").select("id, name, rate").in_("id", tax_ids).execute()
            taxes_dict = {t["id"]: t for t in tax_res.data}

        subtotal = 0
        total_tax = 0
        total_exempt = 0
        total_taxable = 0
        invoice_items = []
        
        for item in payload.items:
            line_sub = item.quantity * item.unit_price
            discount_amt = line_sub * (item.discount_pct / 100) if item.discount_pct else 0
            line_total_net = line_sub - discount_amt
            
            tax_name = None
            tax_rate = 0.0
            is_exempt = True
            
            if item.tax_id and str(item.tax_id) in taxes_dict:
                tax = taxes_dict[str(item.tax_id)]
                tax_name = tax["name"]
                tax_rate = float(tax["rate"])
                is_exempt = False
                
            line_tax = line_total_net * tax_rate
            line_total = line_total_net + line_tax
            
            subtotal += line_total_net
            total_tax += line_tax
            if is_exempt:
                total_exempt += line_total_net
            else:
                total_taxable += line_total_net
                
            base_name = item_names.get(str(item.sale_item_id), "Item")
            if item.variant_id and str(item.variant_id) in variant_names:
                desc = f"{base_name} - {variant_names[str(item.variant_id)]}"
            else:
                desc = base_name

            invoice_items.append({
                "sale_item_id": str(item.sale_item_id),
                "variant_id": str(item.variant_id) if item.variant_id else None,
                "description": desc,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "discount_pct": float(item.discount_pct),
                "discount_amount": float(discount_amt),
                "tax_id": str(item.tax_id) if item.tax_id else None,
                "tax_name": tax_name,
                "tax_rate": tax_rate,
                "is_exempt": is_exempt,
                "tax_amount": float(line_tax),
                "subtotal": float(line_total_net),
                "total": float(line_total_net),
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
        balance_due = max(0.0, round(total_amount - amount_paid, 2))

        is_cxc = balance_due > 0.01 and not payload.is_partial
        if is_cxc and not customer_id:
            raise HTTPException(400, "CXC_REQUIRES_CUSTOMER")

        if payload.is_partial:
            status = "paid" if balance_due <= 0.01 else "partial"
        else:
            status = "paid" if balance_due <= 0.01 else "partial" if amount_paid > 0 else "confirmed"

        # 8. Resolve real venue_id if not valid
        venue_id_to_use = None
        if payload.venue_id and str(payload.venue_id) != "00000000-0000-0000-0000-000000000000":
            venue_id_to_use = str(payload.venue_id)
        else:
            # Check workstation's venue_id
            ws_res = db.table("workstations").select("venue_id").eq("id", str(payload.workstation_id)).execute()
            if ws_res.data and ws_res.data[0].get("venue_id"):
                venue_id_to_use = str(ws_res.data[0]["venue_id"])
            else:
                # Check active venue for org
                ven_res = db.table("venues").select("id").eq("org_id", org_id).execute()
                if ven_res.data:
                    venue_id_to_use = str(ven_res.data[0]["id"])

        # 9. Insert invoice
        invoice_data = {
            "org_id": org_id,
            "venue_id": venue_id_to_use,
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
        if table_order_id:
            invoice_data["table_order_id"] = str(table_order_id)
        elif payload.table_id:
            invoice_data["table_order_id"] = str(payload.table_id)

        inv_res = db.table("invoices").insert(invoice_data).execute()
        if not inv_res.data:
            raise HTTPException(500, "SEQUENCE_ERROR")
        invoice = inv_res.data[0]
        invoice_id = invoice["id"]

        # 9.5. Insert invoice items
        for idx, line in enumerate(invoice_items):
            line["invoice_id"] = invoice_id
            line["position"] = idx
        if invoice_items:
            db.table("invoice_items").insert(invoice_items).execute()

    # 10. Insert payments
    from app.sales.service import get_payment_methods
    cached_pms = await get_payment_methods(org_id, db)
    pm_map = {str(pm["id"]): pm for pm in cached_pms} if cached_pms else {}

    for p in payload.payments:
        # Snapshot payment method
        pm = pm_map.get(str(p.payment_method_id))
        if not pm:
            pm_res = db.table("payment_methods").select("name, method_type").eq(
                "id", str(p.payment_method_id)
            ).eq("org_id", org_id).execute()
            if not pm_res.data:
                raise HTTPException(400, "INVALID_PAYMENT_METHOD")
            pm = pm_res.data[0]

        seat_label = getattr(p, "seat_label", None) or payload.seat_label
        covered_items = getattr(p, "covered_items", None) or payload.covered_item_ids

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
            "seat_label": seat_label,
            "covered_items": covered_items,
        }

        # Register change on cash payment
        if p.cash_tendered and p.cash_tendered > p.amount and payload.change:
            payment_data["cash_change"] = float(payload.change.amount)
            payment_data["change_currency"] = payload.change.currency_code
            payment_data["change_method"] = payload.change.method

        db.table("payments").insert(payment_data).execute()

    # 11. Update customer outstanding balance for CXC
    if not payload.is_partial and (balance_due > 0.01) and customer_id:
        try:
            db.rpc("increment_customer_balance", {
                "p_customer_id": customer_id,
                "p_amount": float(balance_due)
            }).execute()
        except Exception:
            # Fallback direct update to customers table (current_balance)
            try:
                c_res = db.table("customers").select("current_balance").eq("id", customer_id).execute()
                if c_res.data:
                    curr = float(c_res.data[0].get("current_balance") or 0)
                    db.table("customers").update({
                        "current_balance": curr + float(balance_due)
                    }).eq("id", customer_id).execute()
            except Exception as e:
                print(f"[CHECKOUT] Customer balance update error: {e}")

    # 12. Finalize based on invoice status
    if status == "paid":
        # 12.1 Mark table order as billed
        if table_order_id or payload.table_id:
            try:
                if table_order_id:
                    db.table("pos_table_orders").update({
                        "status": "billed",
                        "updated_at": "now()"
                    }).eq("org_id", org_id).eq("id", str(table_order_id)).execute()
                if payload.table_id:
                    db.table("pos_table_orders").update({
                        "status": "billed",
                        "updated_at": "now()"
                    }).eq("org_id", org_id).eq("table_id", str(payload.table_id)).in_("status", ["active", "pre_bill"]).execute()
                from app.cache import invalidate_table_orders
                await invalidate_table_orders(org_id)
            except Exception as te:
                print(f"[CHECKOUT] Error freeing table order: {te}")

        # 12.2 Deduct inventory
        if warehouse_id:
            try:
                from app.sales.inventory_deduction import deduct_inventory_for_invoice
                user_mock = type('User', (), {'id': user_id})()
                await deduct_inventory_for_invoice(org_id, invoice_id, str(warehouse_id), user_mock, db)
            except Exception as e:
                print(f"[CHECKOUT] Inventory deduction warning: {e}")

        # 12.3 Release Redis reservations
        item_ids = [str(item.sale_item_id) for item in payload.items]
        await release_session_reservations(str(warehouse_id), str(payload.pos_session_id), item_ids)
    elif payload.is_partial and status == "partial":
        # Leave table order open, mark payment_pending = True
        if table_order_id or payload.table_id:
            try:
                if table_order_id:
                    db.table("pos_table_orders").update({
                        "payment_pending": True,
                        "updated_at": "now()"
                    }).eq("org_id", org_id).eq("id", str(table_order_id)).execute()
                if payload.table_id:
                    db.table("pos_table_orders").update({
                        "payment_pending": True,
                        "updated_at": "now()"
                    }).eq("org_id", org_id).eq("table_id", str(payload.table_id)).in_("status", ["active", "pre_bill"]).execute()
                from app.cache import invalidate_table_orders
                await invalidate_table_orders(org_id)
            except Exception as te:
                print(f"[CHECKOUT] Error updating table order payment_pending: {te}")

    return {"invoice": invoice}
