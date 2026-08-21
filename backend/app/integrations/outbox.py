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
