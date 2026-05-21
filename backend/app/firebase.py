import os
import firebase_admin
from firebase_admin import credentials, auth
from app.config import get_settings

settings = get_settings()

def init_firebase():
    if not firebase_admin._apps:
        # Note: In production, FIREBASE_SERVICE_ACCOUNT_PATH should point to the downloaded JSON key.
        # Alternatively, if running on GCP, default credentials are used.
        creds = None
        if hasattr(settings, 'FIREBASE_SERVICE_ACCOUNT_PATH') and settings.FIREBASE_SERVICE_ACCOUNT_PATH:
            if os.path.exists(settings.FIREBASE_SERVICE_ACCOUNT_PATH):
                creds = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
        
        firebase_admin.initialize_app(credential=creds)

# Call init_firebase when module is imported
init_firebase()
