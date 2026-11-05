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
    // A plain request: a server action here queued ahead of the page's own work.
    fetch(`/api/account/listing-count?cap=${SELLER_PROMPT_LISTING_CAP}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then(({ count }: { count: number }) => { if (!alive) return; setListings(count); safeSession.set(key, String(count)) })
      .catch(() => { if (alive) setListings(0) })
    return () => { alive = false }
  }, [sellerId])

  const forgetCount = () => { if (sellerId) forgetSellerListingCount(sellerId) }

  if (loading) return { state: 'pending', forgetCount }
  if (!isSeller) return { state: 'visitor', forgetCount }
  if (listings === null) return { state: 'pending', forgetCount }
  if (listings >= SELLER_PROMPT_LISTING_CAP) return { state: 'hidden', forgetCount }
  return { state: 'seller', forgetCount }
}

/** A seller off to list: drop the cached "no listing yet" so the prompt re-checks. */
export function forgetSellerListingCount(sellerId: string) {
  safeSession.remove(cacheKey(sellerId))
}

function cacheKey(sellerId: string) {
  return `dm.banner.listings:${sellerId}`
}
