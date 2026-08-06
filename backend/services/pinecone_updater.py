# services/pinecone_updater.py
import os
from pathlib import Path
from dotenv import load_dotenv

from pinecone import Pinecone

from services.Document_embedder import Load_embedd_and_update

# Setup Environment and Paths
load_dotenv()

INDEX_NAME = "insurance-policies"
NAMESPACE = "ns1"

def sync_drive_to_pinecone():
    """
    Pulls the latest documents from Google Drive, clears the old Pinecone namespace, 
    and upserts the new embeddings. Designed to run as a background task.
    """
    try:
        print("[Sync] Starting Google Drive to Pinecone sync...")
        api_key = os.getenv("PINECONE_API_KEY")
        
        if not api_key:
            raise RuntimeError("PINECONE_API_KEY is missing from the .env file.")
            
        pc = Pinecone(api_key=api_key)
        index = pc.Index(INDEX_NAME)

        # 1. Fetch latest from Google Drive and update Pinecone
        Load_embedd_and_update(index, namespace=NAMESPACE)
        
        
    except Exception as e:
        print(f"[Sync Error] Failed to update Pinecone: {str(e)}")