import asyncio
import httpx
import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Import config
from app.config import get_settings
settings = get_settings()

def _create_token(user_id: uuid.UUID, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

async def main():
    print("Testing local API endpoints to find the 500 error...")
    
    # 1. Connect to DB to get an admin user
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(text("SELECT id, email, role FROM admin_users WHERE is_active = true LIMIT 1"))
        user = result.fetchone()
        
    if not user:
        print("No admin user found.")
        return
        
    print(f"Found admin user: {user.email}")
    token = _create_token(user.id, user.email, user.role)
    
    # 2. Test endpoints
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        headers = {"Authorization": f"Bearer {token}"}
        
        endpoints = [
            "/api/auth/me",
            "/api/admin/modules",
            "/api/admin/tenants",
            "/api/admin/users",
            "/api/admin/billing/overview",
            "/api/admin/audit",
            "/api/admin/lookups",
            "/api/admin/templates",
        ]
        
        for ep in endpoints:
            r = await client.get(ep, headers=headers)
            print(f"GET {ep} -> {r.status_code}")
            if r.status_code == 500:
                print(r.text)
        
if __name__ == "__main__":
    asyncio.run(main())
