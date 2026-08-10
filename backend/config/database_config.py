# database.py
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from config.logger import logger

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
        logger.critical("Supabase URL or Key missing from environment variables!")
        raise ValueError("Supabase URL and Key must be set in the .env file!")

    logger.debug(f"Initializing Supabase client with role: {role}")
    
    # Initialize and export the Supabase Client
    return create_client(SUPABASE_URL, SUPABASE_KEY)