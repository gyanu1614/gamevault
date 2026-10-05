import { Fragment, type ComponentType } from 'react'
import { ArrowsClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ArrowsClockwise'
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ClockCounterClockwise'
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins'
import { HammerIcon } from '@phosphor-icons/react/dist/ssr/Hammer'
import { PackageIcon } from '@phosphor-icons/react/dist/ssr/Package'
import { QuestionIcon } from '@phosphor-icons/react/dist/ssr/Question'
import { TargetIcon } from '@phosphor-icons/react/dist/ssr/Target'
import type { IconProps } from '@phosphor-icons/react'
import type { ValueHowToGet } from '@/lib/values/how-to-get'
import { VALUE_SURFACE } from '@/components/values/styles'
import { cn } from '@/lib/utils'
import { HowToGetFastWay, type ItemBuy } from './ValueListItemClient'
import {
  checkedLabel,
  howToGetNote,
  howToGetSources,
  howToGetStatusMeta,
  howToGetWays,
  type FreeWay,
  type WayIcon,
} from './valueHowToGetCopy'

const FREE_ICONS: Partial<Record<WayIcon, ComponentType<IconProps>>> = {
  coins: CoinsIcon,
  box: PackageIcon,
  spin: ArrowsClockwiseIcon,
  target: TargetIcon,
  materials: PackageIcon,
  craft: HammerIcon,
  history: ClockCounterClockwiseIcon,
}

/** "#C9A8FF" → "201,168,255" for rgba() washes; null when not a 6-digit hex. */
function hexRgb(hex: string): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

/**
 * "How To Get <Item> for Free in Murder Mystery 2" on a value-list item page,
 * from the item's verified how_to_get entry (values_items.how_to_get, `pnpm
 * values:mm2:how-to-get`). Renders nothing for an item without one.
 *
 * Owner, 2026-10-05: answer the search ("how to get X for free"), then show
 * TWO ways side by side — the free in-game way in short steps with real
 * numbers and its honest total, and the fast way (DropMarket → buy →
 * delivered in minutes) — with the item's art and its rarity colour so the
 * card isn't flat grey. Every string is crawlable server text; the FAQ and
 * its schema reuse the same sentences (valueHowToGetCopy.ts, unit-tested).
 */
export function ValueItemHowToGet({
  itemName,
  gameName,
  shortName,
  imageUrl,
  accent,
  earnRate,
  howToGet,
  cheapestUsd,
  buy,
}: {
  itemName: string
  gameName: string
  shortName: string
  imageUrl: string | null
  /** The item's rarity colour (hex). */
  accent: string
  earnRate: { unit: string; perRound: number } | null
  howToGet: ValueHowToGet | null
  cheapestUsd: number | null
  buy: ItemBuy
}) {
  if (!howToGet) return null
  const status = howToGetStatusMeta(howToGet.status)
  const ways = howToGetWays({ name: itemName, gameName, shortName, h: howToGet, cheapestUsd, earnRate })
  const note = howToGetNote(howToGet)
  const sources = howToGetSources(howToGet)
  const rgb = hexRgb(accent) ?? '255,255,255'

  return (
    <section aria-labelledby="how-to-get-title" className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
      {/* Atmosphere: the item's rarity colour glowing in from the top corner,
          and its art, large and faint, behind the header. Decorative only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(60% 70% at 100% 0%, rgba(${rgb},0.16) 0%, rgba(${rgb},0.05) 45%, transparent 75%), radial-gradient(40% 50% at 0% 100%, rgba(${rgb},0.06) 0%, transparent 70%)`,
        }}
      />
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- catalogue art, served as-is
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute -right-10 -top-12 -z-10 h-[300px] w-[300px] rotate-[-14deg] object-contain opacity-[0.07] blur-[1px] max-sm:hidden"
        />
      )}

      <div className="p-5 sm:p-8">
        {/* Header: art tile + the search phrase as the heading. */}
        <div className="flex items-start gap-4">
          {imageUrl && (
            <div
              className="relative hidden h-[72px] w-[72px] shrink-0 place-items-center rounded-lg sm:grid"
              style={{ background: `radial-gradient(closest-side, rgba(${rgb},0.28), rgba(${rgb},0.06) 70%, rgba(255,255,255,0.03))` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- catalogue art, served as-is */}
              <img src={imageUrl} alt={itemName} loading="lazy" decoding="async" className="h-[56px] w-[56px] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)]" />
            </div>
          )}
          <div className="min-w-0">
            <span className="inline-flex h-7 items-center gap-2 rounded-md bg-white/[0.06] px-2.5 text-[12px] font-semibold text-text-secondary">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            <h2 id="how-to-get-title" className="mt-2 text-heading font-bold tracking-tight text-text-primary">
              {ways.title}
            </h2>
          </div>
        </div>

        {/* Answer first — the snippet a search engine quotes. */}
        <p className="mt-4 text-body leading-7 text-text-secondary">
          <strong className="font-semibold text-text-primary">{ways.lead}</strong> {ways.body}
        </p>

        {/* The two ways, as two plain rows on the same card (no card-in-card):
            the free way, then buy it. */}
        <FreeWayRow way={ways.free} />
        <HowToGetFastWay way={ways.fast} name={itemName} shortName={shortName} buy={buy} />

        {note && <p className="mt-5 text-body-sm leading-6 text-text-tertiary">{note}</p>}
      </div>

      <p className="border-t border-white/[0.07] px-5 py-3.5 text-[12px] leading-5 text-text-tertiary sm:px-8">
        {ways.history && <>{ways.history} </>}
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

/** Steps across one line on desktop (2-up on tablets, stacked on phones). */
export const WAY_STEP_COLS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
}

/** Row 1: the free in-game route (or why it's gone) — steps in a line, then the total. */
function FreeWayRow({ way }: { way: FreeWay }) {
  const muted = way.state !== 'available'
  return (
    <div className="mt-7 border-t border-white/[0.07] pt-6">
      <h3 className={cn('text-[18px] font-semibold', muted ? 'text-text-secondary' : 'text-text-primary')}>{way.heading}</h3>

      {way.steps.length > 0 && (
        <ol className={cn('mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2', WAY_STEP_COLS[way.steps.length])}>
          {way.steps.map((step, i) => {
            const Icon = FREE_ICONS[step.icon] ?? QuestionIcon
            return (
              <li key={`${step.title}-${i}`} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-md',
                    muted ? 'bg-white/[0.04] text-text-tertiary' : 'bg-white/[0.07] text-text-primary',
                  )}
                >
                  <Icon size={18} weight="duotone" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold leading-5 text-text-primary">
                    <span className="sr-only">Step {i + 1}: </span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-5 text-text-secondary">{step.value}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {way.message && <p className="mt-3 text-body-sm leading-6 text-text-secondary">{way.message}</p>}

      {way.total && (
        <p className="mt-5 text-body leading-7 text-text-secondary">
          <span className="font-semibold text-text-primary">
            {way.total.label}: {way.total.value}.
          </span>
          {way.total.detail && <> {way.total.detail}</>}
        </p>
      )}
    </div>
  )
}
