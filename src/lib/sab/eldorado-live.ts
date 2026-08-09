/**
 * Live single-item Eldorado price fetch.
 *
 * The batch collector (scripts/collect-eldorado-sab-api-v6.mjs) crawls ALL
 * brainrots on a slow schedule and stores a correction. This module fetches ONE
 * brainrot's CURRENT listings on demand — for the item page a user is viewing —
 * so the displayed price can be seconds-fresh instead of up-to-an-hour stale.
 *
 * It returns the SAME shape the correction cron feeds to reputablePrice()
 * (`ReputableListing[]` = {priceUsd, reviews}), so the live number and the
 * stored number are computed by the identical engine and can't contradict.
 *
 * Scope: DEFAULT variant, page 1 only (one HTTP call, ~300-800ms). Page 1 with
 * useOfferAttributeSearch=true returns the full current cheapest set for the
 * default; rare mutations that need deep pagination stay on the stored value.
 *
 * The Eldorado offers response has a stable shape:
 *   { results: [ { offer: {...}, user: {...}, userOrderInfo: {...} }, ... ],
 *     totalPages }
 * so we read fields directly rather than tree-walking (matches the shape the
 * collector's findOfferObjects resolves to, and validated live).
 */

import type { ReputableListing } from './reputable-pricing'

const BASE_URL = 'https://www.eldorado.gg'
const GAME_ID = '259' // Steal a Brainrot on Eldorado
const CATEGORY = 'CustomItem'

/** Match the collector's account-age floor: brand-new accounts post fakes. */
const MIN_ACCOUNT_AGE_DAYS = 90

/** Toy/bundle/scam title reject lists — mirror the import parser's intent. */
const SCAM_RE =
  /(you need add|you need to add|need to add|\badd me\b|add first|friend request|friend me|need friend|dm me|message me first|read desc|read description|not real|fake price)/i
const BUNDLE_RE = /(bundle|\bpack\b|\bset\b|\blot\b|account|\bacc\b|\bx\d{2,}\b)/i
/** Negative cosmetic trait — excluded from cheapest, same as the cron. */
const COSMETIC_TRAIT_RE = /\btaco\b/i

/** The 14 canonical mutation names → their slug, for the default filter. */
const MUTATION_NAMES = new Set([
  'gold',
  'diamond',
  'bloodrot',
  'candy',
  'lava',
  'galaxy',
  'yin yang',
  'radioactive',
  'cursed',
  'rainbow',
  'divine',
  'cyber',
  'phantom',
])

type EldoradoOffer = {
  offer?: {
    offerTitle?: string
    pricePerUnit?: { amount?: number | string; currency?: string }
    offerAttributeIdValues?: Array<{ name?: string; value?: unknown }>
    attributes?: Array<{ name?: string; value?: unknown }>
    userId?: string
  }
  user?: { id?: string; createdDate?: string }
  userOrderInfo?: { ratingCount?: number }
}

function compact(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** slug/name → Eldorado tradeEnvironmentValue2 enum (e.g. DRAGON_CANNELLONI). */
function generatedTradeEnvironmentValue(value: string): string {
  return compact(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

async function fetchJson(url: URL, signal: AbortSignal): Promise<any | null> {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'accept-language': 'en-US,en;q=0.9',
      referer: `${BASE_URL}/`,
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    },
    signal,
  })
  if (response.status === 403 || response.status === 429) {
    // Signal a block so the caller's circuit breaker can back off.
    throw new Error(`ELDORADO_BLOCKED_${response.status}`)
  }
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Eldorado HTTP ${response.status}`)
  return response.json()
}

/** Resolve a brainrot slug to its Eldorado tradeEnvironmentValue2, via SEO map
 * then the generated fallback (same order the collector uses). */
async function resolveTradeEnvironment(
  slug: string,
  name: string,
  signal: AbortSignal,
): Promise<string[]> {
  const candidates: string[] = []
  const add = (v: string | null | undefined) => {
    const c = compact(v)
    if (c && !candidates.includes(c)) candidates.push(c)
  }

  const mapUrl = new URL('/api/library/seoAliasMappings', BASE_URL)
  mapUrl.searchParams.set('seoAlias', `${slug}-for-sale`)
  mapUrl.searchParams.set('category', CATEGORY)
  mapUrl.searchParams.set('gameId', GAME_ID)
  mapUrl.searchParams.set('locale', 'en-US')
  try {
    const mapping = await fetchJson(mapUrl, signal)
    if (mapping?.query) {
      const q = new URLSearchParams(String(mapping.query).replace(/^\?/, ''))
      add(q.get('te_v2'))
    }
  } catch (error) {
    // A blocked mapping call is fatal for this request; re-throw.
    if (error instanceof Error && error.message.startsWith('ELDORADO_BLOCKED'))
      throw error
    // Otherwise fall through to the generated candidates.
  }

  add(generatedTradeEnvironmentValue(name))
  add(generatedTradeEnvironmentValue(slug))
  return candidates
}

function offersUrl(tradeEnvironmentValue2: string): URL {
  const url = new URL('/api/v1/item-management/offers', BASE_URL)
  url.searchParams.set('gameId', GAME_ID)
  url.searchParams.set('category', CATEGORY)
  url.searchParams.set('tradeEnvironmentValue2', tradeEnvironmentValue2)
  url.searchParams.set('pageIndex', '1')
  url.searchParams.set('pageSize', '50')
  url.searchParams.set('useMinPurchasePrice', 'false')
  // These two are why review counts + the true cheapest set appear:
  url.searchParams.set('useOfferAttributeSearch', 'true')
  url.searchParams.set('includeDeliveryMedians', 'true')
  return url
}

/** The seller's structured Mutations attribute value ("None"/"Gold"/…), or null. */
function mutationAttribute(offer: EldoradoOffer['offer']): string | null {
  const lists = [offer?.attributes, offer?.offerAttributeIdValues].filter(
    Array.isArray,
  ) as Array<Array<{ name?: string; value?: unknown }>>
  for (const list of lists) {
    for (const attr of list) {
      if (!/mutation/i.test(attr?.name ?? '')) continue
      const raw = attr.value as any
      const value =
        typeof raw === 'object' && raw ? (raw.name ?? raw.id ?? null) : raw
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return null
}

/** Is this listing the DEFAULT (no-mutation) variant? Trait-primary, title
 * fallback — mirrors the collector's attribute-primary rule. */
function isDefaultVariant(offer: EldoradoOffer['offer']): boolean {
  const attr = mutationAttribute(offer)?.toLowerCase()
  if (attr) {
    if (attr === 'none') return true
    // Any recognised mutation attribute → NOT default.
    if (MUTATION_NAMES.has(attr)) return false
    // Combo/unknown attr (NR/MF/etc.) → fall through to the title.
  }
  const title = compact(offer?.offerTitle).toLowerCase()
  // Title names a mutation → not default.
  for (const m of MUTATION_NAMES) {
    if (title.includes(m)) return false
  }
  return true
}

function accountAgeDays(createdDate?: string): number | null {
  if (!createdDate) return null
  const created = Date.parse(createdDate)
  if (!Number.isFinite(created)) return null
  return Math.max(0, Math.round((Date.now() - created) / 86_400_000))
}

/**
 * Fetch the current DEFAULT-variant reputable-eligible listings for one
 * brainrot. Returns [] when the item can't be resolved or has no clean
 * listings; throws only on an Eldorado block (403/429) so the caller can trip
 * its circuit breaker. The caller runs reputablePrice() on the result.
 */
export async function fetchItemListings(
  slug: string,
  name: string,
  { timeoutMs = 2500 }: { timeoutMs?: number } = {},
): Promise<ReputableListing[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const candidates = await resolveTradeEnvironment(
      slug,
      name,
      controller.signal,
    )
    let results: EldoradoOffer[] = []
    for (const te of candidates) {
      const body = await fetchJson(offersUrl(te), controller.signal)
      const rows = (body?.results ?? []) as EldoradoOffer[]
      if (rows.length) {
        results = rows
        break
      }
    }

    const expected = compact(name).toLowerCase()
    const seenSeller = new Set<string>()
    const listings: ReputableListing[] = []

    for (const row of results) {
      const offer = row.offer
      if (!offer) continue
      const title = compact(offer.offerTitle)
      const titleLc = title.toLowerCase()

      // Exact-item guard: the title must actually name this brainrot.
      if (!titleLc.includes(expected)) continue
      // Reject chains — mirror the batch pipeline's intent.
      if (SCAM_RE.test(title)) continue
      if (BUNDLE_RE.test(titleLc)) continue
      if (COSMETIC_TRAIT_RE.test(titleLc)) continue
      // DEFAULT variant only.
      if (!isDefaultVariant(offer)) continue

      const currency = offer.pricePerUnit?.currency
      const price = Number(offer.pricePerUnit?.amount)
      if (currency !== 'USD' || !Number.isFinite(price) || price <= 0) continue

      // Drop brand-new seller accounts (the fake-cheap cluster).
      const age = accountAgeDays(row.user?.createdDate)
      if (age != null && age < MIN_ACCOUNT_AGE_DAYS) continue

      // Dedup identical (seller, price) copies — one seller spamming N counts once.
      const sellerId = offer.userId ?? row.user?.id ?? null
      if (sellerId) {
        const key = `${sellerId}:${price}`
        if (seenSeller.has(key)) continue
        seenSeller.add(key)
      }

      const reviews = Number(row.userOrderInfo?.ratingCount)
      if (!Number.isFinite(reviews)) continue // no review data → not gradeable

      listings.push({ priceUsd: price, reviews })
    }

    return listings
  } finally {
    clearTimeout(timer)
  }
}
