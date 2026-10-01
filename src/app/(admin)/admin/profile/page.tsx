import { getCurrentAdmin } from '@/lib/actions/admin-permissions'
import { redirect } from 'next/navigation'
import { PageHeader } from '../components/kit'
import ProfileSettings from './ProfileSettings'

export const metadata = { title: 'Profile' }

export default async function AdminProfilePage() {
  const admin = await getCurrentAdmin()

  if (!admin) {
    redirect('/login?redirect=/admin/profile')
  }

  return (
    <div className="pb-10">
      <PageHeader title="Profile" description="Your admin account." />
      <ProfileSettings admin={admin as any} />
    </div>
  )
}
