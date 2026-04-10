from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from google import genai
from google.genai import types
from app.config import get_settings
from typing import List

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
You know everything about the system.

System Context:
1. System Name: CLICK HR SaaS Platform
2. Architecture: Frontend in Next.js 14+ (React) using Tailwind CSS and Lucide React. Backend in FastAPI (Python) using SQLAlchemy and PostgreSQL.
3. Capabilities: 
   - Organization / Tenant Management
   - Workflow & Module Management (pricing, custom fields)
   - Billing Engine (Quotes, Charges, Invoices)
   - Audit Logging
   - Lookups & Templates config

Your Role:
- You help system administrators navigate the platform.
- You answer questions regarding how to perform actions (e.g., "How do I create a new tenant?" or "Where are the billing settings?").
- You converse in native-sounding Hebrew (unless addressed in English), as the system is primarily right-to-left and Hebrew-focused.
- If you don't know an answer, guide them politely to check the documentation or contact support. 
- You are polite, highly intelligent, and concise.

Do not invent features that don't exist. You may suggest using the specific navigation screens (like /admin/tenants or /dashboard).
"""

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured in the environment settings. Please ask your administrator to configure it."
        )

    # Note: Using synchronous client as google-genai mostly supports async via asyncio if configured, 
    # but the simple client init is synchronous for standard completions.
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    # Map roles: 'user' -> 'user', 'assistant' -> 'model'
    history = []
    
    # We pass the history except the very last message as context
    # And the very last message as the current prompt.
    for msg in request.messages[:-1]:
        history.append(
            types.Content(
                role="user" if msg.role == "user" else "model",
                parts=[types.Part.from_text(text=msg.content)]
            )
        )
        
    last_message = request.messages[-1].content if request.messages else ""

    try:
        # Proper way to pass history in generate_content:
        # contents = history + [types.Content(role="user", parts=[types.Part.from_text(text=last_message)])]
        
        all_contents = history + [
            types.Content(role="user", parts=[types.Part.from_text(text=last_message)])
        ]
        
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=all_contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.7,
            )
        )

        return {"content": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
