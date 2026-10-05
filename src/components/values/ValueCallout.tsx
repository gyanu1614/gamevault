import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '@phosphor-icons/react'

/**
 * A tinted note box for the values hubs — the same amber / yellow callout the
 * checkout uses (tint + hairline + icon in one hue), so a key number or a tip
 * stands out from body text instead of trailing at the end of a section.
 * Server-safe (no hooks); pass a Phosphor SSR icon.
 *
 *   amber   the cost of doing it yourself ("25,000,000 Coins in total")
 *   yellow  a tip or context line ("the regular one drops at 0.2%")
 */
const TONES = {
  amber: { bg: 'rgba(255,178,62,0.09)', border: 'rgba(255,178,62,0.32)', hue: '#FFB23E', body: '#F2DDBA' },
  yellow: { bg: 'rgba(250,204,21,0.07)', border: 'rgba(250,204,21,0.28)', hue: '#FACC15', body: '#EDE3B8' },
} as const

export function ValueCallout({
  tone,
  icon: Icon,
  title,
  children,
  className,
}: {
  tone: keyof typeof TONES
  icon: ComponentType<IconProps>
  /** Bold first line, in the tone's colour. */
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const c = TONES[tone]
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3.5 ${className ?? ''}`}
      style={{ background: c.bg, borderColor: c.border }}
    >
      <Icon aria-hidden size={20} weight="duotone" className="mt-0.5 shrink-0" style={{ color: c.hue }} />
      <div className="min-w-0 text-[14px] leading-6">
        {title && (
          <p className="font-semibold" style={{ color: c.hue }}>
            {title}
          </p>
        )}
        {children && <div style={{ color: c.body }}>{children}</div>}
      </div>
    </div>
  )
}
