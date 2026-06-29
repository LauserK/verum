from fastapi import APIRouter, Depends, HTTPException, Header
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import pytz
import calendar
from uuid import UUID
from decimal import Decimal

from database import get_db
from auth_deps import security, get_current_user
from app.deps import get_active_org_id, require_permission
from permissions import resolve_permission

from app.admin.schemas import (
    CreateOrgRequest, CreateVenueRequest, CreateTemplateRequest, CreateQuestionRequest,
    ReorderItem, ReorderQuestionsRequest, CreateUserRequest, UpdateUserRequest,
    UpdateVenueRequest, CreateShiftRequest, UpdateShiftRequest, RoleCreate, OverrideCreate
)

CARACAS_TZ = pytz.timezone("America/Caracas")

router = APIRouter(prefix="", tags=["Admin"])


# ── Admin CRUD Routes ───────────────────────────────────

@router.get("/admin/organizations")
async def list_organizations(user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    res = db.table("organizations").select("*").execute()
    return res.data or []


async def seed_org_roles(org_id: str, db):
    """Seeds default roles and permissions for a new organization."""
    try:
        # 1. Create 'Gerente de Operaciones' (Admin level)
        res_admin = db.table("custom_roles").insert({
            "org_id": org_id,
            "name": "Gerente de Operaciones",
            "description": "Control total de la sede, usuarios y configuraciones.",
            "is_admin": True
        }).execute()
        
        # 2. Create 'Supervisor de Turno'
        res_super = db.table("custom_roles").insert({
            "org_id": org_id,
            "name": "Supervisor de Turno",
            "description": "Gestión de checklists, auditoría de otros turnos y control de inventario.",
            "is_admin": False
        }).execute()
        
        # 3. Create 'Personal de Línea'
        res_staff = db.table("custom_roles").insert({
            "org_id": org_id,
            "name": "Personal de Línea",
            "description": "Ejecución de checklists, reporte de fallas y conteos de inventario.",
            "is_admin": False
        }).execute()

        if res_super.data and res_staff.data:
            role_supervisor_id = res_super.data[0]["id"]
            role_staff_id = res_staff.data[0]["id"]

            # Fetch all permissions to map them
            perms_res = db.table("permissions").select("id, key").execute()
            perms = {p["key"]: p["id"] for p in (perms_res.data or [])}

            # Associate Permissions to 'Supervisor de Turno'
            super_keys = [
                'checklists.view', 'checklists.execute', 'checklists.view_all', 'checklists.manage_templates',
                'inventory_assets.view', 'inventory_assets.report_fault', 'inventory_assets.add_ticket_entry', 
                'inventory_assets.close_ticket', 'inventory_assets.print_qr', 'inventory_assets.review',
                'inventory_utensils.view', 'inventory_utensils.count', 'inventory_utensils.confirm_count',
                'admin.view_dashboard', 'admin.view_reports'
            ]
            super_perms = [{"role_id": role_supervisor_id, "permission_id": perms[k]} for k in super_keys if k in perms]
            if super_perms:
                db.table("role_permissions").insert(super_perms).execute()

            # Associate Permissions to 'Personal de Línea'
            staff_keys = [
                'checklists.view', 'checklists.execute',
                'inventory_assets.view', 'inventory_assets.report_fault', 'inventory_assets.add_ticket_entry',
                'inventory_utensils.view', 'inventory_utensils.count'
            ]
            staff_perms = [{"role_id": role_staff_id, "permission_id": perms[k]} for k in staff_keys if k in perms]
            if staff_perms:
                db.table("role_permissions").insert(staff_perms).execute()
                
    except Exception as e:
        print(f"Error seeding roles for org {org_id}: {e}")

@router.post("/admin/organizations")
async def create_organization(body: CreateOrgRequest, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    res = db.table("organizations").insert({"name": body.name}).execute()
    if res.data:
        org = res.data[0]
        # Seed default roles for this new organization
        await seed_org_roles(org["id"], db)
        return org
    raise HTTPException(500, "Failed to create organization")


@router.get("/admin/organizations/{org_id}/venues")
async def list_venues(org_id: str, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    res = db.table("venues").select("*").eq("org_id", org_id).execute()
    return res.data or []


@router.post("/admin/venues")
async def create_venue(body: CreateVenueRequest, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    payload = {"org_id": body.org_id, "name": body.name}
    if body.address:
        payload["address"] = body.address
    res = db.table("venues").insert(payload).execute()
    return res.data[0]


@router.put("/admin/venues/{venue_id}")
async def update_venue(venue_id: str, body: UpdateVenueRequest, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    payload = {}
    if body.name is not None:
        payload["name"] = body.name
    if body.address is not None:
        payload["address"] = body.address
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("venues").update(payload).eq("id", venue_id).execute()
    return res.data[0] if res.data else {}


@router.delete("/admin/venues/{venue_id}")
async def delete_venue(venue_id: str, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    db.table("venues").delete().eq("id", venue_id).execute()
    return {"ok": True}


# ── Admin Users CRUD ────────────────────────────────────

@router.get("/admin/users")
async def list_users(user=Depends(require_permission("admin.manage_users")), org_id: str = Depends(get_active_org_id)):
    """List all profiles associated with the active organization context."""
    db = get_db()
    
    # Query profile_organizations to find everyone who belongs to this org
    # Join with profiles to get details and custom_roles to get org-specific roles
    res = db.table("profile_organizations") \
        .select("profile_id, role_id, profiles(id, full_name, role, organization_id, venue_id, shift_id), custom_roles(name)") \
        .eq("organization_id", org_id) \
        .execute()
    
    data = res.data or []
    profiles = []
    
    for item in data:
        p = item.get("profiles")
        if not p:
            continue
            
        # Determine the role for THIS organization
        if item.get("custom_roles"):
            # Use custom role name if defined for this org
            p["role"] = item["custom_roles"]["name"]
        elif p.get("role") == "admin":
            # Keep global admin role
            pass
        else:
            # Default to staff for this org context
            p["role"] = "staff"
            
        profiles.append(p)

    # Get emails from auth users
    for p in profiles:
        try:
            auth_user = db.auth.admin.get_user_by_id(p["id"])
            p["email"] = auth_user.user.email if auth_user.user else None
        except Exception:
            p["email"] = None
            
    return profiles


@router.post("/admin/users")
async def create_user(body: CreateUserRequest, user=Depends(require_permission("admin.manage_users")), org_id: str = Depends(get_active_org_id)):
    """Create a new user or associate an existing one with this organization."""
    db = get_db()
    target_user_id = None
    is_new_user = False

    try:
        # 1. Try to create the user in Auth
        try:
            auth_res = db.auth.admin.create_user({
                "email": body.email,
                "password": body.password,
                "email_confirm": True,
            })
            if auth_res.user:
                target_user_id = auth_res.user.id
                is_new_user = True
        except Exception as e:
            error_str = str(e).lower()
            if "already registered" in error_str or "already exists" in error_str:
                # 2. User exists, find their ID
                # We list users and find the one with the matching email
                all_users = db.auth.admin.list_users()
                existing = next((u for u in all_users if u.email == body.email), None)
                if existing:
                    target_user_id = existing.id
                else:
                    raise HTTPException(400, "User found in Auth but could not retrieve details.")
            else:
                raise HTTPException(400, f"Auth error: {str(e)}")

        if not target_user_id:
            raise HTTPException(500, "Failed to identify user ID")

        # 3. Insert/Update profile
        profile_data = {
            "id": target_user_id,
            "full_name": body.full_name,
            # We keep global role as 'staff' unless explicitly 'admin'
            # The organization-specific role is handled in profile_organizations
            "role": body.role if body.role == "admin" else "staff",
        }
        
        # Only set organization_id if it's a new user (legacy support)
        if is_new_user:
            profile_data["organization_id"] = body.organization_id
            
        if body.venue_id:
            profile_data["venue_id"] = body.venue_id
        if body.shift_id:
            profile_data["shift_id"] = body.shift_id
            
        db.table("profiles").upsert(profile_data).execute()

        # 4. Handle profile_venues (Clean existing for THIS org then insert)
        v_ids = body.venue_ids if body.venue_ids is not None else ([body.venue_id] if body.venue_id else [])
        if v_ids:
            # Remove existing venues for this user that belong to THIS organization to avoid duplicates/mess
            # Note: This is simplified, in a full multi-tenant we'd filter by org venues
            pv_data = [{"profile_id": target_user_id, "venue_id": vid} for vid in v_ids]
            db.table("profile_venues").upsert(pv_data).execute()

        # 5. Handle custom role assignment for THIS organization
        role_id = None
        if body.role not in ["staff", "admin"]:
            role_res = db.table("custom_roles").select("id").eq("name", body.role).eq("org_id", body.organization_id).execute()
            if role_res.data:
                role_id = role_res.data[0]["id"]

        # 6. Multi-tenant association: profile_organizations
        # This is the key part: linking the user to the new company
        db.table("profile_organizations").upsert({
            "profile_id": target_user_id,
            "organization_id": body.organization_id,
            "role_id": role_id,
            "is_default": is_new_user # Make it default only if it's their first org
        }).execute()

        return {
            "id": target_user_id, 
            "email": body.email, 
            "full_name": body.full_name, 
            "role": body.role, 
            "venue_ids": v_ids, 
            "organization_id": body.organization_id,
            "is_associated": not is_new_user
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@router.put("/admin/users/{user_id}")
async def update_user(user_id: str, body: UpdateUserRequest, user=Depends(require_permission("admin.manage_users")), org_id: str = Depends(get_active_org_id)):
    db = get_db()
    payload = {}
    if body.full_name is not None:
        payload["full_name"] = body.full_name
    if body.role is not None:
        payload["role"] = body.role
    if body.venue_id is not None:
        payload["venue_id"] = body.venue_id
    if body.shift_id is not None:
        payload["shift_id"] = body.shift_id
        
    if not payload and body.venue_ids is None:
        raise HTTPException(400, "No fields to update")
        
    if payload:
        db.table("profiles").update(payload).eq("id", user_id).execute()
            
    if body.venue_ids is not None:
        # Delete old mappings and insert new ones
        db.table("profile_venues").delete().eq("profile_id", user_id).execute()
        if body.venue_ids:
            pv_data = [{"profile_id": user_id, "venue_id": vid} for vid in body.venue_ids]
            db.table("profile_venues").insert(pv_data).execute()
    elif body.venue_id is not None:
         db.table("profile_venues").delete().eq("profile_id", user_id).execute()
         db.table("profile_venues").insert({"profile_id": user_id, "venue_id": body.venue_id}).execute()

    # Multi-tenant: Update role in profile_organizations for the active org
    if body.role is not None:
        role_id = None
        if body.role not in ["staff", "admin"]:
            # We need the org_id for this user or from context
            # Since this is an admin action, we use the active_org_id from the admin's context
            role_res = db.table("custom_roles").select("id").eq("name", body.role).eq("org_id", org_id).execute()
            if role_res.data:
                role_id = role_res.data[0]["id"]
                # Update legacy table too for compatibility
                db.table("profile_roles").upsert({
                    "profile_id": user_id,
                    "role_id": role_id
                }).execute()
        
        db.table("profile_organizations").upsert({
            "profile_id": user_id,
            "organization_id": org_id,
            "role_id": role_id
        }).execute()
         
    # Fetch and return the updated profile to ensure consistency
    updated_profile = db.table("profiles").select("*").eq("id", user_id).single().execute()
    return updated_profile.data if updated_profile.data else {"ok": True}


@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, user=Depends(require_permission("admin.manage_users"))):
    """Delete auth user (cascades to profile)."""
    try:
        db = get_db()
        db.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.patch("/admin/users/{user_id}/password")
async def change_user_password(user_id: str, body: dict, user=Depends(require_permission("admin.manage_users"))):
    """Change a user's password via Supabase Auth admin API."""
    db = get_db()
    new_password = body.get("password")
    if not new_password or len(new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    try:
        db.auth.admin.update_user_by_id(user_id, {"password": new_password})
    except Exception as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


# ── Admin Shifts CRUD ───────────────────────────────────

@router.get("/admin/venues/{venue_id}/shifts")
async def list_shifts(venue_id: str, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    res = db.table("shifts").select("*").eq("venue_id", venue_id).order("sort_order").execute()
    return res.data or []


@router.post("/admin/shifts")
async def create_shift(body: CreateShiftRequest, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    payload = {
        "venue_id": body.venue_id,
        "name": body.name,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "sort_order": body.sort_order,
    }
    res = db.table("shifts").insert(payload).execute()
    return res.data[0]


@router.put("/admin/shifts/{shift_id}")
async def update_shift(shift_id: str, body: UpdateShiftRequest, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    payload = {}
    if body.name is not None:
        payload["name"] = body.name
    if body.start_time is not None:
        payload["start_time"] = body.start_time
    if body.end_time is not None:
        payload["end_time"] = body.end_time
    if body.sort_order is not None:
        payload["sort_order"] = body.sort_order
    if not payload:
        raise HTTPException(400, "No fields to update")
    res = db.table("shifts").update(payload).eq("id", shift_id).execute()
    return res.data[0] if res.data else {}


@router.delete("/admin/shifts/{shift_id}")
async def delete_shift(shift_id: str, user=Depends(require_permission("admin.manage_venues"))):
    db = get_db()
    db.table("shifts").delete().eq("id", shift_id).execute()
    return {"ok": True}


# ── Admin Submissions List ──────────────────────────────

@router.get("/admin/submissions")
async def list_submissions(
    venue_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_permission("admin.view_reports")),
):
    """Lists submissions with optional filters."""
    db = get_db()
    # In migrations: user_id -> profiles, template_id -> checklist_templates, venue_id -> venues
    # shift can be a string ('morning') or a UUID referencing 'shifts' table.
    # We remove shifts:shift(name) because there's no explicit FK constraint in the DB.
    query = db.table("submissions").select(
        "*, profiles:user_id(full_name), checklist_templates(title), venues(name)"
    )
    if venue_id:
        query = query.eq("venue_id", venue_id)
    if status:
        query = query.eq("status", status)
    if date_from:
        query = query.gte("created_at", f"{date_from}T00:00:00-04:00")
    if date_to:
        query = query.lte("created_at", f"{date_to}T23:59:59-04:00")

    query = query.order("created_at", desc=True).limit(100)
    res = query.execute()
    
    data = res.data or []
    if not data:
        return []

    # Resolve shift names manually
    shift_ids = list(set(item["shift"] for item in data if item.get("shift") and len(item["shift"]) > 10))
    shift_map = {}
    if shift_ids:
        s_res = db.table("shifts").select("id, name").in_("id", shift_ids).execute()
        shift_map = {sh["id"]: sh["name"] for sh in (s_res.data or [])}

    for item in data:
        s_val = item.get("shift")
        name = shift_map.get(s_val, s_val) # Name from map or original string
        item["shift_name"] = name
        # We also populate 'shifts' object for frontend compatibility s.shifts?.name
        if s_val in shift_map:
            item["shifts"] = {"name": shift_map[s_val]}
        else:
            item["shifts"] = {"name": s_val}
            
    return data


# ── Admin Compliance Report ─────────────────────────────

@router.get("/admin/reports/compliance")
async def get_compliance_report(
    venue_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_permission("admin.view_reports")),
    org_id: str = Depends(get_active_org_id)
):
    """
    Returns compliance metrics:
    - total_expected: templates × days in range
    - completed_on_time, completed_late, missing
    - critical_issues, non_critical_issues
    - avg_execution_minutes
    """
    try:
        db = get_db()
        today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
        d_from = date_from or today
        d_to = date_to or today

        # 1. Get all venue IDs for this organization to ensure strict data isolation
        venues_res = db.table("venues").select("id").eq("org_id", org_id).execute()
        org_venue_ids = [v["id"] for v in (venues_res.data or [])]
        
        if not org_venue_ids:
            return {
                "total_expected": 0, "completed_on_time": 0,
                "completed_late": 0, "completed_total": 0,
                "missing": 0, "compliance_pct": 0,
                "critical_issues": 0, "non_critical_issues": 0,
                "avg_execution_minutes": 0,
            }

        # 2. Get templates for this organization (and optionally a specific venue)
        tmpl_query = db.table("checklist_templates").select("id, venue_id, due_time, due_date, frequency, schedule")
        
        if venue_id:
            # Security check: ensure the requested venue belongs to the admin's organization
            if venue_id not in org_venue_ids:
                raise HTTPException(status_code=403, detail="Venue does not belong to your organization")
            tmpl_query = tmpl_query.eq("venue_id", venue_id)
        else:
            tmpl_query = tmpl_query.in_("venue_id", org_venue_ids)
        
        templates = (tmpl_query.execute()).data or []

        if not templates:
            return {
                "total_expected": 0, "completed_on_time": 0,
                "completed_late": 0, "completed_total": 0,
                "missing": 0, "compliance_pct": 0,
                "critical_issues": 0, "non_critical_issues": 0,
                "avg_execution_minutes": 0,
            }

        template_ids = [t["id"] for t in templates]

        # Get submissions in date range
        # Filter by venue_id if provided to be more specific, otherwise by template_ids
        sub_query = (
            db.table("submissions")
            .select("id, template_id, status, started_at, completed_at, created_at, shift")
            .in_("template_id", template_ids)
            .gte("created_at", f"{d_from}T00:00:00-04:00")
            .lte("created_at", f"{d_to}T23:59:59-04:00")
        )
        if venue_id:
            sub_query = sub_query.eq("venue_id", venue_id)
            
        submissions = (sub_query.execute()).data or []

        # Count completed
        completed = [s for s in submissions if s["status"] == "completed"]
        completed_on_time = 0
        completed_late = 0
        total_exec_minutes = 0
        exec_count = 0

        for s in completed:
            # Calculate execution time if started_at exists
            if s.get("started_at") and s.get("completed_at"):
                try:
                    started = datetime.fromisoformat(s["started_at"].replace("Z", "+00:00"))
                    finished = datetime.fromisoformat(s["completed_at"].replace("Z", "+00:00"))
                    diff = (finished - started).total_seconds() / 60
                    total_exec_minutes += diff
                    exec_count += 1
                except (ValueError, TypeError):
                    pass

            # Check if on time based on due_time
            tmpl = next((t for t in templates if t["id"] == s["template_id"]), None)
            if tmpl and tmpl.get("due_time") and s.get("completed_at"):
                try:
                    completed_dt = datetime.fromisoformat(s["completed_at"].replace("Z", "+00:00"))
                    due_parts = tmpl["due_time"].split(":")
                    due_hour, due_min = int(due_parts[0]), int(due_parts[1])
                    if completed_dt.hour < due_hour or (completed_dt.hour == due_hour and completed_dt.minute <= due_min):
                        completed_on_time += 1
                    else:
                        completed_late += 1
                except (ValueError, IndexError):
                    completed_on_time += 1  # default to on-time if can't parse
            else:
                completed_on_time += 1  # no due_time = always on time

        # Get template venues
        venue_ids = list(set([t["venue_id"] for t in templates if t.get("venue_id")]))
        
        # Get shift counts per venue
        shifts_per_venue = {}
        if venue_ids:
            shifts_res = db.table("shifts").select("venue_id").in_("venue_id", venue_ids).execute()
            for s in (shifts_res.data or []):
                vid = s["venue_id"]
                shifts_per_venue[vid] = shifts_per_venue.get(vid, 0) + 1

        # Accurate count based on template frequency and schedule
        start_date = datetime.strptime(d_from, "%Y-%m-%d")
        end_date = datetime.strptime(d_to, "%Y-%m-%d")
        num_days = max(1, (end_date - start_date).days + 1)
        
        total_expected = 0
        
        for i in range(num_days):
            curr_date = start_date + timedelta(days=i)
            # Database 0=Sun, 1=Mon, ..., 6=Sat. Python weekday() is 0=Mon, 6=Sun.
            day_of_week = (curr_date.weekday() + 1) % 7
            day_of_month = curr_date.day
            
            for t in templates:
                freq = t.get("frequency")
                sched = t.get("schedule") or []
                due_date_str = t.get("due_date")

                # If template has a specific due date, it only counts on that day
                if due_date_str:
                    if curr_date.strftime("%Y-%m-%d") == due_date_str:
                        total_expected += 1
                    continue # Ignore recurring frequencies if a specific date is set

                # Default to daily if not specified, but 'none' means it's ignored unless it had a due_date
                if not freq:
                    freq = "daily"

                if freq == "none":
                    continue
                elif freq == "daily":
                    total_expected += 1
                elif freq == "shift":
                    vid = t.get("venue_id")
                    num_shifts = shifts_per_venue.get(vid, 3) # default to 3 if none defined
                    total_expected += num_shifts
                elif freq == "weekly" and sched:
                    if day_of_week in sched:
                        total_expected += 1
                elif freq == "monthly" and sched:
                    target_day = sched[0]
                    _, last_day = calendar.monthrange(curr_date.year, curr_date.month)
                    actual_target = min(target_day, last_day)
                    if day_of_month == actual_target:
                        total_expected += 1
                elif freq == "custom" and sched:
                    if day_of_week in sched:
                        total_expected += 1

        missing = total_expected - len(completed)

        # Get issue counts from answers
        sub_ids = [s["id"] for s in completed]
        critical_count = 0
        non_critical_count = 0

        if sub_ids:
            issues_res = (
                db.table("answers")
                .select("is_critical_failure, is_non_critical_issue")
                .in_("submission_id", sub_ids)
                .execute()
            )
            for a in (issues_res.data or []):
                if a.get("is_critical_failure"):
                    critical_count += 1
                if a.get("is_non_critical_issue"):
                    non_critical_count += 1

        avg_exec = round(total_exec_minutes / exec_count, 1) if exec_count > 0 else 0

        return {
            "total_expected": total_expected,
            "completed_on_time": completed_on_time,
            "completed_late": completed_late,
            "completed_total": len(completed),
            "missing": max(0, missing),
            "compliance_pct": round(len(completed) / total_expected * 100, 1) if total_expected > 0 else 0,
            "critical_issues": critical_count,
            "non_critical_issues": non_critical_count,
            "avg_execution_minutes": avg_exec,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Permissions & Roles Endpoints ─────────────────────────

@router.get("/permissions")
async def list_permissions(db=Depends(get_db), _=Depends(require_permission("admin.manage_users"))):
    res = db.table("permissions").select("*").execute()
    return res.data


@router.get("/roles")
async def list_roles(org_id: Optional[str] = None, db=Depends(get_db), active_org_id: str = Depends(get_active_org_id)):
    # Use provided org_id or the active one from context
    target_org_id = org_id or active_org_id
    res = db.table("custom_roles").select("*").eq("org_id", target_org_id).execute()
    return res.data


@router.post("/roles")
async def create_role(role: RoleCreate, db=Depends(get_db), _=Depends(require_permission("admin.manage_roles"))):
    res = db.table("custom_roles").insert(role.dict()).execute()
    return res.data[0]


@router.post("/roles/{role_id}/permissions")
async def assign_role_permissions(role_id: str, permission_ids: List[str], db=Depends(get_db), _=Depends(require_permission("admin.manage_roles"))):
    # delete old permissions
    db.table("role_permissions").delete().eq("role_id", role_id).execute()
    # insert new
    inserts = [{"role_id": role_id, "permission_id": pid} for pid in permission_ids]
    if inserts:
        db.table("role_permissions").insert(inserts).execute()
    return {"status": "success"}


@router.post("/profiles/{profile_id}/overrides")
async def create_override(
    profile_id: str,
    override: OverrideCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    _=Depends(require_permission("admin.manage_users")),
):
    # Fetch perm id
    perm_res = (
        db.table("permissions").select("id").eq("key", override.permission_key).execute()
    )
    if not perm_res.data:
        raise HTTPException(404, "Permission not found")
    perm_id = perm_res.data[0]["id"]

    data = {
        "profile_id": profile_id,
        "permission_id": perm_id,
        "granted": override.granted,
        "reason": override.reason,
        "created_by": current_user.id,
    }
    res = db.table("profile_permission_overrides").upsert(data).execute()
    return res.data


@router.get("/profiles/{profile_id}/permissions")
async def get_effective_permissions(profile_id: str, db=Depends(get_db)):
    # Simple logic to return all effective permissions to frontend
    perms = db.table("permissions").select("*").execute().data
    effective = []
    for p in perms:
        has_perm = await resolve_permission(profile_id, p["key"], db)
        if has_perm:
            effective.append(p["key"])
    return {"permissions": effective}


# ── Admin: General Summary (M13/M14 Dashboard) ──

@router.get("/admin/summary")
async def get_admin_summary(
    venue_id: Optional[str] = None,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission("admin.view_dashboard")),
    org_id: str = Depends(get_active_org_id)
):
    try:
        # 1. Active Staff Count
        today_str = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
        
        # Get venues for this org to filter attendance
        venues_res = db.table("venues").select("id").eq("org_id", org_id).execute()
        org_venue_ids = [v["id"] for v in (venues_res.data or [])]
        
        active_staff = 0
        if org_venue_ids:
            live_query = db.table("attendance_logs").select("profile_id, event_type").gte("marked_at", f"{today_str}T00:00:00-04:00")
            if venue_id:
                if venue_id in org_venue_ids:
                    live_query = live_query.eq("venue_id", venue_id)
                else:
                    return {"active_staff": 0, "pending_tickets": 0, "critical_failures": 0, "today": today_str}
            else:
                live_query = live_query.in_("venue_id", org_venue_ids)
            
            live_res = live_query.execute()
            logs = live_res.data or []
            staff_status = {}
            for l in logs:
                staff_status[l["profile_id"]] = l["event_type"]
            active_staff = sum(1 for status in staff_status.values() if status != 'clock_out')

        # 2. Pending Repair Tickets
        pending_tickets = 0
        if org_venue_ids:
            # First get assets for the org/venue
            asset_query = db.table("assets").select("id").in_("venue_id", org_venue_ids)
            if venue_id:
                asset_query = asset_query.eq("venue_id", venue_id)
            
            asset_ids = [a["id"] for a in (asset_query.execute().data or [])]
            
            if asset_ids:
                tickets_res = db.table("repair_tickets").select("id", count="exact").neq("status", "resuelto").in_("asset_id", asset_ids).execute()
                pending_tickets = tickets_res.count if tickets_res.count is not None else 0

        # 3. Critical Checklist Failures (Today)
        # We only count failures for templates that belong to this organization
        critical_failures = 0
        if org_venue_ids:
            tmpl_query = db.table("checklist_templates").select("id").in_("venue_id", org_venue_ids)
            if venue_id:
                tmpl_query = tmpl_query.eq("venue_id", venue_id)
            
            template_ids = [t["id"] for t in (tmpl_query.execute().data or [])]
            
            if template_ids:
                # Find submissions for these templates today
                sub_query = db.table("submissions").select("id").in_("template_id", template_ids).gte("created_at", f"{today_str}T00:00:00-04:00")
                sub_ids = [s["id"] for s in (sub_query.execute().data or [])]
                
                if sub_ids:
                    critical_res = db.table("answers").select("id", count="exact").eq("is_critical_failure", True).in_("submission_id", sub_ids).execute()
                    critical_failures = critical_res.count if critical_res.count is not None else 0

        # 4. Pending Absence Requests
        pending_absences = 0
        if org_venue_ids:
            abs_query = db.table("absences").select("id", count="exact").eq("status", "pending")
            if venue_id:
                abs_query = abs_query.eq("venue_id", venue_id)
            else:
                abs_query = abs_query.in_("venue_id", org_venue_ids)
            
            abs_res = abs_query.execute()
            pending_absences = abs_res.count if abs_res.count is not None else 0

        return {
            "active_staff": active_staff,
            "pending_tickets": pending_tickets,
            "critical_failures": critical_failures,
            "pending_absences": pending_absences,
            "today": today_str
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
