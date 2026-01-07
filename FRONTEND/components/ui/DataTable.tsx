'use client'

import React, { useState } from 'react'
import {
    ChevronDown,
    ChevronUp,
    Search,
    Trash2,
    Edit2,
    MoreVertical
} from 'lucide-react'
import Button from './Button'
import Input from './Input'

export interface Column<T> {
    key: string
    header: string
    width?: string
    render?: (item: T) => React.ReactNode
    sortable?: boolean
}

export interface DataTableProps<T> {
    data: T[]
    columns: Column<T>[]
    keyField: keyof T
    onEdit?: (item: T) => void
    onDelete?: (item: T) => void
    searchable?: boolean
    searchFields?: (keyof T)[]
}

export default function DataTable<T>({
    data,
    columns,
    keyField,
    onEdit,
    onDelete,
    searchable = true,
    searchFields = [] // If empty, basic search won't work unless custom logic added
}: DataTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('')
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

    // Filter Data
    const filteredData = React.useMemo(() => {
        if (!searchTerm) return data

        return data.filter(item => {
            // Basic search logic: check all searchable fields
            return searchFields.some(field => {
                const val = item[field]
                return String(val).toLowerCase().includes(searchTerm.toLowerCase())
            })
        })
    }, [data, searchTerm, searchFields])

    // Sort Data
    const sortedData = React.useMemo(() => {
        if (!sortConfig) return filteredData

        return [...filteredData].sort((a, b) => {
            // @ts-ignore
            const aVal = a[sortConfig.key]
            // @ts-ignore
            const bVal = b[sortConfig.key]

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [filteredData, sortConfig])

    // Handle Sort
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Toolbar */}
            {searchable && (
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="חיפוש..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-4 pr-10 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    scope="col"
                                    className={`
                    px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider
                    ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}
                  `}
                                    style={{ width: col.width }}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.header}
                                        {sortConfig?.key === col.key && (
                                            sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                        )}
                                    </div>
                                </th>
                            ))}
                            {(onEdit || onDelete) && (
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">פעולות</span>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedData.length > 0 ? (
                            sortedData.map((item) => (
                                <tr key={String(item[keyField])} className="hover:bg-gray-50 transition-colors">
                                    {columns.map((col) => (
                                        <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {col.render ? col.render(item) : String(item[col.key as keyof T] || '-')}
                                        </td>
                                    ))}
                                    {(onEdit || onDelete) && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                {onEdit && (
                                                    <button
                                                        onClick={() => onEdit(item)}
                                                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                                                        title="ערוך"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        onClick={() => onDelete(item)}
                                                        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                                                        title="מחק"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                                    className="px-6 py-12 text-center text-gray-500"
                                >
                                    ללא אין נתונים להצגה
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer / Pagination could go here */}
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-500">
                סה"כ {sortedData.length} רשומות
            </div>
        </div>
    )
}
