# services/pinecone_updater.py
import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_google_community import GoogleDriveLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone

# Setup Environment and Paths
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

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

        # 1. Fetch latest from Google Drive
        folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
        credentials_path = str(BASE_DIR / os.getenv("GOOGLE_DRIVE_CREDENTIALS_PATH", "credentials.json"))
        
        loader = GoogleDriveLoader(
            folder_id=folder_id,
            service_account_key=credentials_path,
            recursive=False,
            file_types=["pdf"],
            scopes=["https://www.googleapis.com/auth/drive.readonly"],
        )
        documents = loader.load()
        
        if not documents:
            print("[Sync] No documents found in Drive. Aborting sync.")
            return

        # 2. Chunk the updated documents
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
        split_docs = text_splitter.split_documents(documents)

        # 3. Clear the existing namespace to prevent duplicate chunks
        print(f"[Sync] Clearing old records from namespace '{NAMESPACE}'...")
        index.delete(delete_all=True, namespace=NAMESPACE)

        # 4. Format and Upsert new records
        records = []
        for i, doc in enumerate(split_docs):
            source = doc.metadata.get("source", "Policy Document")
            records.append({
                "id": f"doc_chunk_{i}",
                "chunk_text": doc.page_content,
                "source": source
            })

        print(f"[Sync] Upserting {len(records)} new chunks into Pinecone...")
        batch_size = 100
        for i in range(0, len(records), batch_size):
            index.upsert_records(namespace=NAMESPACE, records=records[i:i+batch_size])

        print("[Sync] Pinecone Database successfully updated with latest policies!")

    except Exception as e:
        print(f"[Sync Error] Failed to update Pinecone: {str(e)}")