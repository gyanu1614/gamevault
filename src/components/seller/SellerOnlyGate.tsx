'use client'

/**
 * V17e — Seller-only route gate.
 *
 * Wraps any page that should ONLY be reachable by approved sellers
 * (e.g. /account/listings, /account/listings/new, future seller
 * dashboards). Logged-in buyers and unauthenticated visitors get a
 * centered loader card + toast, then a redirect to "/".
 *
 * Logic order matters:
 *   1. useAuth still loading        → render `fallback` (the page skeleton)
 *   2. No user at all               → toast + replace('/login?redirect=…')
 *   3. user.isApprovedSeller true   → render children
 *   4. user.isApprovedSeller false  → toast + replace('/')
 *
 * V22 — No per-page DB re-query. `useAuth` derives `isApprovedSeller` from
 * the freshly-fetched `profiles.role` on every load (admin approval sets
 * role='seller'), so the hook's flag is authoritative and current — the
 * old seller_applications fallback here was a redundant round-trip.
 *
 * Always uses router.replace so the protected URL doesn't sit in
 * history; back-button shouldn't loop the user back into the gate.
 */

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

type Status = 'checking' | 'allowed' | 'denied-anon' | 'denied-buyer'

export function SellerOnlyGate({
  children,
  fallback = null,
}: {
  children: ReactNode
  /** Shown while the answer is still unknown: pass the page's skeleton. */
  fallback?: ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Decided during render, not in an effect: a known seller (including the
  // cached one useAuth restores instantly) sees the page on the first frame
  // instead of a "Checking access…" spinner. Middleware has already made the
  // authoritative call for these routes; this only covers a stale client flag.
  const status: Status = user?.isApprovedSeller === true
    ? 'allowed'
    : loading
      ? 'checking'
      : user
        ? 'denied-buyer'
        : 'denied-anon'

  // Once we know the user is denied, fire the toast + redirect once
  // and let the loader card stay on screen during the transition.
  useEffect(() => {
    if (status === 'denied-anon') {
      toast.error('Please sign in to access this page')
      const next = encodeURIComponent(pathname || '/')
      router.replace(`/login?redirect=${next}`)
    } else if (status === 'denied-buyer') {
      toast.error('Sellers only — redirecting to home')
      router.replace('/')
    }
  }, [status, pathname, router])

  if (status === 'allowed') {
    return <>{children}</>
  }

  if (status === 'checking') return <>{fallback}</>

  // Denied: a short panel while the redirect runs, instead of the protected
  // page rendering for a frame.
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-raised">
          <ShieldAlert className="h-5 w-5 text-text-secondary" />
        </div>
        <p className="text-[15px] font-semibold text-text-primary">
          {status === 'denied-anon' ? 'Sign-in required' : 'No access'}
        </p>
        <p className="text-[13px] text-text-secondary">
          {status === 'denied-anon'
            ? 'Taking you to the sign-in page.'
            : 'This area is for approved sellers. Redirecting to the homepage.'}
        </p>
      </div>
    </div>
  )
}
