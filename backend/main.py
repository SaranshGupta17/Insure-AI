# main.py
import json
import os
import jwt
import uuid
import datetime
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from typing import List, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, UploadFile, File, Form 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse




load_dotenv()

# --- NEW: Supabase Client Import ---
from config.database_config import get_supabase

from agents.agent import orchestrator_graph_runner 
from models.Chat_models import ChatResponse, ChatRequest
from models.Login_model import LoginRequest

from services.pinecone_updater import sync_drive_to_pinecone

# _________________________________________________LIFESPAN & FASTAPI SETUP____________________________________________________
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Server starting up. Vector DB will be built lazily on the first Agent 3 query.")
    yield
    print("Shutting down server...")

app = FastAPI(
    title="Multi-Agent API (LangGraph - Secure User Mode)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ____________________________________________________ROOT & HEALTH CHECK ENDPOINTS___________________________________________
# Root endpoint for Google site verification
# ONLY IF USING NGROK: This is required for Google to verify your domain for the webhook. If you are using a custom domain, you can remove this endpoint and verify your domain in Google Search Console instead.
@app.get("/")
async def root():
    return HTMLResponse(content='<html><head><meta name="google-site-verification" content="AfZnW6vLcO-0FAnB2xMQ8LaPqLQOD4iJffQCjY2IdoU" /></head><body></body></html>')

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Server is running (LangGraph Enabled)"}


# ______________________________________________AUTENTICATION & JWT TOKEN MANAGEMENT__________________________________
# Pull the key securely from your environment variables
SECRET_KEY = os.getenv("JWT_SECRET_KEY")

supabase_safe = get_supabase(role="anon")
supabase_service = get_supabase(role="service")


# Add a safety check so your server won't even start if you forget the key
if not SECRET_KEY:
    raise ValueError("No JWT_SECRET_KEY found in .env file!")

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    print(req.role)
    if req.role == "customer":
        if not req.identifier.startswith("CUST-"):
            raise HTTPException(status_code=401, detail="Invalid Customer ID.")
        table_name = "customer"
        
    elif req.role == "employee":
        # NEW: Validate the Employee prefix
        if not req.identifier.startswith("EMP"):
            raise HTTPException(status_code=401, detail="Invalid Employee ID.")
        table_name = "employee"    
    
    # 1. Database Check Simulation
    response = supabase_safe.table(table_name).select("*").eq(f"{req.role}_id", req.identifier).execute()
    
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=401, detail="Account not found or invalid Id.")

    user = response.data[0]
    name = user.get("name")
    
    print(response)
    if str(user.get("pin")) != req.pin:
        raise HTTPException(status_code=401, detail="Incorrect PIN.")

    # 2. Generate a secure JWT Token valid for 2 hours
    expiration = datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    token = jwt.encode(
        {"sub": req.identifier, "role": req.role, "exp": expiration},
        SECRET_KEY,
        algorithm="HS256"
    )
    
    # 3. Send the token back to React
    return {
        "message": "Login successful",
        "token": token,
        "role": req.role,
        "identifier": req.identifier,
        "name": name 
    }


# ______________________________________________________CHAT ENDPOINT________________________________________________________
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    # 2. VALIDATION: Check for both the query AND the secure customer_id
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="No query provided.")
    
    # Note: Ensure your frontend is actually sending this customer_id in the JSON body!
    if not hasattr(request, 'customer_id') or not request.customer_id.strip():
        raise HTTPException(status_code=401, detail="Unauthorized: No Customer ID provided.")

    try:
        # 3. RUN THE DYNAMIC GRAPH: Pass BOTH the query and the ID into the orchestrator
        # The runner function we wrote in agent1.py already handles the state and extracts the final text
        raw_answer = await orchestrator_graph_runner(customer_id = request.customer_id, query = request.query)
        
        # Extract the pure string answer in case Gemini returns a complex block
        if isinstance(raw_answer, list):
            final_answer = raw_answer[0].get('text', str(raw_answer))
        else:
            final_answer = str(raw_answer)

        return ChatResponse(
            answer=final_answer,
            source_documents=[] # LangGraph synthesizes the outputs natively
        )
        
    except Exception as e:
        print(f"Error processing chat request: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred.")


# ___________________________________________________DRIVE WEBHOOK ENDPOINT____________________________________________________
@app.post("/api/admin/sync-policies")
async def drive_webhook_endpoint(request: Request, background_tasks: BackgroundTasks):
    """
    Receives push notifications directly from Google Drive.
    Google sends metadata in headers, not the body!
    """
    # 1. Read Google's custom headers
    resource_state = request.headers.get("X-Goog-Resource-State")
    channel_id = request.headers.get("X-Goog-Channel-Id")
    
    print(f"[Webhook] Ping received! State: {resource_state}, Channel: {channel_id}")
    
    # 2. Handle the initial connection handshake
    if resource_state == "sync":
        print("[Webhook] Successfully connected to Google Drive!")
        return {"status": "Webhook connected successfully!"}
        
    # 3. Handle actual file changes (uploads, edits, deletions)
    if resource_state in ["update", "add", "trash", "change"]:
        print("[Webhook] Change detected in Drive folder. Starting background Pinecone sync...")
        background_tasks.add_task(sync_drive_to_pinecone)
        
    # Always return a 200 OK immediately so Google knows we received the message
    return {"status": "Acknowledged"}



def generate_unique_claim_id() -> str:
    """Generates a unique CLM- ID and checks the database to prevent duplicates."""
    while True:
        # 1. Generate a candidate ID
        candidate_id = f"CLM-{uuid.uuid4().hex[:8].upper()}"
        
        # 2. Query the database to see if this ID is already taken
        response = supabase_safe.table("claims").select("claim_id").eq("claim_id", candidate_id).execute()
        
        # 3. If the data array is empty, the ID is unique!
        if len(response.data) == 0:
            return candidate_id

@app.post("/file_claim")
async def process_file_claim(
    # Text Fields
    customer_id: str = Form(...),
    policy_no: str = Form(...),
    incident_date: str = Form(...),
    incident_type: str = Form(...),
    custom_incident_type: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    
    # File Fields
    rc_document: UploadFile = File(...),
    evidence_files: Optional[List[UploadFile]] = File(None),
    fir_document: Optional[UploadFile] = File(None),
    ntr_document: Optional[UploadFile] = File(None),
    rto_document: Optional[UploadFile] = File(None),
):
    try:
        # 1. Validate Policy in Database
        policy_check = supabase_safe.table("customer").select("*").eq("policy_no", policy_no).execute()
       
        # Check if any policy belonging to the customer matches the submitted policy_no
        if len(policy_check.data) == 0:
            return {"success": False, "error": "Invalid policy number."}

        # 2. Helper function to upload files to Supabase Storage
        async def upload_file_to_storage(file: UploadFile, folder: str):
            if not file: return None
            file_bytes = await file.read()
            # Create a unique filename to prevent overwriting
            file_path = f"{customer_id}/{folder}/{uuid.uuid4()}_{file.filename}"
            
            # NOTE: You must create a storage bucket in Supabase called "claim_documents" first!
            supabase_service.storage.from_("claim_documents").upload(file_path, file_bytes)
            
            # Get the public URL to save in your database
            public_url = supabase_service.storage.from_("claim_documents").get_public_url(file_path)
            return public_url

        # 3. Upload all received files
        rc_url = await upload_file_to_storage(rc_document, "rc_docs")
        fir_url = await upload_file_to_storage(fir_document, "fir_docs") if fir_document else None
        ntr_url = await upload_file_to_storage(ntr_document, "ntr_docs") if ntr_document else None
        rto_url = await upload_file_to_storage(rto_document, "rto_docs") if rto_document else None
        
        # Handle multiple evidence files
        evidence_urls = []
        if evidence_files:
            for ev_file in evidence_files:
                url = await upload_file_to_storage(ev_file, "evidence")
                if url: evidence_urls.append(url)


        # Generate a unique Claim ID
        unique_claim_id = generate_unique_claim_id()
        
        incident_details = {
            "incident_type": custom_incident_type if incident_type == "other" else incident_type,
            "incident_description": description
        }
        
        summary = await orchestrator_graph_runner(customer_id=customer_id, incident_details=str(incident_details))
        
        clean_string = summary[0]['text'].strip().removeprefix("```json").removesuffix("```").strip()

        # 2. Parse the clean string into a real Python dictionary
        summary = json.loads(clean_string)
        print(summary)
        
        
        # 4. Save the Claim Details to the Supabase Database
        claim_data = {
            "claim_id": unique_claim_id, 
            "customer_id": customer_id,
            "incident_date": incident_date,
            "incident_type": custom_incident_type if incident_type == "other" else incident_type,
            "description": description,
            "rc_doc_url": rc_url,
            "fir_doc_url": fir_url,
            "ntr_doc_url": ntr_url,
            "rto_doc_url": rto_url,
            "evidence_urls": evidence_urls, # Ensure your DB column is setup as a JSONB or text array type
            "claim_status": "Pending" if summary["is_covered"] else "Rejected",  # Default status for new claims
            "summary": summary,  # Store the summary generated by the LLM
            "rejection_reason": None if summary["is_covered"] else summary["message"],  # Initialize as None; can be updated later if needed
            "rejected_by":None if summary["is_covered"] else "AI Policy Verifier",  # Mark as rejected by AI if not covered
            "policy_references": summary["policy_references"] ,  # Store policy references if rejected
            }

        # Insert into your 'claims' table
        supabase_service.table("claims").insert(claim_data).execute()

        return {"success": True, "message": "Claim filed successfully"} 

    except Exception as e:
        print(f"Error filing claim: {e}")
        return {"success": False, "error": str(e)}
    
    
    
    
