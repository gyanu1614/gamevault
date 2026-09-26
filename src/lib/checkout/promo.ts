/**
 * AUTH-003 — Server-side promo resolution for checkout.
 *
 * The client may only send a promo CODE. The discount is derived here from the
 * validated promo row and clamped to the subtotal; a client-supplied discount
 * amount is never an input. Pure (the validator is injected) so it unit-tests
 * without a DB.
 */

import type { PromoValidationResult } from '@/lib/actions/promo'

export type PromoValidator = (code: string, subtotal: number) => Promise<PromoValidationResult>

export type ResolvedPromo =
  | { ok: true; discount: number; promoCodeId: string | null }
  | { ok: false; error: string }

const round2 = (n: number) => Math.round(n * 100) / 100

export async function resolveCheckoutPromo(
  promoCode: string | null | undefined,
  subtotal: number,
  validate: PromoValidator,
): Promise<ResolvedPromo> {
  const code = (promoCode ?? '').trim()
  if (!code) return { ok: true, discount: 0, promoCodeId: null }

  const res = await validate(code, subtotal)
  if (!res.valid || !res.promoCodeId) {
    return { ok: false, error: res.error ?? 'Invalid or expired promo code' }
  }

  const raw = Number(res.discountAmount ?? 0)
  const discount = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), Math.max(subtotal, 0)) : 0
  return { ok: true, discount: round2(discount), promoCodeId: res.promoCodeId }
}

/**
 * PAY-014: the promo caps bind inside promo_usage_record (usage / per-user /
 * active window). Map the RPC's refusal text to the buyer-facing message.
 * Shared by the standalone recorder and the one-RPC checkout path.
 */
export function promoRefusalMessage(detail: string): string {
  if (/per-user limit/i.test(detail)) return 'You have already used this promo code'
  if (/usage limit/i.test(detail)) return 'This promo code has reached its usage limit'
  if (/no longer active/i.test(detail)) return 'This promo code has expired'
  return 'This promo code could not be applied'
}
