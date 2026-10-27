import type { ReactNode } from 'react'
import { IconClock, IconPackage, IconSparkles, IconStarFilled, type Icon as TablerIcon } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

export interface Fact {
  key: string
  label: string
  value: ReactNode
  icon: TablerIcon
  /** Icon colour (rarity); neutral when omitted. */
  tone?: string
}

export const FACT_ICONS = { rarity: IconStarFilled, trait: IconSparkles, delivery: IconClock, stock: IconPackage } as const

/**
 * The offer's facts beside the picture: one tile each — an icon in a small
 * raised square, the label over the value. Two columns; fill only, no
 * outlines (house card system).
 */
export function ItemFacts({ facts, className }: { facts: Fact[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3.5', className)}>
      {facts.map((f) => (
        <div key={f.key} className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#1D1E23] text-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_18px_-12px_rgba(0,0,0,0.8)]"
            style={f.tone ? { color: f.tone } : undefined}
          >
            <f.icon aria-hidden size={18} stroke={1.9} />
          </span>
          <div className="min-w-0">
            <dt className="text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
              {f.label}
            </dt>
            <dd className="truncate font-semibold text-text-primary" style={{ fontSize: 'var(--fs-body)' }}>
              {f.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
