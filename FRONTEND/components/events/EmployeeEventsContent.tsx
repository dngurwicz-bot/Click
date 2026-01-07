'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api/client'
import Link from 'next/link'
import { ArrowRight, Loader2, User, Save } from 'lucide-react'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import Card, { CardHeader, CardContent } from '@/components/ui/Card'
import ExcelTable, { Column } from './ExcelTable'
import EventNavigation, { EVENT_TYPES, EventType } from './EventNavigation'

interface EmployeeEventsContentProps {
  employeeId: string
  user: any
}

// Define columns for each event type
const getEventColumns = (eventId: number): Column[] => {
  switch (eventId) {
    case 10: // פתיחת עובד
      return [
        { key: 'first_name', label: 'שם פרטי', width: 150, type: 'text' },
        { key: 'last_name', label: 'שם משפחה', width: 150, type: 'text' },
        { key: 'id_number', label: 'תעודת זהות', width: 120, type: 'text' },
        { key: 'birth_date', label: 'תאריך לידה', width: 120, type: 'date' },
        { key: 'employee_number', label: 'מספר עובד', width: 120, type: 'text' },
        { key: 'gender', label: 'מין', width: 80, type: 'text' },
        { key: 'marital_status', label: 'מצב משפחתי', width: 120, type: 'text' },
      ]
    case 11: // כתובות
      return [
        { key: 'address_type', label: 'סוג כתובת', width: 120, type: 'text' },
        { key: 'street', label: 'רחוב', width: 200, type: 'text' },
        { key: 'house_number', label: 'מספר בית', width: 100, type: 'text' },
        { key: 'city', label: 'עיר', width: 150, type: 'text' },
        { key: 'postal_code', label: 'מיקוד', width: 100, type: 'text' },
        { key: 'country', label: 'מדינה', width: 120, type: 'text' },
        { key: 'is_primary', label: 'כתובת ראשית', width: 100, type: 'text' },
      ]
    case 12: // אמצעי תקשורת
      return [
        { key: 'contact_type', label: 'סוג קשר', width: 120, type: 'text' },
        { key: 'phone', label: 'טלפון', width: 150, type: 'text' },
        { key: 'email', label: 'אימייל', width: 200, type: 'email' },
        { key: 'is_primary', label: 'קשר ראשי', width: 100, type: 'text' },
      ]
    case 13: // פרטי בנק
      return [
        { key: 'bank_name', label: 'שם בנק', width: 150, type: 'text' },
        { key: 'branch_number', label: 'מספר סניף', width: 120, type: 'text' },
        { key: 'account_number', label: 'מספר חשבון', width: 150, type: 'text' },
        { key: 'account_holder', label: 'שם בעל החשבון', width: 150, type: 'text' },
      ]
    case 14: // משפחה
      return [
        { key: 'relation', label: 'קרבה', width: 120, type: 'text' },
        { key: 'first_name', label: 'שם פרטי', width: 150, type: 'text' },
        { key: 'last_name', label: 'שם משפחה', width: 150, type: 'text' },
        { key: 'id_number', label: 'תעודת זהות', width: 120, type: 'text' },
        { key: 'birth_date', label: 'תאריך לידה', width: 120, type: 'date' },
        { key: 'phone', label: 'טלפון', width: 150, type: 'text' },
      ]
    case 15: // תפקידים
      return [
        { key: 'position_name', label: 'שם תפקיד', width: 200, type: 'text' },
        { key: 'department', label: 'מחלקה', width: 150, type: 'text' },
        { key: 'start_date', label: 'תאריך התחלה', width: 120, type: 'date' },
        { key: 'end_date', label: 'תאריך סיום', width: 120, type: 'date' },
        { key: 'salary', label: 'שכר', width: 120, type: 'number' },
      ]
    case 16: // אירועים
      return [
        { key: 'event_name', label: 'שם אירוע', width: 200, type: 'text' },
        { key: 'event_date', label: 'תאריך', width: 120, type: 'date' },
        { key: 'event_type', label: 'סוג אירוע', width: 150, type: 'text' },
        { key: 'description', label: 'תיאור', width: 250, type: 'text' },
      ]
    default:
      return []
  }
}

export default function EmployeeEventsContent({
  employeeId,
  user,
}: EmployeeEventsContentProps) {
  const router = useRouter()
  const [currentEventId, setCurrentEventId] = useState<number>(10)
  const [eventData, setEventData] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const loadEventData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getEventData(employeeId, currentEventId)
      
      // If data is a single object, convert to array
      if (data && !Array.isArray(data)) {
        setEventData([data])
      } else if (Array.isArray(data)) {
        setEventData(data.length > 0 ? data : [{}])
      } else {
        // Initialize with empty row for new events
        setEventData([{}])
      }
    } catch (err: any) {
      console.error('Error loading event data:', err)
      setError(err.message || 'שגיאה בטעינת הנתונים')
      // Initialize with empty row on error
      setEventData([{}])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEventData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, currentEventId])

  const handleCellChange = (rowIndex: number, columnKey: string, value: any) => {
    setHasChanges(true)
    const newData = [...eventData]
    if (!newData[rowIndex]) {
      newData[rowIndex] = {}
    }
    newData[rowIndex][columnKey] = value
    setEventData(newData)
  }

  const handleAddRow = () => {
    setHasChanges(true)
    setEventData([...eventData, {}])
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      
      // Filter out empty rows
      const dataToSave = eventData.filter(row => 
        Object.values(row).some(val => val !== '' && val !== null && val !== undefined)
      )

      if (dataToSave.length === 0) {
        setError('אין נתונים לשמירה')
        return
      }

      // If single row, save as object, otherwise as array
      const payload = dataToSave.length === 1 ? dataToSave[0] : dataToSave
      
      await api.updateEventData(employeeId, currentEventId, payload)
      setHasChanges(false)
      await loadEventData()
    } catch (err: any) {
      console.error('Error saving event data:', err)
      setError(err.message || 'שגיאה בשמירת הנתונים')
    } finally {
      setSaving(false)
    }
  }

  const handleEventSelect = (eventId: number) => {
    if (hasChanges) {
      if (confirm('יש שינויים שלא נשמרו. האם אתה בטוח שברצונך לעבור לאירוע אחר?')) {
        setCurrentEventId(eventId)
        setHasChanges(false)
      }
    } else {
      setCurrentEventId(eventId)
    }
  }

  const currentEvent = EVENT_TYPES.find(e => e.id === currentEventId)
  const columns = getEventColumns(currentEventId)

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40" style={{ borderColor: 'var(--border-color)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <Logo size="md" showSubtext={false} />
              <div className="h-6 w-px bg-gray-300" />
              <Link 
                href="/dashboard" 
                className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-accent"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ArrowRight size={16} />
                חזרה לדשבורד
              </Link>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                תיק עובד - אירועים
              </h1>
            </div>
            {hasChanges && (
              <Button
                onClick={handleSave}
                variant="primary"
                icon={Save}
                isLoading={saving}
              >
                שמור שינויים
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Event Navigation Sidebar */}
          <div className="lg:col-span-1">
            <EventNavigation
              currentEventId={currentEventId}
              onEventSelect={handleEventSelect}
            />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <Card variant="elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {currentEvent?.name || `אירוע ${currentEventId}`}
                    </h2>
                    {currentEvent?.description && (
                      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {currentEvent.description}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 p-4 rounded-lg border" style={{ 
                    background: 'var(--error-light)', 
                    borderColor: 'var(--error)',
                    color: 'var(--error)'
                  }}>
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="animate-spin mb-4" size={32} style={{ color: 'var(--accent-teal)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      טוען נתונים...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <ExcelTable
                      columns={columns}
                      data={eventData}
                      onCellChange={handleCellChange}
                      onAddRow={handleAddRow}
                      editable={true}
                    />
                    
                    {hasChanges && (
                      <div className="flex justify-end pt-4">
                        <Button
                          onClick={handleSave}
                          variant="primary"
                          icon={Save}
                          isLoading={saving}
                        >
                          שמור שינויים
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
