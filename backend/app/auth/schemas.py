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
    pin_code: Optional[str] = None
    permissions: List[str] = []


class AuthorizeActionRequest(BaseModel):
    credential: str  # PIN code (4-6 digits), or Barcode / RFID / NFC badge scan
    permission_key: str  # e.g. 'pos.create_cxc'


class AuthorizeActionResponse(BaseModel):
    authorized: bool
    supervisor_id: Optional[str] = None
    supervisor_name: Optional[str] = None
    message: Optional[str] = None
