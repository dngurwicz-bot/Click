import sys
import io

# Fix UnicodeEncodeError on Windows when logging Hebrew/non-ASCII text
# SQLAlchemy echo logs can contain Hebrew strings (tenant names etc.)
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.middleware.audit import AuditMiddleware
from app.routers import auth, tenants, modules, core, admin_users, lookups, templates, audit, ai, insights, dynamic_reports
import app.models.admin_user_permission  # noqa: F401 – ensure model is registered
import app.models.saved_report_view      # noqa: F401 – ensure saved report model is registered

settings = get_settings()

if settings.BILLING_ENABLED:
    import app.models.billing  # noqa: F401 – ensure billing models are registered
    import app.models.billing_engine  # noqa: F401 – ensure billing engine models are registered
    from app.routers import billing, billing_engine

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
app.include_router(core.router)
app.include_router(admin_users.router)
app.include_router(lookups.router)
app.include_router(templates.router)
if settings.BILLING_ENABLED:
    app.include_router(billing.router)
    app.include_router(billing_engine.router)
app.include_router(audit.router)
app.include_router(ai.router)
app.include_router(insights.router)
app.include_router(dynamic_reports.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


import logging

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "code": getattr(exc, "code", "HTTP_ERROR")},
        )
    
    logging.exception("Unhandled error occurred:")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "code": "INTERNAL_ERROR"},
    )
