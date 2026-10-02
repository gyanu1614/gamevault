import { hasHubPage } from '@/lib/content/theme'
import { fetchAllRows } from '@/lib/seo/paged-read'

import { submitIndexNow, type SubmitFn } from './submit'

/**
 * Value pages (Adopt Me pets, Steal a Brainrot, generic-pipeline games) are
 * submitted only when an item's CASH value really moved. The old job re-sent
 * every Steal a Brainrot URL (~504) every day whether or not a price changed.
 *
 * "Moved" is judged against the game's own daily history table, so the check is
 * stateless: today's value vs the last EARLIER snapshot. A value that appears
 * or disappears counts; a move smaller than BOTH thresholds does not.
 */
export const VALUE_CHANGE_MIN_RELATIVE = 0.05
export const VALUE_CHANGE_MIN_ABSOLUTE_USD = 0.25

export interface ValueSample {
  slug: string
  previous: number | null
  current: number | null
}

export function isMaterialValueChange(previous: number | null, current: number | null): boolean {
  if (previous == null && current == null) return false
  if (previous == null || current == null) return true
  const delta = Math.abs(current - previous)
  if (delta < VALUE_CHANGE_MIN_ABSOLUTE_USD) return false
  if (previous === 0) return true
  return delta / Math.abs(previous) >= VALUE_CHANGE_MIN_RELATIVE
}

/** Items (once each) with at least one material move across their samples. */
export function changedItemSlugs(samples: ValueSample[]): string[] {
  const changed = new Set<string>()
  for (const s of samples) if (isMaterialValueChange(s.previous, s.current)) changed.add(s.slug)
  return [...changed]
}

/** The changed items plus the game pages whose numbers they feed. Nothing changed: nothing. */
export function valuePageUrls(gameSlug: string, itemSlugs: string[]): string[] {
  if (itemSlugs.length === 0) return []
  return [
    ...itemSlugs.map((slug) => `/${gameSlug}/values/${slug}`),
    // The Steal a Brainrot game page IS its values landing, so it moves too.
    ...(gameSlug === 'steal-a-brainrot' ? [`/${gameSlug}`] : []),
    ...(hasHubPage(gameSlug, 'values') ? [`/${gameSlug}/values`] : []),
    ...(hasHubPage(gameSlug, 'calculator') ? [`/${gameSlug}/calculator`] : []),
    ...(hasHubPage(gameSlug, 'priceIndex') ? [`/${gameSlug}/price-index`] : []),
  ]
}

// ── per-game loaders ────────────────────────────────────────────────────────
type Db = any
const HISTORY_WINDOW_DAYS = 14

const num = (v: unknown): number | null => (v == null || Number.isNaN(Number(v)) ? null : Number(v))

function daysBefore(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** The newest row per key that is dated BEFORE `today` (today's own snapshot is ignored). */
function latestBefore<T extends { history_date: string }>(
  rows: T[],
  keyOf: (row: T) => string,
  today: string,
): Map<string, T> {
  const latest = new Map<string, T>()
  for (const row of rows) {
    if (row.history_date >= today) continue
    const key = keyOf(row)
    const prev = latest.get(key)
    if (!prev || row.history_date > prev.history_date) latest.set(key, row)
  }
  return latest
}

export async function loadSabSamples(db: Db, today: string): Promise<ValueSample[]> {
  const current = await fetchAllRows<{ brainrot_id: string; brainrot_slug: string | null; mutation_id: string; market_value_usd: number | null }>(
    (from, to) =>
      db
        .from('sab_price_display')
        .select('brainrot_id, brainrot_slug, mutation_id, market_value_usd')
        .eq('mutation_slug', 'default')
        .order('brainrot_id')
        .range(from, to),
  )
  if (current.length === 0) return []
  const mutationId = current[0].mutation_id
  const history = await fetchAllRows<{ brainrot_id: string; mutation_id: string; history_date: string; median_usd: number | null }>(
    (from, to) =>
      db
        .from('sab_price_history')
        .select('brainrot_id, mutation_id, history_date, median_usd')
        .eq('mutation_id', mutationId)
        .gte('history_date', daysBefore(today, HISTORY_WINDOW_DAYS))
        .lt('history_date', today)
        .order('history_date', { ascending: false })
        .order('brainrot_id')
        .range(from, to),
  )
  const previous = latestBefore(history, (r) => r.brainrot_id, today)
  return current
    .filter((r) => !!r.brainrot_slug)
    .map((r) => ({
      slug: r.brainrot_slug!,
      current: num(r.market_value_usd),
      previous: num(previous.get(r.brainrot_id)?.median_usd),
    }))
}

export async function loadAdoptMeSamples(db: Db, today: string): Promise<ValueSample[]> {
  const current = await fetchAllRows<{ pet_id: string; variant: string; cash_value_usd: number | null; pet: { slug: string; has_page: boolean } | null }>(
    (from, to) =>
      db
        .from('adopt_me_pet_values')
        .select('pet_id, variant, cash_value_usd, pet:adopt_me_pets!inner(slug, has_page)')
        .eq('pet.has_page', true)
        .order('pet_id')
        .order('variant')
        .range(from, to),
  )
  const history = await fetchAllRows<{ pet_id: string; variant: string; history_date: string; cash_value_usd: number | null }>(
    (from, to) =>
      db
        .from('adopt_me_price_history')
        .select('pet_id, variant, history_date, cash_value_usd')
        .gte('history_date', daysBefore(today, HISTORY_WINDOW_DAYS))
        .lt('history_date', today)
        .order('history_date', { ascending: false })
        .order('pet_id')
        .order('variant')
        .range(from, to),
  )
  const previous = latestBefore(history, (r) => `${r.pet_id}:${r.variant}`, today)
  return current
    // Only publishable pets have a page to re-crawl.
    .filter((r) => r.pet?.has_page && r.pet.slug)
    .map((r) => ({
      slug: r.pet!.slug,
      current: num(r.cash_value_usd),
      previous: num(previous.get(`${r.pet_id}:${r.variant}`)?.cash_value_usd),
    }))
}

/** Generic values_* pipeline (Steal an Egg and any game added to it). */
export async function loadEggSamples(db: Db, today: string, gameSlug: string): Promise<ValueSample[]> {
  const current = await fetchAllRows<{ item_id: string; cheapest_usd: number | null; item: { slug: string; games: { slug: string } | null } | null }>(
    (from, to) =>
      db
        .from('values_prices')
        .select('item_id, cheapest_usd, item:values_items!inner(slug, games!inner(slug))')
        .eq('item.games.slug', gameSlug)
        .order('item_id')
        .range(from, to),
  )
  const history = await fetchAllRows<{ item_id: string; history_date: string; cheapest_usd: number | null }>((from, to) =>
    db
      .from('values_price_history')
      .select('item_id, history_date, cheapest_usd')
      .gte('history_date', daysBefore(today, HISTORY_WINDOW_DAYS))
      .lt('history_date', today)
      .order('history_date', { ascending: false })
      .order('item_id')
      .range(from, to),
  )
  const previous = latestBefore(history, (r) => r.item_id, today)
  return current
    .filter((r) => r.item?.games?.slug === gameSlug && r.item.slug)
    .map((r) => ({
      slug: r.item!.slug,
      current: num(r.cheapest_usd),
      previous: num(previous.get(r.item_id)?.cheapest_usd),
    }))
}

/**
 * After a game's prices were republished: submit the value pages whose cash
 * value really moved. Returns how many items changed. Never throws.
 */
export async function submitChangedValuePages(
  db: Db,
  gameSlug: string,
  deps: { submit?: SubmitFn; today?: string } = {},
): Promise<number> {
  try {
    const today = deps.today ?? new Date().toISOString().slice(0, 10)
    const samples =
      gameSlug === 'steal-a-brainrot'
        ? await loadSabSamples(db, today)
        : gameSlug === 'adopt-me'
          ? await loadAdoptMeSamples(db, today)
          : await loadEggSamples(db, today, gameSlug)
    const changed = changedItemSlugs(samples)
    const urls = valuePageUrls(gameSlug, changed)
    if (urls.length === 0) return 0
    await (deps.submit ?? ((u, o) => submitIndexNow(u, o)))(urls, { reason: `value-change:${gameSlug}` })
    return changed.length
  } catch (e) {
    console.error('[indexnow] value-change submission failed (non-fatal):', e)
    return 0
  }
}
