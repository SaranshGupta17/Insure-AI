# main.py
import json
import os
import jwt
import uuid
import datetime
from typing import List, Optional
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


load_dotenv()

# --- NEW: Supabase Client Import ---
from config.database_config import get_supabase
from config.logger import logger

from agents.agent import orchestrator_graph_runner 
from models.Chat_models import ChatResponse, ChatRequest
from models.Login_model import LoginRequest
from models.Update_model import UpdateStatus

from services.pinecone_updater import sync_drive_to_pinecone

#NOTE:_________________________________________________LIFESPAN & FASTAPI SETUP____________________________________________________
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Server starting up. Vector DB initialized lazily.")
    yield
    logger.info("Shutting down server...")

app = FastAPI(
    title="Multi-Agent API (LangGraph - Secure User Mode)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://insure-ai-eciz-eight.vercel.app/"
        ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


#NOTE:____________________________________________________ROOT & HEALTH CHECK ENDPOINTS___________________________________________
# Root endpoint for Google site verification
# ONLY IF USING NGROK: This is required for Google to verify your domain for the webhook. If you are using a custom domain, you can remove this endpoint and verify your domain in Google Search Console instead.
@app.get("/")
async def root():
    return HTMLResponse(content='<html><head><meta name="google-site-verification" content="AfZnW6vLcO-0FAnB2xMQ8LaPqLQOD4iJffQCjY2IdoU" /></head><body></body></html>')

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Server is running (LangGraph Enabled)"}


#NOTE:______________________________________________AUTENTICATION & JWT TOKEN MANAGEMENT__________________________________

# Pull the key securely from your environment variables
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
# Add a safety check so your server won't even start if you forget the key
if not SECRET_KEY:
    logger.error("No JWT_SECRET_KEY found in .env file!")
    raise ValueError("No JWT_SECRET_KEY found in .env file!")

supabase_safe = get_supabase(role="anon")
supabase_service = get_supabase(role="service")


# Tells FastAPI to look for the "Authorization: Bearer <token>" header
security = HTTPBearer()

def verify_employee_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Validates the JWT token and ensures the user is an employee.
    If the token is missing, expired, or belongs to a customer, it throws a 401 error.
    """
    token = credentials.credentials
    try:
        # Decode the token using the exact same secret used in the login route
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        
        # Check if the role inside the token is 'employee'
        if payload.get("role") != "employee":
            logger.warning(f"Access denied. Employee token required but got role: {payload.get('role')}")
            raise HTTPException(status_code=403, detail="Access denied. Employees only.")
            
        # Return the decoded payload so the route can use the employee_id if needed
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.warning("Employee token verification failed: Token has expired.")
        raise HTTPException(status_code=401, detail="Token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        logger.warning("Employee token verification failed: Invalid token.")
        raise HTTPException(status_code=401, detail="Invalid token. Authentication failed.")


def verify_customer_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Validates the JWT token and ensures the user is a customer.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        
        # Check if the role inside the token is 'customer'
        if payload.get("role") != "customer":
            logger.warning(f"Access denied. Customer token required but got role: {payload.get('role')}")
            raise HTTPException(status_code=403, detail="Access denied. Customers only.")
            
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.warning("Customer token verification failed: Token has expired.")
        raise HTTPException(status_code=401, detail="Token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        logger.warning("Customer token verification failed: Invalid token.")
        raise HTTPException(status_code=401, detail="Invalid token. Authentication failed.")



#NOTE:___________________________________________________DRIVE WEBHOOK ENDPOINT____________________________________________________
@app.post("/api/admin/sync-policies")
async def drive_webhook_endpoint(request: Request, background_tasks: BackgroundTasks):
    """
    Receives push notifications directly from Google Drive.
    Google sends metadata in headers, not the body!
    """
    # 1. Read Google's custom headers
    resource_state = request.headers.get("X-Goog-Resource-State")
    channel_id = request.headers.get("X-Goog-Channel-Id")
    
    logger.info(f"[Webhook] Ping received! State: {resource_state}, Channel: {channel_id}")
    
    # 2. Handle the initial connection handshake
    if resource_state == "sync":
        logger.info("[Webhook] Successfully connected to Google Drive!")
        return {"status": "Webhook connected successfully!"}
        
    # 3. Handle actual file changes (uploads, edits, deletions)
    if resource_state in ["update", "add", "trash", "change"]:
        logger.info("[Webhook] Change detected in Drive folder. Starting background Pinecone sync...")
        background_tasks.add_task(sync_drive_to_pinecone)
        
    # Always return a 200 OK immediately so Google knows we received the message
    return {"status": "Acknowledged"}



#NOTE:_______________________________________________________LOGIN ENDPOINT___________________________________________________________-
@app.post("/api/auth/login")
async def login(req: LoginRequest):
    
    logger.info(f"Login attempt for role: '{req.role}' with identifier: '{req.identifier}'")
    if req.role == "customer":
        if not req.identifier.startswith("CUST-"):
            logger.warning(f"Login failed: Invalid Customer ID format '{req.identifier}'")
            raise HTTPException(status_code=401, detail="Invalid Customer ID.")
        table_name = "customer"
        
    elif req.role == "employee":
        # NEW: Validate the Employee prefix
        if not req.identifier.startswith("EMP"):
            logger.warning(f"Login failed: Invalid Employee ID format '{req.identifier}'")
            raise HTTPException(status_code=401, detail="Invalid Employee ID.")
        table_name = "employee"    
    
    # 1. Database Check Simulation
    response = supabase_safe.table(table_name).select("*").eq(f"{req.role}_id", req.identifier).execute()
    
    if not response.data or len(response.data) == 0:
        logger.warning(f"Login failed: Account not found for identifier '{req.identifier}'")
        raise HTTPException(status_code=401, detail="Account not found or invalid Id.")

    user = response.data[0]
    name = user.get("name")
    
    if str(user.get("pin")) != req.pin:
        logger.warning(f"Login failed: Incorrect PIN entered for identifier '{req.identifier}'")
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


#NOTE:______________________________________________________CHATBOT ENDPOINT________________________________________________________
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest,user: dict = Depends(verify_customer_token)):
    # 2. VALIDATION: Check for both the query AND the secure customer_id
    if not request.query.strip():
        logger.warning("Chat request rejected: No query provided.")
        raise HTTPException(status_code=400, detail="No query provided.")
    
    # Note: Ensure your frontend is actually sending this customer_id in the JSON body!
    if not hasattr(request, 'customer_id') or not request.customer_id.strip():
        logger.warning("Chat request rejected: No Customer ID provided in body.")
        raise HTTPException(status_code=401, detail="Unauthorized: No Customer ID provided.")

    try:        
        secure_customer_id = user['sub'] # Taking the ID from the trusted token
        logger.info(f"Processing chat query for customer '{secure_customer_id}': {request.query[:50]}...")
        
        # 3. RUN THE DYNAMIC GRAPH: Pass BOTH the query and the ID into the orchestrator
        # The runner function we wrote in agent1.py already handles the state and extracts the final text
        raw_answer = await orchestrator_graph_runner(customer_id = secure_customer_id, query = request.query)
        
        # Extract the pure string answer in case Gemini returns a complex block
        if isinstance(raw_answer, list):
            final_answer = raw_answer[0].get('text', str(raw_answer))
        else:
            final_answer = str(raw_answer)
            
        logger.info(f"Successfully generated chat response for customer '{secure_customer_id}'.")
        return ChatResponse(
            answer=final_answer,
            source_documents=[] # LangGraph synthesizes the outputs natively
        )
        
    except Exception as e:
        logger.exception(f"Error processing chat request for customer '{request.customer_id}': {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred.")



#NOTE:______________________________________________________________NEW CLAIM FILING ENDPOINT_____________________________________________________________- 

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
    
    # Security Token
    user: dict = Depends(verify_customer_token)
):
    try:
        secure_customer_id = user['sub']
        logger.info(f"Initiating claim filing process for customer '{secure_customer_id}' (Policy: {policy_no})")
        
        # 1. Validate Policy in Database
        policy_check = supabase_safe.table("customer").select("*").eq("policy_no", policy_no).execute()
       
        # Check if any policy belonging to the customer matches the submitted policy_no
        if len(policy_check.data) == 0:
            logger.warning(f"Claim rejected: Invalid policy number '{policy_no}' for customer '{secure_customer_id}'.")
            return {"success": False, "error": "Invalid policy number."}

        # 2. Helper function to upload files to Supabase Storage
        async def upload_file_to_storage(file: UploadFile, folder: str):
            if not file: return None
            file_bytes = await file.read()
            # Create a unique filename to prevent overwriting
            file_path = f"{secure_customer_id}/{folder}/{uuid.uuid4()}_{file.filename}"
            
            # You must create a storage bucket in Supabase called "claim_documents" first!
            supabase_service.storage.from_("claim_documents").upload(file_path, file_bytes, file_options={"content-type": file.content_type})
            
            # Get the public URL to save in your database
            public_url = supabase_service.storage.from_("claim_documents").get_public_url(file_path)
            logger.info(f"File uploaded successfully to Supabase Storage: {file_path}")
            return public_url

        # 3. Upload all received files
        logger.info(f"Uploading files for customer '{secure_customer_id}' claim...")
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
        logger.info(f"Generated unique claim ID: {unique_claim_id}. Evaluating claim via AI orchestrator...")
        
        incident_details = {
            "incident_type": custom_incident_type if incident_type == "other" else incident_type,
            "incident_description": description
        }
        
        summary = await orchestrator_graph_runner(customer_id=secure_customer_id, incident_details=str(incident_details))
        
        clean_string = summary[0]['text'].strip().removeprefix("```json").removesuffix("```").strip()

        # 2. Parse the clean string into a real Python dictionary
        summary = json.loads(clean_string)
        logger.info(f"AI evaluation complete for {unique_claim_id}. Is Covered: {summary.get('is_covered')}")
        
        # 4. Save the Claim Details to the Supabase Database
        claim_data = {
            "claim_id": unique_claim_id, 
            "customer_id": secure_customer_id,
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
            "action_by":None if summary["is_covered"] else "AI Policy Verifier",  # Mark as rejected by AI if not covered
            "policy_references":summary["policy_references"] if len(summary["policy_references"])> 0 else []
            }

        # Insert into your 'claims' table
        supabase_service.table("claims").insert(claim_data).execute()
        logger.info(f"Claim '{unique_claim_id}' successfully saved to database.")
        
        return {"success": True, "message": "Claim filed successfully"} 

    except Exception as e:
        logger.exception(f"Error filing claim for customer '{user.get('sub', 'Unknown')}': {e}")
        return {"success": False, "error": str(e)}
    
    
#NOTE:___________________________________________________LIST ALL CLAIM REQUESTS TO OFFICER ENDPOINT____________________________________________________     
    
@app.get("/api/claims")
async def get_all_claims(user: dict = Depends(verify_employee_token)):
    try:
        
        logger.info(f"Fetching all claims requested by officer '{user['sub']}'...")   
              
        # 1. Fetch claims AND the joined customer data in ONE query!
        # The syntax `customer(name)` tells Supabase to follow the foreign key 
        # to the 'customer' table and extract only the 'name' column.
        response = supabase_safe.table("claims").select(
            "claim_id, customer_id, incident_type, claim_date_time, claim_status, customer(name,policy_no)"
        ).execute()
        
        # 2. Format the nested data perfectly for your React frontend
        formatted_claims = []
        for claim in response.data:
            
            # Supabase returns joined data as a nested dictionary: {"customer": {"name": "Alice"}}
            # We use .get() safely in case a claim somehow has a missing/deleted customer
            customer_info = claim.get("customer") or {}
            customer_name = customer_info.get("name")
            
            policy_no = customer_info.get("policy_no")
            
            claim_date = claim.get("claim_date_time")          # 2026-08-07T12:24:11.816876+00:00
            claim_date = list(claim_date.split("T"))[0] 
                        
            formatted_claims.append({
                "claim_id": claim.get("claim_id"),
                "customer_id": claim.get("customer_id"),
                "customer_name": customer_name, # The newly extracted name
                "policy_no": policy_no, 
                "incident_type": claim.get("incident_type"),
                "claim_date": claim_date, # The newly extracted date
                "claim_status": claim.get("claim_status")
            })
        logger.info(f"Successfully retrieved {len(formatted_claims)} claims.")
        return {"claims": formatted_claims}
        
    except Exception as e:
        logger.exception(f"Error fetching all claims for officer '{user['sub']}': {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch claims from database.")
    

#NOTE:_______________________________________________________REVIEW CLAIM REQUEST ENDPOINT_______________________________________________________
@app.get("/review/claims/{claim_id}")
async def get_claim_review_data(claim_id: str,user: dict = Depends(verify_employee_token)):
    try:
        logger.info(f"Fetching review data for claim ID '{claim_id}' requested by officer '{user['sub']}'")
        
        # Fetch the specific claim by its ID
        response = supabase_safe.table("claims").select(
            "claim_id, customer_id, employee_id, incident_type, claim_date_time, incident_date, incident_type, description, summary,  claim_status, rc_doc_url, fir_doc_url, ntr_doc_url, rto_doc_url, evidence_urls, action_by, customer(name,policy_no,vehicles(car_number,vehicle_model)) "
        ).eq("claim_id", claim_id).execute()

        if not response.data:
            logger.warning(f"Review data fetch failed: Claim ID '{claim_id}' not found.")
            raise HTTPException(status_code=404, detail="Claim not found")

        claim = response.data[0]
        
        # Signed URL Generator ---
        def generate_signed_url(stored_url: str):
            if not stored_url: 
                return None
            try:
                # 1. Extract the relative path from the stored public URL
                bucket_string = "claim_documents/"
                if bucket_string in stored_url:
                    file_path = stored_url.split(bucket_string)[1]
                    
                    # 2. Generate a Signed URL valid for 300 seconds (5 minutes)
                    # We use supabase_service (Admin) so it bypasses RLS to generate the signature
                    sign_response = supabase_safe.storage.from_("claim_documents").create_signed_url(
                        file_path, 
                        expires_in=300
                    )
                    # The Supabase Python client returns a dictionary with the URL
                    return sign_response.get("signedURL")
            except Exception as e:
                logger.error(f"Error generating signed URL for {stored_url}: {e}")
                raise HTTPException(status_code = 404, detail = "URL not found")
            return None
        
        rc_doc_url = claim["rc_doc_url"]
        fir_doc_url = claim["fir_doc_url"]
        ntr_doc_url = claim["ntr_doc_url"]
        rto_doc_url = claim["rto_doc_url"]
        
        signed_rc_url = generate_signed_url(rc_doc_url),
        signed_fir_url = generate_signed_url(fir_doc_url) if fir_doc_url else None,
        signed_ntr_url = generate_signed_url(ntr_doc_url) if ntr_doc_url else None,
        signed_rto_url = generate_signed_url(rto_doc_url) if rto_doc_url else None

        # Convert multiple evidence URLs to Signed URLs
        if len(claim["evidence_urls"]) > 0: 
            signed_evidence_urls = []
            for ev_url in claim.get("evidence_urls", []):
                signed_url = generate_signed_url(ev_url)
                if signed_url:
                    signed_evidence_urls.append(signed_url)
        else: 
            signed_evidence_urls = None           
            
        claim_date = claim["claim_date_time"]          # 2026-08-07T12:24:11.816876+00:00
        claim_date = list(claim_date.split("T"))[0]
        
        # Format the claim data for review
        formatted_claim = {
            "claim_id": claim["claim_id"],
            "claim_date": claim_date,
            "claim_status": claim["claim_status"],
            "customer_id": claim["customer_id"],
            "customer_name": claim["customer"]["name"],
            "policy_no": claim["customer"]["policy_no"],
            "car_number": claim["customer"]["vehicles"]["car_number"],
            "vehicle_model": claim["customer"]["vehicles"]["vehicle_model"],
            "incident_date": claim["incident_date"],
            "incident_type": claim["incident_type"],
            "description": claim["description"],
            "summary": claim["summary"],
            "employee_id":claim["employee_id"],
            "action_by":claim["action_by"],
            "evidence_urls":signed_evidence_urls,
            "rc_url":signed_rc_url,
            "fir_url":signed_fir_url,
            "ntr_url":signed_ntr_url,
            "rto_url":signed_rto_url
        }
        logger.info(f"Successfully compiled review data for claim ID '{claim_id}'.")
        return formatted_claim

    except Exception as e:
        logger.exception(f"Error fetching claim review data for claim '{claim_id}': {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch claim review data from database.")
    
    
#NOTE:__________________________________________________________________________________UPDATE OFFICER ACTION FOR CLAIM REQUEST ENDPOINT____________________________________________________________    
    
@app.post("/officer/approvalaction")
def update_claim_status(request:UpdateStatus,user: dict = Depends(verify_employee_token)):
    try:
        
        secure_employee_id = user['sub']
        logger.info(f"Officer '{secure_employee_id}' is updating claim '{request.claim_id}' to status '{request.claim_status}'")
        update_status = { 
            "claim_status":request.claim_status,
            "rejection_reason":request.rejection_reason,
            "action_by":"Insurance Officer",
            "employee_id":secure_employee_id
            }
        response = supabase_service.table("claims").update(dict(update_status)).eq("claim_id",request.claim_id).execute()
        logger.info(f"Successfully updated claim '{request.claim_id}' to status '{request.claim_status}'")
        return response
    
    except Exception as e:
        logger.exception(f"Error updating status for claim '{request.claim_id}' by officer '{user.get('sub')}': {e}")
        raise HTTPException(e)