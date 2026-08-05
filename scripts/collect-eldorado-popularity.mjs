/**
 * Eldorado popularity ranking → sab_brainrots.popularity_rank.
 *
 * The "Popular" tab used to rank by sample_size (how many listings WE crawled),
 * which just surfaced whatever we happened to scrape most — a wall of Secrets,
 * not what actually sells. Eldorado exposes a real popularity ranking via the
 * offers API with usePopularItems=true: the offers come back ordered by genuine
 * marketplace activity (Garama, Dragon Cannelloni, Cerberus, Meowl at the top).
 *
 * This script fetches that ranking, resolves each popular offer's title to one
 * of our brainrots (first occurrence = that brainrot's rank), and writes
 * popularity_rank. Items never seen in the popular feed get null (they sort
 * after ranked items, by value, as before).
 *
 * Run: node scripts/collect-eldorado-popularity.mjs [--dry]
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const BASE_URL = 'https://www.eldorado.gg'
const GAME_ID = '259'
const MAX_PAGES = 8
const PAGE_SIZE = 50
const REQUEST_TIMEOUT_MS = 20_000

const DRY_RUN = process.argv.includes('--dry')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/** Strip everything but a-z0-9 for tolerant title↔name matching. */
const compact = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

async function fetchPopularOffers() {
  const offers = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL('/api/v1/item-management/offers', BASE_URL)
    url.searchParams.set('gameId', GAME_ID)
    url.searchParams.set('category', 'CustomItem')
    url.searchParams.set('usePopularItems', 'true')
    url.searchParams.set('useOfferAttributeSearch', 'true')
    url.searchParams.set('pageIndex', String(page))
    url.searchParams.set('pageSize', String(PAGE_SIZE))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      })
      if (!response.ok) break
      const body = await response.json()
      const results = body.results ?? []
      offers.push(...results)
      if (results.length < PAGE_SIZE) break
    } catch (error) {
      console.error(`Popular offers page ${page} failed:`, error.message)
      break
    } finally {
      clearTimeout(timeout)
    }
  }

  return offers
}

/**
 * Build a title→brainrot matcher. Each brainrot contributes its name and every
 * alias as a compacted key; an offer title matches the brainrot whose LONGEST
 * key is contained in the title (longest-wins avoids "67" matching inside a
 * longer name, and picks "Los Tralaleritos" over "Tralalero" when both appear).
 */
function buildMatcher(brainrots) {
  const entries = brainrots.map((b) => ({
    id: b.id,
    keys: [compact(b.name), ...(b.aliases ?? []).map(compact)].filter(Boolean),
  }))

  return (title) => {
    const haystack = compact(title)
    let best = null
    let bestLen = 0
    for (const entry of entries) {
      for (const key of entry.keys) {
        if (key.length > bestLen && haystack.includes(key)) {
          best = entry.id
          bestLen = key.length
        }
      }
    }
    return best
  }
}

async function main() {
  const { data: brainrots, error } = await supabase
    .from('sab_brainrots')
    .select('id,name,aliases')

  if (error) throw new Error(`load brainrots: ${error.message}`)

  const match = buildMatcher(brainrots)
  const offers = await fetchPopularOffers()
  console.log(`Fetched ${offers.length} popular offers.`)

  // First occurrence of each brainrot in the popular feed = its rank (1-based).
  const rankByBrainrot = new Map()
  let rank = 0
  for (const offer of offers) {
    const id = match(offer?.offer?.offerTitle ?? '')
    if (id && !rankByBrainrot.has(id)) {
      rank += 1
      rankByBrainrot.set(id, rank)
    }
  }
  console.log(`Resolved ${rankByBrainrot.size} distinct brainrots in rank order.`)

  if (DRY_RUN) {
    const nameById = new Map(brainrots.map((b) => [b.id, b.name]))
    ;[...rankByBrainrot.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 20)
      .forEach(([id, r]) => console.log(`  ${r}. ${nameById.get(id)}`))
    console.log('\nDry run — not written. Drop --dry to persist.')
    return
  }

  // Clear all ranks first, then set the ranked ones — so an item that dropped
  // out of the popular feed loses its stale rank instead of keeping it forever.
  const { error: clearError } = await supabase
    .from('sab_brainrots')
    .update({ popularity_rank: null })
    .not('popularity_rank', 'is', null)
  if (clearError) throw new Error(`clear ranks: ${clearError.message}`)

  let written = 0
  for (const [id, r] of rankByBrainrot) {
    const { error: updateError } = await supabase
      .from('sab_brainrots')
      .update({ popularity_rank: r })
      .eq('id', id)
    if (updateError) {
      console.error(`  rank ${r} (${id}) failed:`, updateError.message)
      continue
    }
    written += 1
  }

  console.log(`✅ Wrote popularity_rank for ${written} brainrots.`)
}

main().catch((error) => {
  console.error('Popularity collection failed:', error.message)
  process.exit(1)
})
