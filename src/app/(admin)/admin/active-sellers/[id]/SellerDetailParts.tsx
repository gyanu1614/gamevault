/**
 * Small presentational pieces shared by the seller detail sections: the
 * status badge and the titled section card.
 */

import React from 'react'
import { StatusBadge } from '../../components/kit'
import { statusTone, titleCase } from './seller-detail-format'

export function Badge({ status }: { status: string }) {
  return <StatusBadge status={titleCase(status)} tone={statusTone(status)} />
}

/**
 * Section = heading ABOVE a data-only card (owner: "title floating outside,
 * card has data only" — no icon boxes).
 */
export function Section({
  title,
  sub,
  aside,
  children,
  className,
}: {
  title: string
  sub?: string
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      <div className="mb-2.5 flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">{title}</h2>
          {sub && <p className="mt-0.5 text-[12.5px] text-text-tertiary">{sub}</p>}
        </div>
        {aside && <div className="shrink-0 whitespace-nowrap">{aside}</div>}
      </div>
      <div className="rounded-lg bg-bg-raised p-4 sm:p-5">{children}</div>
    </section>
  )
}
