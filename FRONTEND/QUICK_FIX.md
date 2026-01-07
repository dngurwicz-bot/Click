# 🔧 תיקון מהיר - Invalid API key

## הבעיה:
המפתח ב-`.env.local` עדיין לא עודכן עם המפתח האמיתי מ-Supabase.

## פתרון מהיר:

### אופציה 1: עדכון ידני

1. **פתח את Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/ighrmrvhtgihhsaztmma/settings/api
   ```

2. **מצא את ה-"anon public" key:**
   - זה המפתח שמופיע תחת "Project API keys"
   - **לא** ה-"service_role" key (זה סודי!)

3. **ערוך את הקובץ:**
   ```bash
   cd FRONTEND
   nano .env.local
   # או
   code .env.local
   ```

4. **החלף את השורה:**
   ```env
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   
   ב:
   ```env
   NEXT_PUBLIC_SUPABASE_ANON_KEY=המפתח_האמיתי_שלך_כאן
   ```

5. **שמור וסגור**

6. **הפעל מחדש את השרת:**
   ```bash
   npm run dev
   ```

### אופציה 2: שימוש בסקריפט

```bash
cd FRONTEND
./update-env.sh
```

הסקריפט יבקש ממך להדביק את המפתח.

## איך לזהות את המפתח הנכון:

✅ **המפתח הנכון:**
- מתחיל ב-`eyJ`
- ארוך מאוד (כ-200 תווים)
- נמצא תחת "anon public" או "public anon"
- בטוח לשימוש בצד הלקוח

❌ **לא המפתח הזה:**
- `service_role` key (זה סודי!)
- מפתח קצר
- מפתח שלא מתחיל ב-`eyJ`

## בדיקה:

לאחר העדכון, הרץ:
```bash
node check-env.js
```

אם הכל תקין, תראה:
```
✅ המפתח נראה תקין!
```

## אם עדיין לא עובד:

1. ודא שהשרת הופעל מחדש
2. נסה למחוק את ה-cache: `rm -rf .next`
3. הרץ מחדש: `npm run dev`
