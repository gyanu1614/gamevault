/**
 * Values health: one daily look at every hub game's data jobs, so a pipeline
 * that silently stops (SAB added nothing for three months; a cached empty list
 * showed "0 Brainrots") is posted to Discord within a day.
 *
 * Per game, three signals, each a single small read:
 *   - catalogue: the latest catalogue_runs row ran within 48 h and did not
 *     fail or stop itself (GitHub starts schedules 5–7 h late; one missed day
 *     is tolerated);
 *   - prices:    the game's "pricing ran" timestamp is inside its window;
 *   - list:      the public value list has rows.
 * Read errors count as problems, never as a pass. The route
 * (api/cron/values-health) posts the message; this module is pure apart from
 * readGameHealth.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

type Db = SupabaseClient

export interface ValuesHealthGame {
  gameSlug: string
  name: string
  /** Where "pricing ran" shows: a timestamp column that moves on every run. */
  price: { table: string; column: string; byGameId?: boolean }
  priceMaxHours: number
  /** Rows the public list shows. */
  list: { table: string; filter: Record<string, unknown>; byGameId?: boolean }
}

export const CATALOGUE_MAX_HOURS = 48

export const VALUES_HEALTH_GAMES: readonly ValuesHealthGame[] = [
  {
    gameSlug: 'steal-a-brainrot',
    name: 'Steal a Brainrot',
    price: { table: 'sab_market_evidence_display', column: 'refreshed_at' },
    priceMaxHours: 48,
    list: { table: 'sab_brainrot_catalog', filter: {} },
  },
  {
    gameSlug: 'adopt-me',
    name: 'Adopt Me',
    // last_priced_at means "price last changed": allow three days before calling it stalled.
    price: { table: 'adopt_me_pet_values', column: 'last_priced_at' },
    priceMaxHours: 72,
    list: { table: 'adopt_me_pets', filter: { is_active: true } },
  },
  {
    gameSlug: 'murder-mystery-2',
    name: 'Murder Mystery 2',
    price: { table: 'values_prices', column: 'updated_at', byGameId: true },
    priceMaxHours: 48,
    list: { table: 'values_items', filter: { is_enabled: true }, byGameId: true },
  },
  {
    gameSlug: 'steal-an-egg',
    name: 'Steal an Egg',
    price: { table: 'values_prices', column: 'updated_at', byGameId: true },
    priceMaxHours: 48,
    list: { table: 'values_items', filter: { is_enabled: true }, byGameId: true },
  },
]

export interface GameHealthInput {
  lastCatalogueRun: { startedAt: string; status: string } | null
  lastPriceAt: string | null
  listCount: number
  readError?: string
}

export interface HealthProblem {
  gameSlug: string
  name: string
  kind: 'catalogue' | 'prices' | 'list' | 'read'
  message: string
}

const ageHours = (iso: string, now: number) => Math.round((now - Date.parse(iso)) / 3_600_000)

export function evaluateGameHealth(game: ValuesHealthGame, input: GameHealthInput, now: number): HealthProblem[] {
  const out: HealthProblem[] = []
  const add = (kind: HealthProblem['kind'], message: string) => out.push({ gameSlug: game.gameSlug, name: game.name, kind, message })
  if (input.readError) {
    add('read', `could not read its health (${input.readError})`)
    return out
  }
  const run = input.lastCatalogueRun
  if (!run) add('catalogue', 'the new-items catalogue has never run')
  else if (ageHours(run.startedAt, now) > CATALOGUE_MAX_HOURS) add('catalogue', `the new-items catalogue last ran ${ageHours(run.startedAt, now)} h ago`)
  else if (run.status === 'failed') add('catalogue', 'the last new-items catalogue run failed')
  else if (run.status === 'blocked') add('catalogue', 'the last new-items catalogue run stopped itself (see its Discord post)')

  if (!input.lastPriceAt) add('prices', 'no price has ever been recorded')
  else if (ageHours(input.lastPriceAt, now) > game.priceMaxHours) add('prices', `no price moved for ${ageHours(input.lastPriceAt, now)} h (allowed ${game.priceMaxHours} h)`)

  if (input.listCount <= 0) add('list', 'the value list is empty')
  return out
}

export function healthMessage(problems: HealthProblem[]): string | null {
  if (!problems.length) return null
  const lines = problems.map((p) => `• ${p.name}: ${p.message}`)
  return [`🩺 **Values health: ${problems.length} problem${problems.length === 1 ? '' : 's'}**`, ...lines].join('\n')
}

/** The three reads for one game. Never throws: a failed read comes back as readError. */
export async function readGameHealth(db: Db, game: ValuesHealthGame): Promise<GameHealthInput> {
  try {
    let gameId: string | null = null
    if (game.price.byGameId || game.list.byGameId) {
      const { data, error } = await db.from('games').select('id').eq('slug', game.gameSlug).maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error('game not found')
      gameId = data.id as string
    }
    const run = await db.from('catalogue_runs').select('started_at,status').eq('game_slug', game.gameSlug).order('started_at', { ascending: false }).limit(1)
    if (run.error) throw new Error(`catalogue_runs: ${run.error.message}`)

    let priceQ = db.from(game.price.table).select(game.price.column).not(game.price.column, 'is', null).order(game.price.column, { ascending: false }).limit(1)
    if (game.price.byGameId) priceQ = priceQ.eq('game_id', gameId)
    const price = await priceQ
    if (price.error) throw new Error(`${game.price.table}: ${price.error.message}`)

    // count with a GET (never head: true — HEAD counts broke keep-alive on hot paths).
    let listQ = db.from(game.list.table).select('*', { count: 'exact' }).match(game.list.filter).limit(1)
    if (game.list.byGameId) listQ = listQ.eq('game_id', gameId)
    const list = await listQ
    if (list.error) throw new Error(`${game.list.table}: ${list.error.message}`)

    const r = run.data?.[0]
    // The column name is config, so the row's type is not known statically.
    const p = (price.data?.[0] as unknown as Record<string, string> | undefined)?.[game.price.column] ?? null
    return {
      lastCatalogueRun: r ? { startedAt: r.started_at as string, status: r.status as string } : null,
      lastPriceAt: p,
      listCount: list.count ?? 0,
    }
  } catch (e) {
    return { lastCatalogueRun: null, lastPriceAt: null, listCount: 0, readError: (e as Error).message }
  }
}
