'use client'

import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import BecomeSellerBanner from './BecomeSellerBanner'
import { Loader2 } from 'lucide-react'

/**
 * HOC that wraps seller-only pages with access control
 * Shows BecomeSellerBanner if user is not an approved seller
 */
export function withSellerAccess<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return function SellerProtectedPage(props: P) {
    const { user, loading } = useAuth()
    const router = useRouter()
    const [sellerStatusChecked, setSellerStatusChecked] = useState(false)
    const [isApprovedSeller, setIsApprovedSeller] = useState(false)

    // Redirect if not authenticated
    useEffect(() => {
      if (!loading && !user) {
        router.push('/login')
      }
    }, [user, loading, router])

    // Verify seller status
    useEffect(() => {
      const checkSellerStatus = async () => {
        if (user && !sellerStatusChecked) {
          // Trust the useAuth hook first
          if (user.isApprovedSeller === true) {
            setIsApprovedSeller(true)
            setSellerStatusChecked(true)
            return
          }

          // Fallback: check directly from database
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()

          const { data } = await supabase
            .from('seller_applications')
            .select('status')
            .eq('user_id', user.id)
            .eq('status', 'approved')
            .single()

          setIsApprovedSeller(!!data)
          setSellerStatusChecked(true)
        }
      }

      checkSellerStatus()
    }, [user, sellerStatusChecked])

    // Loading state
    if (loading || !user || !sellerStatusChecked) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      )
    }

    // Not approved seller - show banner
    if (!isApprovedSeller) {
      return <BecomeSellerBanner />
    }

    // Approved seller - render component
    return <Component {...props} />
  }
}
