/**
 * HowItWorks — the selling lifecycle in four steps, MINIMAL: big custom
 * duotone pictograms (HowItWorksIcons, not stock lucide), a short title under
 * each, and nothing else. Centered row on desktop with hairline connectors
 * that tip to lime; 2×2 grid on small screens. Purely presentational.
 */

'use client'

import type { ComponentType } from 'react'
import { PALETTE } from '../theme'
import { IconList, IconPay, IconDeliver, IconPaid } from './HowItWorksIcons'

interface Step {
  Icon: ComponentType<{ size?: number }>
  title: string
}

const STEPS: Step[] = [
  { Icon: IconList, title: 'You List' },
  { Icon: IconPay, title: 'Buyer Pays' },
  { Icon: IconDeliver, title: 'You Deliver' },
  { Icon: IconPaid, title: 'You Get Paid' },
]

export default function HowItWorks() {
  return (
    <section aria-label="How selling works">
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-0">
        {STEPS.map(({ Icon, title }, i) => {
          const isLast = i === STEPS.length - 1
          return (
            <div key={title} className="relative flex flex-col items-center">
              {/* Connector to the next node (desktop) — sits at tile mid-height. */}
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-[calc(50%+40px)] right-[calc(-50%+40px)] top-8 hidden h-px sm:block"
                  style={{
                    background: `linear-gradient(to right, ${PALETTE.line} 0%, ${PALETTE.line} 55%, ${PALETTE.lime} 100%)`,
                  }}
                />
              )}

              {/* Big icon tile */}
              <span
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{
                  background:
                    'linear-gradient(160deg, rgba(20,67,42,0.07) 0%, rgba(20,67,42,0.035) 100%)',
                  boxShadow: `inset 0 0 0 1px ${PALETTE.line}`,
                }}
              >
                <Icon size={40} />
              </span>

              <h3
                className="mt-3 text-center text-sm font-semibold"
                style={{ color: PALETTE.forest }}
              >
                {title}
              </h3>
            </div>
          )
        })}
      </div>
    </section>
  )
}
