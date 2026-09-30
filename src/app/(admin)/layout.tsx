import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import AdminChrome from './admin/components/AdminChrome'

export const metadata: Metadata = {
  title: {
    template: '%s | DropMarket Admin',
    default: 'DropMarket Admin',
  },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/admin')
  }

  // Check admin_roles table (NOT profiles.role)
  const { data: adminRoleRaw, error } = await (supabase as any)
    .from('admin_roles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const adminRole = adminRoleRaw as { role: string; is_active: boolean } | null

  if (error || !adminRole) {
    redirect('/')
  }

  // Update last active. AUTH-030: admin_roles has no user write policy any
  // more — touch it as the backend, scoped to the verified user.
  await (createServiceRoleClient() as any)
    .from('admin_roles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('user_id', user.id)

  // V56 — The admin's marketplace profile (real avatar + username)
  // feeds the header's identity cluster.
  const { data: profileRaw } = await (supabase as any)
    .from('profiles')
    .select('username, full_name, avatar_url')
    .eq('id', user.id)
    .single()
  const profile = (profileRaw ?? null) as {
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null

  // MFA AAL2 enforcement — every admin page requires aal2
  // (The /admin/mfa route is in a separate route group and NOT wrapped by this layout)
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (!aal || aal.currentLevel !== 'aal2') {
    redirect('/admin/mfa')
  }

  return (
    // The site canvas, flat (the account-section design): cards on it are
    // solid bg-bg-raised fills.
    <div className="relative min-h-[100dvh] bg-bg-base text-text-primary">
      <AdminChrome role={adminRole.role} user={user} profile={profile}>
        {children}
      </AdminChrome>
    </div>
  )
}