from uuid import UUID
from typing import List, Dict, Tuple
from fastapi import HTTPException
from app.inventory.router import process_inventory_document, get_next_document_number

async def deduct_inventory_for_invoice(org_id: str, invoice_id: str, warehouse_id: str, user, db):
    # 1. Fetch invoice and invoice_items
    inv_res = db.table("invoices").select("*").eq("id", invoice_id).eq("org_id", org_id).execute()
    if not inv_res.data:
        raise HTTPException(404, "Invoice not found")
    invoice = inv_res.data[0]
    
    items_res = db.table("invoice_items").select("*").eq("invoice_id", invoice_id).execute()
    invoice_items = items_res.data or []
    
    deductions: Dict[str, float] = {} # key: item_id (str), value: qty to deduct (float)
    
    for line in invoice_items:
        qty_sold = float(line["quantity"])
        sale_item_id = line["sale_item_id"]
        variant_id = line["variant_id"]
        
        if not sale_item_id:
            continue
            
        # 1. Resolve components
        # Try to find components with variant_id
        comp_res = db.table("sale_item_components").select("*").eq("sale_item_id", sale_item_id).eq("variant_id", variant_id).execute()
        # Fallback to components with variant_id IS NULL
        if not comp_res.data:
            comp_res = db.table("sale_item_components").select("*").eq("sale_item_id", sale_item_id).is_("variant_id", "null").execute()
            
        components = comp_res.data or []
        
        for comp in components:
            comp_type = comp["component_type"]
            comp_qty = float(comp["quantity"])
            comp_item_id = comp["item_id"]
            
            if comp_type == 'fixed_qty':
                deductions[comp_item_id] = deductions.get(comp_item_id, 0.0) + (comp_qty * qty_sold)
                
            elif comp_type == 'recipe_proportional':
                # Query recipe
                rec_res = db.table("recipes").select("*").eq("item_id", comp_item_id).eq("is_active", True).execute()
                if rec_res.data:
                    recipe = rec_res.data[0]
                    recipe_id = recipe["id"]
                    yield_qty = float(recipe["yield_qty_base"])
                    
                    ing_res = db.table("recipe_ingredients").select("item_id, qty_base").eq("recipe_id", recipe_id).execute()
                    ingredients = ing_res.data or []
                    for ing in ingredients:
                        ing_item_id = ing["item_id"]
                        ing_qty = float(ing["qty_base"])
                        
                        qty_to_deduct = (ing_qty * comp_qty * qty_sold) / yield_qty
                        deductions[ing_item_id] = deductions.get(ing_item_id, 0.0) + qty_to_deduct
                        
        # 3. Process modifiers in line
        # line["modifiers"] is list of dicts: [{"item_id": "uuid", "deduct_qty": 1.5, ...}]
        line_modifiers = line.get("modifiers") or []
        for mod in line_modifiers:
            mod_item_id = mod.get("item_id")
            mod_deduct_qty = mod.get("deduct_qty")
            if mod_item_id and mod_deduct_qty:
                deductions[mod_item_id] = deductions.get(mod_item_id, 0.0) + (float(mod_deduct_qty) * qty_sold)

    if not deductions:
        return None # Nothing to deduct
        
    # 5. Create inventory_document
    # Get sequence number
    doc_number = await get_next_document_number(db, org_id, "issue")
    
    doc_header = {
        "org_id": org_id,
        "document_type": "issue",
        "document_number": doc_number,
        "status": "draft",
        "warehouse_id": warehouse_id,
        "reference_type": "sale",
        "reference_id": invoice_id,
        "notes": f"Deducción automática por venta de Factura N° {invoice['document_number']}",
        "created_by": user.id
    }
    
    doc_res = db.table("inventory_documents").insert(doc_header).execute()
    doc_id = doc_res.data[0]["id"]
    
    # 6. Create lines
    doc_lines = []
    for idx, (item_id, qty) in enumerate(deductions.items()):
        doc_lines.append({
            "document_id": doc_id,
            "item_id": item_id,
            "qty_base": qty,
            "qty_presentation": qty, # Simple mapping
            "presentation_id": None,
            "order_index": idx
        })
        
    db.table("inventory_document_lines").insert(doc_lines).execute()
    
    # 7. Approve / Process
    await process_inventory_document(UUID(doc_id), org_id, user, db, bypass_auth=True)
    return doc_id
