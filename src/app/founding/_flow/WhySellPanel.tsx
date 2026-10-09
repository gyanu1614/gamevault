'use client'

/**
 * "Why Sell at DropMarket" — a glass pane beside the checklist. Four reasons
 * rise in one after another on mount, each tile lifts a touch on hover,
 * and the founding-spots bar fills once (owner, 2026-10-09: "add life to
 * it, professional and subtle").
 */
import { motion, useReducedMotion } from 'framer-motion'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Coins } from '@phosphor-icons/react/dist/ssr/Coins'
import { Percent } from '@phosphor-icons/react/dist/ssr/Percent'
import { Crown } from '@phosphor-icons/react/dist/ssr/Crown'
import { ShieldCheck } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import type { FoundingProgress } from '@/lib/config/founding-seller'
import { GLASS_CARD } from './ui'

const WHY: ReadonlyArray<{ Icon: PhosphorIcon; tile: string; title: string; line: string }> = [
  { Icon: Coins, tile: 'bg-lime-tint-bg text-lime-text', title: 'Lowest Selling Fees on the Market', line: 'Some of the lowest seller fees anywhere, so you keep more of what you make.' },
  { Icon: Percent, tile: 'bg-warning-bg text-warning', title: 'Fees Get Even Cheaper', line: 'As an early seller you get 50% off all fees for your first year.' },
  { Icon: Crown, tile: 'bg-[rgba(245,196,81,0.14)] text-[#F5C451]', title: 'Founding Badge', line: 'A badge on your store to show off and bring in more buyers. It is yours to keep.' },
  { Icon: ShieldCheck, tile: 'bg-info-bg text-info', title: 'SafeDrop Protection', line: 'You only deliver once a purchase is made, so you never hand over an item first.' },
]

const EASE = [0.22, 1, 0.36, 1] as const

export function WhySellPanel({ progress, className }: { progress: FoundingProgress | null; className?: string }) {
  const reduce = useReducedMotion()
  const rise = (i: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: EASE, delay: 0.15 + i * 0.08 } }

  return (
    <aside className={[GLASS_CARD, 'p-5 sm:p-6', className].filter(Boolean).join(' ')} aria-labelledby="why-sell-title">
      <h2 id="why-sell-title" className="text-subheading text-text-primary">
        Why Sell at <span className="seller-shimmer">DropMarket</span>
      </h2>
      <ul className="mt-3">
        {WHY.map(({ Icon, tile, ...w }, i) => (
          <motion.li
            key={w.title}
            {...rise(i)}
            className="group flex items-start gap-3.5 border-t border-white/[0.05] py-4 first:border-t-0"
          >
            <span
              aria-hidden
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 ease-out group-hover:-translate-y-0.5 ${tile}`}
            >
              <Icon weight="duotone" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-body-sm font-semibold text-text-primary">{w.title}</p>
              <p className="mt-0.5 text-body-sm leading-relaxed text-text-secondary">{w.line}</p>
            </div>
          </motion.li>
        ))}
      </ul>

      {progress && (
        <motion.div {...rise(WHY.length)} className="mt-2 border-t border-white/[0.05] pt-5">
          <p className="text-body-sm text-text-primary">
            <span className="font-semibold text-lime-text">{progress.count} of {progress.cap}</span>{' '}
            {progress.mode === 'claimed' ? 'spots claimed' : 'spots spoken for'}
          </p>
          <div
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
            role="progressbar"
            aria-label="Founding spots claimed"
            aria-valuemin={0}
            aria-valuemax={progress.cap}
            aria-valuenow={progress.count}
          >
            <motion.div
              className="h-full rounded-full bg-lime-text"
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${Math.max(2, progress.percent)}%` }}
              transition={reduce ? { duration: 0 } : { duration: 0.9, ease: EASE, delay: 0.5 }}
            />
          </div>
          <p className="mt-2 text-caption font-normal text-text-tertiary">The first {progress.cap} sellers lock in the founding rate.</p>
        </motion.div>
      )}
    </aside>
  )
}
