import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAdminGate } from '@/lib/admin/context'
import type { AdminUser } from '@/lib/admin/permissions-constants'
import { isPasswordGateExempt, needsPassword, setPasswordUrl } from '@/lib/auth/oauth'
import AdminChrome from './admin/components/AdminChrome'
import { ADMIN_TITLE_TEMPLATE } from '@/lib/seo/title'

export const metadata: Metadata = {
  title: {
    template: ADMIN_TITLE_TEMPLATE,
    default: 'DropMarket Admin',
  },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The one staff check (lib/admin/context): role, permissions, profile and the
  // two-factor level in one call, shared with this request's page and loaders.
  // The /admin/mfa route is in a separate route group and NOT wrapped by this
  // layout, so needs_mfa cannot loop.
  const gate = await getAdminGate()
  if (gate.status === 'signed_out') redirect('/login?redirect=/admin')
  if (gate.status === 'not_admin') redirect('/')
  if (gate.status === 'needs_mfa') redirect('/admin/mfa')
  const { admin, user } = gate

  // The password rule middleware applies to other protected routes (Google /
  // Discord accounts must set a password), from the verified user. Rule:
  // src/lib/auth/oauth.ts.
  const pathname = headers().get('x-pathname') ?? '/admin'
  if (needsPassword(user) && !isPasswordGateExempt(pathname)) {
    redirect(setPasswordUrl(pathname))
  }

  // V56 — The admin's marketplace profile (real avatar + username)
  // feeds the header's identity cluster.
  const { username, full_name, avatar_url } = admin as AdminUser & {
    username: string | null
    full_name: string | null
    avatar_url: string | null
  }
  const profile = { username, full_name, avatar_url }

  return (
    // The site canvas, flat (the account-section design): cards on it are
    // solid bg-bg-raised fills.
    <div className="relative min-h-[100dvh] bg-bg-base text-text-primary">
      <AdminChrome role={admin.role} user={user} profile={profile}>
        {children}
      </AdminChrome>
    </div>
  )
}