'use client'

/**
 * V19/P24/P7.t — Payment Method Picker.
 *
 * 2Game / GameBoost-style vertical list of payment-method tiles. Each
 * tile: brand icon block (44px, brand colour) on the left, name +
 * subtext in the middle, radio dot on the right. Selected tile
 * border + tint flips to lime. Hover-emphasised.
 *
 * Functionality:
 *   • Only the "card" option opens the real Stripe Elements card form
 *     inline below the tile (passed in as `cardForm` child).
 *   • Apple Pay / Google Pay / PayPal / Paysafe / Crypto / Klarna
 *     render as visual options for now — selecting any non-card method
 *     surfaces a "Coming soon" notice. Real wiring lands later.
 *
 * Accessibility: Radix RadioGroup under the hood so keyboard arrow nav
 * works for free.
 */

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  ApplePayIcon,
  CardIcon,
  CryptoIcon,
  GooglePayIcon,
  KlarnaIcon,
  PayPalIcon,
  PaysafeIcon,
} from './_PaymentBrands'

export type PaymentMethodId =
  | 'card'
  | 'apple_pay'
  | 'google_pay'
  | 'paypal'
  | 'paysafe'
  | 'crypto'
  | 'klarna'

interface MethodSpec {
  id: PaymentMethodId
  name: string
  subtext: string
  Icon: (p: { className?: string }) => JSX.Element
  /** When true, surfacing this method shows a "coming soon" notice
   *  instead of a real form. */
  comingSoon?: boolean
}

const METHODS: MethodSpec[] = [
  {
    id: 'card',
    name: 'Debit / Credit Card',
    subtext: 'Visa, Mastercard, Amex — securely via Stripe',
    Icon: CardIcon,
  },
  {
    id: 'apple_pay',
    name: 'Apple Pay',
    subtext: 'Pay with Touch ID or Face ID',
    Icon: ApplePayIcon,
    comingSoon: true,
  },
  {
    id: 'google_pay',
    name: 'Google Pay',
    subtext: 'Pay with your Google account',
    Icon: GooglePayIcon,
    comingSoon: true,
  },
  {
    id: 'paypal',
    name: 'PayPal',
    subtext: 'Pay with your PayPal balance or linked card',
    Icon: PayPalIcon,
    comingSoon: true,
  },
  {
    id: 'paysafe',
    name: 'Paysafe Card',
    subtext: 'Prepaid card for online payments',
    Icon: PaysafeIcon,
    comingSoon: true,
  },
  {
    id: 'crypto',
    name: 'Cryptocurrency',
    subtext: 'BTC · ETH · USDT · USDC and more',
    Icon: CryptoIcon,
    comingSoon: true,
  },
  {
    id: 'klarna',
    name: 'Klarna',
    subtext: 'Buy now, pay later in 3 installments',
    Icon: KlarnaIcon,
    comingSoon: true,
  },
]

export function PaymentMethodPicker({
  value,
  onValueChange,
  cardForm,
}: {
  value: PaymentMethodId
  onValueChange: (v: PaymentMethodId) => void
  /** Stripe Elements card form. Rendered inline under the card tile
   *  when card is selected. */
  cardForm: React.ReactNode
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onValueChange(v as PaymentMethodId)}
      className="space-y-2"
    >
      {METHODS.map((m) => {
        const on = value === m.id
        return (
          <div key={m.id}>
            {/* V19/P24/P7.bb — Bolder, more rectangular tile shape
                matching the Recommended Seller / V-Bucks bundle
                cards on the currency page: `rounded-xl`, 2px border
                (was 1px), generous py-4 height, larger 44px brand
                icon on the left, name + subtext + radio dot. */}
            {/* V19/P24/P7.ee — Thinner tile to cut vertical scroll on
                the left split. Icon scaled down to 32px (was 44),
                padding tightened, single-row name + subtext now
                inline. Visual rhythm matches the Recommended Seller
                card. */}
            <label
              className={cn(
                'group relative flex cursor-pointer items-center gap-3 rounded-xl border-2 bg-bg-raised/60 px-3 py-2.5 transition-all',
                on
                  ? 'border-lime bg-lime-tint-bg/15'
                  : 'border-border-subtle hover:border-border-default hover:bg-bg-raised',
              )}
            >
              <RadioGroupItem value={m.id} className="sr-only" />
              <span className="flex h-8 w-8 shrink-0 items-center justify-center [&>*]:h-8 [&>*]:w-8">
                <m.Icon />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      'text-[14px] font-bold',
                      on ? 'text-lime-text' : 'text-text-primary',
                    )}
                  >
                    {m.name}
                  </span>
                  {m.comingSoon && (
                    <span className="rounded-full bg-bg-overlay px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-tertiary">
                      Soon
                    </span>
                  )}
                </div>
                <p className="line-clamp-1 text-[11.5px] text-text-tertiary">
                  {m.subtext}
                </p>
              </div>
              <span
                aria-hidden
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  on
                    ? 'border-lime bg-lime'
                    : 'border-border-default bg-transparent group-hover:border-border-strong',
                )}
              >
                {on && <Check className="h-2.5 w-2.5 text-text-inverse" strokeWidth={3} />}
              </span>
            </label>

            {/* Inline expanded surface — only the card tile renders
                the Stripe Elements form. Coming-soon methods get a
                short notice when selected. */}
            {on && m.id === 'card' && cardForm && (
              <div className="mt-2.5 rounded-xl border border-border-subtle bg-bg-raised/60 p-3 sm:p-4">
                {cardForm}
              </div>
            )}
            {on && m.comingSoon && (
              <div className="mt-2.5 rounded-xl border border-warning/30 bg-warning-bg/30 p-3 text-[12.5px] text-warning">
                <span className="font-semibold">Coming soon.</span> This payment
                method isn’t live yet — pick Debit / Credit Card to complete
                checkout today. We’ll email you the moment {m.name} is
                available.
              </div>
            )}
          </div>
        )
      })}
    </RadioGroup>
  )
}
