
import React from 'react'
import { ChevronLeft } from 'lucide-react'

export default function CompanyUpdatesWidget() {
    const updates: { title: string, content: string, link: string }[] = []
    const links: string[] = []

    return (
        <div className="bg-white rounded-none sm:rounded-md shadow-sm h-full flex flex-col">
            <div className="p-4 border-b">
                <h3 className="text-lg font-bold text-gray-700 text-right">עדכונים</h3>
            </div>
            <div className="p-4 space-y-6 flex-1 overflow-y-auto flex flex-col items-center justify-center text-gray-400">
                {updates.length > 0 ? (
                    <>
                        {updates.map((u, i) => (
                            <div key={i} className="border-b pb-4 last:border-0 w-full">
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

                        <div className="space-y-3 pt-2 w-full">
                            {links.map((l, i) => (
                                <a key={i} href="#" className="block text-sm text-blue-600 font-medium hover:underline">
                                    {l}
                                </a>
                            ))}
                        </div>
                        <div className="border-t pt-4 w-full">
                            <button className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline">
                                <ChevronLeft size={12} />
                                מידע נוסף
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="text-center">
                        <p className="text-lg font-medium">אין עדכונים חדשים</p>
                    </div>
                )}
            </div>

        </div>
    )
}

