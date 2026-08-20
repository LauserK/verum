from uuid import UUID
from typing import List
from fastapi import HTTPException
from app.sales.schemas import PaymentCreate
from app.sales.service import get_billing_config

async def add_payment(org_id: str, invoice_id: str, payload: PaymentCreate, recorded_by: str, db) -> dict:
    # 1. Validate invoice
    inv_res = db.table("invoices").select("*").eq("id", invoice_id).eq("org_id", org_id).execute()
    if not inv_res.data:
        raise HTTPException(404, "Invoice not found")
    invoice = inv_res.data[0]
    
    if invoice["status"] not in ["confirmed", "partial"]:
        raise HTTPException(400, "Invoice is not in confirmable state for payments")
        
    # 2. Fetch payment method snapshots
    method_res = db.table("payment_methods").select("*").eq("id", str(payload.payment_method_id)).eq("org_id", org_id).execute()
    if not method_res.data:
        raise HTTPException(404, "Payment method not found")
    method = method_res.data[0]
    
    # 3. Currency conversion
    amount = float(payload.amount)
    rate = float(payload.exchange_rate)
    amount_in_invoice_currency = amount * rate
    
    # 4. Evaluate surcharges
    config = await get_billing_config(org_id, db)
    surcharges_applied = []
    total_surcharges = 0.0
    
    # Simple surcharge eval. config.surcharges is list of dicts:
    # [{"name": "Tarjeta Surcharge", "rate": 0.05, "apply_to_payment_methods": ["uuid1", "uuid2"], "is_active": True}]
    surcharges_list = config.get("surcharges") or []
    for surcharge in surcharges_list:
        if surcharge.get("is_active") and str(payload.payment_method_id) in surcharge.get("apply_to_payment_methods", []):
            s_rate = float(surcharge.get("rate", 0))
            s_amount = amount_in_invoice_currency * s_rate
            surcharges_applied.append({
                "name": surcharge.get("name"),
                "rate": s_rate,
                "base_amount": amount_in_invoice_currency,
                "surcharge_amount": s_amount
            })
            total_surcharges += s_amount

    payment_record = {
        "invoice_id": invoice_id,
        "payment_method_id": str(payload.payment_method_id),
        "method_name": method["name"],
        "method_type": method["method_type"],
        "amount": amount,
        "currency_code": payload.currency_code,
        "exchange_rate": rate,
        "amount_in_invoice_currency": amount_in_invoice_currency,
        "surcharges_applied": surcharges_applied,
        "total_surcharges": total_surcharges,
        "reference": payload.reference,
        "cash_tendered": float(payload.cash_tendered) if payload.cash_tendered else None,
        "cash_change": float(payload.cash_change) if payload.cash_change else None,
        "status": "completed",
        "notes": payload.notes,
        "recorded_by": recorded_by
    }
    
    # Insert payment record
    pay_res = db.table("payments").insert(payment_record).execute()
    new_payment = pay_res.data[0]
    
    # 5. Recalculate invoice balance and status
    payments_res = db.table("payments").select("*").eq("invoice_id", invoice_id).eq("status", "completed").execute()
    all_payments = payments_res.data or []
    
    sum_paid = sum(float(p["amount_in_invoice_currency"]) for p in all_payments)
    sum_surcharges = sum(float(p["total_surcharges"]) for p in all_payments)
    
    # Recalculate invoice total including surcharges
    subtotal = float(invoice["subtotal"])
    tax = float(invoice["total_tax"])
    
    new_total = subtotal + tax + sum_surcharges
    balance_due = new_total - sum_paid
    
    # Set status
    if balance_due <= 0.01: # handle precision rounding threshold
        new_status = "paid"
        balance_due = 0.0
    elif sum_paid > 0:
        new_status = "partial"
    else:
        new_status = "confirmed"
        
    db.table("invoices").update({
        "amount_paid": sum_paid,
        "total_surcharges": sum_surcharges,
        "total": new_total,
        "balance_due": balance_due,
        "status": new_status
    }).eq("id", invoice_id).execute()
    
    return new_payment
