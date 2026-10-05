/**
 * `eldorado-structured` normaliser — identity from Eldorado's STRUCTURED
 * offer fields, never from the free-text title.
 *
 * Built against 14,525 live Murder Mystery 2 offers (gameId 204, 2026-10-04):
 *   - identity  = tradeEnvironmentValues 'Item type' + 'Item name' (+ Rarity).
 *     The same name is a different item per type ("Splash" knife ≠ "Splash"
 *     gun), and a year suffix is part of the name ("Pumpkin (2021)").
 *   - variant   = attributes[mm2-properties] Common | Chroma. Attribute FIRST,
 *     title as fallback — the rule both live games settled on (titles omit the
 *     variant: "Fire Dog" is a Chroma listing). A listing whose attribute says
 *     the default while its title EXPLICITLY names another variant (73 "Chroma
 *     X" titles tagged Common) is ambiguous and never priced.
 *   - product key = offer.standardizedProductKey ("204|KNIFE|FANG|GODLY") —
 *     stored for audit; it carries rarity, not the chroma variant.
 *
 * Pure (no I/O, no `@/` imports) so the collector scripts load it via tsx and
 * the tests run it directly.
 */
import type { EldoradoStructuredConfig } from '../sources/eldorado-structured-games'

/** One offer as the collector stores it in the feed (source-shaped, unparsed). */
export interface EldoradoFeedListing {
  source: 'eldorado'
  source_offer_id: string
  title: string
  /** USD per unit (Eldorado pricePerUnitInUSD). */
  price_usd: number | null
  quantity: number | null
  seller_ref: string | null
  /** Seller's review count (userOrderInfo.ratingCount) — the reputable gate. */
  seller_reviews: number | null
  item_type_raw: string | null
  item_name_raw: string | null
  rarity_raw: string | null
  /** Raw structured variant value ("Common" | "Chroma"), null when absent. */
  variant_raw: string | null
  product_key: string | null
}

export type StructuredStatus = 'ok' | 'rejected' | 'ambiguous'

export interface StructuredIdentity {
  status: StructuredStatus
  /** Our values_items.item_type (knife|gun|pet|misc), null when rejected. */
  itemType: string | null
  /** The marketplace's item name, trimmed (year suffix kept). */
  name: string | null
  rarity: string | null
  /** Variant key ('default' | 'chroma' for MM2). */
  variant: string | null
  /** Where the variant came from — drives review, not pricing. */
  variantSource: 'attribute' | 'title' | 'default' | null
  /** `${itemType}|${variant}|${comparableName(name)}` — the market key the resolver and aliases use. */
  marketKey: string | null
  note?: string
}

/**
 * Lowercase, fold accents and quote styles, drop apostrophes, everything else
 * non-alphanumeric to one space. "Traveler’s Gun" = "travelers gun";
 * "Pumpkin (2021)" = "pumpkin 2021".
 */
export function comparableName(value: string): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function marketKey(itemType: string, variant: string, name: string): string {
  return `${itemType}|${variant}|${comparableName(name)}`
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Raw Eldorado offers-API result row ({ offer, user, userOrderInfo, … }) →
 * feed listing. Tolerant of missing fields: a malformed row becomes a listing
 * the normaliser rejects, never a crash mid-crawl.
 */
export function extractEldoradoOffer(row: any, config: EldoradoStructuredConfig): EldoradoFeedListing | null {
  const offer = row?.offer
  const id = str(offer?.id)
  if (!id) return null
  const tev: Record<string, string> = {}
  for (const a of offer?.tradeEnvironmentValues ?? []) {
    const name = str(a?.name)
    const value = str(a?.value)
    if (name && value) tev[name] = value
  }
  let variantRaw: string | null = null
  if (config.variant) {
    const attr = (offer?.attributes ?? []).find((a: any) => a?.id === config.variant!.attributeId)
    variantRaw = str(attr?.values?.[0]?.name)
  }
  return {
    source: 'eldorado',
    source_offer_id: id,
    title: String(offer?.offerTitle ?? ''),
    price_usd: num(offer?.pricePerUnitInUSD?.amount ?? offer?.pricePerUnit?.amount),
    quantity: num(offer?.quantity),
    seller_ref: str(row?.user?.id) ?? str(offer?.userId),
    seller_reviews: num(row?.userOrderInfo?.ratingCount),
    item_type_raw: tev[config.identity.type] ?? null,
    item_name_raw: tev[config.identity.name] ?? null,
    rarity_raw: tev[config.identity.rarity] ?? null,
    variant_raw: variantRaw,
    product_key: str(offer?.standardizedProductKey),
  }
}

function titleVariant(title: string, config: EldoradoStructuredConfig): string | null {
  const patterns = config.variant?.titlePatterns ?? {}
  for (const [variant, re] of Object.entries(patterns)) {
    if (re.test(title)) return variant
  }
  return null
}

/** Feed listing → structured identity (no catalogue lookup yet). */
export function normaliseStructuredListing(
  listing: Pick<EldoradoFeedListing, 'title' | 'item_type_raw' | 'item_name_raw' | 'rarity_raw' | 'variant_raw'>,
  config: EldoradoStructuredConfig,
): StructuredIdentity {
  const rejected = (note: string): StructuredIdentity => ({
    status: 'rejected',
    itemType: null,
    name: null,
    rarity: null,
    variant: null,
    variantSource: null,
    marketKey: null,
    note,
  })

  const rawType = listing.item_type_raw
  if (!rawType) return rejected('no structured item type')
  if (!(rawType in config.typeMap)) return rejected(`unknown item type "${rawType}"`)
  const itemType = config.typeMap[rawType]
  if (!itemType) return rejected(`not a catalogue item type "${rawType}"`)

  const name = str(listing.item_name_raw)
  if (!name) return rejected('no structured item name')
  if (config.rejectNames.some((r) => r.toLowerCase() === name.toLowerCase())) {
    return rejected(`placeholder item name "${name}"`)
  }

  const rarity = str(listing.rarity_raw)
  let variant: string
  let variantSource: StructuredIdentity['variantSource']
  let status: StructuredStatus = 'ok'
  let note: string | undefined

  const vc = config.variant
  if (!vc) {
    variant = 'default'
    variantSource = 'default'
  } else {
    const fromAttr = listing.variant_raw ? vc.map[listing.variant_raw] ?? null : null
    const fromTitle = titleVariant(listing.title ?? '', config)
    if (fromAttr && fromAttr !== vc.defaultVariant) {
      // Explicit non-default attribute wins; a silent title is normal.
      variant = fromAttr
      variantSource = 'attribute'
    } else if (fromAttr === vc.defaultVariant) {
      variant = fromAttr
      variantSource = 'attribute'
      if (fromTitle && fromTitle !== vc.defaultVariant) {
        status = 'ambiguous'
        note = `attribute says ${listing.variant_raw}, title says ${fromTitle}`
      }
    } else if (fromTitle) {
      // No (or an unmapped) attribute: the title decides.
      variant = fromTitle
      variantSource = 'title'
    } else {
      variant = vc.defaultVariant
      variantSource = 'default'
    }
  }

  return {
    status,
    itemType,
    name,
    rarity,
    variant,
    variantSource,
    marketKey: marketKey(itemType, variant, name),
    ...(note ? { note } : {}),
  }
}
