'use client'

/**
 * SellerJourneyTracker — the per-founder "Your progress" strip shown ABOVE the
 * announcements on the Founding HQ. Turns the page from a broadcast feed into a
 * personal journey: Claimed → Application started → Under review → Approved →
 * First listing live. Each step is done / current / upcoming; only the current
 * step shows its next-action hint, so it always tells the founder what to do.
 *
 * Lives in the seller-app Forest Ledger world (ivory ground, forest, lime as a
 * hairline accent). Data comes from resolveSellerJourney in hq-data.ts.
 */

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { PALETTE } from '@/app/account/become-seller/_redesign/theme'
import type { SellerJourney } from '@/lib/founding/hq-data'

export default function SellerJourneyTracker({ journey }: { journey: SellerJourney }) {
  const { steps } = journey

  return (
    <div
      className="rounded-2xl border bg-white p-4"
      style={{ borderColor: PALETTE.line, boxShadow: '0 2px 8px rgba(20,67,42,0.04)' }}
    >
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const done = step.state === 'done'
          const current = step.state === 'current'
          return (
            <li key={step.key} className="relative flex gap-3">
              {/* connector line */}
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-[11px] top-6 w-[2px]"
                  style={{ bottom: 0, backgroundColor: done ? PALETTE.forest2 : '#EAEBE3' }}
                />
              )}

              {/* node */}
              <span className="relative z-10 shrink-0">
                {done ? (
                  <span
                    className="flex h-[23px] w-[23px] items-center justify-center rounded-full"
                    style={{ backgroundColor: PALETTE.forest }}
                  >
                    <Check className="h-3.5 w-3.5" style={{ color: PALETTE.lime }} strokeWidth={3} />
                  </span>
                ) : current ? (
                  <motion.span
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="flex h-[23px] w-[23px] items-center justify-center rounded-full ring-4"
                    style={{
                      backgroundColor: PALETTE.lime,
                      // @ts-expect-error CSS var for ring color
                      '--tw-ring-color': 'rgba(163,230,53,0.22)',
                    }}
                  >
                    <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: PALETTE.forest }} />
                  </motion.span>
                ) : (
                  <span
                    className="flex h-[23px] w-[23px] items-center justify-center rounded-full border-2"
                    style={{ borderColor: '#DDE0D3', backgroundColor: '#FAFAF7' }}
                  >
                    <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: '#D2D6C8' }} />
                  </span>
                )}
              </span>

              {/* label + hint */}
              <div className={isLast ? 'pb-0' : 'pb-4'}>
                <div
                  className="text-[13.5px] font-semibold leading-[23px]"
                  style={{ color: current ? PALETTE.forest : done ? PALETTE.ink : '#9a9f92' }}
                >
                  {step.label}
                </div>
                {current && (
                  <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
                    {step.hint}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
