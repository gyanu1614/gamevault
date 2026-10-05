/**
 * Adopt Me price correction — the reputable-seller pass for Adopt Me.
 *
 * Adopt Me is simpler than SAB: no income multipliers, no cross-cohort
 * anchoring. Its pricing is exactly the shared reputable model — group the raw
 * listings by pet+variant, keep the clean/reputable ones, compute cheapest +
 * average — plus two Adopt Me-specific guards: a placeholder-high trim, and a
 * ladder-sanity check (a lower form can't out-price a form above it).
 *
 * Runs from the unified correct-prices cron. Pure over its inputs (the I/O — DB
 * read/write — lives in the cron) so the decision logic is unit-testable.
 */

import {
  PLACEHOLDER_HIGH_RATIO,
  computeReputablePrices,
  dropPlaceholderHighs,
  variantKey,
  type RawListing,
  type VariantReputablePrice,
} from './reputable-adapter'

/** Ladder rank — higher = more valuable form. Tie-break only (see LADDER_EDGES). */
export const LADDER_RANK: Record<string, number> = {
  N: 0,
  F: 1,
  R: 1,
  FR: 2,
  NEON: 3,
  NFR: 4,
  MEGA: 5,
  MFR: 6,
}

/**
 * Which form is always worth at least as much as which — a PARTIAL order, not
 * a straight line. Each edge adds one thing (a potion, or neon-ing 4 → 1):
 * N ≤ F, R ≤ FR ≤ NFR ≤ MFR and N ≤ NEON ≤ NFR, NEON ≤ MEGA ≤ MFR. Forms on
 * different branches (FR vs NEON, FR vs MEGA) are NOT ordered: for a cheap
 * pet two potions can cost more than four copies of the pet.
 */
export const LADDER_EDGES: ReadonlyArray<readonly [string, string]> = [
  ['N', 'F'],
  ['N', 'R'],
  ['F', 'FR'],
  ['R', 'FR'],
  ['N', 'NEON'],
  ['FR', 'NFR'],
  ['NEON', 'NFR'],
  ['NEON', 'MEGA'],
  ['NFR', 'MFR'],
  ['MEGA', 'MFR'],
]

/** Transitive closure: BELOW[hi] = every form that must not out-price hi. */
const BELOW: Record<string, Set<string>> = (() => {
  const below: Record<string, Set<string>> = {}
  for (const v of Object.keys(LADDER_RANK)) below[v] = new Set()
  for (const [lo, hi] of LADDER_EDGES) below[hi].add(lo)
  let grew = true
  while (grew) {
    grew = false
    for (const v of Object.keys(below)) {
      for (const u of [...below[v]]) {
        for (const w of below[u]) {
          if (!below[v].has(w)) {
            below[v].add(w)
            grew = true
          }
        }
      }
    }
  }
  return below
})()

/** True when `lo` must not be priced above `hi` (lo is below hi on the ladder). */
export function ladderBelow(lo: string, hi: string): boolean {
  return BELOW[hi]?.has(lo) ?? false
}

/**
 * A lower form priced above this multiple of a higher form is an inversion.
 * Was 1.05 against the top form only; across adjacent forms that flagged
 * ordinary dispersion (shrew R $6.24 vs FR $5.87 — a cheap potion's worth),
 * so neighbouring forms get 15%.
 */
export const LADDER_TOLERANCE = 1.15

/**
 * Placeholder highs ("Adopt Me > 2D Kitty > MFR" at $3,618.88 over $22–68
 * offers, qty 99,999 — a shop's out-of-stock price) are dropped by the shared
 * adapter's `dropPlaceholderHighs`; the ratio lives there so every game uses
 * the same one. Re-exported for the existing Adopt Me tests.
 */
export { PLACEHOLDER_HIGH_RATIO }

/** Confidence label from the reputable-listing count — mirrors the SQL helper. */
export function confidenceFor(count: number): string {
  if (count >= 25) return 'highly_accurate'
  if (count >= 10) return 'high'
  if (count >= 3) return 'medium'
  return 'low'
}

export type AdoptMeVariantCorrection = {
  petId: string
  variant: string
  cheapestUsd: number
  averageUsd: number
  reputableCount: number
  confidence: string
}

/** An observed (is_estimated = false) price already on the page. */
export type StoredAdoptMePrice = {
  petId: string
  variant: string
  averageUsd: number
  cheapestUsd: number | null
  reputableCount: number | null
}

/** A form withheld because the pet's ladder is inverted around it. */
export type AdoptMeLadderFlag = {
  petId: string
  variant: string
  /** true = priced this run (not written); false = a stored value (unpublish it). */
  fresh: boolean
  averageUsd: number
  /** Higher forms it out-priced. */
  above: string[]
  /** Lower forms that out-priced it. */
  below: string[]
}

export type AdoptMeCorrectionPlan = {
  corrections: AdoptMeVariantCorrection[]
  flagged: AdoptMeLadderFlag[]
  placeholdersDropped: number
}

type LadderEntry = {
  variant: string
  averageUsd: number
  cheapestUsd: number | null
  reputableCount: number
  fresh: boolean
}

/**
 * Every inverted (lo, hi) pair among a pet's priced forms. A page shows both
 * numbers (Market = average, Cheapest), so either one out of order counts.
 */
function inversions(entries: LadderEntry[], tolerance: number): Array<[LadderEntry, LadderEntry]> {
  const out: Array<[LadderEntry, LadderEntry]> = []
  const above = (a: number | null, b: number | null) => a != null && b != null && a > b * tolerance
  for (const lo of entries) {
    for (const hi of entries) {
      if (
        ladderBelow(lo.variant, hi.variant) &&
        (above(lo.averageUsd, hi.averageUsd) || above(lo.cheapestUsd, hi.cheapestUsd))
      ) {
        out.push([lo, hi])
      }
    }
  }
  return out
}

/**
 * Remove the outlier forms until the pet's ladder is consistent. Each round
 * withholds ONE form, preferring: a stored value nothing re-priced this run
 * (no current evidence) → the form in the most inversions → the one with the
 * fewest reputable listings → the lower form (a lower form above a higher one
 * is usually a mislabeled listing).
 */
function resolveLadder(
  entries: LadderEntry[],
  tolerance: number,
): { kept: LadderEntry[]; dropped: AdoptMeLadderFlag[] } {
  let kept = [...entries]
  const dropped: AdoptMeLadderFlag[] = []
  for (;;) {
    const pairs = inversions(kept, tolerance)
    if (!pairs.length) break
    const count = new Map<string, number>()
    for (const [lo, hi] of pairs) {
      count.set(lo.variant, (count.get(lo.variant) ?? 0) + 1)
      count.set(hi.variant, (count.get(hi.variant) ?? 0) + 1)
    }
    const candidates = kept.filter((e) => count.has(e.variant))
    candidates.sort(
      (a, b) =>
        Number(a.fresh) - Number(b.fresh) ||
        (count.get(b.variant) ?? 0) - (count.get(a.variant) ?? 0) ||
        a.reputableCount - b.reputableCount ||
        LADDER_RANK[a.variant] - LADDER_RANK[b.variant],
    )
    const out = candidates[0]
    dropped.push({
      petId: '',
      variant: out.variant,
      fresh: out.fresh,
      averageUsd: out.averageUsd,
      above: pairs.filter(([lo]) => lo === out).map(([, hi]) => hi.variant).sort(),
      below: pairs.filter(([, hi]) => hi === out).map(([lo]) => lo.variant).sort(),
    })
    kept = kept.filter((e) => e !== out)
  }
  return { kept, dropped }
}

/**
 * The full Adopt Me pass: placeholder trim → shared reputable model → ladder
 * sanity over the pet's WHOLE published ladder (this run's prices plus any
 * observed price already stored for a form this run did not re-price).
 *
 * Input rows must already be cleanliness-filtered by the caller (active, not a
 * known-bad row). `corrections` = what to write; `flagged` = forms withheld
 * (fresh) or to unpublish (stored), for the caller to log. Pets/variants
 * without reputable evidence are simply absent — the caller leaves their
 * existing estimate.
 */
export function planAdoptMeCorrection(
  listings: RawListing[],
  stored: StoredAdoptMePrice[] = [],
  { ladderTolerance = LADDER_TOLERANCE }: { ladderTolerance?: number } = {},
): AdoptMeCorrectionPlan {
  const trimmed = dropPlaceholderHighs(listings)
  const priced = computeReputablePrices(trimmed.kept)

  const freshByPet = new Map<string, VariantReputablePrice[]>()
  for (const result of priced.values()) {
    const list = freshByPet.get(result.itemId)
    if (list) list.push(result)
    else freshByPet.set(result.itemId, [result])
  }
  const storedByPet = new Map<string, StoredAdoptMePrice[]>()
  for (const s of stored) {
    if (LADDER_RANK[s.variant] == null || !(s.averageUsd > 0)) continue
    const list = storedByPet.get(s.petId)
    if (list) list.push(s)
    else storedByPet.set(s.petId, [s])
  }

  const corrections: AdoptMeVariantCorrection[] = []
  const flagged: AdoptMeLadderFlag[] = []

  // Every pet with a price on either side — a pet nothing re-priced this run
  // still has its stored ladder checked.
  const petIds = new Set([...freshByPet.keys(), ...storedByPet.keys()])
  for (const petId of petIds) {
    const variants = freshByPet.get(petId) ?? []
    const freshVariants = new Set(variants.map((v) => v.variant))
    const entries: LadderEntry[] = [
      ...variants
        .filter((v) => LADDER_RANK[v.variant] != null)
        .map((v) => ({
          variant: v.variant,
          averageUsd: v.averageUsd,
          cheapestUsd: v.cheapestUsd,
          reputableCount: v.reputableCount,
          fresh: true,
        })),
      ...(storedByPet.get(petId) ?? [])
        .filter((s) => !freshVariants.has(s.variant))
        .map((s) => ({
          variant: s.variant,
          averageUsd: s.averageUsd,
          cheapestUsd: s.cheapestUsd,
          reputableCount: s.reputableCount ?? 0,
          fresh: false,
        })),
    ]
    const { dropped } = resolveLadder(entries, ladderTolerance)
    const withheld = new Set(dropped.filter((d) => d.fresh).map((d) => d.variant))
    for (const d of dropped) flagged.push({ ...d, petId })

    for (const v of variants) {
      if (withheld.has(v.variant)) continue
      corrections.push({
        petId,
        variant: v.variant,
        cheapestUsd: v.cheapestUsd,
        averageUsd: v.averageUsd,
        reputableCount: v.reputableCount,
        confidence: confidenceFor(v.reputableCount),
      })
    }
  }

  return { corrections, flagged, placeholdersDropped: trimmed.dropped }
}

/**
 * Compute reputable corrections for one game's worth of Adopt Me raw listings
 * (no stored ladder) — `planAdoptMeCorrection(listings).corrections`.
 */
export function correctAdoptMePrices(
  listings: RawListing[],
): AdoptMeVariantCorrection[] {
  return planAdoptMeCorrection(listings).corrections
}

export { variantKey }
