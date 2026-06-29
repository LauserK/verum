from datetime import datetime
from typing import Optional
import pytz
from attendance_utils import is_clocked_in

CARACAS_TZ = pytz.timezone("America/Caracas")

def get_active_shift_for_today(profile_id: str, venue_id: str, db) -> Optional[dict]:
    today_dt = datetime.now(CARACAS_TZ)
    iso_weekday = today_dt.isoweekday() # 1=Mon, 7=Sun
    
    # Get active shift
    shift_res = db.table("employee_shifts").select("*").eq("profile_id", profile_id).eq("venue_id", venue_id).eq("is_active", True).execute()
    if not shift_res.data:
        return None
    
    shift = shift_res.data[0]
    
    if shift["modality"] == "flexible":
        return {"id": shift["id"], "expected_start": None, "expected_end": None}
        
    elif shift["modality"] == "fixed":
        if shift["weekdays"] and iso_weekday in shift["weekdays"]:
            return {"id": shift["id"], "expected_start": shift.get("start_time"), "expected_end": shift.get("end_time")}
        return None
        
    elif shift["modality"] == "rotating":
        days_res = db.table("shift_days").select("*").eq("employee_shift_id", shift["id"]).eq("weekday", iso_weekday).execute()
        if days_res.data and not days_res.data[0].get("day_off"):
            return {"id": shift["id"], "expected_start": days_res.data[0].get("start_time"), "expected_end": days_res.data[0].get("end_time")}
        return None
        
    return None

def calculate_late_minutes(real_time_str: str, expected_time_str: str) -> int:
    if not expected_time_str: return 0
    rt = datetime.strptime(real_time_str, "%H:%M:%S").time()
    et = datetime.strptime(expected_time_str, "%H:%M:%S").time()
    diff = (rt.hour * 60 + rt.minute) - (et.hour * 60 + et.minute)
    return max(0, diff)

def calculate_overtime(real_time_str: str, expected_time_str: str, is_entry: bool) -> int:
    if not expected_time_str: return 0
    rt = datetime.strptime(real_time_str, "%H:%M:%S").time()
    et = datetime.strptime(expected_time_str, "%H:%M:%S").time()
    rm = rt.hour * 60 + rt.minute
    em = et.hour * 60 + et.minute
    
    diff = (em - rm) if is_entry else (rm - em)
    if diff <= 0: return 0
    return diff // 60 # Floor hours
