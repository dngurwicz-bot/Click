# Backend - Click HR

Backend API for Click HR system using FastAPI and Supabase.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=8000
```

3. Run the server:
```bash
uvicorn main:app --reload --port 8000
```

## API Endpoints

- `GET /api/organizations` - Get all organizations
- `POST /api/organizations` - Create organization
- `PUT /api/organizations/{id}` - Update organization
- `DELETE /api/organizations/{id}` - Delete organization
- `GET /api/employees` - Get all employees
- `GET /api/employees/{id}` - Get employee by ID
- `GET /api/employees/{id}/events` - Get employee events
- `GET /api/employees/{id}/events/{event_type}` - Get specific event data
- `PUT /api/employees/{id}/events/{event_type}` - Update event data
