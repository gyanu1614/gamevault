/**
 * Which items actually need rewriting.
 *
 * Repricing used to rewrite every row on every run. That was affordable until
 * the raw-listing table tripled; then the run outgrew its budget, started
 * failing, and prices froze for five days. Most of that work was wasted: on a
 * typical crawl only about half the catalogue has new listings at all.
 *
 * IMPORTANT — this narrows what is WRITTEN, never what is READ. The correction
 * does cohort anchoring: a thin-sample item derives its price from a cohort of
 * well-sampled peers, so the peers must all still be loaded and priced in
 * memory or the anchors change. Dropping items from the INPUT set would
 * silently alter prices; dropping them from the OUTPUT set cannot, because an
 * item whose evidence has not moved recomputes to the value already stored.
 *
 * So: compute everything, write only what changed.
 */

/** The last time each key was computed, from the existing corrections. */
export type ComputedAtByKey = Map<string, string>

/** The newest listing observation per key, from the raw listings just read. */
export type ObservedAtByKey = Map<string, string>

/**
 * Keys whose evidence is newer than their last computed value.
 *
 * A key with no stored `computed_at` is always included — it has never been
 * priced. A key with no observation is excluded: nothing new was seen, so its
 * stored value still stands.
 */
export function keysNeedingRecompute(
  observed: ObservedAtByKey,
  computed: ComputedAtByKey,
): Set<string> {
  const stale = new Set<string>()
  for (const [key, observedAt] of observed) {
    const computedAt = computed.get(key)
    // ISO-8601 UTC strings compare correctly as strings.
    if (!computedAt || observedAt > computedAt) stale.add(key)
  }
  // Never-priced keys with no listings still need a first pass.
  for (const key of computed.keys()) {
    if (!computed.get(key)) stale.add(key)
  }
  return stale
}

/**
 * The newest observation per `brainrot_id:mutation_id`, ignoring rows with no
 * timestamp (an unparseable or missing observed_at must not look "newest").
 */
export function newestObservedByKey(
  rows: { brainrot_id: string; mutation_id: string; observed_at: string | null }[],
): ObservedAtByKey {
  const newest: ObservedAtByKey = new Map()
  for (const row of rows) {
    if (!row.observed_at) continue
    const key = `${row.brainrot_id}:${row.mutation_id}`
    const current = newest.get(key)
    if (!current || row.observed_at > current) newest.set(key, row.observed_at)
  }
  return newest
}
