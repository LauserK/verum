from pydantic import BaseModel
from typing import Optional, List

# ── Attendance: Shifts Models (M13) ──

class EmployeeShiftRequest(BaseModel):
    profile_id: str
    venue_id: str
    modality: str
    weekdays: Optional[List[int]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_active: bool = True

class ShiftDayRequest(BaseModel):
    weekday: int
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    day_off: bool = False

# ── Attendance: Marking Models (M13) ──

class MarkAttendanceRequest(BaseModel):
    event_type: str # clock_in, clock_out, break_start, break_end
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    gps_accuracy_m: Optional[int] = None
    venue_id: str

class AbsenceRequest(BaseModel):
    profile_id: str
    venue_id: str
    date: str
    type: str
    reason: Optional[str] = None

class LeaveRequest(BaseModel):
    date: str  # YYYY-MM-DD
    type: str  # 'leave', 'sick', 'holiday'
    reason: Optional[str] = None
    venue_id: str

class AbsenceApprovalRequest(BaseModel):
    status: str  # 'approved', 'rejected'
    admin_comment: Optional[str] = None

class ManualAttendanceRequest(BaseModel):
    profile_id: str
    venue_id: str
    clock_in: str  # ISO Format: YYYY-MM-DDTHH:MM:SS
    clock_out: str # ISO Format: YYYY-MM-DDTHH:MM:SS
    reason: str

class EditAttendanceDayRequest(BaseModel):
    profile_id: str
    venue_id: str
    work_date: str  # YYYY-MM-DD
    clock_in: Optional[str] = None  # ISO Format: YYYY-MM-DDTHH:MM:SS or similar
    clock_out: Optional[str] = None # ISO Format: YYYY-MM-DDTHH:MM:SS or similar
    reason: str
