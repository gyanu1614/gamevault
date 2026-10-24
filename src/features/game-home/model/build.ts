/**
 * buildGameHome — the loader's data → what each section of /[gameSlug]
 * renders. Pure (no server or client imports), so every show/hide rule is a
 * unit test. A section that has nothing to show is null (or an empty list)
 * and GameHome leaves it out.
 */
import { hubPitch, pickTopSelling } from '@/app/(marketplace)/[gameSlug]/_hubModel'
import type { GameHomeData, GameHomeModel, HotNewModel, OfferRowModel } from '../types'
import { heroFacts } from './hero'
import { pickHotNew } from './hot-new'
import { itemNoun, itemNounSingular } from './item-noun'

/** Offers per Top Selling row (the rail scrolls; See All goes to the category). */
const ROW_LIMIT = 12

function buildHotNew({ game, values }: GameHomeData, noun: string, now: number): HotNewModel | null {
  if (!values) return null
  const cards = pickHotNew(values, now)
  if (cards.length === 0) return null
  return {
    title: `Hot New ${game.name} ${noun}`,
    // The value lists open on their New view from ?view=new (read client-side).
    allHref: `/${game.slug}/values?view=new`,
    sellHref: `/${game.slug}/sell`,
    cards,
  }
}

/**
 * `now` seeds the daily orders (Hot New): the page re-renders on every listing
 * change and at least every 24 h (its ISR window), so the order moves daily.
 */
export function buildGameHome(data: GameHomeData, now: number): GameHomeModel {
  const { game, cards, spotlight, stats, offers } = data
  const noun = itemNoun(game.slug)
  const itemsCard = cards.find((c) => c.type === 'items') ?? null
  const accountsCard = cards.find((c) => c.type === 'account') ?? null

  const topSelling: OfferRowModel[] = []
  if (itemsCard && offers.items.length > 0) {
    topSelling.push({ title: `Top Selling ${game.name} ${noun}`, seeAllHref: itemsCard.href, offers: pickTopSelling(offers.items, ROW_LIMIT) })
  }
  if (accountsCard && offers.accounts.length > 0) {
    topSelling.push({ title: `Top Selling ${game.name} Accounts`, seeAllHref: accountsCard.href, offers: pickTopSelling(offers.accounts, ROW_LIMIT) })
  }

  // Hero facts: every live offer; the "from" price and delivery come from the
  // goods (a per-Robux price would read "from $0.0052"), items first.
  const goods = cards.filter((c) => !c.isCurrency)
  const goodsLow = goods
    .map((c) => stats[c.id]?.lowPrice)
    .filter((p): p is number => typeof p === 'number' && p > 0)
  const delivery = (itemsCard && stats[itemsCard.id]?.avgDeliveryLabel) || goods.map((c) => stats[c.id]?.avgDeliveryLabel).find(Boolean) || null

  return {
    gameSlug: game.slug,
    gameName: game.name,
    itemNoun: noun,
    itemNounSingular: itemNounSingular(game.slug),
    hero: {
      gameName: game.name,
      gameImageUrl: game.image_url,
      pitch: hubPitch(game.name, cards),
      facts: heroFacts({
        gameName: game.name,
        offerCount: cards.reduce((n, c) => n + c.count, 0),
        lowPrice: goodsLow.length > 0 ? Math.min(...goodsLow) : null,
        avgDelivery: delivery,
      }),
    },
    currency: spotlight
      ? {
          gameName: game.name,
          name: spotlight.name,
          href: spotlight.href,
          iconUrl: data.currency.iconUrl,
          accent: data.currency.accent,
          fromLabel: spotlight.fromLabel,
          avgDelivery: spotlight.avgDelivery,
        }
      : null,
    topSelling,
    openingSoon: cards.length === 0,
    hotNew: buildHotNew(data, noun, now),
    faq: data.faq,
    trademark: data.trademark,
  }
}
