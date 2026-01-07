# Click HR - מערכת SAAS לניהול משאבי אנוש

מערכת SAAS רב-ארגונית לניהול משאבי אנוש עם הפרדה מלאה בין ארגונים.

## מבנה הפרויקט

```
Click/
├── BACKEND/          # FastAPI Backend
│   ├── main.py       # Main API file
│   ├── requirements.txt
│   └── scripts/      # Database scripts
│
├── FRONTEND/         # Next.js Frontend
│   ├── app/          # Pages and routes
│   ├── components/   # React components
│   ├── lib/          # Utilities and API client
│   └── package.json
│
└── README.md
```

## תכונות עיקריות

### מודול CLICK CORE (חובה לכל ארגון)

- **תיק עובד חכם**: פרופיל 360 עם פרטים אישיים, פרטי בנק ומשפחה
- **מערכת אירועים**: כל שינוי הוא אירוע עם היסטוריה מלאה
- **ציר זמן היסטורי**: תיעוד מלא של שינויי תפקיד, שכר ומחלקות
- **מבנה ארגוני**: ניהול היררכיה, כפיפויות, אגפים ומחלקות

## טכנולוגיות

### Frontend
- **Next.js 14** - Framework עם App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - עיצוב
- **Supabase** - מסד נתונים ואימות

### Backend
- **FastAPI** - Python web framework
- **Supabase** - Database backend
- **Python 3.9+** - Runtime

## התקנה

### Backend

1. עבור לתיקיית backend:
```bash
cd BACKEND
```

2. התקן את התלויות:
```bash
pip install -r requirements.txt
```

3. צור קובץ `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=8000
```

4. הרץ את השרת:
```bash
uvicorn main:app --reload --port 8000
```

### Frontend

1. עבור לתיקיית frontend:
```bash
cd FRONTEND
```

2. התקן את התלויות:
```bash
npm install
```

3. צור קובץ `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
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
cd BACKEND
uvicorn main:app --reload --port 8000
```

2. **הרץ את ה-frontend** (בטרמינל שני):
```bash
cd FRONTEND
npm run dev
```

3. פתח בדפדפן: `http://localhost:3000`

## מבנה מסד הנתונים

### טבלאות עיקריות:

- **organizations** - ארגונים
- **users** - משתמשים (מחוברים ל-Supabase Auth)
- **organization_modules** - מודולים שכל ארגון קנה
- **employees** - עובדים
- **events** - אירועים (שם פרטי, שם משפחה, כתובת, מייל וכו')
- **event_history** - היסטוריה של כל אירוע
- **event_types** - סוגי אירועים
- **departments** - מחלקות
- **positions** - תפקידים

## אבטחה

המערכת משתמשת ב-Row Level Security (RLS) של Supabase כדי להבטיח:
- כל ארגון רואה רק את הנתונים שלו
- Super Admin יכול לראות את כל הארגונים
- כל שינוי מוגבל לארגון של המשתמש

## מערכת אירועים

כל נתון בעובד הוא אירוע עם היסטוריה:
- שם פרטי ושם משפחה - אירועים
- כתובת - אירוע
- מייל - אירוע
- שכר - אירוע
- תפקיד - אירוע
- וכו'

כל שינוי יוצר רשומה חדשה ב-`event_history` עם:
- הערך החדש
- תאריך התחלה (`valid_from`)
- תאריך סיום (`valid_to`) - NULL אם זה הערך הנוכחי

## הרשאות

- **super_admin** - יכול לראות ולנהל את כל הארגונים
- **admin** - יכול לנהל את הארגון שלו
- **user** - יכול לראות ולערוך נתונים בארגון שלו

## פיתוח

המערכת בנויה במודולריות, כך שניתן להוסיף מודולים נוספים בעתיד:
- Payroll
- Attendance
- Performance
- וכו'

כל מודול נשלט דרך `organization_modules` וניתן להפעיל/לכבות אותו לכל ארגון בנפרד.
