/**
 * PriceIndexCard — the lower card of the hero rail.
 *
 * The brief specced a LIVE SALES feed here, with this as the explicit
 * fallback "when it doesn't exist yet". It doesn't: there are zero
 * completed sales, so a sales feed would be empty or invented. This card
 * shows the price index we genuinely run — items tracked and the last
 * crawl refresh, from `sab_price_display`.
 *
 * HONESTY RULE: every number here is read from the database. Never add a
 * sales count, member count, rating or "trusted by" figure. If the query
 * returns nothing the card renders nothing rather than showing zeros.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import type { PriceIndexSummary } from '../lib/price-index'

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

const usd = (n: number) =>
  n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`

export function PriceIndexCard({ summary }: { summary: PriceIndexSummary | null }) {
  // No data → no card. An empty shell with zeros reads as broken.
  if (!summary) return null

  const updated = summary.updatedAt ? relativeTime(summary.updatedAt) : null

  return (
    <div className="notch-slab h-full">
      <div className="notch flex h-full flex-col bg-[rgba(20,22,28,0.72)] px-6 py-6 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">
            Price Index
          </span>
          {updated && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-text-tertiary">
              {/* Live dot: the crawl genuinely refreshes these rows. */}
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--color-accent-text)' }}
              />
              {updated}
            </span>
          )}
        </div>

        <p className="mt-4 text-[34px] font-bold leading-none tabular-nums text-text-primary">
          {summary.trackedItems.toLocaleString()}
        </p>
        <p className="mt-1.5 text-[13px] text-text-secondary">
          Items with live tracked values
        </p>

        <ul className="mt-5 space-y-2.5 border-t border-white/[0.07] pt-4">
          {summary.samples.map((s) => (
            <li key={s.name} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] text-text-secondary">
                {s.name}
              </span>
              <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-text-primary">
                {usd(s.value)}
              </span>
            </li>
          ))}
        </ul>

        <Link
          href="/steal-a-brainrot/values"
          className="group mt-auto inline-flex items-center gap-1.5 pt-5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          See All Values
          <ArrowRight
            aria-hidden
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </div>
  )
}
