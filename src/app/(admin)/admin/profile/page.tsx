import { getCurrentAdmin } from '@/lib/actions/admin-permissions'
import { redirect } from 'next/navigation'
import ProfileSettings from './ProfileSettings'

export default async function AdminProfilePage() {
  const admin = await getCurrentAdmin()

  if (!admin) {
    redirect('/login?redirect=/admin/profile')
  }

  return <ProfileSettings admin={admin as any} />
}
