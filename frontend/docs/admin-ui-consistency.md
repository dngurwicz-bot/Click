# Admin UI Consistency Contract

מסמך זה הוא ה-source of truth לכל מסכי ה-admin שבהם יש מודאלי עריכה, מודאלי טופס, או רשומות טמפורליות.

## Canonical Components

- להשתמש ב-[AdminModal.tsx](/C:/Click/frontend/components/ui/AdminModal.tsx) לכל shell של modal:
  `AdminModal`, `AdminModalPanel`, `AdminModalHeader`, `AdminModalBody`, `AdminModalFooter`, `AdminField`, `AdminDateFields`, `AdminModalMessage`.
- להשתמש ב-[SplitActionButton.tsx](/C:/Click/frontend/components/ui/SplitActionButton.tsx) לכל מצב `update` של רשומה טמפורלית.
- אין לכתוב header/footer/button styles מקומיים אם יש equivalent ב־`AdminModal.tsx`.

## Visual Rules

- header תמיד `bg-[#dce4f0]` עם כותרת כהה `text-[#1a3a6e]`.
- panel תמיד `rounded-2xl`, `border-slate-200`, `shadow-2xl`.
- footer תמיד `bg-slate-50`, border-top, וכפתורים מיושרים לימין.
- שדות טקסט, select, textarea ותאריכים משתמשים ב־`ADMIN_MODAL_INPUT`, `ADMIN_MODAL_TEXTAREA`, `ADMIN_MODAL_DATE_INPUT`.
- הודעות error/warning/info מוצגות דרך `AdminModalMessage` מעל ה־footer.
- תאריכים ממוקמים בתחתית הטופס דרך `AdminDateFields`, אלא אם זה modal ייעודי ל־`close` שבו מוצג רק `valid_to`.

## Temporal Action Rules

לכל ישות טמפורלית יש להשתמש באותה היררכיית מצבים אם ה־backend תומך בכך:

- `update`:
  primary = `שמור`
  split actions = `רשומה חדשה`, `שמור`, `קבע תקופה`, `סגור תקופה`, `מחק/בטל רשומה`
- `add`:
  footer ייעודי עם `ביטול` + action ראשי `הוסף רשומה`
- `set`:
  footer ייעודי עם `ביטול/חזרה` + action אזהרה `קבע תקופה`
  חובה להציג warning שמסביר שזו פעולה שמחליפה/מפצלת/מסירה רשומות חופפות
- `close`:
  footer ייעודי עם `ביטול/חזרה` + action אזהרה `סגור תקופה`
  חובה להציג רקע/הודעת warning שמסבירה שהרשומה נשארת בהיסטוריה
- `delete`:
  footer ייעודי עם `ביטול/חזרה` + action danger `מחק/בטל רשומה`
  חובה להציג warning על פעולה בלתי הפיכה

אם ה־backend של ישות מסוימת לא תומך ב־`set`, אין להציג `קבע תקופה` עד שהתמיכה מתווספת גם ב־schema/router/service.

## Scope

הכללים חלים לפחות על:

- `frontend/app/admin/users`
- `frontend/app/admin/templates`
- `frontend/app/admin/modules`
- `frontend/app/admin/tenants/[id]`
- `frontend/app/admin/tenants/new`
- `frontend/app/admin/core`
- `frontend/app/admin/core/structure`
- `frontend/app/admin/lookups`
- `frontend/app/admin/billing`
- `frontend/components/tenants`

## Layout Rules

- בטפסים רגילים להשתמש ב־2 עמודות כשאפשר.
- אזורי מדיה כמו לוגו/תמונה לא "צפים"; הם צריכים span ברור בתוך ה־grid.
- field labels, spacing, border radius, button heights ו־date pickers צריכים להיות זהים בין מודאלים מקבילים.
- אין לשים כפתורי מצב בחלק העליון של המודאל אם אפשר לייצג אותם דרך footer/split action.

## Verification Checklist

לפני סיום שינוי ב־admin UI:

1. לחפש מודאלים/כרטיסיות מקבילים ולוודא שהשינוי לא השאיר חריגים.
2. לבדוק האם הישות טמפורלית, ואם כן לוודא שכל ה־actions הרלוונטיים קיימים גם ב־UI וגם ב־backend.
3. להריץ `npm run build` מתוך `C:\Click\frontend`.
4. אם יש שינוי משמעותי ב־UI, לבצע smoke check בדפדפן למסך עצמו ולוודא:
   header עקבי
   footer עקבי
   split button עקבי
   תאריכים באותו מיקום
   warning/error states תקינים
5. לציין במפורש מה אומת ומה לא אומת.
