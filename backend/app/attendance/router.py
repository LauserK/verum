import csv
import io
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse

from app.attendance.schemas import (
    EmployeeShiftRequest, ShiftDayRequest, MarkAttendanceRequest, AbsenceRequest, LeaveRequest,
    AbsenceApprovalRequest, ManualAttendanceRequest, EditAttendanceDayRequest
)
from app.attendance.utils import (
    CARACAS_TZ, get_active_shift_for_today, calculate_late_minutes, calculate_overtime
)
from app.deps import get_active_org_id, require_permission
from auth_deps import security, get_current_user
from database import get_db

router = APIRouter(prefix="", tags=["Attendance"])

# ── Attendance: Shifts Endpoints (M13) ──

@router.get("/employee-shifts")
async def list_employee_shifts(profile_id: Optional[str] = None, venue_id: Optional[str] = None, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    query = db.table("employee_shifts").select("*, shift_days(*)")
    if profile_id:
        query = query.eq("profile_id", profile_id)
    if venue_id:
        query = query.eq("venue_id", venue_id)
    res = query.execute()
    return res.data


@router.post("/employee-shifts")
async def create_employee_shift(body: EmployeeShiftRequest, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    res = db.table("employee_shifts").insert(body.dict(exclude_none=True)).execute()
    return res.data[0]


@router.patch("/employee-shifts/{shift_id}")
async def update_employee_shift(shift_id: str, body: EmployeeShiftRequest, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    res = db.table("employee_shifts").update(body.dict(exclude_none=True)).eq("id", shift_id).execute()
    return res.data[0]


@router.post("/employee-shifts/{shift_id}/days")
async def update_shift_day(shift_id: str, body: ShiftDayRequest, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    data = body.dict()
    data["employee_shift_id"] = shift_id
    res = db.table("shift_days").upsert(data, on_conflict="employee_shift_id,weekday").execute()
    return res.data[0]


# ── Attendance: Marking Endpoints (M13) ──

@router.get("/attendance/today/status")
async def get_attendance_status(venue_id: Optional[str] = None, current_user=Depends(get_current_user), db=Depends(get_db)):
    # 1. First, check if there's any active shift (clock_in without clock_out) across ANY venue today
    today_str = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")

    # Get all logs for today for this user across all venues
    all_logs_res = db.table("attendance_logs").select("*").eq("profile_id", current_user.id).gte("marked_at", f"{today_str}T00:00:00-04:00").order("marked_at", desc=True).execute()

    # Determine the latest event across ALL venues
    global_last_event = None
    global_last_venue = None

    if all_logs_res.data:
        latest_log = all_logs_res.data[0]
        global_last_event = latest_log["event_type"]
        global_last_venue = latest_log["venue_id"]

    # If the user is currently clocked in somewhere (or on break), they are locked to that venue
    is_locked = global_last_event in ["clock_in", "break_start", "break_end"]

    # The effective venue is the locked one, or the requested one, or fail.
    effective_venue_id = global_last_venue if is_locked else venue_id

    if not effective_venue_id:
        # If not locked and no venue provided, we can't give a specific status. 
        # Return generic "ready to clock in" but indicate venue is needed.
        return {
            "last_event": None,
            "last_marked_at": None,
            "available_actions": ["clock_in"],
            "has_active_shift": False,
            "locked_to_venue": None
        }

    # Now get the specific status for the effective_venue_id
    logs_res = db.table("attendance_logs").select("*").eq("profile_id", current_user.id).eq("venue_id", effective_venue_id).gte("marked_at", f"{today_str}T00:00:00-04:00").order("marked_at", desc=True).limit(1).execute()

    last_event = logs_res.data[0]["event_type"] if logs_res.data else None

    # State Machine
    available_actions = []
    if not last_event: available_actions = ["clock_in"]
    elif last_event == "clock_in": available_actions = ["break_start", "clock_out"]
    elif last_event == "break_start": available_actions = ["break_end"]
    elif last_event == "break_end": available_actions = ["clock_out"]

    # Check if user is Admin (admins bypass shift requirement)
    # Using a more robust lookup
    is_admin = False
    profile_res = db.table("profiles").select("role").eq("id", current_user.id).execute()
    if profile_res.data:
        is_admin = profile_res.data[0].get("role") == "admin"

    if is_admin:
        has_active_shift = True
    elif is_locked:
        # If locked, we must have a shift in THAT venue
        shift_check = db.table("employee_shifts").select("id").eq("profile_id", current_user.id).eq("venue_id", effective_venue_id).eq("is_active", True).limit(1).execute()
        has_active_shift = bool(shift_check.data and len(shift_check.data) > 0)
    else:
        # If not locked, we prioritize the selected venue_id
        target_venue = venue_id
        
        if target_venue:
            shift_check = db.table("employee_shifts").select("id").eq("profile_id", current_user.id).eq("venue_id", target_venue).eq("is_active", True).limit(1).execute()
            has_active_shift = bool(shift_check.data and len(shift_check.data) > 0)
        else:
            # Fallback: check if they have AT LEAST ONE active shift in ANY of their assigned venues
            pv_res = db.table("profile_venues").select("venue_id").eq("profile_id", current_user.id).execute()
            assigned_venue_ids = [pv["venue_id"] for pv in (pv_res.data or [])]
            
            if not assigned_venue_ids:
                has_active_shift = False
            else:
                shift_check = db.table("employee_shifts").select("id").eq("profile_id", current_user.id).in_("venue_id", assigned_venue_ids).eq("is_active", True).limit(1).execute()
                has_active_shift = bool(shift_check.data and len(shift_check.data) > 0)

    return {
        "last_event": last_event,
        "last_marked_at": logs_res.data[0]["marked_at"] if logs_res.data else None,
        "available_actions": available_actions,
        "has_active_shift": has_active_shift,
        "locked_to_venue": effective_venue_id if is_locked else None,
        "effective_venue_id": effective_venue_id
    }


@router.post("/attendance/mark")
async def mark_attendance(body: MarkAttendanceRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.mark"))):
    today_str = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
    venue_id = body.venue_id
    if not venue_id:
        raise HTTPException(400, "venue_id is required")
        
    status_res = await get_attendance_status(venue_id, current_user, db)
    
    # Validation: Cross-venue lock
    if status_res.get("locked_to_venue") and str(status_res["locked_to_venue"]) != str(venue_id):
        raise HTTPException(400, "Ya tienes un turno activo en otra sede")
        
    if body.event_type not in status_res["available_actions"]:
        raise HTTPException(400, f"Invalid state. Allowed: {status_res['available_actions']}")
        
    now_dt = datetime.now(CARACAS_TZ)
    now_time_str = now_dt.strftime("%H:%M:%S")
    
    active_shift = get_active_shift_for_today(current_user.id, venue_id, db)
    
    log_data = {
        "profile_id": current_user.id,
        "venue_id": venue_id,
        "event_type": body.event_type,
        "gps_lat": body.gps_lat,
        "gps_lng": body.gps_lng,
        "gps_accuracy_m": body.gps_accuracy_m,
    }
    
    if active_shift:
        log_data["employee_shift_id"] = active_shift["id"]
        log_data["expected_start"] = active_shift["expected_start"]
        log_data["expected_end"] = active_shift["expected_end"]
        
        if body.event_type == "clock_in":
            log_data["minutes_late"] = calculate_late_minutes(now_time_str, active_shift["expected_start"])
            log_data["overtime_hours"] = 0 # No overtime calculated at entry anymore
        elif body.event_type == "clock_out":
            # 1. Find corresponding clock_in for today
            in_log_res = db.table("attendance_logs").select("marked_at").eq("profile_id", current_user.id).eq("venue_id", venue_id).eq("event_type", "clock_in").gte("marked_at", f"{today_str}T00:00:00-04:00").order("marked_at", desc=True).limit(1).execute()
            
            if in_log_res.data and active_shift["expected_start"] and active_shift["expected_end"]:
                in_dt = datetime.fromisoformat(in_log_res.data[0]["marked_at"].replace("Z", "+00:00")).astimezone(CARACAS_TZ)
                
                # Expected duration
                e_in = datetime.strptime(active_shift["expected_start"], "%H:%M:%S")
                e_out = datetime.strptime(active_shift["expected_end"], "%H:%M:%S")
                total_expected_mins = (e_out.hour * 60 + e_out.minute) - (e_in.hour * 60 + e_in.minute)
                
                # Real duration
                total_worked_mins = (now_dt - in_dt).total_seconds() / 60
                
                if total_worked_mins > total_expected_mins:
                    overtime_mins = total_worked_mins - total_expected_mins
                    log_data["overtime_hours"] = int(overtime_mins // 60)
                else:
                    log_data["overtime_hours"] = 0
            else:
                # Fallback if no clock_in found or no expected times
                log_data["overtime_hours"] = 0
            
    res = db.table("attendance_logs").insert(log_data).execute()
    return res.data[0]


# ── Attendance: Absences & Admin Views (M13) ──

@router.get("/attendance/live")
async def get_live_attendance(venue_id: str, db=Depends(get_db), _=Depends(require_permission("attendance.view_team"))):   
    today_str = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
    # Fetch all logs for today in this venue
    logs_res = db.table("attendance_logs").select("*, profiles!attendance_logs_profile_id_fkey(full_name)").eq("venue_id", venue_id).gte("marked_at", f"{today_str}T00:00:00-04:00").order("marked_at", desc=True).execute()
    
    # Group by profile to find latest state
    staff_status = {}
    for log in logs_res.data or []:
        pid = log["profile_id"]
        if pid not in staff_status:
            staff_status[pid] = log

    return list(staff_status.values())


@router.post("/attendance/absences")
async def create_absence(body: AbsenceRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    data = body.dict()
    data["approved_by"] = current_user.id
    data["status"] = "approved"
    res = db.table("absences").upsert(data, on_conflict="profile_id,date").execute()
    return res.data[0] if res.data else {"ok": True}


@router.post("/admin/attendance/manual")
async def add_manual_attendance(body: ManualAttendanceRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    """Admin manually adds a clock-in and clock-out for a user."""
    
    # 1. Parse dates
    try:
        # Expected format from frontend: "YYYY-MM-DDTHH:MM"
        # We append :00 if needed and parse
        in_str = body.clock_in if len(body.clock_in) > 16 else f"{body.clock_in}:00"
        out_str = body.clock_out if len(body.clock_out) > 16 else f"{body.clock_out}:00"
        
        in_dt = CARACAS_TZ.localize(datetime.fromisoformat(in_str))
        out_dt = CARACAS_TZ.localize(datetime.fromisoformat(out_str))
    except ValueError:
        raise HTTPException(400, "Formato de fecha inválido. Use ISO8601 (YYYY-MM-DDTHH:MM)")

    if out_dt <= in_dt:
        raise HTTPException(400, "La hora de salida debe ser posterior a la de entrada")

    # 2. Get shift info for calculations
    target_date_str = in_dt.strftime("%Y-%m-%d")
    in_time_str = in_dt.strftime("%H:%M:%S")
    out_time_str = out_dt.strftime("%H:%M:%S")
    
    active_shift = None
    iso_weekday = in_dt.isoweekday()
    
    shift_res = db.table("employee_shifts").select("*").eq("profile_id", body.profile_id).eq("venue_id", body.venue_id).eq("is_active", True).execute()
    
    for s in shift_res.data or []:
        if s["modality"] == "fixed" and s["weekdays"] and iso_weekday in s["weekdays"]:
            active_shift = {
                "id": s["id"],
                "expected_start": s["start_time"],
                "expected_end": s["end_time"]
            }
            break
        elif s["modality"] == "rotating":
            d_res = db.table("shift_days").select("*").eq("employee_shift_id", s["id"]).eq("weekday", iso_weekday).execute()
            if d_res.data and not d_res.data[0].get("day_off"):
                active_shift = {
                    "id": s["id"],
                    "expected_start": d_res.data[0]["start_time"],
                    "expected_end": d_res.data[0]["end_time"]
                }
                break

    # 3. Prepare common log data
    base_log = {
        "profile_id": body.profile_id,
        "venue_id": body.venue_id,
        "edited_by": current_user.id,
        "edit_reason": body.reason,
        "verification_status": "verified"
    }
    
    if active_shift:
        base_log.update({
            "employee_shift_id": active_shift["id"],
            "expected_start": active_shift["expected_start"],
            "expected_end": active_shift["expected_end"]
        })

    # 4. Calculate Minutes Late and Overtime (New Logic)
    # Overtime only if total_worked_minutes > total_expected_minutes
    minutes_late = 0
    overtime_hours = 0
    
    if active_shift:
        # Expected duration in minutes
        e_in = datetime.strptime(active_shift["expected_start"], "%H:%M:%S")
        e_out = datetime.strptime(active_shift["expected_end"], "%H:%M:%S")
        total_expected_mins = (e_out.hour * 60 + e_out.minute) - (e_in.hour * 60 + e_in.minute)
        
        # Real duration in minutes
        total_worked_mins = (out_dt - in_dt).total_seconds() / 60
        
        # 1. Late Minutes (based on start time)
        minutes_late = calculate_late_minutes(in_time_str, active_shift["expected_start"])
        
        # 2. Overtime Hours (only if we worked more than expected)
        if total_worked_mins > total_expected_mins:
            overtime_mins = total_worked_mins - total_expected_mins
            overtime_hours = int(overtime_mins // 60)

    # 5. Insert Clock In
    in_log = base_log.copy()
    in_log.update({
        "event_type": "clock_in",
        "marked_at": in_dt.isoformat(),
        "minutes_late": minutes_late
    })
    
    db.table("attendance_logs").insert(in_log).execute()

    # 6. Insert Clock Out
    out_log = base_log.copy()
    out_log.update({
        "event_type": "clock_out",
        "marked_at": out_dt.isoformat(),
        "overtime_hours": overtime_hours
    })
    
    res = db.table("attendance_logs").insert(out_log).execute()
    
    return {"ok": True, "count": 2, "overtime_hours": overtime_hours, "minutes_late": minutes_late}


@router.post("/admin/attendance/edit-day")
async def edit_attendance_day(body: EditAttendanceDayRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    """Admin explicitly edits a user's clock-in/out times for a specific day."""
    
    work_date_str = body.work_date
    next_day_str = (datetime.strptime(work_date_str, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")

    # Fetch existing logs for this day
    logs_res = db.table("attendance_logs").select("*")\
        .eq("profile_id", body.profile_id)\
        .eq("venue_id", body.venue_id)\
        .gte("marked_at", f"{work_date_str}T00:00:00-04:00")\
        .lt("marked_at", f"{next_day_str}T00:00:00-04:00")\
        .execute()
        
    logs = logs_res.data or []
    
    clock_in_log = next((l for l in logs if l["event_type"] == "clock_in"), None)
    clock_out_log = next((l for l in logs if l["event_type"] == "clock_out"), None)

    # 1. Parse dates and validate
    in_dt = None
    out_dt = None
    try:
        if body.clock_in:
            in_str = body.clock_in if len(body.clock_in) > 16 else f"{body.clock_in}:00"
            in_dt = CARACAS_TZ.localize(datetime.fromisoformat(in_str))
        if body.clock_out:
            out_str = body.clock_out if len(body.clock_out) > 16 else f"{body.clock_out}:00"
            out_dt = CARACAS_TZ.localize(datetime.fromisoformat(out_str))
    except ValueError:
        raise HTTPException(400, "Formato de fecha inválido. Use ISO8601 (YYYY-MM-DDTHH:MM)")

    if in_dt and out_dt and out_dt <= in_dt:
        raise HTTPException(400, "La hora de salida debe ser posterior a la de entrada")

    # 2. Get active shift for calculations
    active_shift = None
    iso_weekday = datetime.strptime(work_date_str, "%Y-%m-%d").isoweekday()
    shift_res = db.table("employee_shifts").select("*").eq("profile_id", body.profile_id).eq("venue_id", body.venue_id).eq("is_active", True).execute()
    
    for s in shift_res.data or []:
        if s["modality"] == "fixed" and s["weekdays"] and iso_weekday in s["weekdays"]:
            active_shift = {
                "id": s["id"],
                "expected_start": s["start_time"],
                "expected_end": s["end_time"]
            }
            break
        elif s["modality"] == "rotating":
            d_res = db.table("shift_days").select("*").eq("employee_shift_id", s["id"]).eq("weekday", iso_weekday).execute()
            if d_res.data and not d_res.data[0].get("day_off"):
                active_shift = {
                    "id": s["id"],
                    "expected_start": d_res.data[0]["start_time"],
                    "expected_end": d_res.data[0]["end_time"]
                }
                break

    base_log = {
        "profile_id": body.profile_id,
        "venue_id": body.venue_id,
        "edited_by": current_user.id,
        "edit_reason": body.reason,
        "verification_status": "verified"
    }
    if active_shift:
        base_log.update({
            "employee_shift_id": active_shift["id"],
            "expected_start": active_shift["expected_start"],
            "expected_end": active_shift["expected_end"]
        })

    updates_count = 0
    
    # 3. Handle Clock In
    if in_dt:
        minutes_late = 0
        if active_shift:
            minutes_late = calculate_late_minutes(in_dt.strftime("%H:%M:%S"), active_shift["expected_start"])
            
        in_payload = base_log.copy()
        in_payload.update({
            "event_type": "clock_in",
            "marked_at": in_dt.isoformat(),
            "minutes_late": minutes_late
        })
        
        if clock_in_log:
            db.table("attendance_logs").update(in_payload).eq("id", clock_in_log["id"]).execute()
        else:
            db.table("attendance_logs").insert(in_payload).execute()
        updates_count += 1

    # 4. Handle Clock Out
    if out_dt:
        overtime_hours = 0
        if active_shift and in_dt:
            e_in = datetime.strptime(active_shift["expected_start"], "%H:%M:%S")
            e_out = datetime.strptime(active_shift["expected_end"], "%H:%M:%S")
            total_expected_mins = (e_out.hour * 60 + e_out.minute) - (e_in.hour * 60 + e_in.minute)
            total_worked_mins = (out_dt - in_dt).total_seconds() / 60
            
            if total_worked_mins > total_expected_mins:
                overtime_mins = total_worked_mins - total_expected_mins
                overtime_hours = int(overtime_mins // 60)
                
        out_payload = base_log.copy()
        out_payload.update({
            "event_type": "clock_out",
            "marked_at": out_dt.isoformat(),
            "overtime_hours": overtime_hours
        })
        
        if clock_out_log:
            db.table("attendance_logs").update(out_payload).eq("id", clock_out_log["id"]).execute()
        else:
            db.table("attendance_logs").insert(out_payload).execute()
        updates_count += 1

    return {"ok": True, "updated": updates_count}


@router.post("/attendance/requests")
async def request_leave(body: LeaveRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.request_leave"))):
    """Staff requests a leave. Sets status to 'pending'."""
    venue_id = body.venue_id
    if not venue_id:
        raise HTTPException(400, "venue_id is required")

    # Check for existing mark or approved absence on that date
    log_check = db.table("attendance_logs").select("id").eq("profile_id", current_user.id).gte("marked_at", f"{body.date}T00:00:00-04:00").lte("marked_at", f"{body.date}T23:59:59-04:00").limit(1).execute()
    if log_check.data:
        raise HTTPException(400, "Ya tienes marcas registradas para esa fecha")

    abs_check = db.table("absences").select("id, status").eq("profile_id", current_user.id).eq("date", body.date).execute()
    if abs_check.data:
        status = abs_check.data[0]["status"]
        if status == "approved":
            raise HTTPException(400, "Ya tienes una ausencia aprobada para esa fecha")
        elif status == "pending":
            raise HTTPException(400, "Ya tienes una solicitud pendiente para esa fecha")
        elif status == "rejected":
            raise HTTPException(400, "Ya tienes una solicitud rechazada para esa fecha. Contacta a un administrador si necesitas renegociar.")
        else:
            raise HTTPException(400, f"Ya existe un registro de ausencia ({status}) para esa fecha")

    data = {
        "profile_id": current_user.id,
        "venue_id": venue_id,
        "date": body.date,
        "type": body.type,
        "reason": body.reason,
        "status": "pending"
    }
    res = db.table("absences").insert(data).execute()
    return res.data[0] if res.data else {"ok": True}


@router.get("/attendance/requests/me")
async def get_my_requests(current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.view_own"))):
    """Returns the authenticated user's leave requests."""
    res = db.table("absences").select("*").eq("profile_id", current_user.id).order("date", desc=True).limit(50).execute()
    return res.data or []


@router.get("/admin/attendance/requests")
async def get_pending_requests(venue_id: Optional[str] = None, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.manage")), org_id: str = Depends(get_active_org_id)):
    """Admin lists pending leave requests for their organization/venue."""
    # Get venue IDs for this org
    venues_res = db.table("venues").select("id").eq("org_id", org_id).execute()
    org_venue_ids = [v["id"] for v in (venues_res.data or [])]
    
    # Use explicit relationship names to avoid ambiguity since absences has two FKs to profiles
    query = db.table("absences").select("*, profiles!profile_id(full_name), venues(name)").eq("status", "pending")
    
    if venue_id:
        query = query.eq("venue_id", venue_id)
    else:
        query = query.in_("venue_id", org_venue_ids)
        
    res = query.order("date", desc=True).execute()
    return res.data or []


@router.get("/admin/attendance/absences")
async def list_all_absences(venue_id: Optional[str] = None, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.manage")), org_id: str = Depends(get_active_org_id)):
    """Admin lists all absences (history) for their organization/venue."""
    # Get venue IDs for this org
    venues_res = db.table("venues").select("id").eq("org_id", org_id).execute()
    org_venue_ids = [v["id"] for v in (venues_res.data or [])]
    
    # Get employee info AND admin info (reviewer)
    query = db.table("absences").select("*, profiles!profile_id(full_name), venues(name), reviewer:profiles!approved_by(full_name)")
    
    if venue_id:
        query = query.eq("venue_id", venue_id)
    else:
        query = query.in_("venue_id", org_venue_ids)
        
    res = query.order("date", desc=True).limit(100).execute()
    return res.data or []


@router.patch("/admin/attendance/requests/{absence_id}")
async def review_leave_request(absence_id: str, body: AbsenceApprovalRequest, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    """Admin approves or rejects a leave request."""
    # Verify the absence exists and belongs to the admin's org
    # (Simplified for now, assuming permission check is enough or doing a quick check)
    update_data = {
        "status": body.status,
        "admin_comment": body.admin_comment,
        "approved_by": current_user.id if body.status == "approved" else None
    }
    
    res = db.table("absences").update(update_data).eq("id", absence_id).execute()
    return res.data[0] if res.data else {"ok": True}


@router.post("/internal/attendance/check-absences")
async def cron_check_absences(db=Depends(get_db)):
    """Called daily at 11:50 PM"""
    today_dt = datetime.now(CARACAS_TZ)
    today_str = today_dt.strftime("%Y-%m-%d")
    iso_weekday = today_dt.isoweekday()
    
    # Find all users who were SUPPOSED to work today
    shifts_res = db.table("employee_shifts").select("*").eq("is_active", True).execute()
    expected_profiles = []
    
    for shift in shifts_res.data or []:
        if shift["modality"] == "fixed" and shift["weekdays"] and iso_weekday in shift["weekdays"]:
            expected_profiles.append(shift)
        elif shift["modality"] == "rotating":
            d_res = db.table("shift_days").select("day_off").eq("employee_shift_id", shift["id"]).eq("weekday", iso_weekday).execute()
            if d_res.data and not d_res.data[0].get("day_off"):
                expected_profiles.append(shift)
                
    # Check if they have ANY log today
    for s in expected_profiles:
        pid = s["profile_id"]
        log_check = db.table("attendance_logs").select("id").eq("profile_id", pid).gte("marked_at", f"{today_str}T00:00:00-04:00").limit(1).execute()
        
        if not log_check.data:
            # Check if they already have an absence (e.g., leave/sick)
            abs_check = db.table("absences").select("id").eq("profile_id", pid).eq("date", today_str).execute()
            if not abs_check.data:
                db.table("absences").insert({
                    "profile_id": pid,
                    "venue_id": s["venue_id"],
                    "date": today_str,
                    "type": "unexcused"
                }).execute()
                
    return {"ok": True, "checked": len(expected_profiles)}


# ── Attendance: History & Reports (M14) ──

@router.get("/attendance/me")
async def get_my_attendance_history(days: int = 30, current_user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_permission("attendance.view_own"))):
    """Returns the staff member's attendance history for the calendar view."""
    today = datetime.now(CARACAS_TZ)
    start_date = (today - timedelta(days=days)).strftime("%Y-%m-%d")
    
    res = db.table("v_daily_attendance").select("*").eq("profile_id", current_user.id).gte("work_date", start_date).order("work_date", desc=True).execute()
    return res.data or []


@router.get("/attendance/alerts")
async def get_attendance_alerts(venue_id: str, db=Depends(get_db), _=Depends(require_permission("attendance.manage"))):
    """Returns late arrivals and unexcused absences for the admin."""
    today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
    
    # Absences
    absences_res = db.table("absences").select("*, profiles!absences_profile_id_fkey(full_name)").eq("venue_id", venue_id).eq("date", today).eq("type", "unexcused").execute()
    
    # Lates today
    lates_res = db.table("attendance_logs").select("*, profiles!attendance_logs_profile_id_fkey(full_name)").eq("venue_id", venue_id).gte("marked_at", f"{today}T00:00:00-04:00").gt("minutes_late", 0).order("marked_at", desc=True).execute()
    
    return {
        "absences": absences_res.data or [],
        "lates": lates_res.data or []
    }


@router.get("/attendance/report")
async def get_attendance_report(venue_id: str, date_from: str, date_to: str, profile_id: Optional[str] = None, db=Depends(get_db), _=Depends(require_permission("attendance.view_reports"))):
    """JSON endpoint for the frontend table preview."""
    query = db.table("v_daily_attendance").select("*").eq("venue_id", venue_id).gte("work_date", date_from).lte("work_date", date_to)
    if profile_id:
        query = query.eq("profile_id", profile_id)
        
    res = query.order("work_date", desc=False).execute()
    return res.data or []


@router.get("/attendance/export")
async def export_attendance_csv(venue_id: str, report_type: str, date_from: str, date_to: str, profile_id: Optional[str] = None, db=Depends(get_db), _=Depends(require_permission("attendance.view_reports"))):
    """Exports attendance data as a CSV file."""
    # Fetch base data
    query = db.table("v_daily_attendance").select("*").eq("venue_id", venue_id).gte("work_date", date_from).lte("work_date", date_to)
    if profile_id:
        query = query.eq("profile_id", profile_id)
    data = query.order("work_date", desc=False).execute().data or []

    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "daily":
        writer.writerow(["name", "date", "clock_in", "clock_out", "net_hours", "overtime_hours", "late_minutes", "absence"])
        for row in data:
            writer.writerow([
                row.get("full_name"), row.get("work_date"), 
                row.get("clock_in", "")[11:16] if row.get("clock_in") else "",
                row.get("clock_out", "")[11:16] if row.get("clock_out") else "",
                row.get("net_hours", 0), row.get("overtime_hours", 0),
                row.get("minutes_late", 0), row.get("absence_type", "")
            ])
    
    elif report_type in ["weekly", "custom"]:
        # Group by employee
        employees = {}
        for row in data:
            pid = row["profile_id"]
            if pid not in employees:
                employees[pid] = {"name": row["full_name"], "days": {}, "total_net": 0, "total_ot": 0}
            
            d_str = row["work_date"]
            
            date_col_key = d_str # Use actual date as key to support any length
            employees[pid]["days"][date_col_key] = row
            employees[pid]["total_net"] += float(row.get("net_hours") or 0)
            employees[pid]["total_ot"] += int(row.get("overtime_hours") or 0)

        # Group by employee to generate headers based on date range
        start_dt = datetime.strptime(date_from, "%Y-%m-%d")
        end_dt = datetime.strptime(date_to, "%Y-%m-%d")
        delta = (end_dt - start_dt).days
        
        headers = ["name"]
        dates_in_range = []
        for i in range(delta + 1):
            curr = (start_dt + timedelta(days=i)).strftime("%Y-%m-%d")
            dates_in_range.append(curr)
            day_prefix = datetime.strptime(curr, "%Y-%m-%d").strftime("%a").lower()[:3]
            headers.extend([f"{curr}_{day_prefix}_net", f"{curr}_{day_prefix}_ot", f"{curr}_{day_prefix}_late", f"{curr}_{day_prefix}_absence"])
        
        headers.extend(["total_net", "total_ot"])
        writer.writerow(headers)

        for pid, emp in employees.items():
            row_data = [emp["name"]]
            for d in dates_in_range:
                day_data = emp["days"].get(d, {})
                row_data.extend([
                    day_data.get("net_hours", 0),
                    day_data.get("overtime_hours", 0),
                    day_data.get("minutes_late", 0),
                    day_data.get("absence_type", "")
                ])
            row_data.extend([round(emp["total_net"], 2), emp["total_ot"]])
            writer.writerow(row_data)

    output.seek(0)
    filename = f"attendance_{report_type}_{date_from}_to_{date_to}.csv"
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
