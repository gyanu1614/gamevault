/**
 * Marketplace route group layout.
 *
 * Every route in this group is a page of ONE game (/[gameSlug]/…), and each
 * draws that game's own hero background through `GameHeroBackdrop`
 * (src/components/marketplace/GameHeroBackdrop.tsx): category pages, the game
 * landing, listing / item pages and the values / calculator / blog / sell
 * hubs. So this layout no longer paints the shared `marketplace.avif`
 * backdrop — it would only load an image the per-game band covers.
 *
 * `relative isolate` keeps the old stacking contract: page content (and the
 * hero band it carries) stays in its own context under the fixed navbar.
 */

import type { ReactNode } from 'react'

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return <div className="relative isolate min-h-screen">{children}</div>
}
