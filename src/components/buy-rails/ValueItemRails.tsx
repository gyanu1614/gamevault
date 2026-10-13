import type { ReactNode } from 'react'
import { getGameRails, getRailSettings, getValueItemRail } from '@/lib/buy-rails/server'
import { BuyRail } from './BuyRail'
import { BuyBar } from './BuyBar'
import { RailCardView } from './RailCardView'

/**
 * Value item pages (/[game]/values/[item]): the body below the hero, framed by
 * the buy rails from 1280px — the game's currency card left (with the price
 * alert's slot under it), this item's buy card right — and the phone bar for
 * the item below that, shown at once.
 *
 * Full page width (owner, 2026-10-11): the rails sit out toward the page
 * edges (32px gutter, equal both sides) and the content column takes the
 * middle; its sections keep their own max-w-7xl + px-8, so they centre there
 * and the px-8 adds to the 24px gap before each rail.
 *
 * Off (admin switch) → the children render exactly as before.
 */
export async function ValueItemRails({
  gameSlug,
  itemSlug,
  itemName,
  imageUrl,
  children,
}: {
  gameSlug: string
  itemSlug: string
  itemName: string
  imageUrl: string | null
  children: ReactNode
}) {
  const settings = await getRailSettings()
  if (!settings.value_item) return <>{children}</>
  // 'nightly': the game cards ride the nightly game-directory refresh these
  // pages already get; the item card is live (its own stock tag).
  const [rails, item] = await Promise.all([
    getGameRails(gameSlug, 'nightly'),
    getValueItemRail(gameSlug, itemSlug, itemName, imageUrl),
  ])

  return (
    <>
      <div className="w-full xl:grid xl:grid-cols-[220px_minmax(0,1fr)_220px] xl:items-start xl:gap-6 xl:px-8">
        <BuyRail label={rails.currency?.title ?? 'Shop'}>
          {rails.currency && <RailCardView card={rails.currency} surface="value_item" position="left" />}
          {/* Price alert slot (growth point 4): "Email me when it drops" goes here. */}
        </BuyRail>
        <div className="min-w-0">{children}</div>
        <BuyRail label={item.title}>
          <RailCardView card={item} surface="value_item" position="right" />
        </BuyRail>
      </div>
      <BuyBar card={item} surface="value_item" mode="immediate" />
    </>
  )
}
