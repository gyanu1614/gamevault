import { Fragment } from 'react'
import type { ValueHowToGet } from '@/lib/values/how-to-get'
import { VALUE_LABEL, VALUE_SURFACE, VALUE_TILE } from '@/components/values/styles'
import { cn } from '@/lib/utils'
import { ValueListBuyActions, type ItemBuy } from './ValueListItemClient'
import { checkedLabel, howToGetGuide, howToGetNote, howToGetSources, howToGetStatusMeta } from './valueHowToGetCopy'
import { formatUsd } from './valueListItemCopy'

/** Steps lay out 1-up on phones, 2-up on tablets, all in one row on desktop (≤ 4). */
const STEP_COLS: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }

/**
 * "How To Get <Item> in MM2" on a value-list item page, from the item's
 * verified how_to_get entry (values_items.how_to_get, `pnpm
 * values:mm2:how-to-get`). Renders nothing for an item without one.
 *
 * ONE card that reads like a short guide (owner, 2026-10-05: "easy
 * instructions like a small blog section", not a database): the direct answer
 * — can you get it, and for free — then numbered steps, then one closing bar
 * with the cheapest price and the buy button, then history + sources. Neutral
 * chrome; only the status dot carries colour. All copy is in
 * valueHowToGetCopy.ts (pure, unit-tested) and the FAQ schema reuses it.
 */
export function ValueItemHowToGet({
  itemName,
  shortName,
  howToGet,
  cheapestUsd,
  buy,
  sellHref,
}: {
  itemName: string
  shortName: string
  howToGet: ValueHowToGet | null
  cheapestUsd: number | null
  buy: ItemBuy
  sellHref: string
}) {
  if (!howToGet) return null
  const status = howToGetStatusMeta(howToGet.status)
  const guide = howToGetGuide({ name: itemName, shortName, h: howToGet, cheapestUsd })
  const note = howToGetNote(howToGet)
  const sources = howToGetSources(howToGet)
  const tradeOnly = howToGet.status !== 'obtainable'

  return (
    <section aria-labelledby="how-to-get-title" className={cn(VALUE_SURFACE, 'overflow-hidden')}>
      <div className="p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="how-to-get-title" className="text-heading font-bold tracking-tight text-text-primary">
            How To Get {itemName} in {shortName}
          </h2>
          <span className="inline-flex h-7 items-center gap-2 rounded-md bg-white/[0.06] px-2.5 text-[12px] font-semibold text-text-secondary">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        {/* Answer first — plain server text, the snippet a search engine quotes. */}
        <p className="mt-4 max-w-[75ch] text-body leading-7 text-text-secondary">
          <strong className="font-semibold text-text-primary">{guide.lead}</strong> {guide.body}
        </p>

        {guide.steps.length > 0 && (
          <ol className={cn('mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2', STEP_COLS[guide.steps.length])}>
            {guide.steps.map((step, i) => (
              <li key={step.title} className={cn(VALUE_TILE, 'flex gap-3.5 p-4')}>
                <span
                  aria-hidden
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/[0.08] text-[13px] font-bold tabular-nums text-text-primary"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold leading-7 text-text-primary">
                    <span className="sr-only">Step {i + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="mt-0.5 text-body-sm leading-6 text-text-secondary">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {note && <p className="mt-4 max-w-[75ch] text-body-sm leading-6 text-text-tertiary">{note}</p>}
      </div>

      {/* The other way: buy it. */}
      <div className="flex flex-col gap-4 border-t border-white/[0.07] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className={VALUE_LABEL}>{guide.buyLabel}</p>
          {cheapestUsd != null ? (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-[24px] font-bold leading-tight tracking-[-0.02em] tabular-nums text-text-primary">
                {formatUsd(cheapestUsd)}
              </span>
              <span className="text-body-sm text-text-secondary">cheapest from a reputable seller</span>
            </p>
          ) : (
            <p className="mt-1 text-body-sm text-text-secondary">No reputable price yet.</p>
          )}
        </div>
        <ValueListBuyActions
          name={itemName}
          buy={buy}
          sell={tradeOnly ? { href: sellHref, label: 'Sell Yours For Cash' } : undefined}
        />
      </div>

      <p className="border-t border-white/[0.07] px-5 py-3.5 text-[12px] leading-5 text-text-tertiary sm:px-8">
        {guide.history && <>{guide.history} </>}
        {sources.length > 0 && (
          <>
            {sources.length > 1 ? 'Sources: ' : 'Source: '}
            {sources.map((g, gi) => (
              <Fragment key={g.label}>
                {gi > 0 && '; '}
                {g.label}
                {' — '}
                {g.links.map((l, li) => (
                  <Fragment key={l.href}>
                    {li > 0 && ', '}
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="rounded-sm underline decoration-white/20 underline-offset-2 transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      {l.title}
                    </a>
                  </Fragment>
                ))}
                {g.license && ` (${g.license})`}
              </Fragment>
            ))}
            {' · '}
          </>
        )}
        {checkedLabel(howToGet)}
      </p>
    </section>
  )
}
