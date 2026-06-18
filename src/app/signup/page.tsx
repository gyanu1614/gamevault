'use client'

/**
 * V17 — Legacy /signup redirector. Mirrors /login: opens the global
 * AuthDialog modal in signup mode, forwards `?redirect=` so the modal's
 * success handler routes there, and bounces dismissals home so the user
 * never gets stranded on a blank route.
 */

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuthDialog } from '@/components/auth/AuthDialog'

function SignupRedirector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { open, isOpen } = useAuthDialog()
  const redirect = searchParams?.get('redirect') || '/'
  const hasOpenedRef = useRef(false)

  useEffect(() => {
    open('signup', { redirect })
    hasOpenedRef.current = true
  }, [open, redirect])

  useEffect(() => {
    if (hasOpenedRef.current && !isOpen && pathname === '/signup') {
      router.replace('/')
    }
  }, [isOpen, pathname, router])

  return null
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupRedirector />
    </Suspense>
  )
}
