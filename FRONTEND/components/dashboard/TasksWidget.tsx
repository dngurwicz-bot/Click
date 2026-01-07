'use client'
import React, { useState } from 'react'
import { Search } from 'lucide-react'

export default function TasksWidget() {
    const [activeTab, setActiveTab] = useState<'handling' | 'error'>('handling')

    const tasks = [
        { title: 'נדרש אישור לטופס', from: 'חנה מאי קשתי (2586)', date: '01/01/2026' },
        { title: 'נדרש אישור לטופס', from: 'משה פריד (2258)', date: '01/01/2026' },
        { title: 'נדרש אישור לטופס', from: 'תיאר שיבלי (8679)', date: '01/01/2026' },
        { title: 'נדרש אישור לטופס', from: 'נורית ראש (2263)', date: '01/01/2026' },
        { title: 'נדרש אישור לטופס', from: 'פרחן רוחני (1893)', date: '01/01/2026' },
    ]

    return (
        <div className="bg-white rounded-none sm:rounded-md shadow-sm flex flex-col h-full border-t-4 border-t-blue-400">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-700">משימות</h3>
                <div className="flex gap-2">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="חיפוש"
                            className="pl-8 pr-3 py-1 text-sm border rounded bg-gray-50 max-w-[120px]"
                        />
                        <Search className="absolute left-2 top-1.5 w-4 h-4 text-gray-400" />
                    </div>
                    <select className="text-sm border rounded bg-gray-50 py-1 px-2">
                        <option>כל המשימות</option>
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b text-sm">
                <button
                    className={`flex-1 py-3 font-medium text-center relative ${activeTab === 'handling' ? 'text-blue-600' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('handling')}
                >
                    משימות לטיפולי
                    <span className="mr-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">49</span>
                    {activeTab === 'handling' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500" />}
                </button>
                <button
                    className={`flex-1 py-3 font-medium text-center relative ${activeTab === 'error' ? 'text-blue-600' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('error')}
                >
                    שגויים לטיפולי
                    <span className="mr-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">1</span>
                    {activeTab === 'error' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500" />}
                </button>
                <button className="flex-1 py-3 text-blue-500 text-xs text-center hover:underline">
                    לכל המשימות
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-0">
                {tasks.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border-b hover:bg-slate-50 transition-colors">
                        <button className="bg-[#48C0D8] text-white text-xs px-3 py-1 rounded shadow-sm hover:bg-[#3baac1]">
                            לטיפול
                        </button>
                        <div className="text-right">
                            <div className="text-sm font-bold text-gray-800">{t.title}</div>
                            <div className="text-xs text-gray-500">{t.from}</div>
                        </div>
                        <div className="text-center text-xs text-gray-500">
                            <div className="font-medium">תאריך יעד</div>
                            <div>{t.date}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
