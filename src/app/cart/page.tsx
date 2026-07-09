'use client'

/**
 * Cart Page - DEPRECATED
 * @deprecated Cart system removed in favor of direct "Buy Now" checkout (Feb 2026).
 * This page now redirects to marketplace.
 * See: progress/24feb/03_CHECKOUT_SAFEDROP_CART_FIXES.md
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function CartPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to marketplace since cart is deprecated
    router.replace('/browse')
  }, [router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-lime-text mx-auto mb-4" />
        <p className="text-text-secondary">Redirecting to marketplace...</p>
      </div>
    </div>
  )
}
