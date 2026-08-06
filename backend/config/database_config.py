# database.py
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")

def get_supabase(role: str = "anon") -> Client:
    
    if role == "service":
        SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    else:
        SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
        
    # Safety checks
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase URL and Key must be set in the .env file!")

    # Initialize and export the Supabase Client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase