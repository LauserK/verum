# backend/app/integrations/outbox.py
import json
from uuid import UUID
from decimal import Decimal

def _json_serializer(obj):
    if isinstance(obj, (UUID, Decimal)):
        return str(obj)
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

def enqueue_event(org_id: str, event_type: str, payload: dict, db) -> None:
    try:
        clean_payload = json.loads(json.dumps(payload, default=_json_serializer))
        res = db.table("integration_events").insert({
            "org_id": str(org_id),
            "event_type": event_type,
            "payload": clean_payload,
            "status": "pending"
        }).execute()
        print(f"[OUTBOX] Enqueued event {event_type} for org {org_id}: {res.data}")
    except Exception as e:
        print(f"[OUTBOX ERROR] Failed to enqueue event {event_type}: {e}")

