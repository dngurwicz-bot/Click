# Click HR Backend API

Backend API בפייתון עם FastAPI עבור מערכת Click HR.

## התקנה

1. התקן את התלויות:
```bash
pip install -r requirements.txt
```

2. צור קובץ `.env` מהדוגמה:
```bash
cp .env.example .env
```

3. עדכן את קובץ `.env` עם הערכים הנכונים:
```env
SUPABASE_URL=https://ighrmrvhtgihhsaztmma.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
PORT=8000
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## הרצה

הרץ את השרת:
```bash
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

או:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

השרת יעבוד על: `http://localhost:8000`

## API Endpoints

### Health Check
- `GET /` - הודעת ברוכים הבאים
- `GET /health` - בדיקת סטטוס השרת

### Organizations
- `GET /api/organizations` - קבלת כל הארגונים
- `GET /api/organizations/{org_id}` - קבלת ארגון ספציפי
- `POST /api/organizations` - יצירת ארגון חדש (super_admin בלבד)
- `PUT /api/organizations/{org_id}` - עדכון ארגון (super_admin בלבד)
- `DELETE /api/organizations/{org_id}` - מחיקת ארגון (super_admin בלבד)

## Authentication

כל ה-endpoints דורשים JWT token ב-Authorization header:
```
Authorization: Bearer <token>
```

הטוקן מתקבל מ-Supabase Auth לאחר התחברות.

## הרשאות

- **super_admin** - יכול לראות ולנהל את כל הארגונים
- **admin** - יכול לראות ולנהל את הארגון שלו
- **user** - יכול לראות את הארגון שלו

## טכנולוגיות

- **FastAPI** - Web framework
- **Uvicorn** - ASGI server
- **Supabase** - Database & Auth
- **Pydantic** - Data validation
- **Python-dotenv** - Environment variables

## מבנה הקבצים

```
backend/
├── main.py              # קובץ ה-API הראשי
├── requirements.txt      # תלויות Python
├── .env.example         # דוגמה לקובץ משתני סביבה
├── .env                 # משתני סביבה (לא נשמר ב-git)
└── README.md            # קובץ זה
```
