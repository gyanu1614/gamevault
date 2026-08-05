import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Data for the blog-hub teaser strips. Kept small and defensive: every query
 * falls back to an empty result so a data hiccup hides a section rather than
 * breaking the page. Only SAB has a live catalog today; other games return
 * empty and their teasers self-hide.
 */

export interface HubTeaserItem {
  name: string
  slug: string
  priceLabel: string
  qualifier: string
  imageUrl: string | null
  /** Variant this price is for (e.g. 'FR', 'NFR') — the strip's benchmark form. */
  variant?: string
  /** 7-day price change %, when we hold history for it. Signed; null = flat/none. */
  changePct?: number | null
}

/** A real worked-example trade for the calculator teaser — two priced pets
 *  with images and a computed win/fair/lose verdict. */
export interface HubCalcExample {
  give: { name: string; imageUrl: string | null; usd: number }
  offer: { name: string; imageUrl: string | null; usd: number }
  /** 'WIN' | 'FAIR' | 'LOSE' from the offer-vs-give cash gap. */
  verdict: 'WIN' | 'FAIR' | 'LOSE'
  /** Signed cash difference (offer - give), for the delta label. */
  deltaUsd: number
}

/**
 * A real calculator example for the teaser: picks two mid-value priced pets
 * (with images) as a give/offer pair and computes a genuine WIN/FAIR/LOSE from
 * their cash gap (±20% band = fair). Adopt Me only for now; [] elsewhere.
 */
export async function getHubCalcExample(
  gameSlug: string,
): Promise<HubCalcExample | null> {
  if (gameSlug !== 'adopt-me') return null

  const supabase = await createClient()
  const [petsRes, valsRes] = await Promise.all([
    (supabase as any)
      .from('adopt_me_pets')
      .select('id,name,image_url,has_page')
      .eq('is_active', true),
    (supabase as any)
      .from('adopt_me_pet_values')
      .select('pet_id,cash_value_usd')
      .eq('variant', 'FR'),
  ])
  if (petsRes.error || valsRes.error) return null

  type Pet = { id: string; name: string; image_url: string | null; has_page: boolean }
  const byId = new Map((petsRes.data as Pet[]).map((p) => [p.id, p]))
  const priced = ((valsRes.data ?? []) as { pet_id: string; cash_value_usd: number | string | null }[])
    .filter((v) => v.cash_value_usd != null && Number.isFinite(Number(v.cash_value_usd)))
    .map((v) => ({ pet: byId.get(v.pet_id), usd: Number(v.cash_value_usd) }))
    .filter((v): v is { pet: Pet; usd: number } => !!v.pet && v.pet.has_page && v.pet.image_url != null)
    .sort((a, b) => b.usd - a.usd)

  // Need at least two priced pets to form an example.
  if (priced.length < 2) return null

  const band = (a: number, b: number) => (b === 0 ? 0 : ((a - b) / b) * 100)
  const verdictOf = (offerU: number, giveU: number): 'WIN' | 'FAIR' | 'LOSE' => {
    const p = band(offerU, giveU)
    return p > 20 ? 'WIN' : p < -20 ? 'LOSE' : 'FAIR'
  }

  // Lead the teaser with a WIN — the most compelling showcase ("you gain
  // value"). Scan pairs among the top pets for the best clear win (offer worth
  // meaningfully more than what you give, but not absurdly so), then fall back
  // to a FAIR, then any real pair.
  const pool = priced.slice(0, 8)
  let give = priced[1]
  let offer = priced[Math.min(3, priced.length - 1)]
  let bestWin: { g: typeof give; o: typeof offer; gap: number } | null = null
  let bestFair: { g: typeof give; o: typeof offer; gap: number } | null = null
  for (let i = 0; i < pool.length; i++) {
    for (let j = 0; j < pool.length; j++) {
      if (i === j) continue
      const gap = band(pool[j].usd, pool[i].usd) // offer vs give, signed %
      const v = verdictOf(pool[j].usd, pool[i].usd)
      // A "nice" win is a clear gain that isn't a wild mismatch (25%–120%).
      if (v === 'WIN' && gap >= 25 && gap <= 120) {
        if (!bestWin || gap > bestWin.gap) bestWin = { g: pool[i], o: pool[j], gap }
      }
      if (v === 'FAIR' && (!bestFair || Math.abs(gap) < bestFair.gap)) {
        bestFair = { g: pool[i], o: pool[j], gap: Math.abs(gap) }
      }
    }
  }
  const pick = bestWin ?? bestFair
  if (pick) {
    give = pick.g
    offer = pick.o
  }

  const delta = offer.usd - give.usd
  const verdict = verdictOf(offer.usd, give.usd)

  return {
    give: { name: give.pet.name, imageUrl: give.pet.image_url, usd: give.usd },
    offer: { name: offer.pet.name, imageUrl: offer.pet.image_url, usd: offer.usd },
    verdict,
    deltaUsd: delta,
  }
}

/** One stat for the compact hub stat strip. Optional link + thumbnail + trend. */
export interface HubStat {
  label: string
  value: string
  /** Optional secondary value shown quieter next to the main value. */
  sub?: string
  /** Optional pet/item image for the stat (e.g. the top pet). */
  imageUrl?: string | null
  /** Optional in-hub link the stat points to. */
  href?: string
  /** Trend direction for a price mover: 'up' | 'down' — colors the value. */
  trend?: 'up' | 'down'
}

/**
 * Stats for the compact strip under the blog title: most popular pet, highest
 * value, pets tracked, and a real price mover WHEN price history supports one.
 * Adopt Me only for now; other games return [] and the strip self-hides.
 * Everything shown is real — a stat with no data is omitted, never faked.
 */
export async function getHubStatStrip(gameSlug: string): Promise<HubStat[]> {
  if (gameSlug !== 'adopt-me') return []

  const supabase = await createClient()

  const [petsRes, valsRes, histRes] = await Promise.all([
    (supabase as any)
      .from('adopt_me_pets')
      .select('id,name,slug,image_url,has_page')
      .eq('is_active', true),
    (supabase as any)
      .from('adopt_me_pet_values')
      .select('pet_id,cash_value_usd')
      .eq('variant', 'FR'),
    (supabase as any)
      .from('adopt_me_price_history')
      .select('pet_id,cash_value_usd,history_date')
      .eq('variant', 'FR')
      .order('history_date', { ascending: true }),
  ])

  if (petsRes.error || valsRes.error) return []

  type Pet = { id: string; name: string; slug: string; image_url: string | null; has_page: boolean }
  const pets = (petsRes.data ?? []) as Pet[]
  const byId = new Map(pets.map((p) => [p.id, p]))
  const published = pets.filter((p) => p.has_page)

  const priced = ((valsRes.data ?? []) as { pet_id: string; cash_value_usd: number | string | null }[])
    .filter((v) => v.cash_value_usd != null && Number.isFinite(Number(v.cash_value_usd)))
    .map((v) => ({ pet: byId.get(v.pet_id), usd: Number(v.cash_value_usd) }))
    .filter((v): v is { pet: Pet; usd: number } => !!v.pet && v.pet.has_page)
    .sort((a, b) => b.usd - a.usd)

  const usd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

  const stats: HubStat[] = []

  // Most popular = the single highest-value pet (with its thumbnail + link).
  const top = priced[0]
  if (top) {
    stats.push({
      label: 'Most popular',
      value: top.pet.name,
      imageUrl: top.pet.image_url,
      href: `/${gameSlug}/values/${top.pet.slug}`,
    })
    stats.push({
      label: 'Highest value',
      value: usd.format(top.usd),
      href: `/${gameSlug}/values`,
    })
  }

  // Price movers — ONLY when the history holds >=2 distinct dates for a pet, so
  // the % is a real change, never fabricated. These change daily (that's the
  // point — the strip should feel live, not a static count).
  const hist = (histRes.error ? [] : (histRes.data ?? [])) as {
    pet_id: string
    cash_value_usd: number | string | null
    history_date: string
  }[]
  const byPet = new Map<string, { d: string; u: number }[]>()
  for (const r of hist) {
    const u = Number(r.cash_value_usd)
    if (!Number.isFinite(u)) continue
    const list = byPet.get(r.pet_id) ?? []
    list.push({ d: r.history_date, u })
    byPet.set(r.pet_id, list)
  }
  const movers: { name: string; slug: string | null; pct: number }[] = []
  for (const [pid, arr] of byPet.entries()) {
    const dates = [...new Set(arr.map((x) => x.d))].sort()
    if (dates.length < 2) continue
    const first = arr.find((x) => x.d === dates[0])?.u
    const last = arr.find((x) => x.d === dates[dates.length - 1])?.u
    if (first == null || last == null || first === 0 || first === last) continue
    const pct = ((last - first) / first) * 100
    const pet = byId.get(pid)
    movers.push({ name: pet?.name ?? 'A pet', slug: pet?.slug ?? null, pct })
  }

  // "Trending" = the single biggest MOVE in either direction (the pet everyone's
  // repricing right now) — distinct from "Biggest riser" (top gainer). Both are
  // real, both shift daily, so the strip always feels live.
  const trending = movers
    .slice()
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0]
  const topRiser = movers
    .filter((m) => m.pct > 0)
    .sort((a, b) => b.pct - a.pct)[0]

  const pushMover = (
    label: string,
    m: { name: string; slug: string | null; pct: number } | undefined,
  ) => {
    if (!m) return
    const up = m.pct > 0
    stats.push({
      label,
      value: m.name,
      sub: `${up ? '+' : ''}${m.pct.toFixed(0)}%`,
      trend: up ? 'up' : 'down',
      href: m.slug ? `/${gameSlug}/values/${m.slug}` : `/${gameSlug}/values`,
    })
  }

  pushMover('Trending', trending)
  // Only add "Biggest riser" if it's a DIFFERENT pet than Trending (avoid a dup).
  if (topRiser && topRiser.name !== trending?.name) {
    pushMover('Biggest riser', topRiser)
  }

  return stats
}

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/** Turn a raw confidence enum (`highly_accurate`) into a clean label
 *  (`Highly Accurate`) — no underscores, no shouty all-caps. */
function confidenceLabel(raw: string | null | undefined): string {
  const v = (raw ?? 'low').replace(/_/g, ' ').trim()
  return v.replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * The top few priced items by value, for the "Live values" teaser. Sourced
 * from the same public catalog the Values page reads, so the numbers match.
 * Each game has its own catalog shape, so this dispatches by slug; a game with
 * no catalog returns empty and its teaser self-hides.
 */
export async function getHubTopValues(
  gameSlug: string,
  limit = 4,
): Promise<HubTeaserItem[]> {
  if (gameSlug === 'adopt-me') return getAdoptMeTopValues(limit)
  if (gameSlug !== 'steal-a-brainrot') return []

  const supabase = await createClient()

  const [catalogRes, priceRes] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_market_catalog')
      .select('id,name,slug,image_url,confidence_label'),
    (supabase as any)
      .from('sab_public_price_catalog_corrected')
      .select('brainrot_id,market_value_usd,confidence_label')
      .eq('mutation_slug', 'default'),
  ])

  if (catalogRes.error || priceRes.error) {
    if (catalogRes.error) {
      console.error('Hub top-values catalog error:', catalogRes.error)
    }
    if (priceRes.error) {
      console.error('Hub top-values price error:', priceRes.error)
    }
    return []
  }

  type CatalogRow = {
    id: string
    name: string
    slug: string
    image_url: string | null
    confidence_label: string | null
  }
  type PriceRow = {
    brainrot_id: string
    market_value_usd: number | string | null
    confidence_label: string | null
  }

  const priceById = new Map<string, PriceRow>(
    ((priceRes.data ?? []) as PriceRow[])
      .filter(
        (r) =>
          r.market_value_usd != null &&
          Number.isFinite(Number(r.market_value_usd)),
      )
      .map((r) => [r.brainrot_id, r]),
  )

  return ((catalogRes.data ?? []) as CatalogRow[])
    .map((row) => {
      const price = priceById.get(row.id)
      if (!price) return null
      const usd = Number(price.market_value_usd)
      const confidence = confidenceLabel(
        price.confidence_label ?? row.confidence_label,
      )
      return {
        name: row.name,
        slug: row.slug,
        imageUrl: row.image_url,
        usd,
        qualifier: `${confidence} confidence`,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, limit)
    .map((x) => ({
      name: x.name,
      slug: x.slug,
      imageUrl: x.imageUrl,
      priceLabel: USD.format(x.usd),
      qualifier: x.qualifier,
    }))
}

/**
 * Adopt Me top values, ranked by Fly Ride cash price (the variant traders
 * benchmark against — matching the value list's default). Reads the same two
 * catalog tables the /adopt-me/values page reads, so the teaser and the list
 * never disagree. Only published pets (has_page) surface, so every teaser links
 * to a real page.
 */
async function getAdoptMeTopValues(limit: number): Promise<HubTeaserItem[]> {
  const supabase = await createClient()

  const [petsRes, valuesRes] = await Promise.all([
    (supabase as any)
      .from('adopt_me_pets')
      .select('id,slug,name,image_url,has_page')
      .eq('is_active', true),
    (supabase as any)
      .from('adopt_me_pet_values')
      .select('pet_id,variant,cash_value_usd,confidence,price_change_7d')
      .eq('variant', 'FR'),
  ])

  if (petsRes.error || valuesRes.error) {
    if (petsRes.error) console.error('Hub top-values pets error:', petsRes.error)
    if (valuesRes.error)
      console.error('Hub top-values values error:', valuesRes.error)
    return []
  }

  type PetRow = {
    id: string
    slug: string
    name: string
    image_url: string | null
    has_page: boolean
  }
  type ValueRow = {
    pet_id: string
    cash_value_usd: number | string | null
    confidence: string | null
    price_change_7d: number | string | null
  }

  const frByPet = new Map<string, ValueRow>(
    ((valuesRes.data ?? []) as ValueRow[])
      .filter(
        (r) =>
          r.cash_value_usd != null &&
          Number.isFinite(Number(r.cash_value_usd)),
      )
      .map((r) => [r.pet_id, r]),
  )

  return ((petsRes.data ?? []) as PetRow[])
    .filter((pet) => pet.has_page)
    .map((pet) => {
      const price = frByPet.get(pet.id)
      if (!price) return null
      const usd = Number(price.cash_value_usd)
      const confidence = confidenceLabel(price.confidence)
      const chg = Number(price.price_change_7d)
      return {
        name: pet.name,
        slug: pet.slug,
        imageUrl: pet.image_url,
        usd,
        qualifier: `${confidence} confidence`,
        changePct: Number.isFinite(chg) && chg !== 0 ? chg : null,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, limit)
    .map((x) => ({
      name: x.name,
      slug: x.slug,
      imageUrl: x.imageUrl,
      priceLabel: USD.format(x.usd),
      qualifier: x.qualifier,
      variant: 'FR',
      changePct: x.changePct,
    }))
}
