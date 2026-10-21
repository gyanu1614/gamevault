import type { ReactNode } from 'react'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'

export interface InfoColumn {
  key: string
  label: string
  align?: 'left' | 'right'
  /** Hide below this breakpoint (secondary columns on phones). */
  hideBelow?: 'sm' | 'md'
}

const HIDE = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell' } as const

/**
 * A real <table> on one surface: quiet header, every other row on a faint
 * band (owner: banded rows, no hairline under every row). Scrolls sideways
 * inside its card on narrow phones instead of breaking the page width.
 */
export function InfoTable({
  caption,
  columns,
  rows,
  className,
}: {
  /** Screen-reader caption (the section heading already titles it visually). */
  caption: string
  columns: InfoColumn[]
  rows: { key: string; cells: ReactNode[] }[]
  className?: string
}) {
  return (
    <div className={cn('overflow-x-auto rounded-lg', MARKET_CARD, className)}>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-white/[0.07]">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-4 py-3 text-caption font-medium text-text-tertiary sm:px-5',
                  c.align === 'right' && 'text-right',
                  c.hideBelow && HIDE[c.hideBelow],
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="even:bg-white/[0.025]">
              {r.cells.map((cell, i) => {
                const c = columns[i]
                return (
                  <td
                    key={c?.key ?? i}
                    className={cn(
                      'px-4 py-3 align-middle text-body-sm text-text-primary sm:px-5',
                      c?.align === 'right' && 'text-right',
                      c?.hideBelow && HIDE[c.hideBelow],
                    )}
                  >
                    {cell}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
