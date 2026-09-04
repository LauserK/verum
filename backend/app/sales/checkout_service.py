from datetime import datetime
from fastapi import HTTPException
from app.sales.schemas import CheckoutCreate
from app.sales.service import resolve_pos_config
from app.sales.stock_service import release_session_reservations, validate_checkout_stock
from app.cache import cache


async def process_checkout(org_id: str, payload: CheckoutCreate, user_id: str, db):
    """
    Atomic checkout: validate idempotency → lock warehouse → validate stock
    → create invoice → register payments → confirm → deduct inventory
    → release reservations & lock → record idempotency.
    """
    # 0. Idempotency check
    idempotency_key = getattr(payload, "idempotency_key", None)
    idemp_cache_key = f"sales:idempotency:{org_id}:{idempotency_key}" if idempotency_key else None
    if idemp_cache_key:
        cached_result = await cache.get(idemp_cache_key)
        if cached_result:
            if cached_result.get("status") == "processing":
                raise HTTPException(409, "TRANSACTION_IN_PROGRESS")
            return cached_result
        # Mark in-flight for 30s
        await cache.set(idemp_cache_key, {"status": "processing"}, ttl=30)

    # 1. Resolve POS config
    pos_config = await resolve_pos_config(
        org_id, str(payload.workstation_id), payload.mode, db
    )
    warehouse_id = pos_config.get("warehouse_id") if isinstance(pos_config, dict) else pos_config.warehouse_id

    # Acquire distributed lock on warehouse
    lock_key = f"stock:lock:{warehouse_id}" if warehouse_id else None
    if lock_key:
        await cache.setnx(lock_key, "locked", ttl=10)

    try:
        # Atomic stock validation (respects allow_negative_stock)
        if warehouse_id and payload.items:
            await validate_checkout_stock(org_id, str(warehouse_id), payload.items, db)

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

        # 4.4 Resolve real venue_id if not valid
        venue_id_to_use = None
        if payload.venue_id and str(payload.venue_id) != "00000000-0000-0000-0000-000000000000":
            venue_id_to_use = str(payload.venue_id)
        else:
            ws_res = db.table("workstations").select("venue_id").eq("id", str(payload.workstation_id)).execute()
            if ws_res.data and ws_res.data[0].get("venue_id"):
                venue_id_to_use = str(ws_res.data[0]["venue_id"])
            else:
                ven_res = db.table("venues").select("id").eq("org_id", org_id).execute()
                if ven_res.data:
                    venue_id_to_use = str(ven_res.data[0]["id"])

        # 4.5 Resolve table_order_id if applicable (must reference a valid pos_table_orders.id)
        table_order_id = None
        if payload.table_order_id:
            try:
                t_check = db.table("pos_table_orders").select("id").eq("org_id", org_id).eq("id", str(payload.table_order_id)).limit(1).execute()
                if t_check.data:
                    table_order_id = str(t_check.data[0]["id"])
            except Exception:
                pass

        if not table_order_id and payload.table_id:
            try:
                t_res = db.table("pos_table_orders").select("id").eq("org_id", org_id).eq("table_id", str(payload.table_id)).in_("status", ["active", "pre_bill"]).order("created_at", desc=True).limit(1).execute()
                if t_res.data:
                    table_order_id = str(t_res.data[0]["id"])
                else:
                    t_res2 = db.table("pos_table_orders").select("id").eq("org_id", org_id).eq("id", str(payload.table_id)).limit(1).execute()
                    if t_res2.data:
                        table_order_id = str(t_res2.data[0]["id"])
            except Exception:
                pass

        # 5. Calculate and snapshot items (Batch fetch tax rates & item names)
        tax_ids = [str(item.tax_id) for item in payload.items if item.tax_id]
        item_ids = [str(item.sale_item_id) for item in payload.items]
        variant_ids = [str(item.variant_id) for item in payload.items if item.variant_id]

        tax_rates_map = {}
        if tax_ids:
            taxes_res = db.table("taxes").select("id, rate, name").in_("id", list(set(tax_ids))).execute()
            if taxes_res.data:
                tax_rates_map = {t["id"]: t for t in taxes_res.data}

        item_names = {}
        if item_ids:
            items_res = db.table("sale_items").select("id, name").in_("id", list(set(item_ids))).execute()
            if items_res.data:
                item_names = {i["id"]: i["name"] for i in items_res.data}

        variant_names = {}
        if variant_ids:
            var_res = db.table("sale_item_variants").select("id, name").in_("id", list(set(variant_ids))).execute()
            if var_res.data:
                variant_names = {v["id"]: v["name"] for v in var_res.data}

        invoice_items = []
        subtotal = 0.0
        total_tax = 0.0
        total_exempt = 0.0
        total_taxable = 0.0

        for item in payload.items:
            line_raw = float(item.unit_price) * item.quantity
            discount_amt = 0.0
            if item.discount_pct > 0:
                discount_amt = line_raw * (float(item.discount_pct) / 100.0)
            elif item.discount_amount > 0:
                discount_amt = float(item.discount_amount)

            line_total_net = line_raw - discount_amt
            subtotal += line_total_net

            line_tax = 0.0
            tax_rate = 0.0
            tax_name = None
            is_exempt = True

            if item.tax_id and str(item.tax_id) in tax_rates_map:
                tax_obj = tax_rates_map[str(item.tax_id)]
                tax_rate = float(tax_obj["rate"])
                tax_name = tax_obj["name"]
                is_exempt = False
                line_tax = line_total_net * (tax_rate / 100.0)
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

        delivery_cost = float(payload.delivery_cost or 0.0) if payload.mode == "delivery" else 0.0
        total_amount = subtotal - payload.discount_amount + delivery_cost

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
                seq = seq_res.data[0]
                prefix = seq.get("prefix", "")
                next_num = seq.get("next_number", 1)
                padding = seq.get("padding", 8)
                doc_number = f"{prefix}{str(next_num).zfill(padding)}"
                db.table("document_sequences").update({
                    "next_number": next_num + 1
                }).eq("id", seq["id"]).execute()

        # 7. Calculate amount paid & balance
        amount_paid = sum(float(p.amount) for p in payload.payments)
        balance_due = max(0.0, total_amount - amount_paid)

        # 8. Determine status
        if payload.is_partial:
            status = "partial"
        elif balance_due <= 0.009:
            status = "paid"
        elif amount_paid > 0:
            status = "partial"
        else:
            status = "pending"

        if not venue_id_to_use:
            ws_res = db.table("workstations").select("venue_id").eq("id", str(payload.workstation_id)).execute()
            if ws_res.data and ws_res.data[0].get("venue_id"):
                venue_id_to_use = str(ws_res.data[0]["venue_id"])
            else:
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
            "delivery_zone_id": str(payload.delivery_zone_id) if payload.delivery_zone_id else None,
            "delivery_zone_name": payload.delivery_zone_name,
            "delivery_cost": delivery_cost,
            "delivery_address": payload.delivery_address,
            "delivery_notes": payload.delivery_notes,
            "total": float(total_amount),
            "amount_paid": float(amount_paid),
            "balance_due": float(balance_due),
            "status": status,
            "notes": payload.notes,
            "created_by": user_id,
        }
        if table_order_id:
            invoice_data["table_order_id"] = str(table_order_id)

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

            db.table("payments").insert({
                "invoice_id": invoice_id,
                "pos_session_id": str(payload.pos_session_id),
                "payment_method_id": str(p.payment_method_id),
                "payment_method_name": pm["name"],
                "payment_method_type": pm["method_type"],
                "amount": float(p.amount),
                "currency_code": p.currency_code,
                "exchange_rate": float(p.exchange_rate),
                "reference": p.reference,
                "seat_label": seat_label,
                "covered_items": covered_items,
            }).execute()

        # 10.5 Insert change record if given
        if payload.change:
            pm_c_res = db.table("payment_methods").select("name").eq(
                "id", str(payload.change.payment_method_id)
            ).execute()
            c_name = pm_c_res.data[0]["name"] if pm_c_res.data else "Efectivo"
            db.table("changes").insert({
                "invoice_id": invoice_id,
                "payment_method_id": str(payload.change.payment_method_id),
                "payment_method_name": c_name,
                "amount": float(payload.change.amount),
                "currency_code": payload.change.currency_code,
                "exchange_rate": float(payload.change.exchange_rate),
            }).execute()

        # 11. Customer balance update if CXC (status pending or balance due)
        if customer_id and balance_due > 0:
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
                    print(f"[CHECKOUT] Error updating table order partial: {te}")
    finally:
        # Release distributed lock
        if lock_key:
            await cache.delete(lock_key)

    # Invalidate stock availability cache for warehouse
    if warehouse_id:
        await cache.delete(f"sales:stock:availability:{org_id}:{warehouse_id}")

    res_data = {"invoice": invoice}
    if idemp_cache_key:
        await cache.set(idemp_cache_key, res_data, ttl=86400) # Cache completed checkout for 24h

    return res_data
