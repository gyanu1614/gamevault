'use client'

/**
 * Client half of the required-password rule. The middleware sends protected
 * routes to /auth/set-password; everywhere else (static public pages, the
 * founding flow) this opens the Set Your Password modal in place once the
 * session loads, so the page the account landed on stays behind it and
 * reappears when the password is saved. Rule + exemptions: src/lib/auth/oauth.ts.
 */

import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { isPasswordGateExempt, needsPassword } from '@/lib/auth/oauth'
import { SetPasswordDialog } from '@/components/auth/SetPasswordDialog'

export default function PasswordGate() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const open = !loading && !!user && !isPasswordGateExempt(pathname) && needsPassword(user)
  if (!open) return null
  return <SetPasswordDialog open email={user?.email} provider={user?.app_metadata?.provider} />
}
