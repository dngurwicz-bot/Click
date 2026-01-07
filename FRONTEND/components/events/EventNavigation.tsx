'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { FileText, MapPin, Phone, Mail, CreditCard, Users, Briefcase, Calendar } from 'lucide-react'

export interface EventType {
  id: number
  name: string
  icon: React.ComponentType<any>
  description?: string
}

export const EVENT_TYPES: EventType[] = [
  {
    id: 10,
    name: 'פתיחת עובד',
    icon: FileText,
    description: 'פרטים אישיים בסיסיים',
  },
  {
    id: 11,
    name: 'כתובות',
    icon: MapPin,
    description: 'כתובות המגורים',
  },
  {
    id: 12,
    name: 'אמצעי תקשורת',
    icon: Phone,
    description: 'טלפונים ומיילים',
  },
  {
    id: 13,
    name: 'פרטי בנק',
    icon: CreditCard,
    description: 'פרטי חשבון בנק',
  },
  {
    id: 14,
    name: 'משפחה',
    icon: Users,
    description: 'פרטי בני משפחה',
  },
  {
    id: 15,
    name: 'תפקידים',
    icon: Briefcase,
    description: 'היסטוריית תפקידים',
  },
  {
    id: 16,
    name: 'אירועים',
    icon: Calendar,
    description: 'אירועים ותאריכים חשובים',
  },
]

interface EventNavigationProps {
  currentEventId: number
  onEventSelect: (eventId: number) => void
  className?: string
}

export default function EventNavigation({
  currentEventId,
  onEventSelect,
  className,
}: EventNavigationProps) {
  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg p-4', className)}>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        אירועים
      </h3>
      <div className="space-y-2">
        {EVENT_TYPES.map((event) => {
          const Icon = event.icon
          const isActive = currentEventId === event.id

          return (
            <button
              key={event.id}
              onClick={() => onEventSelect(event.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-right',
                isActive
                  ? 'bg-blue-50 border-2 border-blue-500 shadow-sm'
                  : 'hover:bg-gray-50 border-2 border-transparent'
              )}
            >
              <div
                className={cn(
                  'p-2 rounded-lg',
                  isActive ? 'bg-blue-100' : 'bg-gray-100'
                )}
              >
                <Icon
                  size={20}
                  className={isActive ? 'text-blue-600' : 'text-gray-600'}
                />
              </div>
              <div className="flex-1">
                <div
                  className={cn(
                    'text-sm font-medium',
                    isActive ? 'text-blue-900' : 'text-gray-900'
                  )}
                >
                  אירוע {event.id} - {event.name}
                </div>
                {event.description && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {event.description}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
