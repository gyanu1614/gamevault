'use client'

/**
 * Client-side half of the required-password rule. The middleware enforces it
 * on protected routes; public pages are static (no cookies there), so this
 * component sends a signed-in, password-less account to Set Your Password
 * from the browser after the session loads. Exempt routes and the rule
 * itself live in src/lib/auth/oauth.ts.
 */

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { isPasswordGateExempt, needsPassword, setPasswordUrl } from '@/lib/auth/oauth'

export default function PasswordGate() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading || !user) return
    if (isPasswordGateExempt(pathname)) return
    if (!needsPassword(user)) return
    router.replace(setPasswordUrl(`${pathname ?? '/'}${window.location.search}`))
  }, [loading, user, pathname, router])

  return null
}
