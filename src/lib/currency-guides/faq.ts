import type { CurrencyGuide } from './schema'

export interface FaqEntry {
  q: string
  a: string
}

/**
 * The currency FAQ comes from the admin config (category_configs.config.faq,
 * per game, in the DB). Most configs carry the same password row:
 *   "Never. Delivery happens via the game's own trade/gift system — only your
 *    username/handle is required."
 * That is false wherever the currency can't be traded or gifted (V-Bucks,
 * Valorant Points, R6 Credits, COD Points, GTA$, FC Coins…): live R6 sellers
 * ask for the linked Xbox login. We don't write the DB from here; the page
 * swaps the answer at render where the game's guide says a password may be
 * needed (`delivery.no_password === false`), and leaves every other game's
 * admin copy alone.
 */
export const ACCOUNT_ACCESS_ANSWER =
  "Some delivery methods need account access. Your seller tells you exactly what's needed before you pay, and SafeDrop Protection covers the order. If you do share a login, change your password once the order is complete."

const PASSWORD_QUESTION = /\bpassword\b/i

/** The password row's answer for a game: the admin's own copy unless the guide says access may be needed. */
export function passwordAnswer(adminAnswer: string, noPassword: boolean | null | undefined): string {
  return noPassword === false ? ACCOUNT_ACCESS_ANSWER : adminAnswer
}

/** Questions shown on a currency page (accordion and FAQPage JSON-LD). */
export const FAQ_MAX = 6

const norm = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * The page's FAQ with the guide applied: the password row made honest, then
 * the guide's extra questions (skipping any the admin list already asks).
 * The visible accordion and the FAQPage JSON-LD both read this one list.
 */
export function applyGuideToFaq(faq: FaqEntry[], guide: CurrencyGuide | null): FaqEntry[] {
  if (!guide) return faq
  const fixed = faq.map((f) =>
    PASSWORD_QUESTION.test(f.q) ? { q: f.q, a: passwordAnswer(f.a, guide.delivery.no_password) } : f,
  )
  const seen = new Set(fixed.map((f) => norm(f.q)))
  const extra = guide.faq_extra.filter((f) => !seen.has(norm(f.q)))
  for (const f of extra) seen.add(norm(f.q))
  // The game's support question ("Why Is My Robux Pending?") is answered here,
  // not as a one-line section in the guide (owner, 2026-10-06).
  const support = guide.support_topic
  const supportQ =
    support && !seen.has(norm(support.heading))
      ? [{ q: support.heading, a: support.paragraphs.slice(0, 2).join(' ') }]
      : []
  const all = [...fixed, ...extra, ...supportQ]
  // Six at most (owner, 2026-10-06: "5-6 max, the best ones for search").
  // A guide can name its six, in order (page.faq_pick); otherwise the first six.
  const pick = guide.page?.faq_pick
  if (pick && pick.length > 0) {
    const byQ = new Map(all.map((f) => [norm(f.q), f]))
    const chosen = pick.map((q) => byQ.get(norm(q))).filter((f): f is FaqEntry => !!f)
    if (chosen.length > 0) return chosen.slice(0, FAQ_MAX)
  }
  return all.slice(0, FAQ_MAX)
}
