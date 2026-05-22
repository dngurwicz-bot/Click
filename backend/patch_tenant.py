import os
import re

ROUTERS_DIR = r"c:\Click\backend\app\routers"
FILES_TO_PATCH = ["core.py", "billing.py", "billing_engine.py", "admin_users.py", "tenants.py"]

def patch_file(filename):
    filepath = os.path.join(ROUTERS_DIR, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Add import if missing
    import_stmt = "from app.middleware.auth import require_tenant_id, get_enforced_tenant_id, CurrentUser"
    if "require_tenant_id" not in content:
        # try to replace existing auth import
        content = re.sub(
            r"from app\.middleware\.auth import (.*CurrentUser.*)",
            r"from app.middleware.auth import require_tenant_id, get_enforced_tenant_id, \1",
            content
        )
        if "require_tenant_id" not in content:
            # fallback
            content = content.replace("from app.middleware.auth import CurrentUser", import_stmt)

    # Patch dependency in def signature
    content = re.sub(r"tenant_id:\s*uuid\.UUID\s*,", r"tenant_id: uuid.UUID = Depends(require_tenant_id),", content)
    content = re.sub(r"tenant_id:\s*uuid\.UUID\s*\|\s*None\s*=\s*None\s*,", r"tenant_id: uuid.UUID = Depends(require_tenant_id),", content)
    
    # Also patch specific manual body logic if present (e.g. in core.py)
    content = content.replace("tenant_id = body.tenant_id", "tenant_id = get_enforced_tenant_id(body.tenant_id, user)")
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

for fname in FILES_TO_PATCH:
    print(f"Patching {fname}...")
    patch_file(fname)
