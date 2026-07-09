import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  // Update last active
  await (supabase as any)
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
    <div className="min-h-screen bg-bg-base relative text-text-primary">
      {/* V19/P22 — Replaced violet+indigo radial gradients with a
          neutral bg-bg-base canvas. Admin chrome is now on-brand with
          the rest of the site (lime accent on dark) rather than a
          standalone purple theme. */}
      <div className="fixed inset-0 bg-bg-base" />

      {/* V55 — Client chrome owns the sidebar-collapse state and keeps
          sidebar width, header offset, and content margin in lockstep. */}
      <AdminChrome role={adminRole.role} user={user} profile={profile}>
        {children}
      </AdminChrome>
    </div>
  )
}