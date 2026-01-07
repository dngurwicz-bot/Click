import { Suspense } from 'react'
import EmployeeEventsContent from '@/components/events/EmployeeEventsContent'
import { Loader2 } from 'lucide-react'

interface PageProps {
  params: {
    employeeId: string
  }
}

// This is a placeholder - you'll need to get the user from your auth system
async function getUser() {
  // Replace this with your actual auth logic
  return { id: '1', email: 'user@example.com' }
}

export default async function EmployeeEventsPage({ params }: PageProps) {
  const user = await getUser()
  
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-teal)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              טוען...
            </p>
          </div>
        </div>
      }
    >
      <EmployeeEventsContent employeeId={params.employeeId} user={user} />
    </Suspense>
  )
}
