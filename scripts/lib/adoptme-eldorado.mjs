/**
 * Eldorado (Adopt Me, gameId 201) offer reading + cleaning — shared by the
 * per-pet cash collector (collect-eldorado-adoptme.mjs) and the category crawl
 * used by the catalog dry run (adoptme-catalog-dryrun.mjs), so both apply the
 * SAME identity / variant / noise rules to a listing.
 *
 * RESPONSE SHAPE DRIFT (seen 2026-10-04): Eldorado moved the variant from
 * `offer.offerAttributeIdValues[{name:'Traits', value:'FR'}]` to
 * `offer.attributes[{name:'Traits', value:{name:'FR'}}]`, and renamed the
 * identity attribute "Item Name" → "Item name". The readers below accept both
 * shapes (and any casing) so a listing never silently loses its trait.
 *
 * Pure helpers + plain fetch. No DB, no writes.
 */

export const ELDORADO_BASE_URL = 'https://www.eldorado.gg'
export const ELDORADO_AM_GAME_ID = '201'
export const ELDORADO_AM_CATEGORY = 'CustomItem'
export const ELDORADO_PAGE_SIZE = 50 // the API rejects anything larger (400)
export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'

// Toys / non-pet items named after a pet, and bundles — reject outright.
// Tested against the title with the pet's OWN name removed, so a pet whose
// name contains one of these words ("Castle Hermit Crab", "Sunset …") is not
// wiped out wholesale; "Shadow Dragon Ducky" still leaves "ducky" and drops.
export const TOY_WORDS =
  /(duck(y|ies)|skateboard|sabre|saber|stroller|plush|\btoy\b|kingdom|castle|\bmap\b|\bbase\b|house|home|split|theme|bundle|pack|set|potion|egg|account|\bacc\b|robux)/

// Scam-bait titles ("add me / you need to add / friend request").
export const SCAM_WORDS =
  /(you need add|you need to add|need to add|\badd me\b|add first|friend request|friend me|need friend|dm me|message me first|read desc|read description|not real|fake price)/i

/** Every form on our 8-step ladder is publishable (trait-primary detection). */
export const PUBLISHABLE_VARIANTS = new Set(['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR'])

// Eldorado Traits code → our variant. Eldorado's options are a 3 × 4 grid:
//   None  F   R   FR      (no neon)
//   N     NF  NR  NFR     (N = NEON — not Normal)
//   M     MF  MR  MFR     (M = Mega Neon)
// "None" is the plain pet, but sellers also file Neons/FRs there, so a None
// listing takes its variant from the title (and is dropped without one).
// Until 2026-10-05 "N" was mapped to Normal: every "N Caterpillar" (a Neon)
// priced the Normal column — caterpillar N $59.54 against a ~$14 Normal.
export const TRAIT_TO_VARIANT = {
  F: 'F',
  R: 'R',
  FR: 'FR',
  N: 'NEON',
  NEON: 'NEON',
  NFR: 'NFR',
  M: 'MEGA',
  MEGA: 'MEGA',
  MFR: 'MFR',
}

/**
 * Neon/Mega + ONE potion (Neon Fly, Neon Ride, Mega Fly, Mega Ride). Real
 * Eldorado forms with no column on our 8-step ladder. A listing tagged with
 * one is dropped outright — falling through to the title priced "Neon Ride
 * X" as a plain Ride and "Mega Neon Ride X" as a plain Mega.
 */
export const COMBO_TRAITS = new Set(['NF', 'NR', 'MF', 'MR'])

export const DEFAULT_MIN_ACCOUNT_AGE_DAYS = 120

/** Normalise a title/name for exact matching (strip emoji, punctuation, case). */
export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Catalog name → Eldorado Item name, where the two spell a pet differently
 * (normalised keys). Seen 2026-10-04: adoptmevalues "Wooly Rhino" / Eldorado
 * "Woolly Rhino", "Malaysian Tapir" / "Malayan Tapir". (adoptmevalues also
 * lists a "Chihuaha" typo next to a real "Chihuahua" — deliberately NOT
 * aliased, or one Eldorado group would price two catalog pets.)
 */
export const ELDORADO_NAME_ALIASES = {
  'wooly rhino': 'woolly rhino',
  'malaysian tapir': 'malayan tapir',
}

/** The crawl grouping key for one of OUR pet names (alias-aware). */
export function eldoradoKeyFor(petName) {
  const key = normalizeName(petName)
  return ELDORADO_NAME_ALIASES[key] ?? key
}

/** The offer's structured "Item name" (canonical pet identity), or null. */
export function itemNameOf(offer) {
  const tev = offer?.tradeEnvironmentValues || []
  const hit = tev.find((a) => String(a?.name || '').toLowerCase() === 'item name')
  return hit?.value ?? null
}

/** The offer's structured "Item type" (Pets, Toys, Eggs …), or null. */
export function itemTypeOf(offer) {
  const tev = offer?.tradeEnvironmentValues || []
  const hit = tev.find((a) => String(a?.name || '').toLowerCase() === 'item type')
  return hit?.value ?? null
}

/** The structured Traits code ('FR', 'NFR', 'None' …) from either shape, or null. */
export function traitValue(offer) {
  const legacy = (offer?.offerAttributeIdValues || []).find(
    (a) => String(a?.name || '').toLowerCase() === 'traits',
  )
  if (legacy?.value != null) {
    return typeof legacy.value === 'string' ? legacy.value : legacy.value?.name ?? null
  }
  const current = (offer?.attributes || []).find(
    (a) => String(a?.name || '').toLowerCase() === 'traits',
  )
  if (!current) return null
  const v = current.value ?? current.values?.[0]
  if (v == null) return null
  return typeof v === 'string' ? v : v.name ?? v.id ?? null
}

/** Map an Eldorado trait code to our variant, or null if unmapped/None/combo. */
export function variantFromTrait(trait) {
  if (!trait) return null
  const key = String(trait).trim().toUpperCase()
  if (key === 'NONE') return null
  return TRAIT_TO_VARIANT[key] ?? null
}

/** True for a Neon/Mega + single-potion trait code (NF, NR, MF, MR). */
export function isComboTrait(trait) {
  return trait != null && COMBO_TRAITS.has(String(trait).trim().toUpperCase())
}

/**
 * Infer the variant from a listing title. Most specific first; null when the
 * title gives no clear signal (we never guess) or names a combo form (Neon
 * Ride, Mega Neon Fly …) that has no ladder column. `petName` is cut out
 * first so a pet's own name ("Bluebottle Fly") never reads as a potion.
 *
 * @param {string} title
 * @param {string | null} [petName]
 * @returns {string | null}
 */
export function variantFromTitle(title, petName = null) {
  let t = ` ${normalizeName(title)} `
  const np = normalizeName(petName)
  if (np) t = t.split(` ${np} `).join(' ')
  const has = (re) => re.test(t)
  const fly = has(/\b(fly|flyable|flying)\b/)
  const ride = has(/\b(ride|rideable|ridable|riding)\b/)
  const flyRide = has(/\bfr\b|\brf\b|fly (and |n )?ride/)
  const neon = has(/\bneon\b/)
  const mega = has(/\bmega\b/)
  if (has(/\bmfr\b/) || (mega && flyRide)) return 'MFR'
  if (has(/\b(nfr|nrf)\b/) || (neon && flyRide)) return 'NFR'
  // Neon/Mega with ONE potion is a combo form (NF/NR/MF/MR) — no column.
  if (has(/\b(nf|nr|mf|mr)\b/)) return null
  if (mega) return fly || ride ? null : 'MEGA'
  if (neon) return fly || ride ? null : 'NEON'
  if (flyRide) return 'FR'
  if (fly && !ride) return 'F'
  if (ride && !fly) return 'R'
  if (has(/\bnormal\b/) || has(/\bno potion\b/) || has(/\bdefault\b/)) return 'N'
  return null
}

/**
 * The variant for one listing from its structured trait + title: TRAIT-PRIMARY,
 * title fallback; a combo trait, no signal, or a trait/title disagreement is a
 * reject. Shared by the cleaner and by any re-derivation of a cached crawl.
 *
 * @param {{ trait: string | null | undefined, title: string, petName?: string | null }} input
 * @returns {{ variant: string } | { variant: null, reason: string }}
 */
export function resolveListingVariant({ trait, title, petName = null }) {
  if (isComboTrait(trait)) return { variant: null, reason: 'combo-variant' }
  const traitVariant = variantFromTrait(trait)
  const titleVariant = variantFromTitle(title, petName)
  const variant = traitVariant ?? titleVariant
  if (!variant || !PUBLISHABLE_VARIANTS.has(variant)) return { variant: null, reason: 'no-variant' }
  if (traitVariant && titleVariant && traitVariant !== titleVariant) {
    return { variant: null, reason: 'variant-conflict' }
  }
  return { variant }
}

/** Account age in days from an ISO createdDate, or null if unknown. */
export function accountAgeDays(createdDateIso, nowMs) {
  if (!createdDateIso) return null
  const created = Date.parse(createdDateIso)
  if (!Number.isFinite(created)) return null
  return (nowMs - created) / 86400000
}

/** True when the title (minus the pet's own name) names a toy/bundle/account. */
export function isToyTitle(title, petName) {
  let t = normalizeName(title)
  const np = normalizeName(petName)
  if (np) t = t.split(np).join(' ')
  return TOY_WORDS.test(t)
}

/**
 * Clean one Eldorado offer result ({ offer, user, userOrderInfo }) into a
 * compact listing, or say why it was rejected. Identity is NOT checked here —
 * the caller scopes it (te_v2 filter, or grouping by `itemNameOf`). `petName`
 * is only used to keep the pet's own name out of the toy-word test.
 *
 * @param {any} item
 * @param {{ petName?: string | null, nowMs?: number, minAccountAgeDays?: number }} [opts]
 * @returns {{ ok: true, listing: any } | { ok: false, reason: string }}
 */
export function cleanEldoradoOffer(item, {
  petName = null,
  nowMs = Date.now(),
  minAccountAgeDays = DEFAULT_MIN_ACCOUNT_AGE_DAYS,
} = {}) {
  const offer = item?.offer
  if (!offer) return { ok: false, reason: 'no-offer' }
  const title = offer.offerTitle ?? ''
  if (isToyTitle(title, petName ?? itemNameOf(offer) ?? '')) return { ok: false, reason: 'toy' }
  if (SCAM_WORDS.test(String(title))) return { ok: false, reason: 'scam' }
  const age = accountAgeDays(item.user?.createdDate, nowMs)
  if (age != null && age < minAccountAgeDays) return { ok: false, reason: 'new-account' }

  // Variant: TRAIT-PRIMARY, title fallback; combo / none / disagreement → drop.
  const trait = traitValue(offer)
  const resolved = resolveListingVariant({ trait, title, petName: petName ?? itemNameOf(offer) })
  if (!resolved.variant) return { ok: false, reason: resolved.reason }
  const variant = resolved.variant

  const price = Number(offer.pricePerUnit?.amount)
  const currency = offer.pricePerUnit?.currency
  if (!Number.isFinite(price) || price <= 0 || currency !== 'USD') {
    return { ok: false, reason: 'bad-price' }
  }

  // userOrderInfo.ratingCount is the seller's total reviews — populated only
  // because the request sets includeDeliveryMedians=true. The reputable gate
  // (200/500/1000 by value) runs on it.
  const orderInfo = item.userOrderInfo ?? {}
  return {
    ok: true,
    listing: {
      variant,
      priceUsd: price,
      title,
      trait,
      sellerId: item.user?.id ?? null,
      reviews: Number.isFinite(orderInfo.ratingCount) ? orderInfo.ratingCount : null,
      sellerRating: Number.isFinite(orderInfo.feedbackScore) ? orderInfo.feedbackScore : null,
      accountAgeDays: age != null ? Math.round(age) : null,
      offerId: offer.id ?? null,
      quantity: Number.isFinite(offer.quantity) ? offer.quantity : null,
    },
  }
}

/**
 * Offers URL. `filters` are extra query params, e.g.
 *   { tradeEnvironmentValue2: 'Owl' }            — one pet (canonical Item name)
 *   { searchQuery: 'Owl' }                        — fuzzy fallback (re-filter!)
 *   { tradeEnvironmentValue0: 'Pets',
 *     offerSortingCriterion: 'Price', isAscending: 'true' } — the whole category
 */
export function eldoradoOffersUrl(filters, pageIndex) {
  const u = new URL('/api/v1/item-management/offers', ELDORADO_BASE_URL)
  u.searchParams.set('gameId', ELDORADO_AM_GAME_ID)
  u.searchParams.set('category', ELDORADO_AM_CATEGORY)
  for (const [k, v] of Object.entries(filters || {})) u.searchParams.set(k, String(v))
  u.searchParams.set('pageIndex', String(pageIndex))
  u.searchParams.set('pageSize', String(ELDORADO_PAGE_SIZE))
  u.searchParams.set('includeDeliveryMedians', 'true')
  return u.toString()
}

export async function fetchEldoradoOffers(filters, pageIndex, { ua = BROWSER_UA, retries = 2 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(eldoradoOffersUrl(filters, pageIndex), {
        headers: { 'user-agent': ua, accept: 'application/json' },
      })
      if (res.status === 429) throw new Error('429 rate limited')
      if (!res.ok) throw new Error(`offers p${pageIndex} → ${res.status}`)
      return await res.json()
    } catch (err) {
      lastErr = err
      if (attempt < retries) await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)))
    }
  }
  throw lastErr
}

/** The whole Adopt Me "Pets" item type, cheapest first (stable-ish paging). */
export const PETS_CATEGORY_FILTERS = {
  tradeEnvironmentValue0: 'Pets',
  offerSortingCriterion: 'Price',
  isAscending: 'true',
}

/**
 * Eldorado rejects pageIndex > 1000 (HTTP 400 "invalid PageIndex"), so one
 * sorted walk reaches at most 50,000 offers. Adopt Me Pets had 64,969 on
 * 2026-10-04, so the crawl walks cheapest-first to the cap, then dearest-first
 * until it meets offers it has already seen.
 */
export const ELDORADO_MAX_PAGE_INDEX = 1000

/**
 * ONE crawl of every Adopt Me pet offer on Eldorado (~1,300 pages of 50 on
 * 2026-10-04), cleaned with `cleanEldoradoOffer` and grouped by the offer's
 * structured Item name. Two passes when the list is deeper than the API's
 * page cap: price ascending, then price descending until the passes overlap.
 * Offers are deduped by id (the passes overlap, and a 25-minute walk over a
 * live list shifts offers across page seams).
 *
 * Only compact listings are kept in memory (the raw results carry seller bios
 * and images — ~5 KB each).
 *
 * `fetchPage(page, ascending)` is injectable for tests.
 *
 * @returns {Promise<{
 *   byName: Map<string, { itemName: string, offers: number, listings: any[] }>,
 *   recordCount: number, totalPages: number, pagesFetched: number,
 *   uniqueOffers: number, duplicates: number, rejected: Record<string, number>,
 *   errors: string[], stoppedBy: string,
 * }>}
 */
export async function crawlEldoradoPets({
  delayMs = 1000,
  maxPages = 2000,
  filters = PETS_CATEGORY_FILTERS,
  minAccountAgeDays = DEFAULT_MIN_ACCOUNT_AGE_DAYS,
  log = (/** @type {string} */ _m) => {},
  fetchPage = (/** @type {number} */ page, /** @type {boolean} */ ascending) =>
    fetchEldoradoOffers({ ...filters, isAscending: String(ascending) }, page),
} = {}) {
  const byName = new Map()
  const seenOfferIds = new Set()
  /** @type {Record<string, number>} */
  const rejected = {}
  /** @type {string[]} */
  const errors = []
  let duplicates = 0
  let recordCount = 0
  let totalPages = 1
  let pagesFetched = 0
  let stoppedBy = 'complete'

  /** Ingest one page; returns how many offers on it were new. */
  function ingest(results) {
    let fresh = 0
    const nowMs = Date.now()
    for (const item of results) {
      const offer = item?.offer
      const id = offer?.id
      if (id) {
        if (seenOfferIds.has(id)) {
          duplicates += 1
          continue
        }
        seenOfferIds.add(id)
      }
      fresh += 1
      const itemName = itemNameOf(offer)
      if (!itemName) {
        rejected['no-item-name'] = (rejected['no-item-name'] ?? 0) + 1
        continue
      }
      const key = normalizeName(itemName)
      let group = byName.get(key)
      if (!group) {
        group = { itemName, offers: 0, listings: [] }
        byName.set(key, group)
      }
      group.offers += 1
      const cleaned = cleanEldoradoOffer(item, { petName: itemName, nowMs, minAccountAgeDays })
      if (!cleaned.ok) {
        rejected[cleaned.reason] = (rejected[cleaned.reason] ?? 0) + 1
        continue
      }
      group.listings.push(cleaned.listing)
    }
    return fresh
  }

  /**
   * One sorted walk. Ascending: to totalPages (≤ the API cap). Descending:
   * until a page brings nothing new (met the ascending pass) or every
   * reported offer is seen.
   */
  async function walk(ascending) {
    const label = ascending ? 'asc' : 'desc'
    let consecutiveErrors = 0
    for (let page = 1; page <= ELDORADO_MAX_PAGE_INDEX; page += 1) {
      if (pagesFetched >= maxPages) return 'max-pages'
      if (ascending && page > totalPages) return 'complete'
      if (pagesFetched > 0) await new Promise((r) => setTimeout(r, delayMs))
      let body
      try {
        body = await fetchPage(page, ascending)
        consecutiveErrors = 0
      } catch (err) {
        errors.push(`${label} p${page}: ${err.message}`)
        consecutiveErrors += 1
        if (consecutiveErrors >= 5) return 'errors'
        continue
      }
      pagesFetched += 1
      if (ascending && page === 1) {
        recordCount = Number(body?.recordCount) || 0
        totalPages = Number(body?.totalPages) || 1
      }
      const results = body?.results ?? []
      if (!results.length) return 'complete'
      const fresh = ingest(results)
      if (pagesFetched % 50 === 0 || page === 1) {
        log(`  eldorado ${label} page ${page} — ${seenOfferIds.size}/${recordCount} offers, ${byName.size} pets`)
      }
      if (!ascending && (fresh === 0 || seenOfferIds.size >= recordCount)) return 'complete'
    }
    return ascending && totalPages > ELDORADO_MAX_PAGE_INDEX ? 'page-cap' : 'complete'
  }

  stoppedBy = await walk(true)
  if (stoppedBy === 'page-cap') {
    log(`  hit Eldorado's ${ELDORADO_MAX_PAGE_INDEX}-page cap; walking dearest-first for the rest`)
    stoppedBy = await walk(false)
  }

  return {
    byName,
    recordCount,
    totalPages,
    pagesFetched,
    uniqueOffers: seenOfferIds.size,
    duplicates,
    rejected,
    errors,
    stoppedBy,
  }
}
