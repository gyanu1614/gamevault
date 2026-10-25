/**
 * Values feed mappers: each game's value-list row shape → FeedItem. Pure, so
 * the field choices are unit-tested; the server read lives in ./index.ts. A
 * new game on the generic values template needs nothing here.
 */
import type { AdoptMePetItem } from '@/app/(marketplace)/[gameSlug]/values/_adoptMeListModel'
import { cardVariant } from '@/app/(marketplace)/[gameSlug]/values/_adoptMeListModel'
import type { BrainrotDirectoryItem } from '@/app/(marketplace)/[gameSlug]/values/_sabListModel'
import type { ValueListRow } from '@/app/(marketplace)/[gameSlug]/values/_generic/valueListModel'
import type { FeedItem } from './types'

const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

/** Adopt Me: the card's form (Fly Ride, else the nearest priced) carries the trend and value. */
export function fromAdoptMe(rows: readonly AdoptMePetItem[]): FeedItem[] {
  return rows.map((p) => {
    const v = cardVariant(p.values, 'FR')
    const value = p.values[v]
    return {
      slug: p.slug,
      name: p.name,
      imageUrl: p.imageUrl,
      href: p.hasPage ? `/adopt-me/values/${p.slug}` : null,
      rarityKey: p.rarity ?? null,
      itemType: null,
      isNew: p.isNew === true,
      trendPct: value?.trendPct ?? null,
      trendLabel: value?.trendPct != null ? v : null,
      valueUsd: value?.cashUsd ?? null,
    }
  })
}

/** Steal a Brainrot: the plain (default mutation) price. */
export function fromSab(rows: readonly BrainrotDirectoryItem[]): FeedItem[] {
  return rows.map((b) => ({
    slug: b.slug,
    name: b.name,
    imageUrl: b.image_url,
    href: `/steal-a-brainrot/values/${b.slug}`,
    rarityKey: b.rarity ?? null,
    itemType: null,
    isNew: b.isNew === true,
    trendPct: b.trendPct ?? null,
    trendLabel: null,
    valueUsd: num(b.average_usd) ?? num(b.display_price_usd),
  }))
}

/** Generic values template (MM2, Steal an Egg, any future game). */
export function fromGeneric(rows: readonly ValueListRow[]): FeedItem[] {
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    imageUrl: r.imageUrl,
    href: r.href,
    rarityKey: r.rarity,
    itemType: r.itemType,
    isNew: r.isNew === true,
    trendPct: r.trendPct,
    trendLabel: null,
    valueUsd: r.marketUsd ?? r.cheapestUsd,
  }))
}
