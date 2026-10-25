import 'server-only'
import { bindCategoryListingsTag } from '@/lib/revalidation/listings'
import { getImageAccent } from '@/lib/ui/image-accent.server'
import { gameTrademarkLine } from '@/lib/seo/trademark'
import { buildHubFaq, pickOfficialPack } from '@/lib/seo/hub-faq'
import { getCurrencyGuide } from '@/lib/currency-guides'
import { CHECKOUT_COINS } from '@/lib/payments/method-marks'
import { payssionSelectorMethods } from '@/lib/payments/providers/payssion/methods'
import { getHubCategoryStats, getHubCurrency, getHubOffers } from '@/app/(marketplace)/[gameSlug]/_hubData'
import { buildHubCards, splitCards, type HubCategory } from '@/app/(marketplace)/[gameSlug]/_hubModel'
import type { GameHomeData } from '../types'
import type { GameData } from './game'
import { getValuesFeed } from '@/lib/value-listings/feed'
import { getBlogRail } from '@/lib/blog/rail'

const NO_CURRENCY = { iconUrl: null, unitSuffix: null, unitsPerPrice: null }
/** Guides in the carousel (newest first). */
const GUIDE_LIMIT = 8

/**
 * Everything /[gameSlug] shows, in one parallel fan-out. Cookie-free reads
 * (listing read clients + the anon client), so the page stays ISR. The page
 * binds every category's listings tag, so a listing change anywhere in the
 * game refreshes it; the 24 h `revalidate` is only the safety net.
 */
export async function loadGameHome(game: GameData): Promise<GameHomeData> {
  const categories = (game.categories ?? []) as HubCategory[]
  const hasCurrency = categories.some((c) => c.type === 'currency')

  const [stats, currency, offers, values, guides] = await Promise.all([
    getHubCategoryStats(game.id, categories),
    hasCurrency ? getHubCurrency(game.slug) : Promise.resolve(NO_CURRENCY),
    getHubOffers(game.id, categories),
    getValuesFeed(game.slug),
    getBlogRail(game.slug, GUIDE_LIMIT),
    // Anchor this render to every category's listings tag (no-op reads), so
    // revalidateListingSurfaces refreshes the page with its category pages.
    Promise.all(categories.map((c) => bindCategoryListingsTag(c.id))),
  ])

  const cards = buildHubCards(game.slug, categories, stats, currency.unitSuffix)
  const { spotlight } = splitCards(cards)
  const itemsCard = cards.find((c) => c.type === 'items') ?? null
  const accountsCard = cards.find((c) => c.type === 'account') ?? null

  const currencyIcon =
    currency.iconUrl || (spotlight && !spotlight.icon.startsWith('/icons/categories/') ? spotlight.icon : null)
  const currencyAccent = currencyIcon ? await getImageAccent(currencyIcon) : null

  // The FAQ players actually search ("how much is 1000 robux in usd", "is it
  // safe to buy robux"…): one list for the accordion and the FAQPage JSON-LD.
  const guide = spotlight ? getCurrencyGuide(game.slug) : null
  const faq = buildHubFaq({
    gameName: game.name,
    currency: spotlight
      ? {
          name: spotlight.name,
          fromLabel: spotlight.fromLabel,
          avgDelivery: spotlight.avgDelivery,
          official: pickOfficialPack(guide?.official_prices?.packages),
          lowPrice: stats[spotlight.id]?.lowPrice ?? null,
          unitsPerPrice: currency.unitsPerPrice,
        }
      : null,
    items: itemsCard ? { fromLabel: itemsCard.fromLabel, count: itemsCard.count } : null,
    accounts: accountsCard ? { fromLabel: accountsCard.fromLabel, count: accountsCard.count } : null,
    paymentMethods: [...CHECKOUT_COINS.map((c) => c.label), ...payssionSelectorMethods().map((m) => m.label)],
    extra: guide?.page?.hub_faq ?? [],
  })

  return {
    game: { id: game.id, name: game.name, slug: game.slug, description: game.description ?? null, image_url: game.image_url ?? null },
    categories,
    cards,
    spotlight,
    currency: { iconUrl: currencyIcon, accent: currencyAccent },
    stats,
    offers,
    faq,
    trademark: gameTrademarkLine(game.name, { currency: spotlight?.name, owner: guide?.trademark_owner }),
    values,
    guides,
  }
}
