import { Fragment } from 'react'
import type { ValueHowToGet } from '@/lib/values/how-to-get'
import { VALUE_LABEL, VALUE_SURFACE, VALUE_TILE } from '@/components/values/styles'
import { ValueListBuyActions, type ItemBuy } from './ValueListItemClient'
import {
  checkedLabel,
  howToGetNote,
  howToGetPath,
  howToGetRows,
  howToGetSources,
  howToGetStatusMeta,
  type HowToGetPath,
} from './valueHowToGetCopy'
import { formatUsd } from './valueListItemCopy'

/**
 * "How To Get <Item>" on a value-list item page, from the item's verified
 * how_to_get entry (values_items.how_to_get, `pnpm values:mm2:how-to-get`).
 * Renders nothing for an item without one.
 *
 * Left: the facts (Method / Cost / Odds / Released, a muted note, the sources
 * with their licence and the check date). Right: the real choice — grind vs
 * real money: "Unbox It" (expected spins × the stated per-spin price, on
 * average) or "Craft It" (the recipe) against "Buy It" (the cheapest
 * reputable price + the page's buy button). An item that can't be obtained
 * (or can't be confirmed) gets one honest line and the buy/sell pair instead.
 * Neutral chrome throughout; only the status dot carries colour. All copy
 * lives in valueHowToGetCopy.ts (pure, unit-tested).
 */
export function ValueItemHowToGet({
  itemName,
  howToGet,
  cheapestUsd,
  buy,
  sellHref,
}: {
  itemName: string
  howToGet: ValueHowToGet | null
  cheapestUsd: number | null
  buy: ItemBuy
  sellHref: string
}) {
  if (!howToGet) return null
  const status = howToGetStatusMeta(howToGet.status)
  const rows = howToGetRows(howToGet)
  const note = howToGetNote(howToGet)
  const sources = howToGetSources(howToGet)
  const path = howToGetPath(howToGet)

  return (
    <section aria-labelledby="how-to-get-title">
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="how-to-get-title" className="text-heading font-bold tracking-tight text-text-primary">
          How To Get {itemName}
        </h2>
        <span className="inline-flex h-7 items-center gap-2 rounded-md bg-white/[0.06] px-2.5 text-[12px] font-semibold text-text-secondary">
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className={`${VALUE_SURFACE} flex flex-col px-5 py-2 sm:px-6`}>
          <dl>
            {rows.map((r) => (
              <div
                key={r.label}
                className="grid gap-y-0.5 py-3.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-x-4 [&+&]:border-t [&+&]:border-white/[0.07]"
              >
                <dt className="text-[13px] leading-5 text-text-secondary sm:leading-6">{r.label}</dt>
                <dd className="text-[14px] font-medium leading-6 text-text-primary">{r.value}</dd>
              </div>
            ))}
          </dl>
          {note && <p className="pb-2 pt-1 text-body-sm leading-6 text-text-tertiary">{note}</p>}
          <p className="mt-auto border-t border-white/[0.07] pb-3 pt-3.5 text-[12px] leading-5 text-text-tertiary">
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
        </div>

        <PathPanel
          itemName={itemName}
          path={path}
          cheapestUsd={cheapestUsd}
          buy={buy}
          sellHref={sellHref}
        />
      </div>
    </section>
  )
}

function PanelHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[15px] font-semibold text-text-primary">{title}</h3>
      {aside && <p className={VALUE_LABEL}>{aside}</p>}
    </div>
  )
}

const BIG = 'mt-2.5 text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums text-text-primary'

function PriceBlock({ cheapestUsd }: { cheapestUsd: number | null }) {
  return cheapestUsd != null ? (
    <>
      <p className={BIG}>{formatUsd(cheapestUsd)}</p>
      <p className="mt-2 text-body-sm text-text-secondary">The lowest price a reputable seller is asking right now.</p>
    </>
  ) : (
    <p className="mt-2 text-body-sm text-text-secondary">No reputable price yet.</p>
  )
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function PathPanel({
  itemName,
  path,
  cheapestUsd,
  buy,
  sellHref,
}: {
  itemName: string
  path: HowToGetPath
  cheapestUsd: number | null
  buy: ItemBuy
  sellHref: string
}) {
  if (path.kind === 'trade') {
    const [lead, ...rest] = path.lines
    return (
      <div className={`${VALUE_SURFACE} flex flex-col p-5 sm:p-6`}>
        <PanelHead title="Trade Or Buy" />
        <p className="mt-2.5 text-[15px] leading-6 text-text-primary">{lead}</p>
        {rest.map((l) => (
          <p key={l} className="mt-1 text-body-sm leading-6 text-text-secondary">
            {l}
          </p>
        ))}
        {cheapestUsd != null && (
          <div className="mt-5">
            <p className={VALUE_LABEL}>Cheapest Price</p>
            <p className="mt-1.5 text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums text-text-primary">
              {formatUsd(cheapestUsd)}
            </p>
          </div>
        )}
        <ValueListBuyActions
          className="mt-auto pt-5"
          name={itemName}
          buy={buy}
          sell={{ href: sellHref, label: 'Sell Yours For Cash' }}
        />
      </div>
    )
  }

  const buyHalf = (
    <div className="flex flex-col p-5 sm:p-6">
      <PanelHead title="Buy It" aside={cheapestUsd != null ? 'Cheapest Price' : undefined} />
      <PriceBlock cheapestUsd={cheapestUsd} />
      <ValueListBuyActions className="mt-4" name={itemName} buy={buy} />
    </div>
  )

  if (path.kind === 'buy') return <div className={VALUE_SURFACE}>{buyHalf}</div>

  return (
    <div className={`${VALUE_SURFACE} flex flex-col`}>
      {path.kind === 'unbox' ? (
        <div className="p-5 sm:p-6">
          <PanelHead title="Unbox It" aside="On Average" />
          <p className={BIG}>{path.copy.headline}</p>
          <p className="mt-2 text-body-sm text-text-secondary">{path.copy.detail}</p>
          {path.copy.alternatives && <p className="mt-0.5 text-[12px] text-text-tertiary">{path.copy.alternatives}</p>}
        </div>
      ) : (
        <div className="p-5 sm:p-6">
          <PanelHead title="Craft It" aside="Recipe" />
          <ul className="mt-3 flex flex-wrap gap-2">
            {path.recipe.map((part) => (
              <li key={part.label} className={`${VALUE_TILE} px-3 py-2`}>
                <span className="block text-[15px] font-semibold tabular-nums text-text-primary">{part.label}</span>
                {part.hint && <span className="mt-0.5 block text-[12px] text-text-tertiary">{capitalise(part.hint)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="border-t border-white/[0.07]">{buyHalf}</div>
    </div>
  )
}
