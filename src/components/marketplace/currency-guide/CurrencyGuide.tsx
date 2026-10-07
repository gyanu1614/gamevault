import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins'
import { GiftIcon } from '@phosphor-icons/react/dist/ssr/Gift'
import { IdentificationCardIcon } from '@phosphor-icons/react/dist/ssr/IdentificationCard'
import { KeyIcon } from '@phosphor-icons/react/dist/ssr/Key'
import { LightbulbIcon } from '@phosphor-icons/react/dist/ssr/Lightbulb'
import { LockKeyIcon } from '@phosphor-icons/react/dist/ssr/LockKey'
import { PackageIcon } from '@phosphor-icons/react/dist/ssr/Package'
import { PiggyBankIcon } from '@phosphor-icons/react/dist/ssr/PiggyBank'
import { RocketLaunchIcon } from '@phosphor-icons/react/dist/ssr/RocketLaunch'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { StorefrontIcon } from '@phosphor-icons/react/dist/ssr/Storefront'
import { UserCircleIcon } from '@phosphor-icons/react/dist/ssr/UserCircle'
import { WarningIcon } from '@phosphor-icons/react/dist/ssr/Warning'
import Link from '@/components/navigation/AppLink'
import { ValueCallout } from '@/components/values/ValueCallout'
import { buildPriceRows, guideFamily, type CurrencyGuide as Guide, type OurPrices, type PriceRow } from '@/lib/currency-guides'
import type { CurrencyPageCard } from '@/lib/currency-guides/server'
import { CurrencyCarousel } from './CurrencyCarousel'
import { DeliverySteps, type DeliveryStep } from './DeliverySteps'

/**
 * "<Game> <Currency> Guide", the closing section of a currency page (after
 * the FAQ). Owner rules, 2026-10-06 (memory: currency-guide-design-rules):
 * on the page itself (no card, no table of contents), every section a
 * centred heading + one or two plain lines, then:
 *
 *   What is it      where you spend it, linked to our other currency pages
 *   Savings         5 packs: official price (grey) vs sellers here, tip line
 *   Delivery        steps joined by moving arrows, one-line tip
 *   Safety          three points with floating icons
 *   Support topic   ("Why Is My Robux Pending?")
 *   More <Game>     floating icon links, only categories with offers
 *   Currencies      looping carousel of other games' currency pages
 *
 * Copy comes from the guide's hand-written `page` block; a guide without one
 * falls back to its long fact fields until it is written. Server component:
 * every word is in the HTML; the arrows and carousel are small client islands.
 */

export interface CurrencyGuideProps {
  guide: Guide
  gameName: string
  /** This page's live offers, for the "Sellers Here" column. */
  ours: OurPrices
  /** This game's categories with live offers (More <Game>). */
  categories: Array<{ href: string; name: string; type: string | null }>
  /** Other games' currency pages for the carousel. */
  currencyPages: CurrencyPageCard[]
  /** Publisher whose rules forbid buying the currency (GTA$, Roubles). */
  rmtPublisher?: string | null
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
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

/** "Roblox Robux Guide"; "Blade Ball Tokens Guide" when the currency already names the game. */
export function guideTitle(gameName: string, currency: string): string {
  const name = currency.toLowerCase().includes(gameName.toLowerCase()) ? currency : `${gameName} ${currency}`
  return `${name} Guide: Prices, Delivery and Safety`
}

/** The guide's on-page copy: the hand-written block, or a fallback from the fact fields. */
export function pageCopy(guide: Guide) {
  const c = guide.currency
  if (guide.page) return guide.page
  const packs = guide.official_prices?.packages ?? []
  return {
    subtitle: `What ${c} ${/s$/i.test(c) ? 'are' : 'is'}, how much you can save, how delivery works and how to buy safely.`,
    what_is: { heading: `What ${/s$/i.test(c) ? 'Are' : 'Is'} ${c}?`, text: splitLead(guide.what_is.paragraphs[0])[0] },
    savings: packs.length >= 2
      ? {
          heading: `How Much Do You Save on ${c}?`,
          text: `Sellers here set their own prices, so the same ${c} often costs less than the official store.`,
          amounts: packs.slice(0, 5).map((p) => p.amount),
        }
      : undefined,
    delivery: {
      text: guide.delivery.typical_time ? splitLead(guide.delivery.typical_time)[0] : `Here is how ${c} reaches your account.`,
      steps: guide.delivery.steps.slice(0, 4).map((s, i) => ({ title: `Step ${i + 1}`, body: splitLead(s)[0] })),
    },
    safety_text: 'Every order is covered, and every seller is ID-checked before they can list.',
    support: guide.support_topic ? { heading: guide.support_topic.heading, text: splitLead(guide.support_topic.paragraphs[0])[0] } : undefined,
  }
}

/* ── Building blocks ─────────────────────────────────────────────── */

/**
 * One section. Layout B (owner picked "you decide", 2026-10-06, after
 * measuring Eldorado and GameBoost at 1440 px: 30 px section titles, 16 px /
 * 24 px text running the full page width): full-width sections, every other
 * one on a filled band so it's always clear which content belongs to which
 * heading.
 */
function Block({
  id,
  title,
  lead,
  band = false,
  children,
}: {
  id: string
  title: string
  lead?: ReactNode
  band?: boolean
  children?: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className={
        band
          ? 'mt-10 scroll-mt-24 rounded-2xl bg-[linear-gradient(180deg,#1D1E23_0%,#18191D_100%)] px-5 py-10 sm:mt-12 sm:px-12 sm:py-14'
          : 'mt-10 scroll-mt-24 px-1 py-6 sm:mt-12 sm:py-8'
      }
    >
      <h3 id={id} className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-text-primary [text-wrap:balance] sm:text-[30px]">
        {title}
      </h3>
      {lead && <p className="mx-auto mt-3 max-w-4xl text-[16px] leading-[26px] text-text-secondary [text-wrap:pretty]">{lead}</p>}
      {children}
    </section>
  )
}

/** A slim one-line tip (blue) under a section; wraps only on narrow screens. */
function Tip({ label, children, tone = 'blue', icon }: { label: string; children: ReactNode; tone?: 'blue' | 'yellow'; icon: ComponentType<IconProps> }) {
  return (
    <div className="mx-auto mt-8 w-fit max-w-full text-left">
      <ValueCallout tone={tone} icon={icon} title={label}>
        {children}
      </ValueCallout>
    </div>
  )
}

/* ── Savings table ───────────────────────────────────────────────── */

function SavingsTable({ rows, currency, officialLabel }: { rows: PriceRow[]; currency: string; officialLabel: string }) {
  return (
    <div className="mx-auto mt-8 max-w-3xl overflow-x-auto text-left">
      <table className="w-full border-collapse text-[15px] tabular-nums">
        <caption className="sr-only">{`${currency} prices: ${officialLabel} compared with sellers here`}</caption>
        <thead>
          <tr className="text-[12px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
            <th scope="col" className="pb-3 pr-4 font-medium">{currency}</th>
            <th scope="col" className="pb-3 pr-4 text-right font-medium">{officialLabel}</th>
            <th scope="col" className="pb-3 pr-4 text-right font-medium">Sellers Here</th>
            <th scope="col" className="pb-3 text-right font-medium">You Save</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.amount} className="border-t border-white/[0.07]">
              <th scope="row" className="py-3.5 pr-4 font-semibold text-text-primary">{num.format(r.amount)}</th>
              <td className="py-3.5 pr-4 text-right text-text-tertiary">{r.officialUsd != null ? usd.format(r.officialUsd) : '—'}</td>
              <td className="py-3.5 pr-4 text-right font-semibold text-text-primary">{r.oursUsd != null ? usd.format(r.oursUsd) : '—'}</td>
              <td className="py-3.5 text-right font-medium text-[#3FD986]">{r.savePct != null ? `${r.savePct}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Floating icon row (safety, more) ────────────────────────────── */

function FloatIcon({ icon: Icon, tint }: { icon: ComponentType<IconProps>; tint: string }) {
  return (
    <span aria-hidden className="inline-flex drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]" style={{ color: `rgb(${tint})` }}>
      <Icon size={36} weight="duotone" />
    </span>
  )
}

const CATEGORY_ICON: Record<string, ComponentType<IconProps>> = {
  currency: CoinsIcon,
  items: PackageIcon,
  account: UserCircleIcon,
  top_up: CoinsIcon,
  gift_card: GiftIcon,
  service: RocketLaunchIcon,
}

/* ── The guide ───────────────────────────────────────────────────── */

export function CurrencyGuide({ guide, gameName, ours, categories, currencyPages, rmtPublisher }: CurrencyGuideProps) {
  const c = guide.currency
  const page = pageCopy(guide)
  const noPassword = guide.delivery.no_password

  const allRows = buildPriceRows(guide, ours)
  const rows = page.savings ? page.savings.amounts.map((a) => allRows.find((r) => r.amount === a)).filter((r): r is PriceRow => !!r) : []
  const showTable = rows.some((r) => r.officialUsd != null)
  const tipRow = page.savings && 'tip_amount' in page.savings && page.savings.tip_amount
    ? rows.find((r) => r.amount === page.savings!.tip_amount)
    : rows.filter((r) => r.officialUsd != null && r.oursUsd != null).at(-1)
  const tipSave = tipRow?.officialUsd != null && tipRow.oursUsd != null ? Math.round(tipRow.officialUsd - tipRow.oursUsd) : 0
  const officialLabel = guide.game === 'roblox' ? 'On Roblox' : 'Official Store'

  const steps: DeliveryStep[] = page.delivery.steps
  const safety: { icon: ComponentType<IconProps>; tint: string; title: string; body: string }[] = [
    { icon: ShieldCheckIcon, tint: '63,217,134', title: 'Every Order Covered', body: "Not delivered or not as described? You get a full refund." },
    { icon: IdentificationCardIcon, tint: '94,234,212', title: 'ID-Checked Sellers', body: 'Every seller passes an ID check before they can sell.' },
    noPassword
      ? { icon: LockKeyIcon, tint: '245,196,81', title: 'Keep Your Password', body: 'Delivery never needs your login.' }
      : { icon: KeyIcon, tint: '245,196,81', title: 'Access Explained First', body: "Your seller says what's needed before you pay." },
  ]
  const more = categories.filter((cat) => cat.type !== 'currency')

  return (
    <section id="currency-guide" aria-labelledby="currency-guide-title" className="mx-auto mt-16 w-full max-w-7xl text-center sm:mt-24">
      <header>
        <h2 id="currency-guide-title" className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-text-primary [text-wrap:balance] sm:text-[36px]">
          {guideTitle(gameName, c)}
        </h2>
        <p className="mx-auto mt-3 max-w-4xl text-[17px] leading-7 text-text-secondary [text-wrap:pretty]">{page.subtitle}</p>
      </header>

      {/* 1 — What it is, and where else you can spend money on this site. */}
      <Block
        id="guide-what"
        title={page.what_is.heading}
        lead={
          <>
            {page.what_is.text}
            {'links' in page.what_is && page.what_is.links && page.what_is.links.length > 0 && (
              <>
                {' '}
                {page.what_is.spend_intro}{' '}
                {page.what_is.links.map((l, i, all) => (
                  <span key={l.href}>
                    <Link href={l.href} className="font-medium text-text-primary underline decoration-white/25 underline-offset-[3px] transition-colors hover:decoration-white/70">
                      {l.label}
                    </Link>
                    {i < all.length - 2 ? ', ' : i === all.length - 2 ? ' and ' : '.'}
                  </span>
                ))}
              </>
            )}
          </>
        }
      />

      {/* 2 — Savings: five packs, official price against the cheapest seller here. */}
      {page.savings && showTable && (
        <Block id="guide-prices" band title={page.savings.heading} lead={page.savings.text}>
          <SavingsTable rows={rows} currency={c} officialLabel={officialLabel} />
          {tipRow && tipSave >= 2 && (
            <Tip label="Tip" icon={PiggyBankIcon}>
              You save about {usd.format(tipSave).replace(/\.00$/, '')} on {formatAmount(c, tipRow.amount)} when you buy here.
            </Tip>
          )}
        </Block>
      )}

      {/* 3 — Delivery, step by step. */}
      <Block id="guide-delivery" title={guide.delivery.heading} lead={page.delivery.text}>
        <DeliverySteps steps={steps} />
        {'tip' in page.delivery && page.delivery.tip && (
          <Tip label="Did You Know?" icon={LightbulbIcon}>
            {page.delivery.tip}
          </Tip>
        )}
      </Block>

      {/* 4 — Safety. */}
      <Block
        id="guide-safety"
        band
        title={`Is It Safe to Buy ${c}?`}
        lead={
          rmtPublisher
            ? `Your order is covered here, but ${rmtPublisher}'s rules don't allow buying ${c} outside the game, and ${rmtPublisher} can act on accounts it links to a sale.`
            : page.safety_text
        }
      >
        <ul className="mx-auto mt-9 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
          {safety.map((f) => (
            <li key={f.title} className="flex flex-col items-center">
              <FloatIcon icon={f.icon} tint={f.tint} />
              <p className="mt-3 text-[15px] font-semibold text-text-primary">{f.title}</p>
              <p className="mx-auto mt-1 max-w-[15rem] text-[13.5px] leading-5 text-text-secondary">{f.body}</p>
            </li>
          ))}
        </ul>
        {rmtPublisher && (
          <Tip label="Before You Buy" tone="yellow" icon={WarningIcon}>
            Only buy what you&apos;re comfortable risking on your account.
          </Tip>
        )}
      </Block>

      {/* 5 — The game's own support question. */}
      {page.support && <Block id="guide-help" title={page.support.heading} lead={page.support.text} />}

      {/* 6 — More of this game: floating icon links, only categories with offers. */}
      <Block id="guide-more" band title={`More ${gameName}`}>
        <ul className="mx-auto mt-7 flex max-w-3xl flex-wrap items-start justify-center gap-x-10 gap-y-6">
          {[{ href: `/${guide.game}`, name: `${gameName} Marketplace`, type: 'hub' }, ...more].map((l) => {
            const Icon = l.type === 'hub' ? StorefrontIcon : (CATEGORY_ICON[l.type ?? ''] ?? PackageIcon)
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="group flex flex-col items-center gap-2 rounded-md px-2 py-1 text-[14px] font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <span aria-hidden className="text-text-primary drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:-translate-y-0.5">
                    <Icon size={28} weight="duotone" />
                  </span>
                  {l.type === 'hub' ? l.name : `${gameName} ${l.name}`}
                </Link>
              </li>
            )
          })}
        </ul>
      </Block>

      {/* 7 — Other games' currencies. */}
      {currencyPages.length > 0 && (
        <Block id="guide-currencies" title={guideFamily(guide) === 'roblox' ? 'Roblox Games Currencies' : 'More Game Currencies'}>
          <CurrencyCarousel items={currencyPages} />
        </Block>
      )}

      <p className="mx-auto mt-14 max-w-3xl text-[12px] leading-5 text-text-tertiary">
        {trademarkLine(guide.trademark_owner, gameName, c)}
      </p>
    </section>
  )
}

function trademarkLine(owner: string, gameName: string, currency: string): string {
  const stop = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)
  if (/\btrademark\b/i.test(owner)) {
    return `${stop(owner)} DropMarket is an independent marketplace and isn't affiliated with or endorsed by them.`
  }
  return `${gameName} and ${currency} are trademarks of ${stop(owner)} DropMarket is an independent marketplace and isn't affiliated with or endorsed by ${stop(owner)}`
}
