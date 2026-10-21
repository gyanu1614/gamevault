import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { IconTile } from './IconTile'
import { INFO_TONE, type InfoTone } from './tones'

/**
 * The centred hero of a site info page (SafeDrop, fees, browse, guides).
 * Same type scale as HubHero (30 → 42px, the WFL-calculator recipe) but no
 * HubNav clearance: these pages sit under the global navbar, which already
 * leaves its own spacer. A faint wash in the page's tone gives the top some
 * colour without a glow. Server-safe.
 */
export function InfoHero({
  icon,
  tone = 'neutral',
  title,
  lead,
  children,
}: {
  icon?: ComponentType<IconProps>
  tone?: InfoTone
  title: ReactNode
  lead?: ReactNode
  /** CTAs, under the lead. */
  children?: ReactNode
}) {
  return (
    <header className="relative isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-28 -z-10 h-[460px]"
        style={{ background: `radial-gradient(50% 62% at 50% 0%, ${INFO_TONE[tone].wash}, transparent 74%)` }}
      />
      <div className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center motion-safe:animate-fade-up">
          {icon && <IconTile icon={icon} tone={tone} size="lg" />}
          <h1 className="mt-5 text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[42px]">
            {title}
          </h1>
          {lead && <p className="mt-3 max-w-2xl text-[15px] leading-7 text-text-secondary sm:text-[17px]">{lead}</p>}
          {children && <div className="mt-6 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">{children}</div>}
        </div>
      </div>
    </header>
  )
}
