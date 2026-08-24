# backend/app/integrations/worker.py
import asyncio
import os
import hmac
import hashlib
import json
from datetime import datetime, timezone, timedelta
import httpx
from database import supabase
from config import settings

async def process_outbox_events(client: httpx.AsyncClient):
    try:
        # Consultamos eventos 'pending' o 'failed'
        events_res = supabase.table("integration_events").select("*").in_("status", ["pending", "failed"]).limit(20).execute()
        events = events_res.data or []
        
        if not events:
            return
            
        now = datetime.now(timezone.utc)
        retry_delay = timedelta(seconds=60)

        for event in events:
            event_id = event["id"]
            org_id = event["org_id"]
            status = event.get("status")
            
            # Si el evento falló previamente, esperar al menos 1 minuto desde el último intento
            if status == "failed":
                attempt_time_str = event.get("processed_at") or event.get("created_at")
                if attempt_time_str:
                    try:
                        # Reemplazar Z por +00:00 para compatibilidad ISO
                        dt_iso = attempt_time_str.replace("Z", "+00:00")
                        last_attempt = datetime.fromisoformat(dt_iso)
                        if now - last_attempt < retry_delay:
                            # Aún no ha pasado el minuto de enfriamiento para este evento
                            continue
                    except Exception:
                        pass

            # 1. Fetch active integration credentials
            integration_res = supabase.table("quick_integrations").select("*").eq("org_id", org_id).eq("is_active", True).execute()
            if not integration_res.data:
                supabase.table("integration_events").update({
                    "status": "failed",
                    "error_message": "No active quick_integration found for org.",
                    "processed_at": "now()"
                }).eq("id", event_id).execute()
                continue
                
            integration = integration_res.data[0]
            secret = integration["secret"]
            company_id = integration["company_id"]
            
            # 2. Prepare payload & HMAC signature
            payload_bytes = json.dumps(event["payload"]).encode('utf-8')
            signature = hmac.new(secret.encode('utf-8'), payload_bytes, hashlib.sha256).hexdigest()
            
            base_webhook_url = getattr(settings, 'VERUM_QUICK_WEBHOOK_URL', None) or os.environ.get(
                "VERUM_QUICK_WEBHOOK_URL", 
                "http://localhost:8000/integrations/api/verum/webhook/product"
            )

            event_type = event.get("event_type", "")
            if event_type.startswith("payment_method."):
                webhook_url = base_webhook_url.replace("/webhook/product", "/webhook/payment")
            else:
                webhook_url = base_webhook_url
            
            headers = {
                "Content-Type": "application/json",
                "X-Verum-Signature": signature,
                "X-Verum-Company-Id": str(company_id)
            }
            
            # 3. Dispatch POST to VerumQuick
            try:
                response = await client.post(webhook_url, content=payload_bytes, headers=headers, timeout=10.0)
                    
                if response.status_code in [200, 201]:
                    supabase.table("integration_events").update({
                        "status": "processed",
                        "processed_at": "now()",
                        "error_message": None
                    }).eq("id", event_id).execute()
                    print(f"[OUTBOX WORKER] Successfully dispatched event {event_id} ({event.get('event_type')}) to VerumQuick.")
                else:
                    supabase.table("integration_events").update({
                        "status": "failed",
                        "error_message": f"HTTP {response.status_code}: {response.text}",
                        "processed_at": "now()"
                    }).eq("id", event_id).execute()
                    print(f"[OUTBOX WORKER ERROR] Webhook response {response.status_code}: {response.text}")
            except Exception as e:
                supabase.table("integration_events").update({
                    "status": "failed",
                    "error_message": str(e),
                    "processed_at": "now()"
                }).eq("id", event_id).execute()
                print(f"[OUTBOX WORKER ERROR] Failed to connect to webhook: {e}")
                
    except Exception as e:
        print(f"[OUTBOX WORKER] Unexpected error polling events: {e}")

async def start_outbox_worker_loop():
    print("[OUTBOX WORKER] Background outbox worker loop started.")
    async with httpx.AsyncClient() as client:
        while True:
            try:
                await process_outbox_events(client)
            except asyncio.CancelledError:
                print("[OUTBOX WORKER] Background loop cancelled.")
                break
            except Exception as e:
                print(f"[OUTBOX WORKER LOOP ERROR] {e}")
            await asyncio.sleep(5)

