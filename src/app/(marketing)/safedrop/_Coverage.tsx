import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/ssr/CheckCircle'
import { CheckIcon } from '@phosphor-icons/react/dist/ssr/Check'
import { XCircleIcon } from '@phosphor-icons/react/dist/ssr/XCircle'
import { XIcon } from '@phosphor-icons/react/dist/ssr/X'
import { IconTile, INFO_TONE, type InfoTone } from '@/components/info'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { COVERED, NOT_COVERED } from './_content'

/** Covered and not covered, side by side on one surface (one column on phones). */
export function Coverage() {
  return (
    <div className={cn('grid overflow-hidden rounded-lg md:grid-cols-2', MARKET_CARD)}>
      <Column tone="green" icon={CheckCircleIcon} mark={CheckIcon} title="Covered" items={COVERED} />
      <Column
        tone="red"
        icon={XCircleIcon}
        mark={XIcon}
        title="Not Covered"
        items={NOT_COVERED}
        className="border-t border-white/[0.07] md:border-l md:border-t-0"
      />
    </div>
  )
}

function Column({
  tone,
  icon,
  mark: Mark,
  title,
  items,
  className,
}: {
  tone: InfoTone
  icon: ComponentType<IconProps>
  mark: ComponentType<IconProps>
  title: string
  items: string[]
  className?: string
}) {
  const t = INFO_TONE[tone]
  return (
    <div className={cn('p-5 sm:p-6', className)} style={{ background: `linear-gradient(180deg, ${t.tint}, transparent 55%)` }}>
      <h3 className="flex items-center gap-3 text-body-lg font-semibold text-text-primary">
        <IconTile icon={icon} tone={tone} size="sm" />
        {title}
      </h3>
      <ul className="mt-5 space-y-3.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-body-sm text-text-primary">
            <Mark aria-hidden size={16} weight="bold" className="mt-[3px] shrink-0" style={{ color: t.hue }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
