import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { IconTile } from './IconTile'
import type { InfoTone } from './tones'

export interface Fact {
  icon: ComponentType<IconProps>
  tone?: InfoTone
  title: string
  body: string
  href?: string
}

/**
 * Short facts side by side on one surface, split by hairlines (the /support
 * trust strip, shared): 1 column on phones, 2 on tablets, all in one row on
 * desktop. No cards inside the card.
 */
export function FactStrip({ items, label, className }: { items: Fact[]; label: string; className?: string }) {
  const cols = items.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
  return (
    <section aria-label={label} className={className}>
      <ul className={cn('grid divide-y divide-white/[0.07] rounded-lg sm:grid-cols-2 sm:divide-y-0 lg:divide-x', cols, MARKET_CARD)}>
        {items.map((f, i) => {
          const inner = (
            <>
              <IconTile icon={f.icon} tone={f.tone} />
              <span className="min-w-0">
                <span className="block text-body font-semibold text-text-primary">{f.title}</span>
                <span className="mt-1 block text-body-sm text-text-tertiary">{f.body}</span>
              </span>
            </>
          )
          return (
            <li
              key={f.title}
              // 2-up on tablets: a hairline under the first row only.
              className={cn(i < items.length - (items.length % 2 || 2) && 'sm:border-b sm:border-white/[0.07] lg:border-b-0')}
            >
              {f.href ? (
                <Link href={f.href} className="flex h-full items-start gap-3.5 p-5 transition-colors hover:bg-white/[0.03]">
                  {inner}
                </Link>
              ) : (
                <div className="flex h-full items-start gap-3.5 p-5">{inner}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
