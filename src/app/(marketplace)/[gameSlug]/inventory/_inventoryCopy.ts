/**
 * Every server string on /[game]/inventory. Written for search first — the
 * H1 and FAQ carry what players type ("mm2 inventory value calculator", "how
 * much is my mm2 inventory worth", "mm2 inventory worth") — and true to the
 * data: the counts are the live priced set, the method matches the
 * methodology page (asking prices from established sellers, three listings
 * before a price), and the FAQ + FAQPage schema reuse the visible sentences.
 * Pure; unit-tested in inventoryCopy.test.ts.
 */

import { fmtUsd } from '@/lib/values/inventory'

export interface CopyCtx {
  /** "Murder Mystery 2" */
  gameName: string
  /** "MM2" */
  shortName: string
}

/** Live numbers behind the copy (the priced catalogue). */
export interface InventoryStats {
  /** Items with a published price (the ones the tool can add). */
  priced: number
  /** Every item in the catalogue. */
  total: number
  /** Reputable listings behind the priced set. */
  listings: number
  /** The most valuable priced item (cheapest price). */
  top: { name: string; usd: number } | null
}

const n = (x: number) => x.toLocaleString('en-US')

export const pageTitle = (c: CopyCtx) => `${c.shortName} Inventory Value Calculator: What Is Your Inventory Worth?`

export const metaTitle = (c: CopyCtx) => `${c.shortName} Inventory Value Calculator: Your Inventory Worth in USD`

export function metaDescription(c: CopyCtx, s: InventoryStats): string {
  return `Add your ${c.gameName} items and see what your inventory is worth in real money. ${n(s.priced)} ${c.shortName} items priced in USD from ${n(s.listings)} live listings by professional sellers. Share it as an image or a Discord trade ad.`
}

/** The answer-first lead under the H1: how it works, where the prices come from. */
export function lead(c: CopyCtx, s: InventoryStats): { strong: string; rest: string } {
  return {
    strong: `Add your ${c.shortName} items and their quantities, and the calculator adds up what your inventory is worth in US dollars at today's prices.`,
    rest: `${n(s.priced)} ${c.gameName} knives, guns and pets carry a live price from ${n(s.listings)} listings by professional sellers, checked every day. Your list stays in your browser and in the link, so you can share it.`,
  }
}

// ── the method section (server text, so the page is crawlable) ──────────────

export const methodTitle = (c: CopyCtx) => `How The ${c.shortName} Inventory Calculator Works`

export function methodLead(c: CopyCtx, s: InventoryStats): { strong: string; rest: string } {
  return {
    strong: `Every price is real money, not value points.`,
    rest: `We read the live ${c.gameName} listings of established sellers every day, and an item gets a price only once at least three of their listings back it. ${s.top ? `The most valuable item you can add today is ${s.top.name} at ${fmtUsd(s.top.usd)}.` : ''}`.trim(),
  }
}

export interface MethodStep {
  icon: 'search' | 'qty' | 'total' | 'share'
  title: string
  value: string
}

export function methodSteps(c: CopyCtx, s: InventoryStats): MethodStep[] {
  return [
    { icon: 'search', title: 'Add Your Items', value: `Search ${n(s.priced)} priced ${c.shortName} items by name` },
    { icon: 'qty', title: 'Set Quantities', value: 'Up to 999 copies of each item' },
    { icon: 'total', title: 'See Your Total', value: 'Cheapest price and market value, in USD' },
    { icon: 'share', title: 'Share It', value: 'An image, a link or a Discord trade ad' },
  ]
}

export const pricesCallout = {
  title: 'Cheapest vs Market',
  body: 'The total adds up the lowest reputable asking price of each item, what the same items cost to buy today; market value adds up the typical asking price.',
}

// ── FAQ (= FAQPage schema) ──────────────────────────────────────────────────

export function faq(c: CopyCtx, s: InventoryStats): { q: string; a: string }[] {
  const unpriced = Math.max(0, s.total - s.priced)
  return [
    {
      q: `How much is my ${c.shortName} inventory worth?`,
      a: `Add each item and its quantity to the calculator above: it adds up today's cheapest price of every item in US dollars, with the market value beside it. ${n(s.priced)} ${c.shortName} items are priced from ${n(s.listings)} live listings by professional sellers.`,
    },
    ...(s.top
      ? [
          {
            q: `What is the most valuable item in ${c.shortName}?`,
            a: `${s.top.name} is the most valuable ${c.gameName} item you can add today, at ${fmtUsd(s.top.usd)} (its cheapest live price). Prices change daily, so the calculator always uses the latest one.`,
          },
        ]
      : []),
    {
      q: `Where do the ${c.shortName} prices come from?`,
      a: `From live listings by professional sellers on a third-party marketplace, read every day. Only sellers with an established review record count, and an item needs at least three of their listings before it gets a price. These are asking prices, not completed sales.`,
    },
    {
      q: 'What is the difference between the total and the market value?',
      a: `The total adds up the lowest reputable asking price of each item: what the same items would cost to buy today. The market value adds up the typical asking price, the middle of the cheapest few listings, so it is usually a little higher.`,
    },
    {
      q: `Are these ${c.shortName} trade values or real money?`,
      a: `Real money. Every number is a price in US dollars measured from live listings, not community value points.`,
    },
    {
      q: `How do I share my ${c.shortName} inventory?`,
      a: `Your inventory lives in the page link, so copying the link shares it. Share My Inventory draws an image of your total and top items, and Copy Trade Ad copies a Discord-ready list with values. Both are made in your browser; nothing is uploaded.`,
    },
    ...(unpriced > 0
      ? [
          {
            q: 'Why is an item missing from the calculator?',
            a: `Only priced items can be added. ${n(unpriced)} ${c.shortName} items have fewer than three reputable listings right now, so they have no price yet; each one appears as soon as the listings are there.`,
          },
        ]
      : []),
  ]
}
