# Integración Bidireccional VERUM ↔ VerumQuick (Milestone 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement catalog synchronization from VERUM to VerumQuick using an outbox pattern for reliable, asynchronous dispatch.

**Architecture:** We use an outbox pattern in VERUM. Product changes are written to an `integration_events` table in the same transaction as the `sale_items`. A background worker polls this table and dispatches signed HMAC POST requests to VerumQuick. VerumQuick receives the payload, verifies the HMAC, and upserts the product by `external_code`.

**Tech Stack:** FastAPI, PostgreSQL (Supabase), Python, Django

---

### Task 1: Migration for Integration Events (VERUM)

**Files:**
- Create: `backend/migrations/068_integration_events.sql`

- [ ] **Step 1: Write the migration**

```sql
-- backend/migrations/068_integration_events.sql

CREATE TABLE IF NOT EXISTS public.integration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_integration_events_status ON public.integration_events (status);
CREATE INDEX IF NOT EXISTS idx_integration_events_org_id ON public.integration_events (org_id);
```

- [ ] **Step 2: Apply the migration (conceptual)**

Run: `psql $DATABASE_URL -f backend/migrations/068_integration_events.sql`
Expected: Migration executes successfully.

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/068_integration_events.sql
git commit -m "feat: add integration_events table migration for outbox pattern"
```

### Task 2: Outbox Service (VERUM)

**Files:**
- Create: `backend/app/integrations/outbox.py`

- [ ] **Step 1: Write the outbox insertion logic**

```python
# backend/app/integrations/outbox.py
import json
from uuid import UUID

def enqueue_event(org_id: str, event_type: str, payload: dict, db) -> None:
    db.table("integration_events").insert({
        "org_id": str(org_id),
        "event_type": event_type,
        "payload": payload,
        "status": "pending"
    }).execute()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/integrations/outbox.py
git commit -m "feat: add outbox service logic for queuing integration events"
```

### Task 3: Trigger Outbox on Product Creation (VERUM)

**Files:**
- Modify: `backend/app/sales/service.py`

- [ ] **Step 1: Import outbox and enqueue event**

In `backend/app/sales/service.py`, add the import and call the outbox inside `create_sale_item`.

```python
# Insert at top
from app.integrations.outbox import enqueue_event
```

Modify `create_sale_item`:

```python
    if payload.modifier_group_ids:
        await _link_modifiers(item_id, payload.modifier_group_ids, db)

    item_out = await get_sale_item(item_id, org_id, db)
    
    # Enqueue outbox event for integration
    enqueue_event(
        org_id=org_id,
        event_type="product.created",
        payload=item_out,
        db=db
    )

    return item_out
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/sales/service.py
git commit -m "feat: enqueue outbox event on sale item creation"
```

### Task 4: Dispatcher Worker (VERUM)

**Files:**
- Create: `backend/scripts/worker_outbox.py`
- Modify: `backend/requirements.txt` (if `httpx` not present, though it likely is. We will use `requests` or `httpx`.)

- [ ] **Step 1: Write the dispatcher worker script**

```python
# backend/scripts/worker_outbox.py
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/worker_outbox.py
git commit -m "feat: add dispatcher worker for integration events"
```

### Task 5: Webhook Django View (VerumQuick)

**Files:**
- Modify: `apps/integrations/views.py`
- Modify: `apps/integrations/urls.py`

- [ ] **Step 1: Write Webhook View**

Append to `C:/Users/kilda/PROYECTOS/django-saas-boilerplate-main/apps/integrations/views.py`:

```python
import hmac
import hashlib
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from apps.integrations.models import VerumIntegration
from apps.catalog.models import Product, Category, Currency

@csrf_exempt
@require_POST
def verum_webhook_product(request):
    company_id = request.headers.get('X-Verum-Company-Id')
    signature = request.headers.get('X-Verum-Signature')
    
    if not company_id or not signature:
        return JsonResponse({"error": "Missing headers"}, status=400)
        
    try:
        integration = VerumIntegration.objects.get(company_id=company_id, is_active=True)
    except VerumIntegration.DoesNotExist:
        return JsonResponse({"error": "Integration not found"}, status=404)
        
    # Verify HMAC
    expected_signature = hmac.new(
        integration.shared_secret.encode('utf-8'),
        request.body,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(expected_signature, signature):
        return JsonResponse({"error": "Invalid signature"}, status=403)
        
    try:
        payload = json.loads(request.body)
        external_code = str(payload.get("id"))
        
        category, _ = Category.objects.get_or_create(
            company_id=company_id, 
            name="Importados de VERUM", 
            defaults={"is_active": True}
        )
        
        currency = Currency.objects.filter(is_active=True).first()
        if not currency:
             return JsonResponse({"error": "No currency configured"}, status=400)

        # Upsert Product
        Product.objects.update_or_create(
            company_id=company_id,
            external_code=external_code,
            defaults={
                "category": category,
                "name": payload.get("name", "Unnamed"),
                "base_price": payload.get("sale_price", 0.0),
                "food_cost": payload.get("food_cost", 0.0),
                "base_currency": currency,
                "is_active": True
            }
        )
        return JsonResponse({"status": "success"}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
```

- [ ] **Step 2: Add URL Routing in VerumQuick**

Modify `C:/Users/kilda/PROYECTOS/django-saas-boilerplate-main/apps/integrations/urls.py`:

```python
from django.urls import path
from .views import authorize_verum_view, verum_webhook_product

app_name = 'integrations'

urlpatterns = [
    path('verum/authorize/', authorize_verum_view, name='verum_authorize'),
    path('api/verum/webhook/product', verum_webhook_product, name='verum_webhook_product'),
]
```

- [ ] **Step 3: Commit**

```bash
git add apps/integrations/views.py apps/integrations/urls.py
git commit -m "feat: add product webhook endpoint for verum integration"
```
