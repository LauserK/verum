from pydantic import BaseModel
from typing import Optional, List


class SyncResponse(BaseModel):
    id: str
    role: str
    is_superadmin: bool = False
    organization_is_active: bool = True


class VenueInfo(BaseModel):
    id: str
    name: str


class OrgInfo(BaseModel):
    id: str
    name: str
    venues: List[VenueInfo]
    is_active: bool = True


class ProfileResponse(BaseModel):
    id: str
    full_name: Optional[str] = None
    role: str
    is_superadmin: bool = False
    organizations: List[OrgInfo] = []
    organization_id: Optional[str] = None
    venue_id: Optional[str] = None
    shift_id: Optional[str] = None
    shift_name: Optional[str] = None
