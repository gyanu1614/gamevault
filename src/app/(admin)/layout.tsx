import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from './admin/components/Sidebar'
import EnhancedAdminHeader from './admin/components/EnhancedAdminHeader'

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
          the rest of GameVault (lime accent on dark) rather than a
          standalone purple theme. */}
      <div className="fixed inset-0 bg-bg-base" />

      {/* Sidebar */}
      <Sidebar role={adminRole.role} user={user} />

      {/* Main Content Area - Always has left margin for sidebar */}
      <div className="relative lg:ml-[14.3rem] flex flex-col min-h-screen">
        {/* Header */}
        <EnhancedAdminHeader role={adminRole.role} user={user} />

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 mt-20">
          <div className="relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}