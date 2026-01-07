# הוראות הגדרת Supabase

## שלב 1: קבלת המפתחות מ-Supabase

1. פתח את ה-Supabase Dashboard:
   - https://supabase.com/dashboard/project/ighrmrvhtgihhsaztmma/settings/api
   - או עבור ל: Settings → API

2. מצא את הערכים הבאים:
   - **Project URL** - זה ה-URL של הפרויקט שלך
   - **anon public** key - זה המפתח שצריך ל-`.env.local`

## שלב 2: עדכון קובץ .env.local

ערוך את הקובץ `FRONTEND/.env.local` והחלף את הערכים:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ighrmrvhtgihhsaztmma.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=המפתח_האמיתי_שלך_כאן
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**חשוב:**
- המפתח `anon public` צריך להיות ארוך (כ-200 תווים)
- ודא שאין רווחים או שורות נוספות
- המפתח צריך להתחיל עם `eyJ...` (JWT token)

## שלב 3: הפעלה מחדש של השרת

לאחר עדכון הקובץ, השרת צריך להיטען מחדש אוטומטית. אם לא:
1. עצור את השרת (Ctrl+C)
2. הרץ מחדש: `npm run dev`

## בדיקת תקינות

אם עדיין יש שגיאה:
1. ודא שהמפתח הועתק במלואו (ללא חיתוך)
2. ודא שאין רווחים מיותרים
3. ודא שה-URL נכון
4. נסה להעתיק את המפתח שוב מ-Supabase Dashboard
