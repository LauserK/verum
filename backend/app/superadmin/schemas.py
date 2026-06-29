from pydantic import BaseModel
from typing import Optional, List
from app.auth.schemas import VenueInfo

class SuperAdminUserOrgUpdate(BaseModel):
    role_id: Optional[str] = None
    role_name: Optional[str] = None # 'admin', 'staff', or custom role name
    venue_ids: Optional[List[str]] = None

class SuperAdminUserOrgAdd(BaseModel):
    organization_id: str
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    venue_ids: Optional[List[str]] = None

class UserOrgDetail(BaseModel):
    id: str
    name: str
    role_id: Optional[str] = None
    role_name: str
    venues: List[VenueInfo]

class SuperAdminUserDetail(BaseModel):
    id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    is_superadmin: bool
    organizations: List[UserOrgDetail]

class SuperAdminUserInOrg(BaseModel):
    id: str
    full_name: Optional[str] = None
    role_name: str

class SuperAdminOrgDetail(BaseModel):
    id: str
    name: str
    is_active: bool
    venues: List[VenueInfo]
    users: List[SuperAdminUserInOrg]
