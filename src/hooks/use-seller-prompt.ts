'use client'

/**
 * useSellerPrompt — which seller prompt the viewer should see, from the same
 * `useAuth()` profile the navbar reads. No request for visitors; one bounded
 * count (session-cached) for a seller, so the lime variant goes away once
 * they have `SELLER_PROMPT_LISTING_CAP` listings.
 *
 *   pending → auth (or the seller's count) still resolving: reserve the
 *             space, paint nothing — never the wrong variant (the old bar
 *             flashed amber then green on login).
 *   visitor → signed out, or a buyer.
 *   seller  → a seller with fewer than the cap.
 *   hidden  → a seller who is already selling.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { safeSession } from '@/lib/safe-storage'
import { sellerListingCount } from '@/lib/actions/seller-banner'
import { SELLER_PROMPT_LISTING_CAP, type SellerPromptVariant } from '@/lib/seller/seller-prompt'

export type SellerPromptState = 'pending' | 'hidden' | SellerPromptVariant

export function useSellerPrompt(): { state: SellerPromptState; forgetCount: () => void } {
  const { profile, loading } = useAuth()
  const isSeller = profile?.role === 'seller'
  const sellerId = isSeller ? profile?.id ?? null : null
  // null = unknown yet
  const [listings, setListings] = useState<number | null>(null)

  useEffect(() => {
    if (!sellerId) { setListings(null); return }
    const key = cacheKey(sellerId)
    const cached = safeSession.get(key)
    if (cached !== null && /^\d+$/.test(cached)) { setListings(Number(cached)); return }
    let alive = true
    sellerListingCount(SELLER_PROMPT_LISTING_CAP)
      .then((n) => { if (!alive) return; setListings(n); safeSession.set(key, String(n)) })
      .catch(() => { if (alive) setListings(0) })
    return () => { alive = false }
  }, [sellerId])

  const forgetCount = () => { if (sellerId) safeSession.remove(cacheKey(sellerId)) }

  if (loading) return { state: 'pending', forgetCount }
  if (!isSeller) return { state: 'visitor', forgetCount }
  if (listings === null) return { state: 'pending', forgetCount }
  if (listings >= SELLER_PROMPT_LISTING_CAP) return { state: 'hidden', forgetCount }
  return { state: 'seller', forgetCount }
}

function cacheKey(sellerId: string) {
  return `dm.banner.listings:${sellerId}`
}
