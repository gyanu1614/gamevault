/**
 * buildGameHome — the loader's data → what each section of /[gameSlug]
 * renders. Pure (no server or client imports), so every show/hide rule is a
 * unit test. A section that has nothing to show is null (or an empty list)
 * and GameHome leaves it out.
 */
import { pickTopSelling } from '@/app/(marketplace)/[gameSlug]/_hubModel'
import { sortGrid, toGridItems } from '@/features/items-grid/model/grid'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import type { GameHomeData, GameHomeModel, GuidesModel, HotNewModel, OfferRowModel, PopularRowModel, PriceMovesModel, ToolsModel } from '../types'
import { gameTools } from './tools'
import { aboutRows } from './about'
import { howItWorksHighlight } from './how-it-works'
import { heroFacts } from './hero'
import { pickHotNew } from './hot-new'
import { pickMovers } from './movers'
import { itemNoun, itemNounSingular } from './item-noun'

/** Offers per Top Selling row (the rail scrolls; See All goes to the category). */
const ROW_LIMIT = 12

/** Games whose items row ranks pets by market demand (owner, 2026-11-03); needs `pnpm adoptme:popularity` or its like. */
const POPULAR_ROW_GAMES = new Set(['adopt-me'])

function buildPopular({ game, values }: GameHomeData, noun: string, itemsHref: string | null): PopularRowModel | null {
  if (!values || !itemsHref || !POPULAR_ROW_GAMES.has(game.slug)) return null
  const items = sortGrid(toGridItems(game.slug, values), 'recommended')
    .filter((i) => i.offers > 0)
    .slice(0, ROW_LIMIT)
  return items.length > 0 ? { title: `Popular ${game.name} ${noun}`, seeAllHref: itemsHref, items } : null
}

const POST_TYPE: Record<string, { label: string; accent: string }> = {
  guide: { label: 'Guide', accent: '#7DB4FF' },
  value: { label: 'Values', accent: '#B6E36A' },
  seller: { label: 'Selling Guide', accent: '#F5C451' },
  codes: { label: 'Codes', accent: '#C18CFF' },
}

function buildGuides({ game, guides }: GameHomeData): GuidesModel | null {
  if (guides.length === 0) return null
  return {
    title: `${game.name} Guides`,
    moreHref: `/${game.slug}/blog`,
    posts: guides.map((p) => {
      const t = POST_TYPE[p.postType ?? 'guide'] ?? POST_TYPE.guide
      return { href: p.href, title: p.title, excerpt: p.excerpt, cover: p.cover, readMinutes: p.readMinutes, typeLabel: t.label, accent: t.accent }
    }),
  }
}

function buildTools({ game, values }: GameHomeData, noun: string): ToolsModel | null {
  const tiles = gameTools(game.slug, game.name, noun)
  if (tiles.length === 0) return null
  const art = (values?.items ?? [])
    .filter((i) => i.imageUrl && i.valueUsd != null)
    .sort((a, b) => b.valueUsd! - a.valueUsd!)
    .slice(0, 2)
    .map((i) => i.imageUrl!)
  return { title: `Free ${game.name} Trading Tools`, tiles, art }
}

function buildPriceMoves({ game, values }: GameHomeData): PriceMovesModel | null {
  if (!values) return null
  const moves = pickMovers(values.items)
  if (!moves) return null
  const updated = values.updatedAt ? new Date(values.updatedAt) : null
  return {
    title: `Biggest ${game.name} Price Moves This Week`,
    listHref: `/${game.slug}/values`,
    updatedLabel:
      updated && !Number.isNaN(updated.getTime())
        ? `Prices updated ${updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
        : 'Updated daily',
    ...moves,
  }
}

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

  const popular = buildPopular(data, noun, itemsCard?.href ?? null)
  const topSelling: OfferRowModel[] = []
  if (!popular && itemsCard && offers.items.length > 0) {
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
  const offerCount = cards.reduce((n, c) => n + c.count, 0)
  const lowPrice = goodsLow.length > 0 ? Math.min(...goodsLow) : null

  // About collage: the game's most valuable items, else our own offers' pictures.
  const valuable = (data.values?.items ?? [])
    .filter((i) => i.imageUrl && i.valueUsd != null)
    .sort((a, b) => b.valueUsd! - a.valueUsd!)
    .map((i) => i.imageUrl!)
  const offerArt = offers.items.map((o) => o.imageUrl).filter((u): u is string => !!u)
  const collage = [...new Set([...valuable, ...offerArt])].slice(0, 5)

  return {
    gameSlug: game.slug,
    gameName: game.name,
    itemNoun: noun,
    itemNounSingular: itemNounSingular(game.slug),
    header: {
      gameName: game.name,
      gameImageUrl: game.image_url,
      itemNoun: noun,
      facts: heroFacts({ gameName: game.name, offerCount, lowPrice, avgDelivery: delivery }),
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
    popular,
    topSelling,
    hotNew: buildHotNew(data, noun, now),
    priceMoves: buildPriceMoves(data),
    tools: buildTools(data, noun),
    guides: buildGuides(data),
    howItWorks: {
      title: `How to Buy ${game.name} ${noun} Safely`,
      highlight: howItWorksHighlight({ spotlight, currencyIconUrl: data.currency.iconUrl, gameImageUrl: game.image_url, totalOffers: offerCount }),
    },
    whyBuy: { count: offerCount, fromPrice: lowPrice != null ? `$${formatStatPrice(lowPrice)}` : null },
    about: {
      gameName: game.name,
      gameImageUrl: game.image_url,
      rows: aboutRows({
        gameSlug: game.slug,
        gameName: game.name,
        itemNoun: noun,
        itemNounSingular: itemNounSingular(game.slug),
        categoryNames: cards.map((c) => c.name),
        offerCount,
        lowPrice,
        hasValues: data.values != null,
        currencyName: spotlight?.name ?? null,
      }),
      art: collage,
      categories: cards.map((c) => ({ name: c.name, href: c.href, count: c.count })),
    },
    productSchema: productSchema(data, noun, itemsCard?.count ?? 0),
    faq: data.faq,
    trademark: data.trademark,
  }
}

/** The item offers this page shows, as one Product with an AggregateOffer (prices on the page, never a guess). */
function productSchema({ game, offers }: GameHomeData, noun: string, liveCount: number): GameHomeModel['productSchema'] {
  const prices = offers.items.map((o) => o.pricePerUnit).filter((p) => Number.isFinite(p) && p > 0)
  if (prices.length === 0) return null
  return {
    name: `${game.name} ${noun}`,
    description: `Buy ${game.name} ${noun.toLowerCase()} from verified sellers on DropMarket, with SafeDrop Protection on every order.`,
    brand: game.name,
    lowPrice: Math.min(...prices),
    highPrice: Math.max(...prices),
    offerCount: Math.max(liveCount, prices.length),
    image: offers.items.find((o) => o.imageUrl)?.imageUrl ?? game.image_url,
  }
}
