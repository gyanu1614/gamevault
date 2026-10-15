import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins'
import { GiftIcon } from '@phosphor-icons/react/dist/ssr/Gift'
import { LightningIcon } from '@phosphor-icons/react/dist/ssr/Lightning'
import { RocketLaunchIcon } from '@phosphor-icons/react/dist/ssr/RocketLaunch'
import { SwordIcon } from '@phosphor-icons/react/dist/ssr/Sword'
import { UserCircleIcon } from '@phosphor-icons/react/dist/ssr/UserCircle'
import { ChatCircleDotsIcon } from '@phosphor-icons/react/dist/ssr/ChatCircleDots'
import { IconTile, INFO_TONE } from '@/components/info'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { ValueCallout } from '@/components/values/ValueCallout'
import {
  DISPUTE_WINDOW_LABEL,
  PROTECTION_WINDOW_HOURS as WIN,
  hoursAsDaysTitle,
  type ProtectionCategoryType,
} from '@/lib/legal/protection-windows'

const ROWS: { type: ProtectionCategoryType; label: string; icon: ComponentType<IconProps>; from: string }[] = [
  { type: 'currency', label: 'In-Game Currency', icon: CoinsIcon, from: 'Delivery' },
  { type: 'items', label: 'Items', icon: SwordIcon, from: 'Delivery' },
  { type: 'top_up', label: 'Top-Ups', icon: LightningIcon, from: 'Delivery' },
  { type: 'gift_card', label: 'Gift Cards', icon: GiftIcon, from: 'Delivery' },
  { type: 'service', label: 'Boosting & Coaching', icon: RocketLaunchIcon, from: 'Completion' },
  { type: 'account', label: 'Game Accounts', icon: UserCircleIcon, from: 'Delivery' },
]

/** Literal class strings (Tailwind only sees whole names): base 2-up grid, lg 3-up grid. */
const RULE = {
  l: { both: 'border-l', base: 'border-l lg:border-l-0', lg: 'lg:border-l', none: '' },
  t: { both: 'border-t', base: 'border-t lg:border-t-0', lg: 'lg:border-t', none: '' },
} as const

function side(edge: 'l' | 't', base: boolean, lg: boolean): string {
  return RULE[edge][base && lg ? 'both' : base ? 'base' : lg ? 'lg' : 'none']
}

/** Hairlines between tiles: column rules and row rules for 2 (base) and 3 (lg) columns. */
function rules(i: number): string {
  return cn(side('l', i % 2 === 1, i % 3 !== 0), side('t', i >= 2, i >= 3))
}

/**
 * Each category's protection window as a tile (icon, category, the number
 * big), six on one surface split by hairlines: 3 across on desktop, 2 on
 * tablets and phones. Then the one number that outlasts every window.
 */
export function WindowsTable() {
  const t = INFO_TONE.amber
  return (
    <div className="space-y-3">
      <ul
        aria-label="Protection window by category"
        className={cn('grid grid-cols-2 overflow-hidden rounded-lg lg:grid-cols-3', MARKET_CARD)}
      >
        {ROWS.map((r, i) => (
          <li
            key={r.type}
            className={cn('flex flex-col justify-between gap-3 border-white/[0.07] p-4 sm:p-5', rules(i))}
          >
            <span className="flex items-center gap-2.5 text-body-sm font-medium text-text-secondary">
              <IconTile icon={r.icon} tone="amber" size="sm" />
              {r.label}
            </span>
            <span>
              <span className="block text-heading font-bold tabular-nums" style={{ color: t.hue }}>
                {hoursAsDaysTitle(WIN[r.type])}
              </span>
              <span className="mt-0.5 block text-caption text-text-tertiary">from {r.from.toLowerCase()}</span>
            </span>
          </li>
        ))}
      </ul>
      <ValueCallout tone="blue" icon={ChatCircleDotsIcon} title={`Disputes stay open ${DISPUTE_WINDOW_LABEL}`}>
        from delivery, even after you confirm or the order completes.
      </ValueCallout>
    </div>
  )
}
