# backend/auth_deps.py
from types import SimpleNamespace
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import supabase

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    from app.cache import cache, hash_token
    token = credentials.credentials
    token_hash = hash_token(token)

    # Check cache first
    cached_user = await cache.get(f"auth:user:{token_hash}")
    if cached_user:
        return SimpleNamespace(**cached_user)

    try:
        res = supabase.auth.get_user(token)
        if res and res.user:
            user_data = {
                "id": res.user.id,
                "email": getattr(res.user, "email", None),
                "user_metadata": getattr(res.user, "user_metadata", {}) or {},
            }
            await cache.set(f"auth:user:{token_hash}", user_data, ttl=300)
            return res.user
        else:
            print("Auth error: No user returned from Supabase")
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        import traceback
        print(f"Authentication exception: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
