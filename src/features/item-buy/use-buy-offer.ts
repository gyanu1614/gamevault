'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { trackValueEvent } from '@/lib/value-listings/track'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'

/**
 * Buy one offer from the pet page — the listing page's flow: the seller's own
 * listing opens its editor; signed out, the sign-in dialog opens in place with
 * checkout as the way back; otherwise straight to checkout with the quantity.
 * While the session is still loading the click goes to checkout (a protected
 * page that signs the visitor in itself), never to the dialog. The funnel
 * beacon records which listing the pet page sold.
 */
export function useBuyOffer(gameSlug: string, itemSlug: string) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { open: openAuth } = useAuthDialog()
  const [navigating, startNav] = useTransition()
  const viewerId = user?.id ?? null

  const buy = (offer: ItemOffer, qty: number, variant: string | null) => {
    if (viewerId && offer.sellerId === viewerId) {
      router.push(`/sell/edit/${offer.id}`)
      return
    }
    trackValueEvent({ event: 'listing_opened', surface: 'item_buy', game: gameSlug, item: itemSlug, variant, listing: offer.id })
    const checkout = `/checkout/${offer.id}?qty=${qty}`
    if (!viewerId && !loading) {
      openAuth('login', { redirect: checkout })
      return
    }
    startNav(() => router.push(checkout))
  }

  return { buy, navigating, viewerId }
}
