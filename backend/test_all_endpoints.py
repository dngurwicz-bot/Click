import inspect
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db

client = TestClient(app)

def test_all():
    print("Testing all GET and POST endpoints...")
    # First get a valid token if possible, or just hit them unauth to see if they 500 instead of 401
    
    # We will iterate through all routes in the app
    for route in app.routes:
        methods = route.methods if hasattr(route, "methods") else set()
        path = getattr(route, "path", None)
        if not path or path.startswith("/api/docs") or path.startswith("/api/redoc"):
            continue
            
        if "GET" in methods:
            # fill in path params with dummy uuid or 1
            test_path = path.replace("{tenant_id}", "00000000-0000-0000-0000-000000000001")
            test_path = test_path.replace("{slug}", "demo")
            test_path = test_path.replace("{id}", "00000000-0000-0000-0000-000000000001")
            
            try:
                r = client.get(test_path)
                print(f"GET {test_path} -> {r.status_code}")
                if r.status_code == 500:
                    print("  -> ERROR:", r.text)
            except Exception as e:
                print(f"GET {test_path} -> Exception: {e}")

if __name__ == "__main__":
    test_all()
