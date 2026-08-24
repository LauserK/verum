from supabase import create_client, Client, ClientOptions
from config import settings
import httpx

# Configure robust client options for Windows asyncio HTTP sockets
client_options = ClientOptions(
    postgrest_client_timeout=30.0,
    storage_client_timeout=30.0
)

supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
    options=client_options
)

def get_db():
    return supabase
