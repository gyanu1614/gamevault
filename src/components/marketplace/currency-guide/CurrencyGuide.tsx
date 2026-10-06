import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { ClockIcon } from '@phosphor-icons/react/dist/ssr/Clock'
import { IdentificationCardIcon } from '@phosphor-icons/react/dist/ssr/IdentificationCard'
import { KeyIcon } from '@phosphor-icons/react/dist/ssr/Key'
import { LightbulbIcon } from '@phosphor-icons/react/dist/ssr/Lightbulb'
import { LockKeyIcon } from '@phosphor-icons/react/dist/ssr/LockKey'
import { PiggyBankIcon } from '@phosphor-icons/react/dist/ssr/PiggyBank'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { StarIcon } from '@phosphor-icons/react/dist/ssr/Star'
import { WarningIcon } from '@phosphor-icons/react/dist/ssr/Warning'
import Link from '@/components/navigation/AppLink'
import { ValueCallout } from '@/components/values/ValueCallout'
import { WaySectionHead } from '@/app/(marketplace)/[gameSlug]/values/_generic/WaySectionHead'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import {
  bestSaving,
  buildPriceRows,
  cheapestUnitPrice,
  formatCheckedAt,
  type CurrencyGuide as Guide,
  type OurPrices,
  type PriceRow,
} from '@/lib/currency-guides'
import type { GuideLinks } from '@/lib/currency-guides/links'
import { GuideFrame, type GuideNavItem } from './GuideFrame'
import { GuideReveal } from './GuideReveal'

/**
 * "<Currency> Guide: Prices, Delivery and Safety", the closing section of a
 * currency page (after the FAQ). Owner-approved design, 2026-10-05.
 *
 * ONE surface, sub-sections as plain rows on hairlines (no card-in-card),
 * numbered toned heads, at most one slim callout per section. Server-rendered:
 * every word is in the HTML; the client bits (jump rail, fold, reveal) only
 * move it. Data: the researched fact sheet (lib/currency-guides) + this page's
 * live offers + the cached directory and review reads.
 */

export interface CurrencyGuideProps {
  guide: Guide
  gameName: string
  /** This page's live offers, for the "DropMarket" column. */
  ours: OurPrices
  /** Real rating for the game: only passed with ≥10 reviews. */
  reviews: { count: number; average: number } | null
  links: GuideLinks
  /** Admin-uploaded currency icon (category_configs.currency_icon_url). */
  iconUrl?: string | null
  /** Publisher whose rules forbid buying the currency (GTA$, Roubles). */
  rmtPublisher?: string | null
}

const TEAL = '#5EEAD4'
const TEAL_RGB = '45,212,191'
/** Anchors clear the navbar (and the phone sub-nav). */
const SCROLL_MT = 'scroll-mt-[calc(var(--navbar-bottom)+76px)] md:scroll-mt-[calc(var(--navbar-bottom)+24px)]'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usdFine = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })
const num = new Intl.NumberFormat('en-US')

/** "1,000 Robux"; GTA$ reads as a prefix: "GTA$250,000". */
export function formatAmount(currency: string, n: number): string {
  return currency.endsWith('$') ? `${currency}${num.format(n)}` : `${num.format(n)} ${currency}`
}

/** "Price the pass. To receive…" → the first sentence and the rest. */
export function splitLead(text: string): [string, string] {
  const m = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(text.trim())
  return m ? [m[1], m[2]] : [text.trim(), '']
}

function perLabel(per: number, currency: string): string {
  if (per === 1_000_000) return `per 1M ${currency}`
  if (per === 1_000) return `per 1K ${currency}`
  return `per ${num.format(per)} ${currency}`
}

function trademarkLine(owner: string, gameName: string, currency: string): string {
  // Sentence-form owners ("Blade Ball is a Roblox experience; Roblox is a
  // trademark of Roblox Corporation") already name the marks.
  // "Epic Games, Inc." already ends a sentence: no second full stop.
  const stop = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)
  if (/\btrademark\b/i.test(owner)) {
    return `${stop(owner)} DropMarket is an independent marketplace and isn't affiliated with or endorsed by them.`
  }
  return `${gameName} and ${currency} are trademarks of ${stop(owner)} DropMarket is an independent marketplace and isn't affiliated with or endorsed by ${stop(owner)}`
}

export function CurrencyGuide(props: CurrencyGuideProps) {
  const { guide, gameName, ours, iconUrl } = props
  const c = guide.currency
  const support = guide.support_topic ?? null

  const nav: GuideNavItem[] = [
    { id: 'guide-what', label: `What ${/s$/i.test(c) ? 'Are' : 'Is'} ${c}`, folded: false },
    { id: 'guide-prices', label: 'Official vs DropMarket', folded: false },
    { id: 'guide-delivery', label: 'How Delivery Works', folded: true },
    { id: 'guide-safety', label: 'Is It Safe', folded: true },
    ...(support ? [{ id: 'guide-help', label: support.heading, folded: true }] : []),
    { id: 'guide-more', label: `More ${gameName}`, folded: true },
  ]
  const n = (id: string) => nav.findIndex((x) => x.id === id) + 1

  const open = (
    <>
      <GuideReveal index={0}>
        <WhatIsSection guide={guide} n={n('guide-what')} />
      </GuideReveal>
      <GuideReveal index={1}>
        <PricesSection guide={guide} ours={ours} n={n('guide-prices')} />
      </GuideReveal>
    </>
  )
  const folded = (
    <>
      <GuideReveal index={0}>
        <DeliverySection guide={guide} n={n('guide-delivery')} />
      </GuideReveal>
      <GuideReveal index={1}>
        <SafetySection {...props} n={n('guide-safety')} />
      </GuideReveal>
      {support && (
        <GuideReveal index={2}>
          <GuideRow id="guide-help" n={n('guide-help')} title={support.heading} tone="neutral">
            <Paragraphs items={support.paragraphs} />
          </GuideRow>
        </GuideReveal>
      )}
      <GuideReveal index={3}>
        <MoreSection gameName={gameName} links={props.links} n={n('guide-more')} />
      </GuideReveal>
    </>
  )

  return (
    <section
      id="currency-guide"
      aria-labelledby="currency-guide-title"
      className={cn('relative isolate mx-auto mt-12 max-w-5xl overflow-hidden rounded-lg sm:mt-16', MARKET_CARD)}
    >
      {/* A soft teal light from the top corner, and the currency's own icon,
          large and faint. Decorative only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(55% 60% at 100% 0%, rgba(${TEAL_RGB},0.07) 0%, rgba(${TEAL_RGB},0.02) 45%, transparent 75%)`,
        }}
      />
      {iconUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded icon, served as-is
        <img
          src={iconUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute -right-8 -top-10 -z-10 h-[220px] w-[220px] rotate-[-12deg] object-contain opacity-[0.05] max-sm:hidden"
        />
      )}

      <div className="p-5 sm:p-8">
        <header className="flex items-center gap-4">
          {iconUrl && (
            <span
              className="hidden h-14 w-14 shrink-0 place-items-center rounded-lg sm:grid"
              style={{ background: `radial-gradient(closest-side, rgba(${TEAL_RGB},0.20), rgba(${TEAL_RGB},0.04) 70%, rgba(255,255,255,0.03))` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded icon, served as-is */}
              <img src={iconUrl} alt="" loading="lazy" decoding="async" className="h-9 w-9 object-contain" />
            </span>
          )}
          <div className="min-w-0">
            <h2
              id="currency-guide-title"
              className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-text-primary sm:text-[26px]"
            >
              {c} Guide: Prices, Delivery and Safety
            </h2>
            <p className="mt-1.5 text-[14px] text-text-secondary">
              What {c} {/s$/i.test(c) ? 'are' : 'is'}, what {/s$/i.test(c) ? 'they cost' : 'it costs'}, how delivery works and how your order is covered.
            </p>
          </div>
        </header>

        <div className="mt-7 border-t border-white/[0.07] pt-7">
          <GuideFrame
            nav={nav}
            open={open}
            folded={folded}
            foldLabel={`Read the Full ${c} Guide`}
            foldHint={`Delivery, safety${support ? ', common questions' : ''} and more`}
          />
        </div>

        <p className="mt-8 border-t border-white/[0.07] pt-5 text-[12px] leading-5 text-text-tertiary">
          {trademarkLine(guide.trademark_owner, gameName, c)}
        </p>
      </div>
    </section>
  )
}

/* ── Building blocks ─────────────────────────────────────────────── */

function GuideRow({
  id,
  n,
  title,
  tone,
  aside,
  first = false,
  children,
}: {
  id: string
  n: number
  title: string
  tone: 'neutral' | 'green' | 'teal'
  /** Beside the heading (the "No Password Needed" chip). */
  aside?: ReactNode
  first?: boolean
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(SCROLL_MT, !first && 'mt-7 border-t border-white/[0.07] pt-7')}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <WaySectionHead n={n} title={title} tone={tone} id={`${id}-title`} />
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** Paragraphs, the first sentence of the first one in bold: answer first. */
function Paragraphs({ items }: { items: string[] }) {
  return (
    <div className="space-y-3 text-[15px] leading-7 text-text-secondary">
      {items.map((p, i) => {
        if (i > 0) return <p key={i}>{p}</p>
        const [lead, rest] = splitLead(p)
        return (
          <p key={i}>
            <strong className="font-semibold text-text-primary">{lead}</strong>
            {rest ? ` ${rest}` : null}
          </p>
        )
      })}
    </div>
  )
}

function IconTile({ icon: Icon, tint }: { icon: ComponentType<IconProps>; tint?: string }) {
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-md"
      style={{ background: tint ? `rgba(${tint},0.12)` : 'rgba(255,255,255,0.07)', color: tint ? `rgb(${tint})` : undefined }}
    >
      <Icon size={18} weight="duotone" />
    </span>
  )
}

/* ── 1. What Is ──────────────────────────────────────────────────── */

function WhatIsSection({ guide, n }: { guide: Guide; n: number }) {
  return (
    <GuideRow id="guide-what" n={n} title={guide.what_is.heading} tone="neutral" first>
      <Paragraphs items={guide.what_is.paragraphs} />
    </GuideRow>
  )
}

/* ── 2. Prices ───────────────────────────────────────────────────── */

function PricesSection({ guide, ours, n }: { guide: Guide; ours: OurPrices; n: number }) {
  const c = guide.currency
  const op = guide.official_prices
  const rows = buildPriceRows(guide, ours)
  const best = bestSaving(rows)
  const cheapest = rows.length === 0 ? cheapestUnitPrice(ours) : null
  const checked = formatCheckedAt(guide.checked_at)
  const where = op?.packages[0]?.where
  const oursWhat = ours.kind === 'bundle' ? 'the cheapest live Global or US offer for that pack' : 'the cheapest live offer for that exact amount'

  return (
    <GuideRow id="guide-prices" n={n} title={op?.heading ?? `${c} Prices on DropMarket`} tone="teal">
      {rows.length > 0 ? (
        <>
          <p className="text-[14px] leading-6 text-text-secondary">
            Official prices from {where}, checked {checked}. The DropMarket price is {oursWhat}, before the service fee.
          </p>
          <PriceTable rows={rows} currency={c} />
        </>
      ) : op ? null : (
        <p className="text-[15px] leading-7 text-text-secondary">
          There&apos;s no official cash price list for {c}, so there&apos;s nothing to compare against.{' '}
          {cheapest ? "Here's what DropMarket sellers charge right now." : 'No seller has stock on DropMarket right now.'}
        </p>
      )}

      {op?.note && <p className="mt-4 text-[14px] leading-6 text-text-secondary">{op.note}</p>}

      {op?.extras && op.extras.length > 0 && (
        <dl className="mt-4 divide-y divide-white/[0.06] rounded-md bg-white/[0.03] px-4">
          {op.extras.map((x) => (
            <div key={x.label} className="grid gap-x-6 gap-y-0.5 py-2.5 text-[14px] leading-6 sm:grid-cols-[190px_minmax(0,1fr)]">
              <dt className="font-medium text-text-primary">{x.label}</dt>
              <dd className="text-text-secondary">{x.detail}</dd>
            </div>
          ))}
        </dl>
      )}

      {best && best.officialUsd != null && best.oursUsd != null && (
        <ValueCallout tone="blue" icon={PiggyBankIcon} title={`Biggest Saving: ${best.savePct}% on ${formatAmount(c, best.amount)}`} className="mt-5">
          {usd.format(best.oursUsd)} on DropMarket against {usd.format(best.officialUsd)} at the official store.
        </ValueCallout>
      )}
      {cheapest && (
        <ValueCallout tone="blue" icon={PiggyBankIcon} title={`Cheapest Right Now: ${usdFine.format(cheapest.usd)} ${perLabel(cheapest.per, c)}`} className="mt-5">
          From a live offer on this page. Prices move as sellers update them.
        </ValueCallout>
      )}
    </GuideRow>
  )
}

/**
 * One table, two layouts: columns from md up (the DropMarket column is a
 * quiet teal band running to the edge, the saving pill inside it); on phones
 * each row becomes a small stacked block (amount, then Official | DropMarket)
 * with the column names drawn from data-label. No horizontal scroll.
 */
function PriceTable({ rows, currency }: { rows: PriceRow[]; currency: string }) {
  const cellLabel = 'max-md:before:mb-0.5 max-md:before:block max-md:before:text-[11.5px] max-md:before:font-medium max-md:before:text-text-tertiary max-md:before:content-[attr(data-label)]'
  const band = { background: `rgba(${TEAL_RGB},0.06)` }
  const line = 'md:border-t md:border-white/[0.06]'
  return (
    <table className="mt-4 w-full border-separate border-spacing-0 text-[14px] tabular-nums">
      <caption className="sr-only">
        Official {currency} prices against the cheapest DropMarket price for the same amount
      </caption>
      <thead className="max-md:hidden">
        <tr className="text-left text-[12.5px] text-text-tertiary">
          <th scope="col" className="w-[34%] pb-2 pr-4 font-medium">Amount</th>
          <th scope="col" className="w-[24%] pb-2 pr-4 font-medium">Official Price</th>
          <th scope="col" className="rounded-t-md px-4 pb-2 pt-2 font-medium" style={{ ...band, color: TEAL }}>
            DropMarket
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const last = i === rows.length - 1
          return (
            <tr
              key={`${r.amount}-${i}`}
              className="max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-2 max-md:border-t max-md:border-white/[0.06] max-md:py-3"
            >
              <td className={cn('py-2.5 pr-4 align-middle max-md:col-span-2 max-md:py-0', line)}>
                <span className="font-medium text-text-primary">{formatAmount(currency, r.amount)}</span>
                {(r.label || r.appAmount) && (
                  <span className="mt-0.5 block text-[12px] text-text-tertiary md:mt-0.5">
                    {r.label ?? `${num.format(r.appAmount!)} in the app`}
                  </span>
                )}
              </td>
              <td
                data-label="Official Price"
                className={cn('py-2.5 pr-4 align-middle text-text-secondary max-md:py-1.5', line, cellLabel)}
              >
                {r.officialUsd != null ? usd.format(r.officialUsd) : `${num.format(r.officialRobux ?? 0)} Robux`}
              </td>
              <td
                data-label="DropMarket"
                className={cn('px-4 py-2.5 align-middle max-md:rounded-md max-md:px-2.5 max-md:py-1.5', line, last && 'md:rounded-b-md', cellLabel)}
                style={band}
              >
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  {r.oursUsd != null ? (
                    <span className="font-semibold" style={{ color: TEAL }}>
                      {usd.format(r.oursUsd)}
                    </span>
                  ) : (
                    <span className="text-text-tertiary">
                      <span aria-hidden>—</span>
                      <span className="sr-only">No live offer for this amount</span>
                    </span>
                  )}
                  {r.savePct != null && (
                    <span
                      className="inline-flex items-center rounded-md px-1.5 py-px text-[11.5px] font-semibold"
                      style={{ background: `rgba(${TEAL_RGB},0.12)`, color: TEAL }}
                    >
                      Save {r.savePct}%
                    </span>
                  )}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ── 3. Delivery ─────────────────────────────────────────────────── */

const SELLER_STEPS_FALLBACK = 'Your seller sends delivery steps in the order chat.'

function DeliverySection({ guide, n }: { guide: Guide; n: number }) {
  const d = guide.delivery
  const unclear = d.method === 'unclear_see_notes'
  return (
    <GuideRow
      id="guide-delivery"
      n={n}
      title={d.heading}
      tone="neutral"
      aside={
        d.no_password === true ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgba(63,217,134,0.10)] px-2.5 py-1 text-[12.5px] font-semibold text-[#3FD986]">
            <LockKeyIcon aria-hidden size={14} weight="duotone" />
            No Password Needed
          </span>
        ) : null
      }
    >
      {d.steps.length > 0 ? (
        <ol className="relative space-y-4">
          {/* The thread between the numbers. */}
          <span aria-hidden className="absolute bottom-3 left-[13.5px] top-3 w-px bg-white/[0.08]" />
          {d.steps.map((step, i) => {
            const [lead, rest] = splitLead(step)
            return (
              <li key={i} className="relative flex items-start gap-3.5">
                <span
                  aria-hidden
                  className="relative grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#2A2B31] text-[13px] font-semibold tabular-nums text-text-primary"
                >
                  {i + 1}
                </span>
                <p className="min-w-0 pt-0.5 text-[15px] leading-6 text-text-secondary">
                  <span className="sr-only">Step {i + 1}: </span>
                  <span className="font-medium text-text-primary">{lead}</span>
                  {rest ? ` ${rest}` : null}
                </p>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="text-[15px] leading-7 text-text-secondary">{SELLER_STEPS_FALLBACK}</p>
      )}

      {unclear && d.steps.length > 0 ? (
        <ValueCallout tone="yellow" icon={LightbulbIcon} title="Good To Know" className="mt-5">
          {[SELLER_STEPS_FALLBACK, d.typical_time].filter(Boolean).join(' ')}
        </ValueCallout>
      ) : d.typical_time ? (
        <ValueCallout tone="blue" icon={ClockIcon} title="Delivery Time" className="mt-5">
          {d.typical_time}
        </ValueCallout>
      ) : null}
    </GuideRow>
  )
}

/* ── 4. Is It Safe ───────────────────────────────────────────────── */

function SafetySection({ guide, reviews, rmtPublisher, gameName, n }: CurrencyGuideProps & { n: number }) {
  const c = guide.currency
  const noPassword = guide.delivery.no_password
  const facts: { icon: ComponentType<IconProps>; tint?: string; title: string; body: string }[] = [
    { icon: ShieldCheckIcon, tint: '63,217,134', title: 'SafeDrop Protection', body: 'Item Guaranteed or Full Refund.' },
    { icon: IdentificationCardIcon, title: 'ID-Verified Sellers', body: 'Every seller passes an ID check before they can list.' },
    noPassword
      ? { icon: LockKeyIcon, title: 'Your Password Stays Yours', body: 'Delivery never needs your login.' }
      : { icon: KeyIcon, title: 'Access Explained Up Front', body: "Your seller says what's needed before you pay." },
  ]
  if (reviews) {
    facts.push({
      icon: StarIcon,
      tint: '250,204,21',
      title: `Rated ${reviews.average.toFixed(1)} out of 5`,
      body: `From ${num.format(reviews.count)} buyer reviews on ${gameName} orders.`,
    })
  }

  return (
    <GuideRow id="guide-safety" n={n} title={`Is It Safe to Buy ${c} on DropMarket?`} tone="green">
      <p className="text-[15px] leading-7 text-text-secondary">
        {rmtPublisher ? (
          <>
            {/* OWNER: wording for games whose publisher bans buying the currency (README safety flags). */}
            <strong className="font-semibold text-text-primary">
              DropMarket covers your order, but {rmtPublisher}&apos;s rules don&apos;t allow buying {c} outside the game.
            </strong>{' '}
            {rmtPublisher} can remove {c} or suspend accounts it links to a sale. SafeDrop Protection covers the delivery, not what {rmtPublisher} does afterwards.
          </>
        ) : (
          <>
            <strong className="font-semibold text-text-primary">Yes. Every order is covered by SafeDrop Protection.</strong>{' '}
            If your {c} doesn&apos;t arrive as described, you get a full refund.
          </>
        )}
      </p>

      <ul className={cn('mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2', facts.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        {facts.map((f) => (
          <li key={f.title} className="flex items-start gap-3">
            <IconTile icon={f.icon} tint={f.tint} />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-5 text-text-primary">{f.title}</p>
              <p className="mt-0.5 text-[13px] leading-5 text-text-secondary">{f.body}</p>
            </div>
          </li>
        ))}
      </ul>

      {rmtPublisher ? (
        <ValueCallout tone="yellow" icon={WarningIcon} title="Before You Buy" className="mt-5">
          Only buy what you&apos;re comfortable risking on your account.
        </ValueCallout>
      ) : noPassword === false ? (
        <ValueCallout tone="yellow" icon={LightbulbIcon} title="Good To Know" className="mt-5">
          If you share a login for delivery, change your password once the order is complete.
        </ValueCallout>
      ) : null}
    </GuideRow>
  )
}

/* ── 6. More on DropMarket ───────────────────────────────────────── */

const CHIP =
  'group inline-flex h-9 items-center gap-2 rounded-md bg-white/[0.05] px-3 text-[13px] font-medium text-text-secondary ' +
  'transition-colors duration-200 hover:bg-white/[0.09] hover:text-text-primary ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

function MoreSection({ gameName, links, n }: { gameName: string; links: GuideLinks; n: number }) {
  return (
    <GuideRow id="guide-more" n={n} title={`More ${gameName} on DropMarket`} tone="neutral">
      <ul className="flex flex-wrap gap-2">
        {links.game.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={CHIP}>
              {l.label}
              <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-tertiary transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
      {links.related.length > 0 && (
        <>
          <p className="mt-5 text-[13px] font-medium text-text-tertiary">Other Game Currencies</p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {links.related.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={CHIP}>
                  {l.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- game icon, served as-is
                    <img src={l.imageUrl} alt="" loading="lazy" decoding="async" className="h-5 w-5 rounded-[4px] object-cover" />
                  )}
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </GuideRow>
  )
}
