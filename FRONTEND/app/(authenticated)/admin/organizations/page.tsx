import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OrganizationsContent from '@/components/admin/OrganizationsContent'

export const dynamic = 'force-dynamic'

export default async function OrganizationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <OrganizationsContent user={user} />
}
