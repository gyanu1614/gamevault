/**
 * StatsMarquee — V20/P15
 *
 * Infinite horizontal marquee of stat chips. Replaces the static 4-tile
 * stats grid so the hero art behind it stays visible. Pure CSS animation
 * (translateX 0 → -50% with a doubled track), pauses on hover, edge fades
 * via mask-image. No background — floats over whatever's behind.
 */
import {
  ShoppingBag,
  ShieldCheck,
  Star,
  Gamepad2,
  Zap,
  Users,
  Lock,
  Globe2,
} from 'lucide-react'

interface Stat {
  value: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  /** Optional accent for the value (lime by default). */
  tone?: 'lime' | 'success' | 'info' | 'warning'
}

const STATS: Stat[] = [
  { Icon: ShoppingBag,  value: '1.24M+', label: 'Orders Delivered',   tone: 'lime'    },
  { Icon: ShieldCheck,  value: '$48M+',  label: 'Traded Securely',    tone: 'success' },
  { Icon: Star,         value: '4.9',    label: 'Avg Seller Rating',  tone: 'warning' },
  { Icon: Gamepad2,     value: '180+',   label: 'Games Supported',    tone: 'info'    },
  { Icon: Zap,          value: '<5 min', label: 'Average Delivery',   tone: 'lime'    },
  { Icon: Users,        value: '92K+',   label: 'Active Sellers',     tone: 'info'    },
  { Icon: Lock,         value: '100%',   label: 'Escrow Protected',   tone: 'success' },
  { Icon: Globe2,       value: '24/7',   label: 'Support Worldwide',  tone: 'warning' },
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
