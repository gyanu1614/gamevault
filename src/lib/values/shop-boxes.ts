/**
 * The boxes in MM2's Shop today, from the researched seed
 * (scripts/values-seeds/murder-mystery-2.boxes.json, in-game "Chances Per
 * Item" screen + wiki), imported at build time. The free-items guide reads
 * the box odds and each box's Godly and Chroma from here, so its numbers are
 * the research's numbers. Pure; the page joins the slugs to live prices.
 */

import mm2Boxes from '../../../scripts/values-seeds/murder-mystery-2.boxes.json'
import type { TierOdds } from './free-guide'

export interface ShopBoxItem {
  name: string
  /** values_items slug (null when the catalogue has no row). */
  slug: string | null
}

export interface ShopBox {
  slug: string
  name: string
  kind: 'box' | 'egg'
  odds: TierOdds
  godlies: ShopBoxItem[]
  chromas: ShopBoxItem[]
}

type RawBox = (typeof mm2Boxes.boxes)[number]

function tierOdds(b: RawBox): TierOdds | null {
  const pct = (r: string) => b.odds_by_rarity.find((o) => o.rarity === r)?.pct
  const o = {
    common: pct('Common'),
    uncommon: pct('Uncommon'),
    rare: pct('Rare'),
    legendary: pct('Legendary'),
    godly: pct('Godly'),
    chroma: pct('Chroma'),
  }
  return Object.values(o).every((v) => typeof v === 'number') ? (o as TierOdds) : null
}

function toShopBox(b: RawBox): ShopBox | null {
  const odds = tierOdds(b)
  if (!odds || (b.kind !== 'box' && b.kind !== 'egg')) return null
  const item = (i: RawBox['items'][number]): ShopBoxItem => ({ name: i.name, slug: i.slug ?? null })
  return {
    slug: b.slug,
    name: b.name,
    kind: b.kind,
    odds,
    godlies: b.items.filter((i) => i.rarity === 'Godly' && !i.chroma).map(item),
    chromas: b.items.filter((i) => i.chroma).map(item),
  }
}

const SHOP: Record<string, ShopBox[]> = {
  'murder-mystery-2': mm2Boxes.boxes
    .filter((b) => b.in_shop)
    .map(toShopBox)
    .filter((b): b is ShopBox => b !== null),
}

/** Every box (and egg) in the game's Shop today, in the seed's order. */
export function shopBoxes(gameSlug: string): ShopBox[] {
  return SHOP[gameSlug] ?? []
}

/** The weapon boxes only (not the pet egg). */
export const weaponBoxes = (gameSlug: string) => shopBoxes(gameSlug).filter((b) => b.kind === 'box')

/**
 * The odds every weapon box shares (MM2: 70 / 15 / 10 / 5 / 0.2 + Chroma
 * 0.004). Null if the boxes disagree — the page then must not quote one figure.
 */
export function sharedWeaponBoxOdds(gameSlug: string): TierOdds | null {
  const boxes = weaponBoxes(gameSlug)
  if (boxes.length === 0) return null
  const first = JSON.stringify(boxes[0].odds)
  return boxes.every((b) => JSON.stringify(b.odds) === first) ? boxes[0].odds : null
}
