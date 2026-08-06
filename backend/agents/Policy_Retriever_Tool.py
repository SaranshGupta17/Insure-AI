"""Agent 3: Optimized Google Drive RAG Tool for LangGraph via Pinecone."""

import os
from pathlib import Path
from dotenv import load_dotenv

from langchain.tools import tool
from pinecone import Pinecone

from services.Document_embedder import Load_embedd_and_update

load_dotenv()

INDEX_NAME = "insurance-policies"
NAMESPACE = "ns1"

def get_pinecone_index():
    """"Loads existing Pinecone index or creates a new one if it doesn't exist."""
    
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

        # Populate the new index with documents from Google Drive and upsert them
        Load_embedd_and_update(index, namespace=NAMESPACE)
        
        return index

    else:
        # 2. If index already exists, just connect to it
        print(f"[Agent 3] Connected to existing Pinecone index '{INDEX_NAME}'.")
        return pc.Index(INDEX_NAME)



@tool
async def search_company_policies(query: str) -> str:
    """
    Use this tool ONLY to search the company's general PDF rules, terms, conditions, and official guidelines.
    Call this when the user asks to "summarize policy documents", asks about general company rules, or asks how to file a claim.
    DO NOT use this tool for looking up a specific customer's personal data, vehicle number, or personal database records.
    """
    try:
        index = get_pinecone_index()
        
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