import os
import uuid
import json
from google.oauth2.service_account import Credentials # <-- Changed this import
from googleapiclient.discovery import build
from dotenv import load_dotenv
from config.logger import logger

load_dotenv()

# --- CONFIGURATION ---
# IMPORTANT: This must be your EXACT ngrok URL followed by your FastAPI endpoint path

def setup_drive_webhook():
    logger.info("Initializing Google Drive webhook registration...")
    
    # 1. Use the token.json file that Langchain generates, NOT a service account
    # Authenticate silently using the service account JSON
    # Fetch the raw JSON string from your .env
    WEBHOOK_URL =os.getenv("WEBHOOK_URL")  
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    creds_json_string = os.getenv("GOOGLE_DRIVE_CREDENTIALS")
    
    if not WEBHOOK_URL:
        logger.error("WEBHOOK_URL missing in environment variables.")
        raise ValueError("WEBHOOK_URL is required to register webhook.")    
    
    if not folder_id or not creds_json_string:
        logger.error("Google Drive folder ID or service account credentials missing in .env")
        raise ValueError("GOOGLE_DRIVE_FOLDER_ID and GOOGLE_DRIVE_CREDENTIALS are required.")
    
    

    try:
        # Parse the string into a Python dictionary
        creds_info = json.loads(creds_json_string)
             # Use _info instead of _file
        creds = Credentials.from_service_account_info(
            creds_info,
            scopes=["https://www.googleapis.com/auth/drive.readonly"]
        )
        
        service = build(
            'drive', 
            'v3', 
            credentials=creds,
            cache_discovery=False
        )
        
        # Generate a unique ID for this specific webhook connection
        channel_id = str(uuid.uuid4())
        body = {
            "id": channel_id,
            "type": "web_hook",
            "address": WEBHOOK_URL
        }
            
        logger.info(f"Sending watch request to Google Drive for Folder ID: '{folder_id}' -> Target Endpoint: '{WEBHOOK_URL}'")
        
        response = service.files().watch(fileId=folder_id, body=body).execute()
        
        logger.info("✅ Google Drive Webhook Registered Successfully!")
        logger.info(f"Channel ID: {response.get('id')}")
        logger.info(f"Resource ID: {response.get('resourceId')}")
        logger.info("Resource ID: %s", response.get("resourceId"))
        logger.info("Expiration: %s", response.get("expiration"))
        logger.info("Now, drop a PDF into your Google Drive folder and watch your FastAPI terminal!")
        
    except json.JSONDecodeError as exc:
        logger.exception("GOOGLE_DRIVE_CREDENTIALS is not valid JSON.")
        raise ValueError(
            "GOOGLE_DRIVE_CREDENTIALS must contain valid JSON."
        ) from exc

    except Exception as exc:
        logger.exception(
            "Error registering Google Drive webhook: %s",
            exc,
        )
        raise

if __name__ == "__main__":
    setup_drive_webhook()