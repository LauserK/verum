from datetime import date

async def is_clocked_in(profile_id: str, db) -> bool:
    """ Checks if the user's latest attendance log for today is an active session. """
    
    # Get the latest log for today
    today = date.today().isoformat()
    res = db.table("attendance_logs")\
        .select("event_type")\
        .eq("profile_id", profile_id)\
        .gte("marked_at", f"{today}T00:00:00-04:00")\
        .order("marked_at", desc=True)\
        .limit(1)\
        .execute()
    
    if not res.data:
        return False
    
    # If the last action was 'clock_in' or 'break_end', they are active
    return res.data[0]["event_type"] in ["clock_in", "break_end"]
