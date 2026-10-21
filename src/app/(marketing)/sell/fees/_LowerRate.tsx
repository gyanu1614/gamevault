import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { CrownSimpleIcon } from '@phosphor-icons/react/dist/ssr/CrownSimple'
import { SparkleIcon } from '@phosphor-icons/react/dist/ssr/Sparkle'
import Link from '@/components/navigation/AppLink'
import { IconTile, INFO_TONE } from '@/components/info'
import { TierIcon } from '@/components/seller/tiers/TierIcon'
import type { PublicFeeSchedule } from '@/lib/fees/public-rates'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { pct, pts } from './_fees-content'

/**
 * Beside the category table: the two ways a rate goes down. The rank ladder
 * (each rank takes points off, never below the floor) and the founding
 * programme (replaces the rank discount while it runs). One surface, two
 * parts split by a hairline.
 */
export function LowerRate({ s }: { s: PublicFeeSchedule }) {
  return (
    <aside aria-labelledby="lower-rate" className={cn('flex flex-col rounded-lg p-5 sm:p-6', MARKET_CARD)}>
      <h3 id="lower-rate" className="flex items-center gap-3 text-body-lg font-semibold text-text-primary">
        <IconTile icon={CrownSimpleIcon} tone="amber" size="sm" />
        Lower Your Rate
      </h3>
      <ul className="mt-4 overflow-hidden rounded-md">
        {s.ranks.map((r) => (
          <li key={r.tier} className="flex items-center justify-between gap-3 px-3 py-2.5 text-body-sm odd:bg-white/[0.035]">
            <span className="inline-flex items-center gap-2.5 font-medium text-text-primary">
              <TierIcon tier={r.tier} size={20} decorative />
              {r.displayName}
            </span>
            <span className="tabular-nums text-text-secondary">
              {r.discountPts > 0 ? (
                <b className="font-semibold" style={{ color: INFO_TONE.green.hue }}>
                  {`-${pts(r.discountPts)} pts`}
                </b>
              ) : (
                'Standard Rate'
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-caption text-text-tertiary">
        {`Rank discounts never take a rate below ${pct(s.rankFloorPct)}.`}{' '}
        <Link href="/account/tiers" className="inline-flex items-center gap-1 font-semibold text-text-secondary hover:text-text-primary">
          How ranks are earned <ArrowRightIcon size={11} weight="bold" aria-hidden />
        </Link>
      </p>
      <div className="mt-5 flex items-start gap-3 border-t border-white/[0.07] pt-5">
        <IconTile icon={SparkleIcon} tone="lime" size="sm" />
        <p className="text-body-sm text-text-secondary">
          <span className="font-semibold text-text-primary">Founding sellers</span>
          {` pay ${pct(s.founding.discountPct)} less for their first ${s.founding.months} months. It replaces the rank discount while it runs.`}
        </p>
      </div>
    </aside>
  )
}
