
import React from 'react'
import { ChevronLeft } from 'lucide-react'

export default function CompanyUpdatesWidget() {
    const updates = [
        {
            title: 'ברוכים הבאים ל-CLICK HR',
            content: 'מערכת ניהול משאבי אנוש החדשה שלך. כאן תוכל לנהל את העובדים, הארגונים והתהליכים בחברה בקלות וביעילות.',
            link: 'מדריך למשתמש'
        },
        {
            title: 'עדכון גרסה 1.2',
            content: 'נוספו יכולות חדשות בניהול תיק עובד ושיפורים בממשק המשתמש.',
            link: 'קרא עוד'
        }
    ]

    const links = [
        'לצפייה בנוהל היעדרויות',
        'לצפייה בנוהל נסיעות',
        'לצפייה בנוהל הלוואה מה"קרן לעזרה הדדית"'
    ]

    return (
        <div className="bg-white rounded-none sm:rounded-md shadow-sm h-full flex flex-col">
            <div className="p-4 border-b">
                <h3 className="text-lg font-bold text-gray-700 text-right">עדכוני חברה</h3>
            </div>
            <div className="p-4 space-y-6 flex-1 overflow-y-auto">
                {updates.map((u, i) => (
                    <div key={i} className="border-b pb-4 last:border-0">
                        <h4 className="font-bold text-gray-800 mb-2">{u.title}</h4>
                        <p className="text-sm text-gray-600 leading-relaxed mb-2">
                            {u.content}
                        </p>
                        <button className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline">
                            <ChevronLeft size={12} />
                            {u.link}
                        </button>
                    </div>
                ))}

                <div className="space-y-3 pt-2">
                    {links.map((l, i) => (
                        <a key={i} href="#" className="block text-sm text-blue-600 font-medium hover:underline">
                            {l}
                        </a>
                    ))}
                </div>

                <div className="border-t pt-4">
                    <button className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline">
                        <ChevronLeft size={12} />
                        מידע נוסף
                    </button>
                </div>
            </div>

        </div>
    )
}

