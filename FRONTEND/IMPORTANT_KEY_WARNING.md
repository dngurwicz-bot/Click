# ⚠️ אזהרה חשובה - סוגי מפתחות Supabase

## המפתח שנתת הוא service_role key - זה לא נכון!

### ❌ service_role key (זה מה שנתת):
- **מסוכן מאוד!** נותן הרשאות מלאות למסד הנתונים
- **אסור להשתמש בו בצד הלקוח** (client-side)
- אם יגיע לידיים לא נכונות, יכול להרוס את כל המסד נתונים
- משמש רק ל-backend עם אבטחה מלאה

### ✅ anon public key (זה מה שאתה צריך):
- **בטוח לשימוש בצד הלקוח**
- הרשאות מוגבלות (מוגבל על ידי Row Level Security)
- זה המפתח שצריך להיות ב-`.env.local`

## איך למצוא את ה-anon public key:

1. **פתח את Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/ighrmrvhtgihhsaztmma/settings/api
   ```

2. **מצא את ה-"anon public" key:**
   - זה המפתח שמופיע תחת "Project API keys"
   - **לא** ה-"service_role" key!
   - המפתח מתחיל ב-`eyJ` (כמו service_role, אבל עם role: "anon")
   - ארוך מאוד (כ-200 תווים)

3. **העתק את ה-anon public key**

4. **עדכן את `.env.local`:**
   ```env
   NEXT_PUBLIC_SUPABASE_ANON_KEY=המפתח_anon_public_כאן
   ```

## איך לזהות את ההבדל:

**service_role key** (זה מה שנתת):
- ב-JWT payload: `"role":"service_role"`
- מסוכן!

**anon public key** (זה מה שאתה צריך):
- ב-JWT payload: `"role":"anon"`
- בטוח!

## חשוב:
- **אל תשתמש ב-service_role key ב-frontend!**
- זה יכול לחשוף את כל המסד נתונים שלך
- השתמש רק ב-anon public key
