import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_google_community import GoogleDriveLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

def Load_embedd_and_update(index,namespace="ns1"):
    
    """Fetches documents from Google Drive, splits them into chunks, and upserts them into the specified Pinecone index and namespace."""
    
    
    print("[Agent 3] Fetching documents from Google Drive to populate Pinecone...")
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    credentials_path = os.getenv("GOOGLE_DRIVE_CREDENTIALS_PATH", "service_account.json")

    if not folder_id or not credentials_path:
        raise RuntimeError("Missing Google Drive credentials/folder ID in .env")

    loader = GoogleDriveLoader(
        folder_id=folder_id,
        service_account_key=str(credentials_path),
        recursive=False,
        file_types=["pdf"],
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )
    documents = loader.load()
    if not documents:
        raise RuntimeError("No PDF documents found in Google Drive folder.")
    
    # Chunk the PDFs
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
    split_docs = text_splitter.split_documents(documents)
    
    try:
        index.delete(delete_all=True, namespace=namespace)
        print(f"[Sync] Clearing old records from namespace '{namespace}'...")
    except Exception as e:
        print(f"[Sync] Note: Skipping deletion of old records (index might be empty).")
    
    # Convert Langchain Docs to Pinecone Records format (using 'chunk_text' as required by field_map)
    records = []
    for i, doc in enumerate(split_docs):
        source = doc.metadata.get("source", "Policy Document")
        records.append({
            "_id": f"doc_chunk_{i}",
            "chunk_text": doc.page_content,
            "source": source
        })
    print(f"[Agent 3] Upserting {len(records)} chunks into Pinecone...")

    # Upsert into Pinecone. Pinecone handles the embeddings automatically based on our field_map!
    
    try:         
        batch_size = 96
        for i in range(0, len(records), batch_size):
            index.upsert_records(namespace=namespace, records=records[i:i+batch_size])
    except Exception as e:
        print(e)
        raise RuntimeError(f"Failed to upsert records into Pinecone: {e}")
            
    print("[Sync] Pinecone Database successfully updated with latest policies!")
        