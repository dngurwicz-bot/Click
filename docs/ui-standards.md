# UI Standards

## Dashboard Screens

- מקור האמת למסכים שניתנים להצגה בדשבורד ובתפריטי הקליק הימני הוא `frontend/lib/dashboardScreens.ts`.
- כל מסך חדש שנוסף למערכת חייב לקבל שם:
  - `id` יציב
  - `href`
  - `label`
  - `shortDescription`
  - `fullDescription`
  - `navGroup`
- אם המסך הוא חלק מ-`CLICK Insights`, לא פותחים עבורו טאב עליון נפרד אלא משייכים אותו ל-`module:insights`.
- אם מסך לא אמור להופיע ככרטיס בדשבורד, יש להגדיר `pinToDashboard: false`.

## F1 Field Help

- `F1` הוא מנגנון עזרה גלובלי, ומחובר דרך `frontend/components/ui/FieldHelpPopup.tsx`.
- כל שדה חדש חייב להיות ניתן לזיהוי דרך אחד מהבאים:
  - `data-field-label`
  - `aria-label`
  - `<label>` ברור ויציב
- לכל שדה עסקי חדש חייב להיות הסבר ב-`frontend/lib/fieldHelpData.ts`.
- ההסבר חייב לכלול:
  - `description`
  - `example` כשיש ערך צפוי/פורמט
  - `affects` כדי להסביר מה השדה משפיע במערכת

## Verification

- לפני סיום עבודה על טופס או מסך ניהולי, יש להריץ:

```bash
npm run audit:field-help
```

- הסקריפט בודק שדות שזוהו דרך `label`, `aria-label` או `data-field-label` ומתריע על שדות בלי מיפוי עזרה.
