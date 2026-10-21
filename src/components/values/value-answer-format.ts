/**
 * The answer-first line of every value page, for search engines and answer
 * engines only (owner 2026-10-10: not shown on the page, which keeps the hero and
 * buy buttons on top). It leads the meta description (the search snippet) and
 * the WebPage JSON-LD:
 *   "<Item> is worth about $X · from N offers we track · Updated <date>."
 * The date is the last MATERIAL price move (seo_value_evidence.price_moved_at),
 * the same value as the page's JSON-LD dateModified and its sitemap lastmod.
 * Older than a week it reads "price steady since <date>" (2026-10-19): the
 * date is when the price last moved, so an old one means a held price, and
 * "Updated 5 Oct" two weeks on made the page look abandoned in results.
 * The count is offers we track, never "sales" (owner, 2026-10-09).
 */
export function formatAboutUsd(value: number): string {
  const digits = value < 10 ? 2 : 0
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export function formatUpdatedDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export interface AnswerInput {
  name: string
  valueUsd: number
  offers: number
  updatedAt: string | null
  /** For tests; defaults to now. */
  now?: number
}

const STEADY_AFTER_MS = 7 * 86_400_000

export function answerParts(a: AnswerInput): { worth: string; offers: string; updated: string | null } {
  const updated = formatUpdatedDate(a.updatedAt)
  const age = a.updatedAt ? (a.now ?? Date.now()) - Date.parse(a.updatedAt) : 0
  return {
    worth: `${a.name} is worth about ${formatAboutUsd(a.valueUsd)}`,
    offers: `from ${a.offers.toLocaleString('en-US')} ${a.offers === 1 ? 'offer' : 'offers'} we track`,
    updated: updated ? (age > STEADY_AFTER_MS ? `price steady since ${updated}` : `Updated ${updated}`) : null,
  }
}

export function answerLine(a: AnswerInput): string {
  const p = answerParts(a)
  return [p.worth, p.offers, p.updated].filter(Boolean).join(' · ')
}

/** The answer as the first sentence of a description; null for an unpriced item. */
export function answerSentence(a: { name: string; valueUsd: number | null | undefined; offers: number; updatedAt: string | null; now?: number }): string | null {
  if (a.valueUsd == null) return null
  return `${answerLine({ ...a, valueUsd: a.valueUsd })}.`
}

/** Lead a description with the answer sentence (fitDescription keeps whole sentences, so it survives trimming). */
export function withAnswer(answer: string | null, description: string): string {
  return answer ? `${answer} ${description}` : description
}
