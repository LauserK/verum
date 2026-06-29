import pytz
from datetime import datetime

CARACAS_TZ = pytz.timezone("America/Caracas")

def get_current_shift() -> str:
    """Returns the current shift based on local hour."""
    hour = datetime.now(CARACAS_TZ).hour
    if 6 <= hour < 14:
        return "morning"
    elif 14 <= hour < 20:
        return "mid"
    else:
        return "closing"


async def get_user_shift_identifier(user_id: str, venue_id: str, db) -> str:
    """
    Retorna el shift_id (UUID) del usuario para una sede específica desde employee_shifts.
    En el modelo M:N, el shift es específico de la sede.
    Si no tiene uno asignado, hace fallback al bloque horario (morning/mid/closing).
    """
    res = db.table("employee_shifts").select("id").eq("profile_id", user_id).eq("venue_id", venue_id).eq("is_active", True).execute()
    if res.data:
        return str(res.data[0]["id"])
    
    return get_current_shift()
