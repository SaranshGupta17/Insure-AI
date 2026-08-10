import os
import tempfile
from dotenv import load_dotenv
from langchain_google_community import GoogleDriveLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config.logger import logger

load_dotenv()

def Load_embedd_and_update(index,namespace="ns1"):
    
    """Fetches documents from Google Drive, splits them into chunks, and upserts them into the specified Pinecone index and namespace."""
    
    logger.info("Fetching documents from Google Drive to populate Pinecone...")
    
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    credentials = os.getenv("GOOGLE_DRIVE_CREDENTIALS")

    if not folder_id or not credentials:
        logger.error("Missing Google Drive credentials or folder ID in environment.")
        raise RuntimeError("Missing Google Drive credentials/folder ID in .env")

    # Create a secure, temporary JSON file in the server's memory/temp space
    with tempfile.NamedTemporaryFile(mode="w+", delete=False, suffix=".json") as temp_file:
        temp_file.write(credentials)
        temp_creds_path = temp_file.name  # Get the path to this temporary file
        
    try:
        loader = GoogleDriveLoader(
            folder_id=folder_id,
            service_account_key=temp_creds_path, # Using the temp path here!
            recursive=False,
            file_types=["pdf"],
            scopes=["https://www.googleapis.com/auth/drive.readonly"],
        )
        documents = loader.load()
        logger.info(f"Successfully loaded {len(documents)} document(s) from Google Drive.")
    except Exception as e:
        logger.exception(f"Error loading documents from Google Drive: {e}")
        raise e
    finally:
        # CLEANUP: Always delete the temporary file immediately after you are done loading
        if os.path.exists(temp_creds_path):
            os.remove(temp_creds_path)
    
    
    # Chunk the PDFs
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
    split_docs = text_splitter.split_documents(documents)
    logger.info(f"Split documents into {len(split_docs)} chunks.")
    
    try:
        index.delete(delete_all=True, namespace=namespace)
        logger.info(f"Cleared old records from Pinecone namespace '{namespace}'.")
    except Exception as e:
        logger.warning(f"Skipping deletion of old records (index might be empty or uninitialized): {e}")
    
    
    # Convert Langchain Docs to Pinecone Records format (using 'chunk_text' as required by field_map)
    records = []
    for i, doc in enumerate(split_docs):
        source = doc.metadata.get("source", "Policy Document")
        records.append({
            "_id": f"doc_chunk_{i}",
            "chunk_text": doc.page_content,
            "source": source
        })
    logger.info(f"Upserting {len(records)} chunks into Pinecone namespace '{namespace}'...")


    # Upsert into Pinecone. Pinecone handles the embeddings automatically based on our field_map!
    try:         
        batch_size = 96
        for i in range(0, len(records), batch_size):
            index.upsert_records(namespace=namespace, records=records[i:i+batch_size])
        logger.info("Pinecone upsert completed successfully.")
    except Exception as e:
        logger.exception(f"Failed to upsert records into Pinecone: {e}")
        raise RuntimeError(f"Failed to upsert records into Pinecone: {e}")
            
    
        