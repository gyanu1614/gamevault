/**
 * ChatNotice: a DropMarket update inside the order chat (dispute opened /
 * resolved, order delivered). One compact centered row: small tinted icon
 * tile, a short bold title, one or two lines of detail. Deliberately small:
 * the chat is for the two parties; these only mark what changed.
 */

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'lime' | 'warning' | 'red' | 'neutral'

const TILE: Record<Tone, string> = {
  lime: 'bg-lime-tint-bg text-lime-text',
  warning: 'bg-warning-bg text-warning',
  red: 'bg-red-400/[0.12] text-red-400',
  neutral: 'bg-white/[0.06] text-text-secondary',
}

export default function ChatNotice({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon
  tone: Tone
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="my-3 flex justify-center px-1">
      <div
        role="status"
        className="flex w-full max-w-[440px] items-start gap-2.5 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5"
      >
        <span className={cn('mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-[7px]', TILE[tone])}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 leading-snug">
          <p className="text-[13px] font-bold text-text-primary">{title}</p>
          {children && <div className="mt-0.5 text-[12.5px] text-text-secondary">{children}</div>}
        </div>
      </div>
    </div>
  )
}
