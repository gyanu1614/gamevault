'use client'

/**
 * V17 — Legacy /login redirector.
 *
 * Auth lives in a global Radix Dialog modal now (see AuthDialog.tsx).
 * Hitting /login directly (bookmark, old link, server-side redirect)
 * opens the modal with the `?redirect=…` target attached. The modal's
 * success handler routes there after sign-in. If the user closes the
 * modal without authenticating, we send them to "/" so they're not
 * stranded on this empty page.
 */

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuthDialog } from '@/components/auth/AuthDialog'

function LoginRedirector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { open, isOpen } = useAuthDialog()
  const redirect = searchParams?.get('redirect') || '/'
  const hasOpenedRef = useRef(false)

  // Open the modal on mount with the desired post-auth destination.
  useEffect(() => {
    open('login', { redirect })
    hasOpenedRef.current = true
  }, [open, redirect])

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

  return null
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginRedirector />
    </Suspense>
  )
}
