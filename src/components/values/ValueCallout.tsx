import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '@phosphor-icons/react'

/**
 * A slim tinted note box for the values hubs — the checkout's callout recipe
 * (tint + hairline + icon in one hue), cut to one line: icon, a bold lead in
 * the tone's colour, then the sentence. Rectangular (6px), full width, so a
 * key number or a tip reads at a glance instead of trailing at the end of a
 * section. Server-safe (no hooks); pass a Phosphor SSR icon.
 *
 *   blue    a number to stop on ("Total: 25,000,000 Coins")
 *   yellow  a tip or context line ("Good To Know")
 */
const TONES = {
  blue: { bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.26)', hue: '#8BBDFB', body: '#D3E3F8' },
  yellow: { bg: 'rgba(250,204,21,0.07)', border: 'rgba(250,204,21,0.26)', hue: '#FACC15', body: '#EDE3B8' },
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
  /** Bold lead, in the tone's colour, on the same line as the text. */
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const c = TONES[tone]
  return (
    <div
      className={`flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 ${className ?? ''}`}
      style={{ background: c.bg, borderColor: c.border }}
    >
      <Icon aria-hidden size={18} weight="duotone" className="mt-[3px] shrink-0" style={{ color: c.hue }} />
      <p className="min-w-0 text-[14px] leading-6" style={{ color: c.body }}>
        {title && (
          <span className="font-semibold" style={{ color: c.hue }}>
            {title}
          </span>
        )}
        {title && children ? ' · ' : null}
        {children}
      </p>
    </div>
  )
}
