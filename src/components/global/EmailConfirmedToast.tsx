'use client'

/**
 * Beta A — Post-confirmation success signal.
 *
 * Reads `?confirmed=1` (set by /auth/callback on a successful signup
 * confirmation) and `?auth_error=…` (set when the confirmation link was
 * expired or failed) from the URL, surfaces a sonner toast, then strips the
 * params so a refresh/back doesn't re-fire.
 *
 * Unlike AccessDeniedToast, this is mounted INSIDE the auth provider stack
 * so it can call useAuthDialog().open('login') to drop the signed-out user
 * straight into the sign-in modal.
 *
 * Session presence is read directly via getSession() rather than waiting on
 * useAuth().loading (which can take up to ~10s) so the toast fires promptly.
 */

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { createClient } from '@/lib/supabase/client'

export default function EmailConfirmedToast() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { open } = useAuthDialog()
  // Strict mode double-invokes effects in dev — guard so the toast fires once.
  const firedRef = useRef(false)

  useEffect(() => {
    const confirmed = searchParams?.get('confirmed')
    const authError = searchParams?.get('auth_error')
    if (!confirmed && !authError) return
    if (firedRef.current) return
    firedRef.current = true

    // Strip both params so refresh/back doesn't re-fire and the URL stays clean.
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.delete('confirmed')
    params.delete('auth_error')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname || '/')

    if (authError) {
      if (authError === 'link_expired') {
        toast.error('Confirmation Link Expired', {
          description: 'Sign in and we can resend it.',
        })
        open('login')
      } else {
        toast.error('Confirmation Failed', {
          description: 'Try the link again or request a new one.',
        })
      }
      return
    }

    // confirmed=1 — decide copy from session presence.
    ;(async () => {
      try {
        const {
          data: { session },
        } = await createClient().auth.getSession()
        if (session) {
          toast.success('Email Confirmed', {
            description: "You're signed in — welcome to DropMarket.",
          })
        } else {
          toast.success('Email Confirmed', {
            description: 'Sign in to continue.',
          })
          open('login')
        }
      } catch {
        // If the session read fails, still acknowledge the confirmation and
        // offer sign-in — worst case they're already signed in and the modal
        // is a no-op on the next protected route.
        toast.success('Email Confirmed', {
          description: 'Sign in to continue.',
        })
        open('login')
      }
    })()
  }, [searchParams, pathname, router, open])

  return null
}
