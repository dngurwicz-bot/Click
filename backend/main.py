"""
Click HR Backend API
FastAPI backend for Click HR system
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Click HR API",
    description="Backend API for Click HR system",
    version="1.0.0"
)

# CORS Configuration
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("⚠️  WARNING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables")
    print("⚠️  The server will start but API endpoints may not work properly")
    supabase = None
else:
    # Initialize Supabase client
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Supabase client initialized successfully")
    except Exception as e:
        print(f"⚠️  WARNING: Failed to initialize Supabase client: {e}")
        print("⚠️  The server will start but API endpoints may not work properly")
        supabase = None

# Pydantic Models
class OrganizationCreate(BaseModel):
    name: str
    is_active: bool = True

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class OrganizationResponse(BaseModel):
    id: str
    name: str
    is_active: bool
    created_at: str
    updated_at: str

# Authentication Dependency
async def verify_token(authorization: Optional[str] = Header(None)):
    """
    Verify JWT token from Authorization header
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase client not initialized. Please check your .env file")
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        # Extract token from "Bearer <token>"
        token = authorization.replace("Bearer ", "")
        
        # Verify token with Supabase
        user = supabase.auth.get_user(token)
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

# Health Check
@app.get("/")
async def root():
    return {"message": "Click HR API is running", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Organizations Endpoints
@app.get("/api/organizations", response_model=List[OrganizationResponse])
async def get_organizations(user: dict = Depends(verify_token)):
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    """
    Get all organizations
    For super_admin: returns all organizations
    For others: returns only their organization
    """
    try:
        # Get user's organization_id from users table
        user_data = supabase.table("users").select("organization_id, role").eq("id", user.user.id).single().execute()
        
        if not user_data.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_role = user_data.data.get("role")
        user_org_id = user_data.data.get("organization_id")
        
        # Super admin can see all organizations
        if user_role == "super_admin":
            response = supabase.table("organizations").select("*").order("created_at", desc=True).execute()
        else:
            # Regular users see only their organization
            response = supabase.table("organizations").select("*").eq("id", user_org_id).execute()
        
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching organizations: {str(e)}")

@app.get("/api/organizations/{org_id}", response_model=OrganizationResponse)
async def get_organization(org_id: str, user: dict = Depends(verify_token)):
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    """
    Get a specific organization by ID
    """
    try:
        # Verify user has access to this organization
        user_data = supabase.table("users").select("organization_id, role").eq("id", user.user.id).single().execute()
        
        if not user_data.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_role = user_data.data.get("role")
        user_org_id = user_data.data.get("organization_id")
        
        # Super admin can access any organization, others only their own
        if user_role != "super_admin" and user_org_id != org_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        response = supabase.table("organizations").select("*").eq("id", org_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        return response.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching organization: {str(e)}")

@app.post("/api/organizations", response_model=OrganizationResponse)
async def create_organization(org: OrganizationCreate, user: dict = Depends(verify_token)):
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    """
    Create a new organization
    Only super_admin can create organizations
    """
    try:
        # Check if user is super_admin
        user_data = supabase.table("users").select("role").eq("id", user.user.id).single().execute()
        
        if not user_data.data or user_data.data.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Only super_admin can create organizations")
        
        # Create organization
        response = supabase.table("organizations").insert({
            "name": org.name,
            "is_active": org.is_active
        }).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create organization")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating organization: {str(e)}")

@app.put("/api/organizations/{org_id}", response_model=OrganizationResponse)
async def update_organization(org_id: str, org: OrganizationUpdate, user: dict = Depends(verify_token)):
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    """
    Update an organization
    Only super_admin can update organizations
    """
    try:
        # Check if user is super_admin
        user_data = supabase.table("users").select("role").eq("id", user.user.id).single().execute()
        
        if not user_data.data or user_data.data.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Only super_admin can update organizations")
        
        # Build update data
        update_data = {}
        if org.name is not None:
            update_data["name"] = org.name
        if org.is_active is not None:
            update_data["is_active"] = org.is_active
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update organization
        response = supabase.table("organizations").update(update_data).eq("id", org_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating organization: {str(e)}")

@app.delete("/api/organizations/{org_id}")
async def delete_organization(org_id: str, user: dict = Depends(verify_token)):
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    """
    Delete an organization
    Only super_admin can delete organizations
    """
    try:
        # Check if user is super_admin
        user_data = supabase.table("users").select("role").eq("id", user.user.id).single().execute()
        
        if not user_data.data or user_data.data.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Only super_admin can delete organizations")
        
        # Check if organization exists
        org_response = supabase.table("organizations").select("id").eq("id", org_id).single().execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Delete organization
        supabase.table("organizations").delete().eq("id", org_id).execute()
        
        return {"message": "Organization deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting organization: {str(e)}")

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port, reload=True)
