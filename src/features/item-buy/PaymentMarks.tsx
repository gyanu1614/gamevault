import { payssionSelectorMethods } from '@/lib/payments/providers/payssion/methods'
import { CARD_SCHEME_MARKS, CHECKOUT_COINS, PAYMENT_METHOD_ONDARK, WALLET_MARKS, type MethodMark } from '@/lib/payments/method-marks'

/**
 * Ways to pay, under Buy (owner, 2026-10-28: "Visa, Mastercard, paysafecard
 * and such, nicely spaced"; then "no boxes, floating, a bit smaller, one
 * row"). The checkout's own on-dark marks in their colours, spread evenly
 * across the box at one optical size; the methods not drawn are counted at
 * the end. Card and the two wallets are the Stripe rail; paysafecard and the
 * coins are worldwide.
 */
const PAYSAFECARD = payssionSelectorMethods().some((m) => m.pmId === 'paysafecard') ? [{ label: 'paysafecard', ...PAYMENT_METHOD_ONDARK.paysafecard }] : []
const COINS = CHECKOUT_COINS.map((c) => ({ label: c.label, logo: c.icon, aspect: 1 }))

const MARKS: Array<MethodMark & { label: string }> = [
  { label: 'Visa', ...CARD_SCHEME_MARKS.visa },
  { label: 'Mastercard', ...CARD_SCHEME_MARKS.mastercard },
  { label: 'Apple Pay', ...WALLET_MARKS.applepay },
  { label: 'Google Pay', ...WALLET_MARKS.googlepay },
  ...PAYSAFECARD,
  ...COINS,
]

/** Checkout methods in all: the Payssion rails, the coins, card, Apple Pay and Google Pay. */
const METHODS = payssionSelectorMethods().length + CHECKOUT_COINS.length + 3
/** Visa and Mastercard are one method (card). */
const MORE = Math.max(0, METHODS - (MARKS.length - 1))

/**
 * One optical size for every mark (checkout's markSize rule: a wide wordmark
 * runs longer and lower), but never lower than MIN_HEIGHT, so a long
 * wordmark like paysafecard stays readable.
 */
const SLOT = { width: 56, height: 16 }
const MIN_HEIGHT = 10
function markBox(aspect: number) {
  let height = Math.max(MIN_HEIGHT, Math.min(SLOT.height, SLOT.height * Math.pow(aspect, -0.4)))
  let width = height * aspect
  if (width > SLOT.width) {
    width = SLOT.width
    height = width / aspect
  }
  return { width: Math.round(width), height: Math.round(height) }
}

export function PaymentMarks() {
  return (
    <div>
      <span className="sr-only">
        Pay with {MARKS.map((m) => m.label).join(', ')}
        {MORE > 0 ? ` and ${MORE} more` : ''}
      </span>
      <ul aria-hidden className="flex items-center justify-between gap-2">
        {MARKS.map((m) => {
          const box = markBox(m.aspect)
          return (
            <li key={m.label} className="flex shrink-0 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- static mark in /public */}
              <img src={m.logo} alt="" width={box.width} height={box.height} loading="lazy" decoding="async" style={{ width: box.width, height: box.height }} />
            </li>
          )
        })}
        {MORE > 0 ? (
          <li className="shrink-0 whitespace-nowrap font-semibold text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
            +{MORE} More
          </li>
        ) : null}
      </ul>
    </div>
  )
}
