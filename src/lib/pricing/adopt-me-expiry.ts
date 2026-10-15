/**
 * When an Adopt Me "observed" price stops counting as live (2026-10-14 audit:
 * 29% of observed prices had no evidence that day and were carried forward
 * with no expiry — 189 since Oct 5 — still shown as verified-seller prices).
 * A price with no reputable evidence (no price-history point) for this many
 * days is marked estimated; its number stays, so the page shows "Est." until
 * fresh listings price it again. Pure, so the rule is testable.
 */
export const OBSERVED_PRICE_TTL_DAYS = 3

/** The first history_date that still counts as recent evidence for a run starting at `startedAt`. */
export function evidenceSince(startedAt: string): string {
  return new Date(Date.parse(startedAt) - OBSERVED_PRICE_TTL_DAYS * 86_400_000).toISOString().slice(0, 10)
}

/** `pet:variant` keys of observed (non-estimated, priced) rows with no evidence in the window. */
export function staleObservedKeys(
  rows: Iterable<{ pet_id: string; variant: string; is_estimated: boolean | null; cash_value_usd: number | string | null }>,
  evidence: ReadonlySet<string>,
): string[] {
  const out: string[] = []
  for (const r of rows) {
    const key = `${r.pet_id}:${r.variant}`
    if (r.is_estimated === false && r.cash_value_usd != null && !evidence.has(key)) out.push(key)
  }
  return out
}
