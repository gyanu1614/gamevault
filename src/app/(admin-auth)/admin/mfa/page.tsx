import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shield, Lock } from 'lucide-react'
import { VerifyForm } from './VerifyForm'
import { EnrollForm } from './EnrollForm'

export const metadata = {
  title: 'Admin MFA Verification',
}

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

  // Check current MFA level
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  // Already aal2 — skip this page
  if (aal?.currentLevel === 'aal2') redirect('/admin')

  // Get enrolled factors
  // listFactors().totp only returns verified factors — any entry means MFA is set up
  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const totpFactors = factorsData?.totp ?? []
  const hasEnrolledFactor = totpFactors.length > 0

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-950 to-black pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20">
            <Lock className="h-8 w-8 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Verification</h1>
          <p className="mt-2 text-sm text-gray-400">
            {hasEnrolledFactor
              ? 'Enter your TOTP code to access the admin panel'
              : 'Set up two-factor authentication to access the admin panel'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
          {/* Shield badge */}
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
            <Shield className="h-4 w-4 text-violet-400 shrink-0" />
            <p className="text-xs text-violet-300">
              {hasEnrolledFactor
                ? 'Session requires MFA verification (TOTP)'
                : 'Admin access requires two-factor authentication'}
            </p>
          </div>

          {/* Conditional form */}
          {hasEnrolledFactor ? (
            <VerifyForm
              factorId={totpFactors[0].id}
              factorName={totpFactors[0].friendly_name ?? 'Authenticator App'}
            />
          ) : (
            <EnrollForm />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          GameVault Admin · Protected by TOTP MFA
        </p>
      </div>
    </div>
  )
}
