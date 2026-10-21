import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { IconTile } from './IconTile'
import type { InfoTone } from './tones'

/**
 * One section of an info page: the icon tile in the section's own tone, the
 * heading, one optional line under it, then the body ~24px below (owner:
 * mt-6 under a heading; 16px looked cramped). Labelled by its heading.
 */
export function InfoSection({
  id,
  icon,
  tone = 'neutral',
  title,
  sub,
  aside,
  className = '',
  children,
}: {
  id: string
  icon: ComponentType<IconProps>
  tone?: InfoTone
  title: ReactNode
  sub?: ReactNode
  /** A link or control on the right of the heading (desktop), under it on phones. */
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className={`mt-16 scroll-mt-[calc(var(--navbar-bottom)+24px)] sm:mt-20 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex items-start gap-3.5">
          <IconTile icon={icon} tone={tone} />
          <div className="min-w-0">
            <h2 id={id} className="text-subheading font-bold text-text-primary sm:text-heading">
              {title}
            </h2>
            {sub && <p className="mt-1 text-body-sm text-text-secondary">{sub}</p>}
          </div>
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}
