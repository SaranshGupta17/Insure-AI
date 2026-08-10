import os
import uuid
import json
from google.oauth2.service_account import Credentials # <-- Changed this import
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
# IMPORTANT: This must be your EXACT ngrok URL followed by your FastAPI endpoint path
WEBHOOK_URL =os.getenv("WEBHOOK_URL")  

def setup_drive_webhook():
    print("Authenticating with Google...")
    
    # 1. Use the token.json file that Langchain generates, NOT a service account
    # Authenticate silently using the service account JSON
    # Fetch the raw JSON string from your .env
    creds_json_string = os.getenv("GOOGLE_DRIVE_CREDENTIALS_PATH")
    
    # Parse the string into a Python dictionary
    creds_info = json.loads(creds_json_string)

    # Use _info instead of _file
    creds = Credentials.from_service_account_info(
        creds_info,
        scopes=["https://www.googleapis.com/auth/drive.readonly"]
    )
    
    service = build('drive', 'v3', credentials=creds)
    
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    # Generate a unique ID for this specific webhook connection
    channel_id = str(uuid.uuid4())

    body = {
        "id": channel_id,
        "type": "web_hook",
        "address": WEBHOOK_URL
    }

    try:
        print(f"Telling Google to watch folder: {folder_id}...")
        

        response = service.files().watch(fileId=folder_id, body=body).execute()
        print("\n✅ Webhook Registered Successfully!")
        print(f"Channel ID: {response['id']}")
        print(f"Resource ID: {response['resourceId']}")
        print("Now, drop a PDF into your Google Drive folder and watch your FastAPI terminal!")
    except Exception as e:
        print(f"\n❌ Error registering webhook: {e}")
        print("Note: Ensure your Ngrok URL is completely correct and verified in Google Cloud Console.")

if __name__ == "__main__":
    setup_drive_webhook()