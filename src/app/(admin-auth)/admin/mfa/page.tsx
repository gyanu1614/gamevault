import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VerifyForm } from './VerifyForm'
import { EnrollForm } from './EnrollForm'
import { SignOutLink } from './SignOutLink'

export const metadata = {
  title: 'Admin Verification',
  robots: { index: false, follow: false },
}

/**
 * The admin 2FA gate. Every /admin page needs an aal2 session (enforced in
 * the (admin) layout); this route lives in its own group so that layout never
 * wraps it. Signed-in admins without a TOTP factor set one up here; admins
 * with one enter a code.
 */
export default async function AdminMFAPage() {
  const supabase = await createClient()

  // Must be logged in
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')

  // Must be an admin
  const { data: adminRole } = await (supabase as any)
    .from('admin_roles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!adminRole) redirect('/')

  // Already aal2 — skip this page
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel === 'aal2') redirect('/admin')

  // listFactors().totp only returns verified factors — any entry means MFA is set up
  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const totpFactors = factorsData?.totp ?? []
  const hasEnrolledFactor = totpFactors.length > 0

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-bg-base px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Image src="/brand/logo-mark-white.png" alt="" width={26} height={26} priority />
          <span className="text-[16px] font-bold tracking-tight text-text-primary">DropMarket</span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11.5px] font-semibold text-text-secondary">
            Admin
          </span>
        </div>

        <section className="rounded-lg bg-bg-raised p-5 sm:p-7">
          {hasEnrolledFactor ? (
            <VerifyForm factorId={totpFactors[0].id} />
          ) : (
            <EnrollForm />
          )}
        </section>

        <p className="mt-5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-[12.5px] text-text-tertiary">
          <span>
            Signed in as <span className="text-text-secondary">{user.email}</span>
          </span>
          <span aria-hidden>·</span>
          <SignOutLink />
        </p>
      </div>
    </main>
  )
}
