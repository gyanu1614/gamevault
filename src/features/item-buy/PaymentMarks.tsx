import { payssionSelectorMethods } from '@/lib/payments/providers/payssion/methods'
import { CHECKOUT_COINS, CHECKOUT_COINS_MONO, PAYMENT_METHOD_MONO } from '@/lib/payments/method-marks'

/**
 * Ways to pay, inside the buy box (StockX shows them next to the decision).
 * Only methods the checkout really offers, and only ones any buyer can use:
 * the two coins and the worldwide or Europe-wide rails — never card scheme
 * logos, whose rails here take local cards only. The rest are counted.
 */
const SHOWN_METHODS = ['paysafecard', 'trustly']

const COIN_MARKS = CHECKOUT_COINS.map((c) => ({ key: c.key, label: c.label, src: CHECKOUT_COINS_MONO[c.key] }))
const METHOD_MARKS = SHOWN_METHODS.flatMap((id) => {
  const mono = PAYMENT_METHOD_MONO[id]
  const method = payssionSelectorMethods().find((m) => m.pmId === id)
  return mono && 'logo' in mono && method ? [{ key: id, label: method.label, src: mono.logo }] : []
})
const MARKS = [...COIN_MARKS, ...METHOD_MARKS]
const MORE = payssionSelectorMethods().length + CHECKOUT_COINS.length - MARKS.length

export function PaymentMarks() {
  return (
    <div className="flex items-center gap-4">
      <span className="sr-only">Pay with {MARKS.map((m) => m.label).join(', ')} and {MORE} more</span>
      {MARKS.map((m) => (
        /* eslint-disable-next-line @next/next/no-img-element -- static mark in /public */
        <img key={m.key} src={m.src} alt="" aria-hidden loading="lazy" decoding="async" className="h-4 w-auto max-w-[72px] object-contain opacity-60" />
      ))}
      {MORE > 0 ? (
        <span aria-hidden className="text-text-tertiary" style={{ fontSize: 'var(--fs-caption)' }}>
          +{MORE} more
        </span>
      ) : null}
    </div>
  )
}
