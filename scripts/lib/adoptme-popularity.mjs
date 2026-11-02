/**
 * Which Adopt Me pets are popular: how many DIFFERENT sellers list each pet on
 * the market right now (owner, 2026-11-01: "popularity to actually be trending
 * pets"). Written to adopt_me_pets.demand_rank (1 = most popular), which the
 * values list's Popular sort, the navbar search order and the sell page's
 * "Top To Sell Now" already read.
 *
 * Why sellers and not listings or Eldorado's own ranking (checked 2026-10-29
 * on prod): Eldorado's usePopularItems feed for Adopt Me comes back near
 * random (Kookaburra, Papa Moose, Zombie Wolf first); "ended" listings mix
 * sales with reprices (the dedup key includes the price); one seller can post
 * many copies. Distinct sellers per pet put Frost Dragon, Owl, Cryptid,
 * Unicorn, Evil Unicorn, Parrot, Crow, Bat Dragon, Giraffe, Shadow Dragon on
 * top: what the market actually trades. Pure: loaded by the daily script and
 * by vitest.
 */

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

/**
 * The writes a run needs: every pet whose stored rank differs from the new one
 * (a pet that fell off the market goes back to null). An unchanged day writes
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
