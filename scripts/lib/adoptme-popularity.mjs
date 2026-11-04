/**
 * Which Adopt Me pets are popular, from two public signals, blended (owner,
 * 2026-11-03: "the demand and popularity… then we decide what we have as top
 * pets"). Written to adopt_me_pets.demand_rank (1 = most popular), which the
 * Items page's Popular sort, the game home's Popular row, the pet page carousel,
 * the values list's Popular sort, the navbar search order and the sell page's
 * "Top To Sell Now" read.
 *
 *  - Eldorado's own pet order: its `item-management/products` feed, one row per
 *    pet, the grid buyers see. It favours cheap, new pets. Steady: 15 of the 16
 *    pets on its page 1 on 2026-10-25 were still in the top 24 on 2026-11-03.
 *  - How many DIFFERENT sellers list each pet. It favours old classics (Frost
 *    Dragon, Owl). Sellers, not listings: one seller can post many copies.
 *
 * A pet near the top of either list ranks high, near the top of both ranks
 * highest, so a new hit and a classic both make it. Not `offers?usePopularItems`:
 * that feed is one row per offer, one big seller first, and came back near random
 * for Adopt Me (Kookaburra, Papa Moose, Zombie Wolf first; checked 2026-10-29).
 * Pure: loaded by the daily script and by vitest; the HTTP client is passed in.
 */
import { ELDORADO_AM_CATEGORY, ELDORADO_AM_GAME_ID, ELDORADO_BASE_URL, eldoradoKeyFor, normalizeName } from './adoptme-eldorado.mjs'

/** Low: being very high on one list counts, so classics aren't drowned by new pets. Measured on 2026-11-03's real lists. */
const BLEND_K = 10
const FEED_PAGE_SIZE = 24
const FEED_MAX_PAGES = 60
/** Matched pets below this mean a broken read, not a small catalogue (about 700 on 2026-11-04). */
export const MIN_FEED_PETS = 300

/**
 * Active raw listings ({ pet_id, seller_id }) → Map(pet_id → rank). Ties break
 * on listing count, then pet id, so a re-run on the same rows gives the same
 * ranks. Pets with no active listing get no rank.
 */
export function rankPetsBySellers(rows) {
  const byPet = new Map()
  for (const row of rows) {
    if (!row?.pet_id) continue
    let entry = byPet.get(row.pet_id)
    if (!entry) {
      entry = { sellers: new Set(), listings: 0 }
      byPet.set(row.pet_id, entry)
    }
    entry.listings += 1
    if (row.seller_id) entry.sellers.add(row.seller_id)
  }
  const ordered = [...byPet.entries()].sort(
    ([idA, a], [idB, b]) => b.sellers.size - a.sellers.size || b.listings - a.listings || String(idA).localeCompare(String(idB)),
  )
  return new Map(ordered.map(([id], i) => [id, i + 1]))
}

/** Eldorado's item names in its own order, every page. Throws on a failed page: a partial order would rank wrongly. */
export async function fetchProductOrder(getJson) {
  const names = []
  let pages = 1
  for (let page = 1; page <= Math.min(pages, FEED_MAX_PAGES); page += 1) {
    const url = new URL('/api/v1/item-management/products', ELDORADO_BASE_URL)
    url.searchParams.set('gameId', ELDORADO_AM_GAME_ID)
    url.searchParams.set('category', ELDORADO_AM_CATEGORY)
    url.searchParams.set('pageIndex', String(page))
    url.searchParams.set('pageSize', String(FEED_PAGE_SIZE))
    url.searchParams.set('useOfferAttributeSearch', 'true')
    const body = await getJson(url)
    pages = Number(body?.totalPages) || 1
    for (const row of body?.results ?? []) if (row?.name) names.push(row.name)
  }
  return names
}

/**
 * Eldorado's names → Map(pet_id → position among our pets). Its eggs and potions
 * match no pet and are skipped, so they don't push pets down.
 */
export function rankPetsByFeed(names, pets) {
  const idByKey = new Map()
  for (const pet of pets) {
    const key = eldoradoKeyFor(pet.name)
    if (!idByKey.has(key)) idByKey.set(key, pet.id)
  }
  const ranks = new Map()
  for (const name of names) {
    const id = idByKey.get(normalizeName(name))
    if (id && !ranks.has(id)) ranks.set(id, ranks.size + 1)
  }
  return ranks
}

/**
 * The two lists → one rank. Each list a pet is on adds 1 / (k + its position).
 * Ties break on the seller rank, then pet id, so a re-run gives the same ranks.
 */
export function blendRanks(feedRanks, sellerRanks) {
  const score = (id) => {
    const feed = feedRanks.get(id)
    const sellers = sellerRanks.get(id)
    return (feed ? 1 / (BLEND_K + feed) : 0) + (sellers ? 1 / (BLEND_K + sellers) : 0)
  }
  const ordered = [...new Set([...feedRanks.keys(), ...sellerRanks.keys()])].sort(
    (a, b) =>
      score(b) - score(a) ||
      (sellerRanks.get(a) ?? Number.MAX_SAFE_INTEGER) - (sellerRanks.get(b) ?? Number.MAX_SAFE_INTEGER) ||
      String(a).localeCompare(String(b)),
  )
  return new Map(ordered.map((id, i) => [id, i + 1]))
}

/**
 * The writes a run needs: every pet whose stored rank differs from the new one
 * (a pet that fell off both lists goes back to null). An unchanged day writes
 * nothing.
 */
export function planRankUpdates(pets, ranks) {
  const updates = []
  for (const pet of pets) {
    const next = ranks.get(pet.id) ?? null
    const current = pet.demand_rank == null ? null : Number(pet.demand_rank)
    if (current !== next) updates.push({ id: pet.id, name: pet.name, from: current, to: next })
  }
  return updates
}
