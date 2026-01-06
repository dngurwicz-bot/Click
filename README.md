# Click HR - מערכת SAAS לניהול משאבי אנוש

מערכת SAAS רב-ארגונית לניהול משאבי אנוש עם הפרדה מלאה בין ארגונים.

## תכונות עיקריות

### מודול CLICK CORE (חובה לכל ארגון)

- **תיק עובד חכם**: פרופיל 360 עם פרטים אישיים, פרטי בנק ומשפחה
- **מערכת אירועים**: כל שינוי הוא אירוע עם היסטוריה מלאה
- **ציר זמן היסטורי**: תיעוד מלא של שינויי תפקיד, שכר ומחלקות
- **מבנה ארגוני**: ניהול היררכיה, כפיפויות, אגפים ומחלקות

## טכנולוגיות

- **Next.js 14** - Framework עם App Router
- **TypeScript** - Type safety
- **Supabase** - מסד נתונים ואימות
- **Tailwind CSS** - עיצוב
- **Row Level Security (RLS)** - הפרדה מלאה בין ארגונים

## התקנה

1. התקן dependencies:
```bash
npm install
```

2. הגדר משתני סביבה:
```bash
cp .env.example .env
```

ערוך את `.env` והוסף את פרטי Supabase שלך:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

3. הפעל את סכמת מסד הנתונים:
- פתח את Supabase Dashboard
- עבור ל-SQL Editor
- העתק והפעל את התוכן מ-`supabase/schema.sql`
- **חשוב**: ודא ש-Row Level Security (RLS) מופעל על כל הטבלאות

4. צור משתמש ראשון:
- פתח את Supabase Dashboard
- עבור ל-Authentication > Users
- צור משתמש חדש
- לאחר מכן, הפעל את השאילתה הבאה ב-SQL Editor כדי לקשר את המשתמש לארגון:
```sql
-- צור ארגון ראשון
INSERT INTO organizations (name) VALUES ('ארגון ראשון');

-- קשר את המשתמש לארגון (החלף את USER_ID ב-ID של המשתמש שיצרת)
INSERT INTO users (id, organization_id, email, role)
VALUES (
  'USER_ID', -- החלף ב-ID של המשתמש מ-Auth
  (SELECT id FROM organizations WHERE name = 'ארגון ראשון' LIMIT 1),
  'your-email@example.com', -- החלף באימייל של המשתמש
  'super_admin' -- או 'admin' או 'user'
);
```

5. הפעל את השרת:
```bash
npm run dev
```

6. התחבר למערכת:
- פתח את הדפדפן בכתובת `http://localhost:3000`
- התחבר עם האימייל והסיסמה שיצרת ב-Supabase

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
