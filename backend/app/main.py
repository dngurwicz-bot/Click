from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.middleware.audit import AuditMiddleware
from app.routers import auth, tenants, modules, admin_users, lookups, templates, billing, billing_engine, audit
import app.models.admin_user_permission  # noqa: F401 – ensure model is registered
import app.models.billing                # noqa: F401 – ensure billing models are registered
import app.models.billing_engine         # noqa: F401 – ensure billing engine models are registered

settings = get_settings()

app = FastAPI(
    title="CLICK HR SaaS API",
    version="0.1.0",
    docs_url="/api/docs" if settings.APP_ENV == "development" else None,
    redoc_url="/api/redoc" if settings.APP_ENV == "development" else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Audit middleware (runs after auth so request.state.user_id is available)
app.add_middleware(AuditMiddleware)

# Routers
app.include_router(auth.router)
app.include_router(tenants.router)
app.include_router(modules.router)
app.include_router(admin_users.router)
app.include_router(lookups.router)
app.include_router(templates.router)
app.include_router(billing.router)
app.include_router(billing_engine.router)
app.include_router(audit.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "code": "INTERNAL_ERROR"},
    )
