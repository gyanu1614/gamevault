import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import Link from '@/components/navigation/AppLink'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { VALUE_BTN_PRIMARY } from '@/components/values/styles'
import { cn } from '@/lib/utils'
import { IconTile } from './IconTile'
import { INFO_TONE, type InfoTone } from './tones'

/** The closing band of an info page: one message, one specific action. */
export function InfoCtaBand({
  icon,
  tone = 'neutral',
  title,
  body,
  action,
  className,
}: {
  icon: ComponentType<IconProps>
  tone?: InfoTone
  title: string
  body: string
  action: { href: string; label: string }
  className?: string
}) {
  return (
    <section
      aria-label={title}
      className={cn('relative isolate mt-16 overflow-hidden rounded-lg sm:mt-20', MARKET_CARD, className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: `radial-gradient(70% 140% at 0% 50%, ${INFO_TONE[tone].wash}, transparent 70%)` }}
      />
      <div className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-4">
          <IconTile icon={icon} tone={tone} size="lg" />
          <div>
            <h2 className="text-subheading font-bold text-text-primary sm:text-heading">{title}</h2>
            <p className="mt-1.5 text-body-sm text-text-secondary">{body}</p>
          </div>
        </div>
        <Link href={action.href} className={cn(VALUE_BTN_PRIMARY, 'group h-11 w-full px-5 text-body-sm sm:w-auto')}>
          {action.label}
          <ArrowRightIcon size={16} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
    </section>
  )
}
