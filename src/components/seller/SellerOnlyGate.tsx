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
 *   1. useAuth still loading        → render the loader (no decision yet)
 *   2. No user at all               → toast + replace('/login?redirect=…')
 *   3. user.isApprovedSeller true   → render children
 *   4. user.isApprovedSeller false  → DB fallback (handles the case
 *      where useAuth's cache is stale — newly-approved sellers
 *      shouldn't be locked out, and freshly-demoted users
 *      shouldn't sneak in).
 *   5. DB confirms not approved     → toast + replace('/')
 *
 * Always uses router.replace so the protected URL doesn't sit in
 * history; back-button shouldn't loop the user back into the gate.
 */

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

type Status = 'checking' | 'allowed' | 'denied-anon' | 'denied-buyer'

export function SellerOnlyGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    if (loading) return

    if (!user) {
      setStatus('denied-anon')
      return
    }

    // Trust the hook's cached flag when it's positive — flipping it to
    // negative still falls through to a DB check below to avoid stale
    // cache locking out a real seller.
    if (user.isApprovedSeller === true) {
      setStatus('allowed')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('seller_applications')
          .select('status')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .maybeSingle()
        if (cancelled) return
        setStatus(data ? 'allowed' : 'denied-buyer')
      } catch {
        if (cancelled) return
        // Treat unknown errors as not-approved — failing closed is the
        // right default for a seller-only page.
        setStatus('denied-buyer')
      }
    })()

    return () => { cancelled = true }
  }, [loading, user])

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

  // Single loader card covers checking + both denied states so the
  // user sees a clean "we're figuring this out / bouncing you" panel
  // instead of the protected page rendering for a frame.
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        {status === 'denied-buyer' || status === 'denied-anon' ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border-default bg-bg-overlay">
            <ShieldAlert className="h-5 w-5 text-text-secondary" />
          </div>
        ) : (
          <Loader2 className="h-7 w-7 animate-spin text-lime" />
        )}
        <p className="text-[15px] font-semibold text-text-primary">
          {status === 'denied-anon'
            ? 'Sign-in required'
            : status === 'denied-buyer'
              ? 'No access'
              : 'Checking access…'}
        </p>
        <p className="text-[13px] text-text-secondary">
          {status === 'denied-anon'
            ? 'Taking you to the sign-in page.'
            : status === 'denied-buyer'
              ? "This area is for approved sellers. Redirecting to the homepage."
              : 'Just a moment while we verify your seller status.'}
        </p>
      </div>
    </div>
  )
}
