'use client'

/**
 * /login redirector (auth-aware).
 *
 * Auth lives in a global Radix Dialog modal (see AuthDialog.tsx). Hitting
 * /login directly (bookmark, old link, server redirect) is handled per the
 * user's auth state — industry behaviour:
 *   • auth still resolving → render nothing (no modal flash).
 *   • ALREADY SIGNED IN → skip the modal, go straight to the destination.
 *   • signed out → open the login modal once with the `?redirect=` target.
 * If a signed-out user closes the modal without auth'ing, we send them home
 * so they're not stranded on this empty route.
 */

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { useAuth } from '@/hooks/use-auth'

function LoginRedirector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { open, isOpen } = useAuthDialog()
  const { user, loading } = useAuth()
  const redirect = searchParams?.get('redirect') || '/'
  const hasOpenedRef = useRef(false)

  // Decide what to do once auth state is known.
  useEffect(() => {
    if (loading) return // wait — don't flash the modal before we know
    if (user) {
      // Already signed in: no login UI, just go where they were headed.
      router.replace(redirect)
      return
    }
    if (!hasOpenedRef.current) {
      open('login', { redirect })
      hasOpenedRef.current = true
    }
  }, [loading, user, open, redirect, router])

  // If the user closes the modal without auth'ing, bounce them home.
  // Guards:
  //   1) `hasOpenedRef` — first paint has isOpen=false BEFORE `open()`
  //      flips it; without this we'd redirect before the modal opens.
  //   2) `pathname === '/login'` — on a successful sign-in the modal
  //      handler already called router.replace(redirect), so by the
  //      time isOpen flips false the pathname is no longer /login.
  //      Skipping the redirect here avoids racing/overriding it.
  useEffect(() => {
    if (hasOpenedRef.current && !isOpen && pathname === '/login') {
      router.replace('/')
    }
  }, [isOpen, pathname, router])

  // Occupy the viewport so the global footer is pushed below the fold and the
  // page doesn't scroll/jump to the bottom while the modal mounts. The modal
  // itself is a fixed overlay rendered by AuthDialog; this is just the empty
  // backdrop area beneath it.
  return <div className="min-h-[calc(100vh-4rem)]" aria-hidden />
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-4rem)]" aria-hidden />}>
      <LoginRedirector />
    </Suspense>
  )
}
