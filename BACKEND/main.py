"""
Click HR Backend API
FastAPI application for managing HR data
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Click HR API",
    description="Backend API for Click HR system",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class OrganizationCreate(BaseModel):
    name: str
    is_active: bool = True

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class EventDataUpdate(BaseModel):
    data: dict

# Health check
@app.get("/")
async def root():
    return {"message": "Click HR API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Organizations endpoints
@app.get("/api/organizations")
async def get_organizations():
    """Get all organizations"""
    # TODO: Implement with Supabase
    return {"data": []}

@app.post("/api/organizations")
async def create_organization(org: OrganizationCreate):
    """Create a new organization"""
    # TODO: Implement with Supabase
    return {"data": {"id": "1", **org.dict()}}

@app.put("/api/organizations/{org_id}")
async def update_organization(org_id: str, org: OrganizationUpdate):
    """Update an organization"""
    # TODO: Implement with Supabase
    return {"data": {"id": org_id, **org.dict(exclude_unset=True)}}

@app.delete("/api/organizations/{org_id}")
async def delete_organization(org_id: str):
    """Delete an organization"""
    # TODO: Implement with Supabase
    return {"message": "Organization deleted"}

# Employees endpoints
@app.get("/api/employees")
async def get_employees():
    """Get all employees"""
    # TODO: Implement with Supabase
    return {"data": []}

@app.get("/api/employees/{employee_id}")
async def get_employee(employee_id: str):
    """Get employee by ID"""
    # TODO: Implement with Supabase
    return {"data": {"id": employee_id}}

@app.get("/api/employees/{employee_id}/events")
async def get_employee_events(employee_id: str):
    """Get all events for an employee"""
    # TODO: Implement with Supabase
    return {"data": []}

@app.get("/api/employees/{employee_id}/events/{event_type}")
async def get_event_data(employee_id: str, event_type: int):
    """Get specific event data for an employee"""
    # TODO: Implement with Supabase
    return {"data": {}}

@app.put("/api/employees/{employee_id}/events/{event_type}")
async def update_event_data(employee_id: str, event_type: int, event_data: EventDataUpdate):
    """Update event data for an employee"""
    # TODO: Implement with Supabase
    return {"data": event_data.data, "message": "Event data updated"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
