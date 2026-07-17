/**
 * HowItWorks — a clean, fintech-authentic row explaining the selling lifecycle
 * in four outcome-oriented steps: Seller Lists → Buyer Purchases → Seller
 * Delivers → Buyer Confirms & Seller Gets Paid. Simple line icons, light world
 * (forest on ivory, lime reserved for the connector accents). Renders as a row
 * on desktop with hairline connectors between nodes, and a stacked column on
 * mobile. Purely presentational — lives on the intro screen.
 */

'use client'

import type { LucideIcon } from 'lucide-react'
import { ListChecks, ShoppingCart, Truck, HandCoins } from 'lucide-react'
import { PALETTE } from '../theme'

interface Step {
  icon: LucideIcon
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: ListChecks,
    title: 'Seller Lists',
    body: 'You post what you sell — game, category, price. Live in minutes.',
  },
  {
    icon: ShoppingCart,
    title: 'Buyer Purchases',
    body: 'A buyer pays upfront. Their funds are held safe until delivery.',
  },
  {
    icon: Truck,
    title: 'Seller Delivers',
    body: 'You hand over the item, account, or top-up straight to the buyer.',
  },
  {
    icon: HandCoins,
    title: 'Buyer Confirms & You Get Paid',
    body: 'Once the buyer confirms, your earnings are released to your payout.',
  },
]

export default function HowItWorks() {
  return (
    <section aria-label="How selling works">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          const isLast = i === STEPS.length - 1
          return (
            <div key={step.title} className="relative flex gap-4 lg:flex-col lg:gap-0">
              {/* Node */}
              <div className="relative flex shrink-0 flex-col items-center lg:flex-row lg:items-center">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: 'rgba(20,67,42,0.06)',
                    color: PALETTE.forest2,
                    boxShadow: `inset 0 0 0 1px ${PALETTE.line}`,
                  }}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>

                {/* Desktop connector to the next node */}
                {!isLast && (
                  <span
                    aria-hidden
                    className="ml-4 hidden h-px flex-1 lg:block"
                    style={{
                      background: `linear-gradient(to right, ${PALETTE.line} 0%, ${PALETTE.line} 60%, ${PALETTE.lime} 100%)`,
                    }}
                  />
                )}
              </div>

              {/* Text */}
              <div className="lg:mt-4 lg:pr-4">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: PALETTE.ink2 }}
                  >
                    Step {i + 1}
                  </span>
                </div>
                <h3
                  className="mt-1 text-sm font-semibold leading-snug"
                  style={{ color: PALETTE.forest }}
                >
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: PALETTE.ink2 }}>
                  {step.body}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
