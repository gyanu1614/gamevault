/**
 * Game hub (/[gameSlug]) model: pure functions, no server or client imports.
 *
 *   buildHubCards  one card per enabled category: link, icon, live count and
 *                  "from" price (the same numbers the category page's title
 *                  uses, from getCategoryStats). Currency leads.
 *   splitCards     the currency card becomes the Buy spotlight and leaves the
 *                  grid, so it is not shown twice.
 *   pickRail       an offer row: best offer (cheapest in stock) first, then
 *                  Recommended; the owner's rule for every listing grid.
 */
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import { sortOffers } from './[categorySlug]/_itemsSort'
import type { ItemOffer } from './[categorySlug]/_itemsTypes'

export interface HubCategory {
  id: string
  name: string
  slug: string
  /** game_categories.type: currency | items | account | service | gift_card | top_up */
  type: string | null
  icon_url?: string | null
}

export interface HubCategoryStat {
  count: number
  lowPrice: number | null
  avgDeliveryLabel: string | null
}

export interface HubCard {
  id: string
  name: string
  slug: string
  type: string | null
  href: string
  icon: string
  count: number
  fromLabel: string | null
  avgDelivery: string | null
  isCurrency: boolean
}

const ICON_BY_TYPE: Record<string, string> = {
  currency: 'currency',
  items: 'items',
  account: 'accounts',
  service: 'boosting',
  top_up: 'top-up',
}

/** The category's own icon (admin upload) or the house glyph for its type. */
export function categoryIcon(type: string | null | undefined, iconUrl: string | null | undefined): string {
  if (iconUrl) return iconUrl
  return `/icons/categories/${ICON_BY_TYPE[type ?? ''] ?? 'items'}.svg`
}

/** "$0.0052/Robux" for per-unit currency, "$4.99" otherwise; null with no price. */
export function fromLabel(lowPrice: number | null | undefined, unitSuffix: string | null): string | null {
  if (lowPrice == null || !(lowPrice > 0)) return null
  return `$${formatStatPrice(lowPrice)}${unitSuffix ? `/${unitSuffix}` : ''}`
}

export function buildHubCards(
  gameSlug: string,
  categories: HubCategory[],
  stats: Record<string, HubCategoryStat | undefined>,
  /** Per-unit suffix for the currency card ("Robux"), null for bundle games. */
  currencyUnitSuffix: string | null,
): HubCard[] {
  const cards = categories.map<HubCard>((c) => {
    const s = stats[c.id]
    const isCurrency = c.type === 'currency'
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      type: c.type,
      href: `/${gameSlug}/${c.slug}`,
      icon: categoryIcon(c.type, c.icon_url),
      count: s?.count ?? 0,
      fromLabel: fromLabel(s?.lowPrice, isCurrency ? currencyUnitSuffix : null),
      avgDelivery: s?.avgDeliveryLabel ?? null,
      isCurrency,
    }
  })
  // Stable: currency first, everything else in the admin's order.
  return [...cards.filter((c) => c.isCurrency), ...cards.filter((c) => !c.isCurrency)]
}

export function splitCards(cards: HubCard[]): { spotlight: HubCard | null; grid: HubCard[] } {
  const spotlight = cards.find((c) => c.isCurrency) ?? null
  return { spotlight, grid: spotlight ? cards.filter((c) => c.id !== spotlight.id) : cards }
}

export function pickRail(offers: ItemOffer[], limit: number): ItemOffer[] {
  return sortOffers(offers, 'recommended').slice(0, limit)
}

/** "Buy and sell Fortnite V-Bucks, accounts and skins from verified sellers." */
export function hubPitch(gameName: string, cards: HubCard[]): string {
  const names = cards.map((c) => (c.isCurrency ? c.name : c.name.toLowerCase()))
  const list =
    names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `Buy and sell ${gameName}${list ? ` ${list}` : ''} from verified sellers.`
}
