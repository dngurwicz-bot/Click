# הוראות הפעלה - Click HR

## התקנה ראשונית

### Backend (Python)

1. עבור לתיקיית backend:
```bash
cd backend
```

2. התקן את התלויות:
```bash
pip install -r requirements.txt
```

3. צור קובץ `.env` (אם עדיין לא קיים):
```bash
# העתק את הערכים מ-.env.example או צור חדש
SUPABASE_URL=https://ighrmrvhtgihhsaztmma.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=8000
```

4. הרץ את השרת:
```bash
uvicorn main:app --reload --port 8000
```

השרת יעבוד על: `http://localhost:8000`

### Frontend (Next.js)

1. עבור לתיקיית frontend:
```bash
cd frontend
```

2. התקן את התלויות:
```bash
npm install
```

3. ודא שקובץ `.env.local` קיים ומכיל:
```env
NEXT_PUBLIC_SUPABASE_URL=https://ighrmrvhtgihhsaztmma.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

4. הרץ את השרת:
```bash
npm run dev
```

האפליקציה תהיה זמינה ב: `http://localhost:3000`

## הרצה

1. **הרץ את ה-backend תחילה** (בטרמינל אחד):
```bash
cd backend
uvicorn main:app --reload --port 8000
```

2. **הרץ את ה-frontend** (בטרמינל שני):
```bash
cd frontend
npm run dev
```

3. פתח בדפדפן: `http://localhost:3000`

## מבנה הפרויקט

```
Click/
├── frontend/          # Next.js application
│   ├── app/          # Pages and routes
│   ├── components/   # React components
│   ├── lib/          # Utilities and API client
│   └── .env.local    # Environment variables
│
├── backend/           # FastAPI application
│   ├── main.py       # Main API file
│   ├── scripts/      # Database scripts
│   ├── supabase/     # Database schema
│   └── .env          # Environment variables
│
└── README.md         # Documentation
```

## הערות

- ה-backend משתמש ב-Service Role Key של Supabase (להרשאות מלאות)
- ה-frontend משתמש ב-Anon Key של Supabase (להרשאות מוגבלות)
- כל הבקשות מה-frontend ל-backend דורשות JWT token מהתחברות Supabase
