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
    <div className="min-h-screen bg-black relative text-[110%]">
      {/* Dark gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-950 to-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
      </div>

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