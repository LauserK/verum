from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from app.deps import get_active_org_id
from database import get_db
from app.integrations.service import (
    get_integration_status,
    complete_handshake,
    disconnect_integration,
    update_integration_config
)
from app.integrations.outbox import enqueue_event
import app.sales.service as sales_svc

router = APIRouter()

@router.get("/integrations/quick/status")
def get_status(org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    return get_integration_status(org_id, db)

@router.patch("/integrations/quick/config")
def update_config(payload: dict, org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    return update_integration_config(org_id, payload, db)

@router.post("/integrations/quick/sync-product/{item_id}")
async def sync_product_manual(item_id: str, org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    item_out = await sales_svc.get_sale_item(item_id, org_id, db)
    enqueue_event(
        org_id=org_id,
        event_type="product.updated",
        payload=item_out,
        db=db
    )
    return {"status": "enqueued", "item_id": item_id}

@router.post("/integrations/quick/disconnect")
def disconnect(org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    return disconnect_integration(org_id, db)

@router.get("/integrations/quick/preview-catalog")
def get_quick_catalog_preview(org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    from app.integrations.service import preview_quick_catalog
    return preview_quick_catalog(org_id, db)

@router.post("/integrations/quick/import-catalog")
async def import_quick_catalog(payload: dict, org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    from app.integrations.service import execute_quick_catalog_import
    return await execute_quick_catalog_import(org_id, payload, db)

@router.get("/integrations/quick/callback", response_class=HTMLResponse)
def callback(org_id: str, company_id: str, secret: str, status: str, db = Depends(get_db)):
    if status == "success":
        complete_handshake(org_id, company_id, secret, db)
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><title>Conexión exitosa</title></head>
    <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
      <h2>¡Vinculación completada con éxito!</h2>
      <p>Cerrando ventana...</p>
      <script>
        if (window.opener) {{
          window.opener.postMessage({{ type: 'VERUM_QUICK_LINKED', company_id: '{company_id}' }}, '*');
        }}
        setTimeout(() => window.close(), 1200);
      </script>
    </body>
    </html>
    """
    return html_content
