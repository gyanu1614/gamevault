import type { ReactNode } from 'react'
import { VALUE_SURFACE } from './styles'

/**
 * Titled content card for methodology / about / FAQ-adjacent blocks.
 * Title sits inside the card; body text uses the secondary token.
 */
export function HubSection({
  title,
  children,
  id,
  className = '',
}: {
  title?: string
  children: ReactNode
  id?: string
  className?: string
}) {
  return (
    <section id={id} className={`${VALUE_SURFACE} p-5 sm:p-6 ${className}`}>
      {title && <h2 className="text-lg font-semibold tracking-tight text-text-primary">{title}</h2>}
      <div className={`${title ? 'mt-3' : ''} space-y-3 text-[15px] leading-relaxed text-text-secondary`}>{children}</div>
    </section>
  )
}

/** Label / value row for item heroes and fact lists. */
export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 [&+&]:border-t [&+&]:border-white/[0.07]">
      <dt className="text-[13px] text-text-secondary">{label}</dt>
      <dd className="text-right text-[14px] font-semibold tabular-nums text-text-primary">{value}</dd>
    </div>
  )
}
