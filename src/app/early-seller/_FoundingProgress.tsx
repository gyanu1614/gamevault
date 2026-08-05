/**
 * FoundingProgress — the honest "momentum / scarcity" bar above the waitlist
 * form. Data comes from getFoundingProgress() (real DB counts, never seeded):
 *   - mode 'waitlist' (early days): "N sellers already joined the founding
 *     waitlist · 100 spots" — real waitlist size, shows traction without
 *     claiming a near-zero "claimed" count.
 *   - mode 'claimed' (once >= reveal threshold granted): "N of 100 founding
 *     spots claimed" — the stronger, real scarcity line.
 * Renders nothing when there's nothing honest to show (handled by the parent
 * passing null).
 */

import type { FoundingProgress as FoundingProgressData } from '@/lib/config/founding-seller'

const AMBER = '#F5C451'

export function FoundingProgress({ data }: { data: FoundingProgressData }) {
  const { mode, count, cap, percent } = data

  const label =
    mode === 'claimed' ? (
      <>
        <span className="font-bold text-white">{count}</span>
        <span className="text-text-secondary"> of {cap} founding spots claimed</span>
      </>
    ) : (
      <>
        <span className="font-bold text-white">{count}</span>
        <span className="text-text-secondary">
          {' '}
          {count === 1 ? 'seller has' : 'sellers'} already joined the founding waitlist
        </span>
      </>
    )

  return (
    <div className="mb-5 rounded-xl border border-[#F5C451]/20 bg-[#F5C451]/[0.05] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] leading-snug">{label}</p>
        <p
          className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: AMBER }}
        >
          {mode === 'claimed' ? `${cap - count} left` : `${cap} spots`}
        </p>
      </div>

      {/* Real progress toward the 100-spot cap. */}
      <div
        className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-label={
          mode === 'claimed'
            ? `${count} of ${cap} founding spots claimed`
            : `${count} sellers on the founding waitlist of ${cap} spots`
        }
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.max(percent, 3)}%`,
            background: `linear-gradient(to right, ${AMBER}cc, ${AMBER})`,
          }}
        />
      </div>
    </div>
  )
}
