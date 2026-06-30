'use client'

import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import BecomeSellerBanner from './BecomeSellerBanner'
import { Loader2 } from 'lucide-react'

/**
 * HOC that wraps seller-only pages with access control.
 * Shows BecomeSellerBanner if the user is not an approved seller.
 *
 * V22 — Reads seller status straight from useAuth (`isApprovedSeller`,
 * derived from the fresh profiles.role). No separate seller_applications
 * query — that was a redundant per-page round-trip.
 */
export function withSellerAccess<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return function SellerProtectedPage(props: P) {
    const { user, loading } = useAuth()
    const router = useRouter()

    // Redirect if not authenticated
    useEffect(() => {
      if (!loading && !user) {
        router.push('/login')
      }
    }, [user, loading, router])

    // Loading state
    if (loading || !user) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
        </div>
      )
    }

    // Not approved seller - show banner
    if (!user.isApprovedSeller) {
      return <BecomeSellerBanner />
    }

    // Approved seller - render component
    return <Component {...props} />
  }
}
