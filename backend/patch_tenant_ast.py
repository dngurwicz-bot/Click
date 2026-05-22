import os
import ast
import re

ROUTERS_DIR = r"c:\Click\backend\app\routers"
FILES_TO_PATCH = ["core.py", "billing.py", "billing_engine.py", "admin_users.py", "tenants.py"]

def get_endpoint_line_ranges(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        source = f.read()
    
    tree = ast.parse(source)
    ranges = []
    
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            is_endpoint = False
            for dec in node.decorator_list:
                if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                    if hasattr(dec.func.value, "id") and dec.func.value.id == "router":
                        is_endpoint = True
                        break
            if is_endpoint:
                ranges.append((node.lineno, node.end_lineno))
    return ranges

def patch_file(filename):
    filepath = os.path.join(ROUTERS_DIR, filename)
    ranges = get_endpoint_line_ranges(filepath)
    
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    content = "".join(lines)
    import_stmt = "from app.middleware.auth import require_tenant_id, get_enforced_tenant_id, CurrentUser"
    if "require_tenant_id" not in content:
        content = re.sub(
            r"from app\.middleware\.auth import (.*CurrentUser.*)",
            r"from app.middleware.auth import require_tenant_id, get_enforced_tenant_id, \1",
            content
        )
        if "require_tenant_id" not in content:
            content = content.replace("from app.middleware.auth import CurrentUser", import_stmt)
            
    if "Annotated" not in content:
        content = "from typing import Annotated\n" + content
            
    lines = content.splitlines(keepends=True)
    
    def in_range(lineno):
        return any(start <= lineno <= end for start, end in ranges)
        
    for i in range(len(lines)):
        lineno = i + 1
        if in_range(lineno):
            lines[i] = re.sub(r"tenant_id:\s*uuid\.UUID\s*,", r"tenant_id: Annotated[uuid.UUID, Depends(require_tenant_id)],", lines[i])
            lines[i] = re.sub(r"tenant_id:\s*uuid\.UUID\s*\|\s*None\s*=\s*None\s*,", r"tenant_id: Annotated[uuid.UUID, Depends(require_tenant_id)],", lines[i])
            if "tenant_id = body.tenant_id" in lines[i]:
                lines[i] = lines[i].replace("tenant_id = body.tenant_id", "tenant_id = get_enforced_tenant_id(body.tenant_id, user)")
            if "tenant_id = req.tenant_id" in lines[i]:
                lines[i] = lines[i].replace("tenant_id = req.tenant_id", "tenant_id = get_enforced_tenant_id(req.tenant_id, user)")
                
    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(lines)

for fname in FILES_TO_PATCH:
    print(f"Patching {fname}...")
    patch_file(fname)
