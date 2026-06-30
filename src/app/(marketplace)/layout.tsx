/**
 * Marketplace route group layout — V21/P7.c
 *
 * Wraps every marketplace route ((marketplace)/[gameSlug]/…,
 * /[gameSlug]/[categorySlug]/…, /[gameSlug]/[categorySlug]/[listing]/…)
 * in the canonical hero backdrop so every game page shares the same
 * brand surface. Per memory:hero-backdrop-pattern — we ship ONE
 * marketplace hero across all games, not a per-game variant. The
 * product (game cover, characters, listings) does the differentiating
 * inside the page; the backdrop frames it.
 */

import type { ReactNode } from 'react'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <HeroBackdropPreload name="marketplace" />
      <HeroBackdrop name="marketplace">{children}</HeroBackdrop>
    </>
  )
}
