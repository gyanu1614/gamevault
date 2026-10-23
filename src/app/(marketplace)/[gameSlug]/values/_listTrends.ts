import 'server-only'
import { fetchAllRows } from '@/lib/db/fetch-all'
import { changesBetween, trendWindowStart } from '@/lib/values/trends'

/**
 * The 7-day change behind the Steal a Brainrot and Adopt Me cards (MM2 reads
 * its own through getValueTrends). Two small reads find the newest snapshot
 * day and the oldest inside the window, then one paged read takes exactly
 * those two days. Through the list's tagged client, so it is cached and
 * refreshed with the list. A trend is decoration: a failed read logs and
 * returns no trends rather than failing (and caching) the whole list.
 */
type Db = any
type Scope = (q: any) => any

const num = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v))

async function trendDays(db: Db, table: string, scope: Scope): Promise<{ fromDate: string; toDate: string } | null> {
  const newest = await scope(db.from(table).select('history_date')).order('history_date', { ascending: false }).limit(1).maybeSingle()
  if (newest.error) throw new Error(`${table}: ${newest.error.message}`)
  const toDate: string | undefined = newest.data?.history_date
  if (!toDate) return null
  const oldest = await scope(db.from(table).select('history_date'))
    .gte('history_date', trendWindowStart(toDate))
    .order('history_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (oldest.error) throw new Error(`${table}: ${oldest.error.message}`)
  const fromDate: string | undefined = oldest.data?.history_date
  return fromDate && fromDate !== toDate ? { fromDate, toDate } : null
}

/** brainrot id → 7-day % change of its plain (default mutation) price. */
export async function getSabTrends(db: Db): Promise<Map<string, number>> {
  try {
    const { data: mutation, error } = await db.from('sab_mutations').select('id').eq('slug', 'default').maybeSingle()
    if (error) throw new Error(`sab_mutations: ${error.message}`)
    if (!mutation) return new Map()
    const scope: Scope = (q) => q.eq('mutation_id', mutation.id)
    const days = await trendDays(db, 'sab_price_history', scope)
    if (!days) return new Map()
    const res = await fetchAllRows<{ brainrot_id: string; history_date: string; median_usd: number | string | null }>((from, to) =>
      scope(db.from('sab_price_history').select('brainrot_id,history_date,median_usd'))
        .in('history_date', [days.fromDate, days.toDate])
        .order('brainrot_id', { ascending: true })
        .order('history_date', { ascending: true })
        .range(from, to),
    )
    if (res.error) throw new Error(`sab_price_history: ${(res.error as { message?: string }).message ?? res.error}`)
    return changesBetween(res.data ?? [], { ...days, keyOf: (r) => r.brainrot_id, dateOf: (r) => r.history_date, valueOf: (r) => num(r.median_usd) })
  } catch (e) {
    console.error('[values] SAB trends unavailable:', e instanceof Error ? e.message : e)
    return new Map()
  }
}

/** `${petId}|${variant}` → 7-day % change of that form's cash value. */
export async function getAdoptMeTrends(db: Db): Promise<Map<string, number>> {
  try {
    const all: Scope = (q) => q
    const days = await trendDays(db, 'adopt_me_price_history', all)
    if (!days) return new Map()
    const res = await fetchAllRows<{ pet_id: string; variant: string; history_date: string; cash_value_usd: number | string | null }>((from, to) =>
      db
        .from('adopt_me_price_history')
        .select('pet_id,variant,history_date,cash_value_usd')
        .in('history_date', [days.fromDate, days.toDate])
        .order('pet_id', { ascending: true })
        .order('variant', { ascending: true })
        .order('history_date', { ascending: true })
        .range(from, to),
    )
    if (res.error) throw new Error(`adopt_me_price_history: ${(res.error as { message?: string }).message ?? res.error}`)
    return changesBetween(res.data ?? [], { ...days, keyOf: (r) => `${r.pet_id}|${r.variant}`, dateOf: (r) => r.history_date, valueOf: (r) => num(r.cash_value_usd) })
  } catch (e) {
    console.error('[values] Adopt Me trends unavailable:', e instanceof Error ? e.message : e)
    return new Map()
  }
}
