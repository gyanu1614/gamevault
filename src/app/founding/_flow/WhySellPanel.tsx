/**
 * "Why Sell Here" — four reasons as hairline rows with silver-glass icons
 * (the site's icon material), and the founding spots bar in the accent.
 * One flat surface; no nested boxes, no chips.
 */
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Coins } from '@phosphor-icons/react/dist/ssr/Coins'
import { Percent } from '@phosphor-icons/react/dist/ssr/Percent'
import { Crown } from '@phosphor-icons/react/dist/ssr/Crown'
import { ShieldCheck } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import type { FoundingProgress } from '@/lib/config/founding-seller'

/** Each reason carries its own hue (duotone icon in a tinted tile) so the
 *  panel reads lively, not a mono list — owner 2026-10-08. */
const WHY: ReadonlyArray<{ Icon: PhosphorIcon; tile: string; title: string; line: string }> = [
  { Icon: Coins, tile: 'bg-lime-tint-bg text-lime-text', title: 'Lowest Selling Fees on the Market', line: 'Some of the lowest seller fees anywhere, so you keep more of what you make.' },
  { Icon: Percent, tile: 'bg-warning-bg text-warning', title: 'Fees Get Even Cheaper', line: 'As an early seller you get 50% off all fees for your first year.' },
  { Icon: Crown, tile: 'bg-[rgba(245,196,81,0.14)] text-[#F5C451]', title: 'Founding Badge', line: 'A badge on your store to show off and bring in more buyers. It is yours to keep.' },
  { Icon: ShieldCheck, tile: 'bg-info-bg text-info', title: 'SafeDrop Protection', line: 'You only deliver once a purchase is made, so you never hand over an item first.' },
]

export function WhySellPanel({ progress, className }: { progress: FoundingProgress | null; className?: string }) {
  return (
    <aside className={['rounded-lg bg-bg-raised p-5 sm:p-6', className].filter(Boolean).join(' ')} aria-labelledby="why-sell-title">
      <h2 id="why-sell-title" className="text-subheading text-text-primary">
        Why Sell at DropMarket
      </h2>
      <ul className="mt-2">
        {WHY.map(({ Icon, tile, ...w }) => (
          <li key={w.title} className="flex items-start gap-3.5 border-t border-white/[0.07] py-4 first:border-t-0">
            <span aria-hidden className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tile}`}>
              <Icon weight="duotone" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-body-sm font-semibold text-text-primary">{w.title}</p>
              <p className="mt-0.5 text-body-sm text-text-secondary">{w.line}</p>
            </div>
          </li>
        ))}
      </ul>

      {progress && (
        <div className="mt-2 border-t border-white/[0.07] pt-5">
          <p className="text-body-sm text-text-primary">
            <span className="font-semibold text-lime-text">{progress.count} of {progress.cap}</span>{' '}
            {progress.mode === 'claimed' ? 'spots claimed' : 'spots spoken for'}
          </p>
          <div
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-overlay"
            role="progressbar"
            aria-label="Founding spots claimed"
            aria-valuemin={0}
            aria-valuemax={progress.cap}
            aria-valuenow={progress.count}
          >
            <div className="h-full rounded-full bg-lime-text transition-[width] duration-700" style={{ width: `${Math.max(2, progress.percent)}%` }} />
          </div>
          <p className="mt-2 text-caption font-normal text-text-tertiary">The first {progress.cap} sellers lock in the founding rate.</p>
        </div>
      )}
    </aside>
  )
}
