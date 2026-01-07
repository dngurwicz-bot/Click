# הוראות Port Forwarding ב-Cursor

## הבעיה
אם אתה מקבל "This site can't be reached" או "ERR_CONNECTION_REFUSED", זה אומר שצריך להגדיר Port Forwarding ב-Cursor.

## פתרון

### שלב 1: פתח את ה-Ports Panel
1. לחץ על הכרטיסייה **"PORTS"** בתחתית המסך ב-Cursor
   - או לחץ על `Ctrl+Shift+P` (או `Cmd+Shift+P` ב-Mac) וחפש "Ports: Focus on Ports View"

### שלב 2: הוסף את הפורטים
1. לחץ על כפתור **"Add Port"** או **"+"**
2. הוסף את הפורטים הבאים:
   - **3000** - Frontend (Next.js)
   - **8000** - Backend (FastAPI)

### שלב 3: Forward את הפורטים
1. לחץ על האייקון של **"Forward"** או **"Open in Browser"** ליד כל פורט
2. או לחץ ימני על הפורט ובחר **"Open in Browser"**

### שלב 4: גש לאתרים
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

## בדיקה מהירה

אם השרתים רצים, תראה אותם ב-Ports Panel עם סטטוס "Forwarded".

## פתרון חלופי

אם Port Forwarding לא עובד, נסה:
1. גש ישירות דרך ה-IP של השרת המרוחק (אם יש)
2. או השתמש ב-VSCode Remote SSH extension

## הערות

- השרתים רצים על `0.0.0.0` כך שהם נגישים מכל כתובת
- ודא שהפורטים לא חסומים ב-firewall
- אם אתה משתמש ב-VPN, ייתכן שצריך להגדיר אותו
