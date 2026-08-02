# main.py
import os
import jwt
import datetime
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from langchain_core.messages import HumanMessage
from fastapi import Request, BackgroundTasks


load_dotenv()

# --- NEW: Supabase Client Import ---
from config.database_config import supabase

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
    response = supabase.table(table_name).select("*").eq(f"{req.role}_id", req.identifier).execute()
    
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
        raw_answer = await orchestrator_graph_runner(request.query, request.customer_id)
        
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