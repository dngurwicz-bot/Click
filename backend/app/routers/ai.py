from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from google import genai
from google.genai import types, errors
from app.config import get_settings
from sqlalchemy import select, func
from app.database import get_db, AsyncSessionLocal
from app.models import Module, ModulePrice, Tenant, TenantIdentity, TenantSubscription
from app.services.temporal import get_active
from typing import List, Any, Dict
import json

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])
settings = get_settings()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

# Extensive system prompt about the CLICK HR SaaS system
SYSTEM_PROMPT = """
You are Antigravity, an expert AI assistant integrated deeply into the CLICK HR SaaS platform.
You know everything about the system because you have access to real-time database tools.

Capabilities & Context:
1. System Name: CLICK HR SaaS Platform
2. Architecture: Frontend in Next.js, Backend in FastAPI.
3. Your Role:
   - You help system admins navigate and understand the platform.
   - You ALWAYS use your tools to provide accurate, real-time data when asked about:
     - Prices of modules or billing catalog.
     - Number of customers (tenants), their names, or details.
     - System statistics.
   - Speak in native-sounding Hebrew.
   - If a user asks "כמה פתרונות יש?" or "מה המחירים?", don't guess—use `get_modules_catalog`.
   - If a user asks "כמה לקוחות יש?", use `get_system_overview`.

Guidelines:
- Be precise. If a module has a base price and a per-seat price, mention both.
- If you search for a tenant and find multiple, ask for clarification.
- Be polite and professional.
"""

# --- Tool Functions for GenAI ---

async def get_modules_catalog() -> str:
    """Returns a list of all modules and their current active catalog prices (ILS)."""
    async with AsyncSessionLocal() as session:
        # Fetch all active modules
        stmt = select(Module).where(Module.is_active == True).order_by(Module.sort_order)
        result = await session.execute(stmt)
        modules = result.scalars().all()
        
        data = []
        for m in modules:
            # Get active price
            price = await get_active(session, ModulePrice, extra_filters={"module_slug": m.slug})
            data.append({
                "slug": m.slug,
                "name": m.name,
                "description": m.description,
                "base_price": float(price.base_price_ils) if price else 0.0,
                "per_seat": float(price.per_seat_ils) if price else 0.0,
                "setup_fee": float(price.setup_fee_ils) if price else 0.0,
                "included_seats": price.included_seats if price else 0
            })
        return json.dumps(data, ensure_ascii=False)

async def get_system_overview() -> str:
    """Returns total tenant count and list of recently joined organizations."""
    async with AsyncSessionLocal() as session:
        # Total count
        count_stmt = select(func.count(Tenant.tenant_id))
        count_res = await session.execute(count_stmt)
        total = count_res.scalar() or 0
        
        # Latest 5 identities
        latest_stmt = select(TenantIdentity).where(TenantIdentity.valid_to.is_(None)).order_by(TenantIdentity.created_at.desc()).limit(5)
        latest_res = await session.execute(latest_stmt)
        latest = latest_res.scalars().all()
        
        names = [f"{i.name_he} ({i.name_en or ''})" for i in latest]
        return json.dumps({"total_tenants": total, "recent_tenants": names}, ensure_ascii=False)

async def search_tenant(query: str) -> str:
    """Searches for a tenant by name (partial match). Returns ID and basic info."""
    async with AsyncSessionLocal() as session:
        stmt = select(TenantIdentity).where(
            (TenantIdentity.name_he.ilike(f"%{query}%")) | (TenantIdentity.name_en.ilike(f"%{query}%"))
        ).where(TenantIdentity.valid_to.is_(None)).limit(5)
        result = await session.execute(stmt)
        found = result.scalars().all()
        
        data = [{"tenant_id": str(f.tenant_id), "name": f.name_he, "tax_id": f.tax_id} for f in found]
        return json.dumps(data, ensure_ascii=False)

# Mapping for the loop
TOOLS_MAP = {
    "get_modules_catalog": get_modules_catalog,
    "get_system_overview": get_system_overview,
    "search_tenant": search_tenant,
}

# Declarations for the SDK
TOOLS_DECLARATIONS = [
    types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="get_modules_catalog",
                description="Returns a list of all modules and their current active catalog prices (ILS).",
            ),
            types.FunctionDeclaration(
                name="get_system_overview",
                description="Returns total tenant count and list of recently joined organizations.",
            ),
            types.FunctionDeclaration(
                name="search_tenant",
                description="Searches for a tenant by name (partial match).",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "query": types.Schema(type="STRING", description="The search term (name in Hebrew or English)"),
                    },
                    required=["query"],
                ),
            ),
        ]
    )
]

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured."
        )

    # Configure automatic retries for transient errors (like 429)
    retry_options = types.HttpRetryOptions(
        initial_delay=1.0,
        attempts=3,
        exp_base=2.0,
        max_delay=10.0,
        jitter=1.0,
        http_status_codes=[429, 500, 502, 503, 504]
    )
    http_options = types.HttpOptions(retry_options=retry_options)
    client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options=http_options)
    
    history = []
    # Truncate history to the last 10 messages to save tokens and stay within limits
    recent_messages = request.messages[-11:-1] if len(request.messages) > 1 else []
    for msg in recent_messages:
        history.append(
            types.Content(
                role="user" if msg.role == "user" else "model",
                parts=[types.Part.from_text(text=msg.content)]
            )
        )
        
    last_message = request.messages[-1].content if request.messages else ""
    all_contents = history + [
        types.Content(role="user", parts=[types.Part.from_text(text=last_message)])
    ]

    try:
        # Loop to handle multiple tool calls if needed
        max_turns = 5
        current_contents = all_contents
        
        for _ in range(max_turns):
            response = client.models.generate_content(
                model='gemini-flash-latest', # Using the verified stable alias for Flash
                contents=current_contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    tools=TOOLS_DECLARATIONS,
                    temperature=0.2, # Lower temp for more deterministic tool use
                )
            )
            
            # Check for function calls
            function_calls = [p.function_call for p in response.candidates[0].content.parts if p.function_call]
            
            if not function_calls:
                # Normal text response
                return {"content": response.text}
            
            # If we are here, we have function calls to execute
            # Add the model's turn (the function call itself) to history
            current_contents.append(response.candidates[0].content)
            
            tool_responses_parts = []
            for fc in function_calls:
                fn_name = fc.name
                fn_args = fc.args or {}
                
                if fn_name in TOOLS_MAP:
                    result = await TOOLS_MAP[fn_name](**fn_args)
                    tool_responses_parts.append(
                        types.Part.from_function_response(
                            name=fn_name,
                            response={"result": result}
                        )
                    )
                else:
                    tool_responses_parts.append(
                        types.Part.from_function_response(
                            name=fn_name,
                            response={"error": f"Tool {fn_name} not found"}
                        )
                    )
            
            # Add the tool responses as a new message in history
            current_contents.append(
                types.Content(role="tool", parts=tool_responses_parts)
            )
            # Loop continues to generate final answer using the tool result

        return {"content": "I apologize, but I reached my maximum reasoning steps. Please try rephrasing."}
        
    except errors.ClientError as e:
        if e.code == 429:
            # Specific handling for Rate Limit / Quota Exhaustion
            raise HTTPException(
                status_code=429,
                detail="יש עומס על שירות ה-AI כרגע (מכסת השימוש הגיעה למקסימום). אנא נסו שוב בעוד כמה דקות."
            )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="שגיאת שרת פנימית. אנא נסו שוב מאוחר יותר.")
