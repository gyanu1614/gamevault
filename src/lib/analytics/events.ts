/**
 * The PostHog event catalogue (growth point 1). One list, so the funnels in
 * PostHog and the code agree on names. Properties are flat primitives only:
 * slugs, ids, amounts, step numbers — never names, emails or free text.
 *
 * Buyer funnel   (page visit = PostHog's $pageview, carries utm_* / ref / src)
 *   listing_viewed            { game, category, listing_id, price_usd }
 *   checkout_started          { listing_id, qty }
 *   promo_code_applied        { code, listing_id }    (creator / coupon codes)
 *   checkout_submitted        { listing_id, order_id, method, subtotal_usd, has_promo }
 *   order_paid                { order_id, total_usd, game, promo_code } (server)
 *
 * Seller funnel  (fired by the founding / banner pages)
 *   seller_banner_clicked     { source }
 *   founding_step_viewed      { step: 1 | 2 | 3 | 4 }
 *   founding_step_completed   { step: 1 | 2 | 3 | 4 }
 *   seller_first_listing_published { game, category }
 *   seller_first_sale         { order_id, total_usd, game } (server)
 */

export const ANALYTICS_EVENTS = [
  'listing_viewed',
  'checkout_started',
  'promo_code_applied',
  'checkout_submitted',
  'order_paid',
  'seller_banner_clicked',
  'founding_step_viewed',
  'founding_step_completed',
  'seller_first_listing_published',
  'seller_first_sale',
] as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number]

export type EventProps = Record<string, string | number | boolean | null>

const PERSONAL_KEYS = /^(email|e-mail|name|full_?name|first_?name|last_?name|username|phone|address|ip|password|token)$/i
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/
const MAX_STRING = 200

export function cleanEventProps(props: Record<string, unknown>): EventProps {
  const out: EventProps = {}
  for (const [key, value] of Object.entries(props)) {
    if (PERSONAL_KEYS.test(key)) continue
    if (value === null || typeof value === 'boolean') out[key] = value
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
    else if (typeof value === 'string' && value.length <= MAX_STRING && !EMAIL.test(value)) out[key] = value
  }
  return out
}
