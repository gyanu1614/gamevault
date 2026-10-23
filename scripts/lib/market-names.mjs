/**
 * The match log (public.market_name_matches) in a price run: after exact
 * matching, every market name still unmatched is resolved in this order —
 *
 *   1. a saved decision: `confirmed` or `auto` → its item; `rejected` → left out;
 *   2. otherwise a close match (name-match.mjs pairUnmatched) against the
 *      items nothing has claimed yet → saved as `auto`;
 *   3. otherwise saved as `unmatched`, with suggestions and its listing count.
 *
 * `planMarketNames` is pure (tested); `loadMarketNames` / `saveMarketNames`
 * do the reads and writes with the job's service-role client.
 */
import { pairUnmatched } from './name-match.mjs'

/** Unmatched rows not seen for this long are dropped from the review list. */
const FORGET_UNMATCHED_DAYS = 30

/**
 * names:   Map<marketName, offers>  — what exact matching left unmatched
 * items:   [{ slug, names[] }]      — the candidates (one game; one type for typed games)
 * claimed: Set<slug>                — items exact matching already used this run
 * ledger:  Map<marketName, row>     — saved rows for this game + source
 * nameOf:  marketName → the text to compare (default: the whole name)
 * Returns { mapped: Map<marketName, slug>, rows: upsert rows, autoMatched: [...] }.
 */
export function planMarketNames({ game, source = 'eldorado', names, items, claimed, ledger, nameOf = (n) => n, now = new Date().toISOString() }) {
  const known = new Set(items.map((i) => i.slug))
  const taken = new Set(claimed)
  const mapped = new Map()
  const rows = []
  const autoMatched = []
  const fresh = []
  const row = (marketName, fields) => ({
    game_slug: game,
    source,
    market_name: marketName,
    item_slug: null,
    score: null,
    suggestions: [],
    offers: names.get(marketName) ?? 0,
    last_seen_at: now,
    ...fields,
  })

  for (const marketName of names.keys()) {
    const saved = ledger.get(marketName)
    if (saved && (saved.status === 'confirmed' || saved.status === 'auto') && saved.item_slug && known.has(saved.item_slug)) {
      mapped.set(marketName, saved.item_slug)
      taken.add(saved.item_slug)
      rows.push(row(marketName, { status: saved.status, item_slug: saved.item_slug, score: saved.score ?? null, suggestions: saved.suggestions ?? [] }))
    } else if (saved?.status === 'rejected') {
      rows.push(row(marketName, { status: 'rejected', item_slug: saved.item_slug ?? null, score: saved.score ?? null, suggestions: saved.suggestions ?? [] }))
    } else {
      fresh.push(marketName)
    }
  }

  const { matched, unmatched } = pairUnmatched(fresh, items, taken, nameOf)
  for (const m of matched) {
    mapped.set(m.marketName, m.slug)
    autoMatched.push(m)
    rows.push(row(m.marketName, { status: 'auto', item_slug: m.slug, score: m.score }))
  }
  for (const u of unmatched) rows.push(row(u.marketName, { status: 'unmatched', suggestions: u.suggestions }))
  return { mapped, rows, autoMatched }
}

export async function loadMarketNames(db, game, source = 'eldorado') {
  const out = new Map()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('market_name_matches')
      .select('market_name,item_slug,status,score,suggestions')
      .eq('game_slug', game)
      .eq('source', source)
      .order('market_name')
      .range(from, from + 999)
    if (error) throw new Error(`market_name_matches read: ${error.message}`)
    for (const r of data ?? []) out.set(r.market_name, r)
    if (!data || data.length < 1000) return out
  }
}

/** Upsert this run's rows (decisions are carried through unchanged) and forget stale unmatched names. */
export async function saveMarketNames(db, game, rows, source = 'eldorado') {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('market_name_matches').upsert(rows.slice(i, i + 500), { onConflict: 'game_slug,source,market_name' })
    if (error) throw new Error(`market_name_matches upsert: ${error.message}`)
  }
  const cutoff = new Date(Date.now() - FORGET_UNMATCHED_DAYS * 86_400_000).toISOString()
  const { error } = await db
    .from('market_name_matches')
    .delete()
    .eq('game_slug', game)
    .eq('source', source)
    .eq('status', 'unmatched')
    .lt('last_seen_at', cutoff)
  if (error) throw new Error(`market_name_matches prune: ${error.message}`)
}

/**
 * The price run must never fail because of the match log: a failed read
 * (e.g. the table not pushed yet) means exact matching only this run, and a
 * failed save is a warning. Both show as GitHub Actions warnings.
 */
export async function loadMarketNamesSafe(db, game, source = 'eldorado') {
  try {
    return await loadMarketNames(db, game, source)
  } catch (e) {
    console.warn(`::warning::match log unavailable for ${game} (${e.message}); exact matching only this run`)
    return null
  }
}

export async function saveMarketNamesSafe(db, game, rows, source = 'eldorado') {
  try {
    await saveMarketNames(db, game, rows, source)
  } catch (e) {
    console.warn(`::warning::match log not saved for ${game} (${e.message})`)
  }
}

/** One log line per run. */
export function describeMarketNames(game, plan) {
  const unmatched = plan.rows.filter((r) => r.status === 'unmatched')
  const auto = plan.autoMatched.map((m) => `${m.marketName} → ${m.slug} (${m.score})`)
  return [
    `  ${game} market names: ${plan.mapped.size} resolved from the match log or close matches, ${unmatched.length} unmatched`,
    ...(auto.length ? [`  new automatic matches: ${auto.join('; ')}`] : []),
  ].join('\n')
}
