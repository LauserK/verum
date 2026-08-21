import os
import sys
import hmac
import hashlib
import json
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import supabase
import httpx

def process_events():
    events_res = supabase.table("integration_events").select("*").eq("status", "pending").limit(50).execute()
    events = events_res.data
    
    if not events:
        return
        
    for event in events:
        org_id = event["org_id"]
        
        # Get integration secret and company_id
        integration_res = supabase.table("quick_integrations").select("*").eq("org_id", org_id).eq("is_active", True).execute()
        if not integration_res.data:
            supabase.table("integration_events").update({
                "status": "failed",
                "error_message": "No active quick_integration found for org."
            }).eq("id", event["id"]).execute()
            continue
            
        integration = integration_res.data[0]
        secret = integration["secret"]
        company_id = integration["company_id"]
        
        # Dispatch
        payload_bytes = json.dumps(event["payload"]).encode('utf-8')
        signature = hmac.new(secret.encode('utf-8'), payload_bytes, hashlib.sha256).hexdigest()
        
        webhook_url = os.environ.get("VERUM_QUICK_WEBHOOK_URL", "http://localhost:8000/api/integrations/verum/webhook/product")
        
        headers = {
            "Content-Type": "application/json",
            "X-Verum-Signature": signature,
            "X-Verum-Company-Id": str(company_id)
        }
        
        try:
            with httpx.Client() as client:
                response = client.post(webhook_url, content=payload_bytes, headers=headers, timeout=10.0)
                
            if response.status_code in [200, 201]:
                supabase.table("integration_events").update({
                    "status": "processed",
                    "processed_at": "now()"
                }).eq("id", event["id"]).execute()
            else:
                supabase.table("integration_events").update({
                    "status": "failed",
                    "error_message": f"HTTP {response.status_code}: {response.text}"
                }).eq("id", event["id"]).execute()
        except Exception as e:
            supabase.table("integration_events").update({
                "status": "failed",
                "error_message": str(e)
            }).eq("id", event["id"]).execute()

if __name__ == "__main__":
    while True:
        process_events()
        time.sleep(5)
