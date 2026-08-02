"""Agent 3: Optimized Google Drive RAG Tool for LangGraph via Pinecone."""

import os
from pathlib import Path
from dotenv import load_dotenv

from langchain.tools import tool
from langchain_google_community import GoogleDriveLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

INDEX_NAME = "insurance-policies"
NAMESPACE = "ns1"

def get_or_create_pinecone_index():
    """Loads existing Pinecone index or creates one lazily from Drive."""
    api_key = os.getenv("PINECONE_API_KEY")
    
    if not api_key:
        raise RuntimeError("PINECONE_API_KEY is missing from the .env file.")

    pc = Pinecone(api_key=api_key)

    # 1. Check if index exists. If not, create it and populate from Google Drive
    if not pc.has_index(INDEX_NAME):
        print(f"[Agent 3] Creating Pinecone index '{INDEX_NAME}' with integrated embeddings...")
        
        # Creating index using Pinecone's Integrated Inference (Llama Embeddings)
        pc.create_index_for_model(
            name=INDEX_NAME,
            cloud="aws",
            region="us-east-1",
            embed={
                "model": "llama-text-embed-v2",
                "field_map": {"text": "chunk_text"}
            }
        )
        
        index = pc.Index(INDEX_NAME)

        print("[Agent 3] Fetching documents from Google Drive to populate Pinecone...")
        folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
        credentials_path = os.getenv("GOOGLE_DRIVE_CREDENTIALS_PATH")
        
        if not folder_id or not credentials_path:
            raise RuntimeError("Missing Google Drive credentials/folder ID in .env")

        credentials_path = Path(credentials_path)
        if not credentials_path.is_absolute():
            credentials_path = BASE_DIR / credentials_path

        loader = GoogleDriveLoader(
            folder_id=folder_id,
            credentials_path=str(credentials_path),
            token_path="token.json",
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

        # Convert Langchain Docs to Pinecone Records format (using 'chunk_text' as required by field_map)
        records = []
        for i, doc in enumerate(split_docs):
            source = doc.metadata.get("source", "Policy Document")
            records.append({
                "id": f"doc_chunk_{i}",
                "chunk_text": doc.page_content,
                "source": source
            })

        print(f"[Agent 3] Upserting {len(records)} chunks into Pinecone...")
        
        # Upsert into Pinecone. Pinecone handles the embeddings automatically based on our field_map!
        batch_size = 100
        for i in range(0, len(records), batch_size):
            index.upsert_records(namespace=NAMESPACE, records=records[i:i+batch_size])
            
        print("[Agent 3] Pinecone Index built successfully.")
        return index

    else:
        # 2. If index already exists, just connect to it
        print(f"[Agent 3] Connected to existing Pinecone index '{INDEX_NAME}'.")
        return pc.Index(INDEX_NAME)


@tool
async def search_company_policies(query: str) -> str:
    """
    Use this tool to search the company's official PDF policy documents and rules.
    Examples: "How do I file a claim?", "What is the deductible?", "What are the rules?"
    """
    try:
        index = get_or_create_pinecone_index()
        
        # Perform semantic search using Pinecone's built-in inference and reranker
        reranked_results = index.search(
            namespace=NAMESPACE,
            query={
                "top_k": 3,
                "inputs": {
                    "text": query
                }
            },
            rerank={
                "model": "bge-reranker-v2-m3",
                "top_n": 3,
                "rank_fields": ["chunk_text"]
            },
            fields=["source", "chunk_text"]
        )

        hits = reranked_results.get("result", {}).get("hits", [])
        if not hits:
            return "No relevant information found in the policy documents."

        # Format retrieved text chunks for Agent 1 to read
        retrieved_texts = []
        for i, hit in enumerate(hits, 1):
            fields = hit.get("fields", {})
            source = fields.get("source", "Policy Document")
            content = fields.get("chunk_text", "")
            
            retrieved_texts.append(f"--- Excerpt {i} (Source: {source}) ---\n{content}")

        return "\n\n".join(retrieved_texts)

    except Exception as drive_err:
        return f"Error searching policy documents: {str(drive_err)}"