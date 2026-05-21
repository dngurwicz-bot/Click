"""Seed core lookup lists that were previously hardcoded in the frontend.

Runs on startup; each list is created only if its list_key doesn't exist yet,
so existing data is never overwritten.
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.lookup import LookupList, LookupItem


# Each entry: (list_key, name_he, description, items)
# items: list of (item_key, label_he, code, sort_order)
_CORE_LOOKUPS: list[tuple[str, str, str, list[tuple[str, str, str, int]]]] = [
    (
        "gender",
        "מגדר",
        "מין העובד",
        [
            ("M", "זכר",   "M", 0),
            ("F", "נקבה",  "F", 1),
        ],
    ),
    (
        "marital_status",
        "מצב משפחתי",
        "המצב המשפחתי של העובד",
        [
            ("single",   "רווק/ה",       "1", 0),
            ("married",  "נשוי/נשואה",   "2", 1),
            ("divorced", "גרוש/ה",        "3", 2),
            ("widowed",  "אלמן/ה",        "4", 3),
        ],
    ),
    (
        "employment_type",
        "סוג העסקה",
        "אופן ההעסקה של העובד",
        [
            ("employee",   "עובד",     "1", 0),
            ("contractor", "קבלן",     "2", 1),
            ("temporary",  "זמני",     "3", 2),
            ("intern",     "מתמחה",    "4", 3),
            ("consultant", "יועץ",     "5", 4),
        ],
    ),
    (
        "employment_status",
        "סטטוס העסקה",
        "מצב ההעסקה הנוכחי של העובד",
        [
            ("active",           "פעיל",      "1", 0),
            ("leave_of_absence", "חופשה",     "2", 1),
            ("unpaid_leave",     'חל"ת',      "3", 2),
            ("terminated",       "סיום",      "4", 3),
            ("future",           "עתידי",     "5", 4),
            ("suspended",        "מושהה",     "6", 5),
        ],
    ),
    (
        "salary_type",
        "בסיס שכר",
        "אופן חישוב השכר",
        [
            ("monthly", "חודשי",  "1", 0),
            ("hourly",  "שעתי",   "2", 1),
            ("daily",   "יומי",   "3", 2),
            ("global",  "גלובלי", "4", 3),
        ],
    ),
    (
        "pay_cycle",
        "מחזור תשלום",
        "תדירות תשלום השכר",
        [
            ("monthly",   "חודשי",      "1", 0),
            ("biweekly",  "דו שבועי",   "2", 1),
            ("weekly",    "שבועי",      "3", 2),
        ],
    ),
    (
        "payment_method",
        "שיטת תשלום",
        "אמצעי העברת השכר",
        [
            ("bank_transfer", "העברה בנקאית", "1", 0),
            ("check",         "שיק",           "2", 1),
            ("cash",          "מזומן",          "3", 2),
        ],
    ),
]


async def seed_core_lookups(db: AsyncSession) -> None:
    for list_key, name_he, description, items in _CORE_LOOKUPS:
        result = await db.execute(select(LookupList).where(LookupList.list_key == list_key))
        existing_list = result.scalar_one_or_none()

        if existing_list is None:
            new_list = LookupList(
                id=uuid.uuid4(),
                list_key=list_key,
                name_he=name_he,
                description=description,
                is_system=True,
                is_active=True,
            )
            db.add(new_list)
            await db.flush()
            list_id = new_list.id
        else:
            list_id = existing_list.id

        for item_key, label_he, code, sort_order in items:
            item_result = await db.execute(
                select(LookupItem)
                .where(LookupItem.list_id == list_id)
                .where(LookupItem.item_key == item_key)
            )
            if item_result.scalar_one_or_none() is None:
                db.add(LookupItem(
                    id=uuid.uuid4(),
                    list_id=list_id,
                    item_key=item_key,
                    label_he=label_he,
                    code=code,
                    sort_order=sort_order,
                    is_system=True,
                    is_active=True,
                ))

    await db.commit()
