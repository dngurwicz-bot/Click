'use client'
import React, { useState } from 'react'
import { Search } from 'lucide-react'

export default function TasksWidget() {
    const tasks: { title: string, from: string, date: string }[] = []

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
                        <option>משימות קליטה</option>
                        <option>משימות מסמכים</option>
                        <option>משימות שכר</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-0 flex flex-col items-center justify-center text-gray-400">
                {tasks.length > 0 ? (
                    tasks.map((t, i) => (
                        <div key={i} className="flex items-center justify-between p-3 border-b hover:bg-slate-50 transition-colors w-full">
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
                    ))
                ) : (
                    <div className="text-center py-10">
                        <p className="text-lg font-medium">אין משימות לטיפול</p>
                        <p className="text-sm">המשימות שלך יופיעו כאן</p>
                    </div>
                )}
            </div>
        </div>
    )
}
