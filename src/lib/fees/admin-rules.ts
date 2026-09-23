/**
 * Pure helpers for the admin fee action (no DB, no Next). Kept out of the
 * 'use server' module so they can be unit-tested and so the client Fees tab
 * can import the band table and the error mapping without pulling a server
 * action into its bundle.
 *
 * Nothing here computes a commission: rates come from resolve_seller_fee
 * (fee-engine.md §8.4). These are input shape checks and error wording.
 */

/** The account "risk band" is UI sugar over three pair base rates (§5.1). */
export const ACCOUNT_RISK_BAND_PCT = { low: 10, mid: 15, high: 20 } as const
export type AccountRiskBandKey = keyof typeof ACCOUNT_RISK_BAND_PCT

/** The band a pair base rate maps to, or 'custom' when it is none of the three. */
export function riskBandForPct(pct: number | null | undefined): AccountRiskBandKey | 'custom' | null {
  if (pct == null || !Number.isFinite(pct)) return null
  for (const [band, v] of Object.entries(ACCOUNT_RISK_BAND_PCT)) {
    if (v === pct) return band as AccountRiskBandKey
  }
  return 'custom'
}

/** 0 ≤ pct ≤ 50, at most 2 dp. Returns the normalised number or an error string. */
export function parsePct(raw: unknown): { pct: number } | { error: string } {
  const str = typeof raw === 'number' ? String(raw) : String(raw ?? '').trim()
  const n = str === '' ? NaN : Number(str)
  if (!Number.isFinite(n)) return { error: 'Enter a rate between 0% and 50%' }
  if (n < 0 || n > 50) return { error: 'Rate must be between 0% and 50%' }
  const rounded = Math.round(n * 100) / 100
  if (rounded !== n) return { error: 'Rate can have at most two decimal places' }
  return { pct: rounded }
}

/**
 * A YYYY-MM-DD date from the form → the 00:00 UTC instant, as ISO. Dates
 * are stored as UTC midnight so "from 6 October" means the same second on
 * every admin's screen.
 */
export function parseUtcDate(raw: unknown): { iso: string; ms: number } | { error: string } {
  const s = String(raw ?? '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return { error: 'Enter a date as YYYY-MM-DD' }
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(ms)
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    return { error: 'That date does not exist' }
  }
  return { iso: d.toISOString(), ms }
}

/** The earliest permitted base-rate start: the first 00:00 UTC ≥ now + notice days. */
export function earliestBaseStartUtc(noticeDays: number, now: Date = new Date()): Date {
  const t = now.getTime() + noticeDays * 86_400_000
  const d = new Date(t)
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return new Date(midnight === t ? midnight : midnight + 86_400_000)
}

export const fmtUtcDate = (iso: string | Date): string =>
  new Date(iso).toISOString().slice(0, 10)

/**
 * Map a PostgREST error onto the sentence the admin sees (§5.3). The
 * database is the enforcer; this only rewords its refusals.
 */
export function feeRuleErrorMessage(err: { code?: string; message?: string } | null | undefined): string {
  const msg = err?.message ?? ''
  if (err?.code === '23P01' || /already scheduled/i.test(msg)) {
    const when = /from (\d{4}-\d{2}-\d{2})/.exec(msg)?.[1]
    return when
      ? `A base rate is already scheduled from ${when} — cancel it first, then schedule the new one.`
      : 'That window overlaps an existing base rate — cancel the scheduled rule first, or pick a later date.'
  }
  if (/notice/i.test(msg)) {
    const earliest = /earliest permitted start: ([^)]+)\)/.exec(msg)?.[1]
    const days = /needs (\d+) days/.exec(msg)?.[1] ?? '14'
    return earliest
      ? `A base rate change needs ${days} days' notice — the earliest permitted start is ${fmtUtcDate(new Date(earliest))}.`
      : `A base rate change needs ${days} days' notice.`
  }
  if (/fee_rules_promo_bounded/.test(msg)) return 'A promotional rate must have an end date.'
  if (/fee_rules_window_ordered/.test(msg)) return 'The end date must be after the start date.'
  if (/fee_rules_pct_check|between 0%/.test(msg)) return 'Rate must be between 0% and 50%.'
  if (/sellers have been charged under it/.test(msg)) return 'That rate has already started — schedule a new rate instead of cancelling it.'
  return msg || 'The fee rule could not be saved.'
}
