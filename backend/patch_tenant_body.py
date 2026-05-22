import os
import ast
import re

ROUTERS_DIR = r"c:\Click\backend\app\routers"
FILES_TO_PATCH = ["core.py", "billing.py", "billing_engine.py", "admin_users.py", "tenants.py"]

def get_endpoint_info(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        source = f.read()
    
    tree = ast.parse(source)
    endpoints = []
    
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            is_endpoint = False
            for dec in node.decorator_list:
                if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                    if hasattr(dec.func.value, "id") and dec.func.value.id == "router":
                        is_endpoint = True
                        break
            if is_endpoint:
                has_tenant_id_arg = any(arg.arg == "tenant_id" for arg in node.args.args)
                has_body_arg = any(arg.arg == "body" for arg in node.args.args)
                
                user_arg_name = None
                for arg in node.args.args:
                    if arg.annotation and isinstance(arg.annotation, ast.Name) and arg.annotation.id == "CurrentUser":
                        user_arg_name = arg.arg
                        break
                
                if not user_arg_name:
                    for arg in node.args.args:
                        if arg.arg in ("user", "current_user"):
                            user_arg_name = arg.arg
                            break
                            
                if user_arg_name and (has_tenant_id_arg or has_body_arg):
                    first_stmt_line = node.body[0].lineno
                    endpoints.append({
                        "line": first_stmt_line,
                        "has_tenant_id": has_tenant_id_arg,
                        "has_body": has_body_arg,
                        "user_var": user_arg_name,
                        "end_line": node.end_lineno
                    })
    return endpoints

def patch_file(filename):
    filepath = os.path.join(ROUTERS_DIR, filename)
    endpoints = get_endpoint_info(filepath)
    if not endpoints:
        return
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    if "get_enforced_tenant_id" not in content:
        content = re.sub(
            r"from app\.middleware\.auth import (.*CurrentUser.*)",
            r"from app.middleware.auth import get_enforced_tenant_id, \1",
            content
        )
        
    lines = content.splitlines(keepends=True)
    endpoints.sort(key=lambda x: x["line"], reverse=True)
    
    for ep in endpoints:
        idx = ep["line"] - 1
        indent_match = re.match(r"^(\s*)", lines[idx])
        indent = indent_match.group(1) if indent_match else "    "
        
        insertions = []
        if ep["has_tenant_id"]:
            if "get_enforced_tenant_id" not in "".join(lines[idx:idx+3]):
                insertions.append(f"{indent}tenant_id = get_enforced_tenant_id(tenant_id, {ep['user_var']})\n")
        
        if ep["has_body"]:
            func_text = "".join(lines[idx:ep["end_line"]])
            if "body.tenant_id" in func_text and "get_enforced_tenant_id(body.tenant_id" not in func_text:
                insertions.append(f"{indent}body.tenant_id = get_enforced_tenant_id(body.tenant_id, {ep['user_var']})\n")
                
        for ins in insertions:
            lines.insert(idx, ins)
            
    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(lines)

for fname in FILES_TO_PATCH:
    print(f"Patching {fname}...")
    patch_file(fname)
