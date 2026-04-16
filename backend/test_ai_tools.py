import sys
import os
import asyncio
import json

# Add parent dir to path
sys.path.append(os.getcwd())

from app.routers.ai import get_modules_catalog, get_system_overview, search_tenant

async def main():
    print("--- Testing Tool: get_modules_catalog ---")
    try:
        catalog = await get_modules_catalog()
        print(f"Catalog Result: {catalog[:200]}...")
    except Exception as e:
        print(f"Error in catalog: {e}")

    print("\n--- Testing Tool: get_system_overview ---")
    try:
        overview = await get_system_overview()
        print(f"Overview Result: {overview}")
    except Exception as e:
        print(f"Error in overview: {e}")

    print("\n--- Testing Tool: search_tenant ---")
    try:
        search = await search_tenant(query="Click")
        print(f"Search Result: {search}")
    except Exception as e:
        print(f"Error in search: {e}")

if __name__ == "__main__":
    asyncio.run(main())
