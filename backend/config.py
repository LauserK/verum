import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    REDIS_URL: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

settings = Settings()
