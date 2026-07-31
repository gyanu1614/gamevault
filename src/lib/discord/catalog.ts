/**
 * Cached Brainrot/mutation name index for autocomplete.
 *
 * Autocomplete is the one interaction Discord will NOT let you defer: the
 * reply must land within 3 seconds or the user sees "this interaction failed"
 * while they're mid-word. So this keeps a small module-scope index (names,
 * slugs, rarities — roughly 500 rows) and matches in memory, instead of
 * querying per keystroke.
 *
 * Module scope means the cache survives across invocations on a warm Vercel
 * instance and is simply rebuilt on a cold one.
 */

import { normalizeText, type Scorable } from './match'
import { selectAll } from './supabase'

export type BrainrotIndexEntry = Scorable & {
  id: string
  name: string
  slug: string
  rarity: string | null
}

export type MutationIndexEntry = Scorable & {
  id: string
  name: string
  slug: string
  incomeMultiplier: number
}

type CatalogIndex = {
  brainrots: BrainrotIndexEntry[]
  mutations: MutationIndexEntry[]
  loadedAt: number
}

/** The catalog changes on a daily cron at most; a stale minute is harmless. */
const CACHE_TTL_MS = 10 * 60 * 1000

let cache: CatalogIndex | null = null
// Concurrent interactions on a cold instance would otherwise each fire their
// own full load; they share one in-flight promise instead.
let inFlight: Promise<CatalogIndex> | null = null

type BrainrotRow = {
  id: string
  name: string
  slug: string
  rarity: string | null
}

type MutationRow = {
  id: string
  name: string
  slug: string
  income_multiplier: number | string | null
}

async function loadIndex(): Promise<CatalogIndex> {
  const [brainrots, mutations] = await Promise.all([
    selectAll<BrainrotRow>('sab_brainrot_market_catalog', 'id,name,slug,rarity'),
    selectAll<MutationRow>('sab_mutations', 'id,name,slug,income_multiplier'),
  ])

  return {
    brainrots: brainrots
      .filter((row) => row.name && row.slug)
      .map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        rarity: row.rarity,
        normalized: normalizeText(row.name),
      })),
    mutations: mutations
      .filter((row) => row.name && row.slug)
      .map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        incomeMultiplier: Number(row.income_multiplier) || 1,
        normalized: normalizeText(row.name),
      })),
    loadedAt: Date.now(),
  }
}

/**
 * The index, refreshing it when stale.
 *
 * On refresh failure the previous index is kept and returned: answering from a
 * ten-minute-old name list beats failing the interaction, and names are the
 * slowest-changing thing in the catalog.
 */
export async function getCatalogIndex(): Promise<CatalogIndex> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache
  if (inFlight) return inFlight

  inFlight = loadIndex()
    .then((index) => {
      cache = index
      return index
    })
    .catch((error) => {
      console.error('Discord bot failed to load catalog index:', error)
      if (cache) return cache
      throw error
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

const EMPTY_INDEX: CatalogIndex = {
  brainrots: [],
  mutations: [],
  loadedAt: 0,
}

/**
 * The index, or an empty one if it can't be produced in time.
 *
 * Only for autocomplete. Discord's 3s autocomplete deadline cannot be
 * extended, and an empty choice list is a far better failure than a timeout —
 * the user just keeps typing and can still submit a free-text value.
 */
export async function getCatalogIndexOrEmpty(
  timeoutMs = 1200,
): Promise<CatalogIndex> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache

  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      getCatalogIndex(),
      new Promise<CatalogIndex>((resolve) => {
        timer = setTimeout(() => resolve(cache ?? EMPTY_INDEX), timeoutMs)
      }),
    ])
  } catch {
    return cache ?? EMPTY_INDEX
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Look up one Brainrot by exact slug, using the cache when it's warm. */
export async function findBrainrotBySlug(
  slug: string,
): Promise<BrainrotIndexEntry | null> {
  const index = await getCatalogIndex()
  return index.brainrots.find((row) => row.slug === slug) ?? null
}
