# CLICK — HR SaaS Platform

## Stack
- **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.0 (async) + asyncpg
- **DB:** PostgreSQL via Supabase
- **Auth:** Supabase Auth + server-issued HttpOnly session cookie
- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS

---

## Quick Start

### 1. Environment
```bash
cp .env.example .env
# Edit the root .env with your backend and Docker credentials
cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local for Next.js public variables
```

`C:\Click\.env` is the canonical local config for the backend and `docker-compose`.
`backend/.env` is only a compatibility fallback for local tooling and should not be treated as the source of truth.

### 2. Database (Docker)
```bash
docker-compose up postgres -d
```

### 3. Backend
```bash
cd backend
uv pip install -e .
alembic upgrade head        # runs migrations + seed
uvicorn app.main:app --reload
# → http://localhost:8000/api/docs
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Project Structure

```
click/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app + middleware
│   │   ├── config.py         # Settings from env
│   │   ├── database.py       # Async SQLAlchemy engine
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic I/O schemas
│   │   ├── routers/          # API route handlers
│   │   ├── services/
│   │   │   └── temporal.py   # close_and_create logic
│   │   └── middleware/
│   │       ├── auth.py       # JWT validation
│   │       └── audit.py      # Auto audit logging
│   └── alembic/              # DB migrations
└── frontend/
    ├── app/                  # Next.js App Router pages
    ├── components/layout/    # TopNav, AdminMenu
    └── lib/                  # API client, Supabase client
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login, sets HttpOnly session cookie |
| POST | `/api/auth/logout` | any | Clear current session cookie |
| GET  | `/api/auth/me` | any | Current user info |
| GET  | `/api/admin/tenants` | admin+ | List all tenants |
| POST | `/api/admin/tenants` | admin+ | Create tenant (all sub-tables) |
| GET  | `/api/admin/tenants/{id}` | admin+ | Tenant detail |
| PUT  | `/api/admin/tenants/{id}` | admin+ | Update (temporal) |
| GET  | `/api/admin/tenants/{id}/history` | admin+ | Full temporal history |
| GET  | `/api/admin/modules` | super_admin | List modules + prices |
| PUT  | `/api/admin/modules/{slug}/price` | super_admin | Update price (temporal) |
| GET  | `/api/admin/users` | super_admin | List admin users |
| POST | `/api/admin/users` | super_admin | Create admin user |
| PUT  | `/api/admin/users/{id}` | super_admin | Update admin user |

---

## Temporal Data Pattern

Every mutable entity uses append-only history:
- `valid_from DATE NOT NULL` — when this version became active
- `valid_to DATE NULL` — NULL means currently active
- Updating = close current row (`valid_to = today-1`) + insert new row (`valid_from = today`)

See `backend/app/services/temporal.py` → `close_and_create()`.
