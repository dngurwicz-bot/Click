'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface Column {
  key: string
  label: string
  width?: number
  type?: 'text' | 'number' | 'date' | 'email'
}

interface ExcelTableProps {
  columns: Column[]
  data: Record<string, any>[]
  onCellChange?: (rowIndex: number, columnKey: string, value: any) => void
  onAddRow?: () => void
  editable?: boolean
  className?: string
}

export default function ExcelTable({
  columns,
  data,
  onCellChange,
  onAddRow,
  editable = true,
  className,
}: ExcelTableProps) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [tableData, setTableData] = useState<Record<string, any>[]>(data)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTableData(data)
  }, [data])

  useEffect(() => {
    if (selectedCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [selectedCell])

  const handleCellClick = (rowIndex: number, columnKey: string) => {
    if (!editable) return
    const value = tableData[rowIndex]?.[columnKey] || ''
    setSelectedCell({ row: rowIndex, col: columnKey })
    setEditValue(String(value))
  }

  const handleCellBlur = () => {
    if (selectedCell && editValue !== String(tableData[selectedCell.row]?.[selectedCell.col] || '')) {
      const newData = [...tableData]
      if (!newData[selectedCell.row]) {
        newData[selectedCell.row] = {}
      }
      newData[selectedCell.row][selectedCell.col] = editValue
      setTableData(newData)
      
      if (onCellChange) {
        onCellChange(selectedCell.row, selectedCell.col, editValue)
      }
    }
    setSelectedCell(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCellBlur()
      
      // If Enter pressed on last cell of last row, add new row
      if (selectedCell && onAddRow) {
        const currentColIndex = columns.findIndex(col => col.key === selectedCell.col)
        if (currentColIndex === columns.length - 1 && selectedCell.row === tableData.length - 1) {
          onAddRow()
        }
      }
    } else if (e.key === 'Escape') {
      setSelectedCell(null)
      setEditValue('')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (selectedCell) {
        const currentColIndex = columns.findIndex(col => col.key === selectedCell.col)
        if (e.shiftKey) {
          // Move to previous column
          if (currentColIndex > 0) {
            handleCellClick(selectedCell.row, columns[currentColIndex - 1].key)
          }
        } else {
          // Move to next column
          if (currentColIndex < columns.length - 1) {
            handleCellClick(selectedCell.row, columns[currentColIndex + 1].key)
          } else if (currentColIndex === columns.length - 1 && selectedCell.row < tableData.length - 1) {
            // Move to first column of next row
            handleCellClick(selectedCell.row + 1, columns[0].key)
          } else if (onAddRow) {
            // Add new row if at last cell
            onAddRow()
            setTimeout(() => {
              handleCellClick(tableData.length, columns[0].key)
            }, 0)
          }
        }
      }
    }
  }

  const getColumnWidth = (column: Column) => {
    return column.width || 150
  }

  return (
    <div className={cn('excel-table-container', className)}>
      <div className="overflow-auto border border-gray-300 rounded-lg bg-white">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="bg-gray-100 border border-gray-300 px-4 py-2 text-right text-sm font-semibold sticky top-0 z-10"
                  style={{
                    minWidth: getColumnWidth(column),
                    width: getColumnWidth(column),
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="border border-gray-300 px-4 py-8 text-center text-sm text-gray-500"
                >
                  אין נתונים להצגה
                </td>
              </tr>
            ) : (
              tableData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {columns.map((column) => {
                    const isSelected =
                      selectedCell?.row === rowIndex && selectedCell?.col === column.key
                    const cellValue = row[column.key] || ''

                    return (
                      <td
                        key={column.key}
                        className={cn(
                          'border border-gray-300 px-4 py-2 text-sm relative',
                          isSelected && 'bg-blue-50 ring-2 ring-blue-400',
                          editable && 'cursor-cell'
                        )}
                        style={{
                          minWidth: getColumnWidth(column),
                          width: getColumnWidth(column),
                        }}
                        onClick={() => handleCellClick(rowIndex, column.key)}
                      >
                        {isSelected ? (
                          <input
                            ref={inputRef}
                            type={column.type === 'number' ? 'number' : 'text'}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyDown}
                            className="w-full h-full border-none outline-none bg-transparent text-sm"
                            style={{ direction: 'rtl' }}
                          />
                        ) : (
                          <span className="block truncate" style={{ direction: 'rtl' }}>
                            {cellValue}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
