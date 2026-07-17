import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminChrome from './admin/components/AdminChrome'
import { ADMIN_FOREST, FOREST_BG } from './admin/_theme/forest'

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
    <div
      className="relative min-h-screen text-text-primary"
      style={{ backgroundColor: ADMIN_FOREST.canvas }}
    >
      {/* Forest Ledger — deep-forest canvas gradient (never flat black).
          Fixed, so the gradient stays put while ledger content scrolls. */}
      <div className="fixed inset-0" style={{ background: FOREST_BG.canvas }} />

      {/* V55 — Client chrome owns the sidebar-collapse state and keeps
          sidebar width, header offset, and content margin in lockstep. */}
      <AdminChrome role={adminRole.role} user={user} profile={profile}>
        {children}
      </AdminChrome>
    </div>
  )
}