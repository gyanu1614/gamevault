/**
 * The Price Index's biggest movers: each item's plain price on the newest history
 * day against the oldest day in the window, the same two days the value cards
 * compare (lib/values/trends). Pure.
 */
export type Mover = { slug: string; name: string; from: number; to: number; pct: number }
export type MoverRow = { brainrot_id: string; history_date: string; median_usd: number | string | null }
export type MoverName = { id: string; name: string; slug: string }

/** Moves smaller than this aren't news on this page. */
const MIN_PCT = 1
const SHOWN_EACH_WAY = 8

export function moversBetween(
  rows: readonly MoverRow[],
  names: readonly MoverName[],
  { fromDate, toDate }: { fromDate: string; toDate: string },
): { gainers: Mover[]; losers: Mover[] } {
  const first = new Map<string, number>()
  const last = new Map<string, number>()
  for (const r of rows) {
    if (r.median_usd == null) continue
    const price = Number(r.median_usd)
    if (!Number.isFinite(price)) continue
    if (r.history_date === fromDate) first.set(r.brainrot_id, price)
    else if (r.history_date === toDate) last.set(r.brainrot_id, price)
  }

  const nameById = new Map(names.map((n) => [n.id, n]))
  const moves: Mover[] = []
  for (const [id, from] of first) {
    const to = last.get(id)
    const item = nameById.get(id)
    if (to == null || !item || from <= 0) continue
    const pct = ((to - from) / from) * 100
    if (Math.abs(pct) >= MIN_PCT) moves.push({ slug: item.slug, name: item.name, from, to, pct })
  }

  return {
    gainers: moves.filter((m) => m.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, SHOWN_EACH_WAY),
    losers: moves.filter((m) => m.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, SHOWN_EACH_WAY),
  }
}
