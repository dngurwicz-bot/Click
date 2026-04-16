import asyncio
from sqlalchemy import text
from app.database import engine

async def main():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE billing_settings ADD COLUMN invoice_primary_color VARCHAR(16) NOT NULL DEFAULT '#1e3a8a';"))
        except Exception as e:
            print("Already exists or error:", e)
            
        try:
            await conn.execute(text("ALTER TABLE billing_settings ADD COLUMN invoice_layout VARCHAR(32) NOT NULL DEFAULT 'modern';"))
        except Exception as e:
            print("Already exists or error:", e)

if __name__ == "__main__":
    asyncio.run(main())
