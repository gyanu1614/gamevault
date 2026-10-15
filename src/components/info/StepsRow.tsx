import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { StepRail } from './StepRail'
import { INFO_TONE, type InfoTone } from './tones'

export interface Step {
  icon: ComponentType<IconProps>
  title: string
  body: ReactNode
}

const COLS: Record<number, string> = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }

/**
 * A short sequence on ONE surface: numbered dots joined by a line, each step
 * an icon, a short title and one line (owner: steps in one line on desktop,
 * numbers only where the content really is a sequence). Stacked with a
 * vertical line on phones.
 */
export function StepsRow({ steps, tone = 'blue', className }: { steps: Step[]; tone?: InfoTone; className?: string }) {
  const t = INFO_TONE[tone]
  return (
    <ol className={cn('grid rounded-lg', COLS[steps.length], MARKET_CARD, className)}>
      {steps.map((s, i) => {
        const Icon = s.icon
        return (
          <li key={s.title} className="relative flex gap-4 p-5 md:flex-col md:gap-0 md:p-6">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-body-sm font-bold tabular-nums"
              style={{ background: t.tint, color: t.hue, boxShadow: `inset 0 0 0 1px ${t.edge}` }}
            >
              {i + 1}
            </span>
            {i < steps.length - 1 && <StepRail index={i} color={t.edge} />}
            <div className="min-w-0 md:mt-5">
              <h3 className="flex items-center gap-2 text-body font-semibold text-text-primary">
                <Icon aria-hidden size={20} weight="duotone" style={{ color: t.hue }} />
                {s.title}
              </h3>
              <p className="mt-1.5 text-body-sm text-text-secondary">{s.body}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
