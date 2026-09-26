import Link from 'next/link'
import { HUB_COPY } from '@/lib/content/theme'

/**
 * "Buy X from $Y" / "Sell X" module for a value page. Shared by every game on
 * the values pipeline — built once here rather than per game.
 *
 * Three states, because a value page can be in three honest positions:
 *
 *  1. We hold a price AND have listings   -> "Buy from $Y"
 *  2. We hold a price, no DropMarket stock -> "Sell yours" (the price is real,
 *     the supply is not — pretending otherwise sends buyers to an empty page)
 *  3. No price at all (every Steal An Egg PET)  -> "no market price yet", with
 *     a link to the item's source egg, which IS priced.
 *
 * Copy stays honest at low prices: Steal An Egg eggs clear around $0.97, so
 * "from $0.97" is what it says. No rounding up, no "from $1".
 */
export function ValuesBuyModule({
  itemName,
  gameName,
  buyHref,
  sellHref,
  cheapestUsd,
  hasListings,
  sourceItem,
}: {
  itemName: string
  gameName: string
  buyHref: string
  sellHref: string
  cheapestUsd: number | null
  hasListings: boolean
  /** For an unpriced item: the priced item it comes from (pet -> its egg). */
  sourceItem?: { name: string; slug: string; cheapestUsd: number | null } | null
}) {
  const fmt = (v: number) =>
    v < 1
      ? `$${v.toFixed(2)}`
      : v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  // 3. Unpriced item (pet catalogue page).
  if (cheapestUsd == null) {
    return (
      <div className="border border-[var(--ct-line)] bg-[var(--ct-surface)] p-5 sm:p-6">
        <p className="text-[15px] font-semibold text-[var(--ct-text)]">
          No market price yet for {itemName}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ct-text-muted)]">
          {itemName} is not sold directly on the marketplaces we track — players
          get it by hatching.{' '}
          {sourceItem
            ? `The ${sourceItem.name} it comes from does have a live price.`
            : 'We publish a value only when real listings back it.'}
        </p>
        {sourceItem && (
          <Link
            href={`/steal-an-egg/values/${sourceItem.slug}`}
            className="mt-4 inline-flex items-center gap-2 border border-[var(--ct-accent-border)] bg-[var(--ct-accent-deep)] px-4 py-2.5 text-[13px] font-semibold text-[var(--ct-accent-text)] transition-colors hover:bg-[var(--ct-hover)]"
          >
            {sourceItem.cheapestUsd != null
              ? `Buy ${sourceItem.name} from ${fmt(sourceItem.cheapestUsd)}`
              : `See ${sourceItem.name}`}
          </Link>
        )}
      </div>
    )
  }

  // 1. Priced with live DropMarket stock.
  if (hasListings) {
    return (
      <div className="border border-[var(--ct-line)] bg-[var(--ct-surface)] p-5 sm:p-6">
        <p className="text-[15px] font-semibold text-[var(--ct-text)]">
          Buy {itemName} from {fmt(cheapestUsd)}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ct-text-muted)]">
          {HUB_COPY.safedrop}
        </p>
        <Link
          href={buyHref}
          className="mt-4 inline-flex items-center gap-2 bg-[var(--ct-accent)] px-4 py-2.5 text-[13px] font-semibold text-[var(--ct-on-accent)] transition-opacity hover:opacity-90"
        >
          Buy {itemName}
        </Link>
      </div>
    )
  }

  // 2. Priced, but nobody is selling it here yet.
  return (
    <div className="border border-[var(--ct-line)] bg-[var(--ct-surface)] p-5 sm:p-6">
      <p className="text-[15px] font-semibold text-[var(--ct-text)]">
        {itemName} sells for about {fmt(cheapestUsd)}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ct-text-muted)]">
        No one is listing {itemName} on DropMarket right now. If you have one,
        this is a good moment to sell it.
      </p>
      <Link
        href={sellHref}
        className="mt-4 inline-flex items-center gap-2 border border-[var(--ct-accent-border)] bg-[var(--ct-accent-deep)] px-4 py-2.5 text-[13px] font-semibold text-[var(--ct-accent-text)] transition-colors hover:bg-[var(--ct-hover)]"
      >
        Sell {itemName} on {gameName}
      </Link>
    </div>
  )
}
