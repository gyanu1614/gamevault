'use client'

/**
 * /signup redirector (auth-aware). Mirrors /login: opens the global AuthDialog
 * modal in signup mode, forwards `?redirect=`. Per auth state (industry
 * behaviour):
 *   • auth resolving → render nothing (no modal flash).
 *   • ALREADY SIGNED IN → skip the modal, go to the destination.
 *   • signed out → open the signup modal once.
 * A signed-out user who dismisses without auth'ing is sent home.
 */

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { useAuth } from '@/hooks/use-auth'

function SignupRedirector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { open, isOpen } = useAuthDialog()
  const { user, loading } = useAuth()
  const redirect = searchParams?.get('redirect') || '/'
  const hasOpenedRef = useRef(false)

  useEffect(() => {
    if (loading) return
    if (user) {
      router.replace(redirect)
      return
    }
    if (!hasOpenedRef.current) {
      open('signup', { redirect })
      hasOpenedRef.current = true
    }
  }, [loading, user, open, redirect, router])

  useEffect(() => {
    if (hasOpenedRef.current && !isOpen && pathname === '/signup') {
      router.replace('/')
    }
  }, [isOpen, pathname, router])

  // Occupy the viewport so the global footer is pushed below the fold and the
  // page doesn't scroll/jump to the bottom while the modal mounts.
  return <div className="min-h-[calc(100vh-4rem)]" aria-hidden />
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-4rem)]" aria-hidden />}>
      <SignupRedirector />
    </Suspense>
  )
}
