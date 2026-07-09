'use client'

/**
 * V31 — Section heading system for the listing detail page.
 *
 * One consistent recipe (direction A + D from the heading exploration):
 *   ── KICKER ──   small lime uppercase label that NAMES the section
 *   Display line   30→40px extrabold, tracking-tight, with ONE word
 *                  in lime (the split-tone accent)
 *   Subline        muted 13.5px supporting copy
 *
 * Two scales:
 *   size="lg"  — centered display treatment for full-width bands
 *                (Other Sellers, How it works, FAQ).
 *   size="md"  — left-aligned, smaller variant for in-column sections
 *                (Similar listings) so they don't fight the buy panel.
 */

import { cn } from '@/lib/utils'

export function SectionHeading({
  kicker,
  title,
  accent,
  sub,
  size = 'lg',
  className,
}: {
  /** Optional uppercase label above the headline (— KICKER — when centered). */
  kicker?: string
  /** Headline text before the accented word. */
  title: string
  /** The lime-highlighted final word(s) of the headline. */
  accent?: string
  sub?: string
  size?: 'lg' | 'md'
  className?: string
}) {
  const centered = size === 'lg'
  return (
    <div className={cn(centered && 'text-center', className)}>
      {kicker && (
        <div
          className={cn(
            'font-bold uppercase tracking-[0.18em] text-lime-text',
            // V36 — Centered kicker runs at ~half the display size and
            // hugs the headline (was a tiny 11.5px floating far above).
            centered ? 'text-[15px] sm:text-[20px]' : 'text-[11px]',
          )}
        >
          {centered ? `— ${kicker} —` : kicker}
        </div>
      )}
      <h2
        className={cn(
          'font-extrabold leading-[1.05] tracking-tight text-text-primary',
          kicker && (centered ? 'mt-0.5' : 'mt-2'),
          centered ? 'text-[30px] sm:text-[40px]' : 'text-[22px] sm:text-[24px]',
        )}
      >
        {title}
        {accent && (
          <>
            {' '}
            <span className="text-lime-text">{accent}</span>
          </>
        )}
      </h2>
      {sub && (
        <p
          className={cn(
            // V41 — Centered sub scaled up to sit on the same type scale
            // as the enlarged section bodies below it (FAQ cards run
            // 16px answers / 20px questions).
            centered
              ? 'mx-auto mt-2 max-w-xl text-[15px] text-text-tertiary sm:text-[16.5px]'
              : 'mt-1.5 text-[13.5px] text-text-tertiary sm:text-[14px]',
          )}
        >
          {sub}
        </p>
      )}
    </div>
  )
}
