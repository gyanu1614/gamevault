'use client'

import { useMemo } from 'react'
import { buyCtaCopy, resolveBuyState, type ItemStock } from '@/lib/value-listings/buy-state'
import { trackValueEvent } from '@/lib/value-listings/track'
import type { ValueSurface } from '@/lib/value-listings/events'

/**
 * The value-page buy button for the chosen variant: state, words, link, and
 * the funnel click event. Stock comes from the server (DropMarket's own live
 * listings); only the variant choice is client-side.
 */
export function useBuyCta(input: {
  gameSlug: string
  categorySlug: string
  itemSlug: string
  /** Stored variant key, or null for an item-level button. */
  variant: string | null
  /** Shown in the state-2 sub-line ("Diamond not listed right now"). */
  variantName: string
  stock: ItemStock | null
  surface: ValueSurface
}) {
  const { gameSlug, categorySlug, itemSlug, variant, variantName, stock, surface } = input
  return useMemo(() => {
    const state = resolveBuyState({ gameSlug, categorySlug, itemSlug, variant, stock })
    const copy = buyCtaCopy(state, variantName)
    const href = state.kind === 'none' ? state.similarHref : state.href
    const onClick = () =>
      trackValueEvent({ event: 'cta_click', surface, game: gameSlug, item: itemSlug, variant, state: state.kind })
    // Our lowest price + offer count behind the button (the hero leads with it).
    const priceUsd = state.kind === 'none' ? null : state.priceUsd
    const count = state.kind === 'none' ? 0 : state.count
    return { state: state.kind, label: copy.label, subline: copy.subline, href, onClick, priceUsd, count }
  }, [gameSlug, categorySlug, itemSlug, variant, variantName, stock, surface])
}
