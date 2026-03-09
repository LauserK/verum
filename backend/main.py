from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
import httpx
from pydantic import BaseModel

from database import supabase
from config import settings

app = FastAPI(title="VERUM API")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # We can either verify the JWT locally using the JWT secret, 
        # or use the supabase auth API to get the user.
        # For simplicity and correctness with Supabase, calling auth.get_user(token) is safest.
        res = supabase.auth.get_user(token)
        if res and res.user:
            return res.user
        else:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

@app.get("/")
def read_root():
    return {"message": "VERUM API is running"}

class SyncResponse(BaseModel):
    id: str
    role: str

@app.post("/auth/sync", response_model=SyncResponse)
async def sync_user(user = Depends(get_current_user)):
    """
    Syncs the Supabase Auth user into the public.profiles table 
    with a default staff role.
    """
    try:
        # Check if profile exists
        existing_profile = supabase.table("profiles").select("*").eq("id", user.id).execute()
        
        if existing_profile.data and len(existing_profile.data) > 0:
            return {"id": user.id, "role": existing_profile.data[0].get("role")}
            
        # Create new profile with 'staff' role
        new_profile = {
            "id": user.id,
            "role": "staff",
            "full_name": user.user_metadata.get("full_name", user.email) if user else ""
        }
        res = supabase.table("profiles").insert(new_profile).execute()
        
        return {"id": user.id, "role": "staff"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
