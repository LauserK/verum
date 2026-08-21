from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from app.deps import get_active_org_id
from database import get_db
from app.integrations.service import get_integration_status, complete_handshake, disconnect_integration

router = APIRouter()

@router.get("/integrations/quick/status")
def get_status(org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    return get_integration_status(org_id, db)

@router.post("/integrations/quick/disconnect")
def disconnect(org_id: str = Depends(get_active_org_id), db = Depends(get_db)):
    return disconnect_integration(org_id, db)

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
