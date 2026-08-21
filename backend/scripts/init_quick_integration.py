import sys
import os
import uuid

# Append backend directory to path to import database
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import get_db

def init_integration(org_id: str):
    db = get_db()
    
    # 1. Create or get the Integration User
    user_email = "quick@verum.local"
    full_name = "VerumQuick System"
    
    res_user = db.table("profiles").select("id").eq("org_id", org_id).eq("email", user_email).execute()
    if res_user.data:
        user_id = res_user.data[0]["id"]
        print(f"User '{full_name}' already exists with ID: {user_id}")
    else:
        user_id = str(uuid.uuid4())
        db.table("profiles").insert({
            "id": user_id,
            "org_id": org_id,
            "email": user_email,
            "full_name": full_name,
            "role": "system"
        }).execute()
        print(f"Created user '{full_name}' with ID: {user_id}")

    # 2. Create or get the Virtual Workstation
    ws_name = "VerumQuick POS"
    res_ws = db.table("workstations").select("id").eq("org_id", org_id).eq("name", ws_name).execute()
    if res_ws.data:
        ws_id = res_ws.data[0]["id"]
        print(f"Workstation '{ws_name}' already exists with ID: {ws_id}")
    else:
        ws_id = str(uuid.uuid4())
        db.table("workstations").insert({
            "id": ws_id,
            "org_id": org_id,
            "name": ws_name,
            "is_active": True
        }).execute()
        print(f"Created workstation '{ws_name}' with ID: {ws_id}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python init_quick_integration.py <org_id>")
        sys.exit(1)
    
    target_org_id = sys.argv[1]
    init_integration(target_org_id)
