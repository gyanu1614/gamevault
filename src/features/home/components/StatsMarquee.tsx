/**
 * StatsMarquee — V20/P15
 *
 * Infinite horizontal marquee of trust chips. Replaces the static 4-tile
 * stats grid so the hero art behind it stays visible. Pure CSS animation
 * (translateX 0 → -50% with a doubled track), pauses on hover, edge fades
 * via mask-image. No background — floats over whatever's behind.
 *
 * Copy rule: honest pre-launch signals only — no invented order counts,
 * traded volumes, or seller totals.
 */
import {
  ShieldCheck,
  BadgeCheck,
  Building2,
  Zap,
  RotateCcw,
  Headset,
} from 'lucide-react'

interface Stat {
  value: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  /** Optional accent for the value (lime by default). */
  tone?: 'lime' | 'success' | 'info' | 'warning'
}

const STATS: Stat[] = [
  { Icon: ShieldCheck,  value: 'SafeDrop',   label: 'Buyer Protection on Every Order', tone: 'success' },
  { Icon: Building2,    value: 'UK Ltd',     label: 'Registered Company',              tone: 'info'    },
  { Icon: BadgeCheck,   value: 'Verified',   label: 'KYC-Checked Sellers',             tone: 'lime'    },
  { Icon: Zap,          value: 'Fast',       label: 'Quick Seller Payouts',            tone: 'warning' },
  { Icon: RotateCcw,    value: 'Money-Back', label: 'Guarantee',                       tone: 'success' },
  { Icon: Headset,      value: '24/7',       label: 'Human Support',                   tone: 'info'    },
]

const TONE_CLASSES: Record<NonNullable<Stat['tone']>, string> = {
  lime:    'text-lime-text',
  success: 'text-success',
  info:    'text-info',
  warning: 'text-warning',
}

export function StatsMarquee() {
  // Doubled track for seamless loop. Second copy is aria-hidden so SR
  // readers don't hear the values twice.
  const tracks = [STATS, STATS]
  return (
    <div
      className="group relative w-full overflow-hidden"
      style={{
        WebkitMaskImage:
          'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
        maskImage:
          'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
      }}
    >
      <div className="flex w-max animate-marquee items-center gap-10 sm:gap-14 group-hover:[animation-play-state:paused]">
        {tracks.map((track, t) => (
          <div
            key={t}
            className="flex shrink-0 items-center gap-10 sm:gap-14"
            aria-hidden={t === 1}
          >
            {track.map((stat, i) => (
              <StatChip key={`${t}-${i}`} stat={stat} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatChip({ stat }: { stat: Stat }) {
  const { Icon, value, label, tone = 'lime' } = stat
  return (
    <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
      <Icon className={`h-5 w-5 ${TONE_CLASSES[tone]}`} aria-hidden />
      <span className="font-display text-[18px] font-black italic uppercase tracking-tight tabular-nums text-text-primary">
        {value}
      </span>
      <span className="font-display text-[18px] font-black italic uppercase tracking-tight text-text-primary">
        {label}
      </span>
    </div>
  )
}
