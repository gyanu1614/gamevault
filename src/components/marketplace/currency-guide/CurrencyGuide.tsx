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
import type { RelatedPageLink } from '@/lib/currency-guides/server'
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
  /** "More Roblox Games": this game's other categories + other games' pages (≤ 10). */
  related: RelatedPageLink[]
  /** Publisher whose rules forbid buying the currency (GTA$, Roubles). */
  rmtPublisher?: string | null
  /** The currency's admin-uploaded icon (the last delivery step's mark). */
  iconUrl?: string | null
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
          ? 'relative isolate mt-16 scroll-mt-24 px-1 py-12 sm:mt-20 sm:py-16'
          : 'mt-12 scroll-mt-24 px-1 py-4 sm:mt-16 sm:py-6'
      }
    >
      {band && <BandGround />}
      <h3 id={id} className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-text-primary [text-wrap:balance] sm:text-[30px]">
        {title}
      </h3>
      {lead && <p className="mx-auto mt-3 max-w-6xl text-[16px] leading-[26px] text-text-secondary [text-wrap:pretty]">{lead}</p>}
      {children}
    </section>
  )
}

const BAND = '#1B1C21'
/** A soft wave, 1440 × 40, filled to the bottom edge. */
const WAVE = 'M0 40 V22 C 180 4 380 0 620 12 C 860 24 1080 34 1260 22 C 1340 17 1400 12 1440 10 V40 Z'

/**
 * A band's ground: one flat tone (no gradient, so no seam against the page),
 * edge to edge, with a soft wave on its top and bottom edges instead of a
 * straight cut (owner, 2026-10-06). The page <main> clips the overflow.
 */
function BandGround() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2" style={{ background: BAND }}>
      <svg className="absolute bottom-[calc(100%-1px)] left-0 h-6 w-full sm:h-10" viewBox="0 0 1440 40" preserveAspectRatio="none">
        <path d={WAVE} fill={BAND} />
      </svg>
      <svg className="absolute left-0 top-[calc(100%-1px)] h-6 w-full -scale-y-100 sm:h-10" viewBox="0 0 1440 40" preserveAspectRatio="none">
        <path d={WAVE} fill={BAND} />
      </svg>
    </span>
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
  // A real table (owner, 2026-10-06: "a nice full table, not just lines"):
  // one rounded box, a filled header row, each row a full-width cell band.
  const th = 'px-4 py-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-text-tertiary sm:px-6'
  const td = 'px-4 py-4 sm:px-6'
  return (
    <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-xl bg-[#1D1E23] text-left shadow-[0_18px_40px_-24px_rgba(0,0,0,0.8)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[15px] tabular-nums">
          <caption className="sr-only">{`${currency} prices: ${officialLabel} compared with sellers here`}</caption>
          <thead className="bg-[#24252B]">
            <tr>
              <th scope="col" className={th}>Amount</th>
              <th scope="col" className={`${th} text-right`}>{officialLabel}</th>
              <th scope="col" className={`${th} text-right`}>Sellers Here</th>
              <th scope="col" className={`${th} text-right`}>You Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.amount} className={i % 2 === 1 ? 'bg-white/[0.015]' : undefined}>
                <th scope="row" className={`${td} whitespace-nowrap font-semibold text-text-primary`}>{formatAmount(currency, r.amount)}</th>
                <td className={`${td} text-right text-text-tertiary`}>{r.officialUsd != null ? usd.format(r.officialUsd) : '—'}</td>
                <td className={`${td} text-right text-[16px] font-bold text-text-primary`}>{r.oursUsd != null ? usd.format(r.oursUsd) : '—'}</td>
                <td className={`${td} text-right font-semibold text-[#3FD986]`}>{r.savePct != null ? `${r.savePct}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

const GLYPH: Record<string, string> = { currency: 'currency', items: 'items', account: 'accounts', service: 'boosting', top_up: 'top-up' }

/** The house category glyph (public/icons/categories), drawn white through a mask, floating. */
function CategoryMark({ type }: { type: string | null }) {
  const src = `/icons/categories/${GLYPH[type ?? ''] ?? 'items'}.svg`
  return (
    <span
      aria-hidden
      className="inline-block h-8 w-8 bg-white/85 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:bg-white"
      style={{
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  )
}

/* ── The guide ───────────────────────────────────────────────────── */

export function CurrencyGuide({ guide, gameName, ours, related, rmtPublisher, iconUrl }: CurrencyGuideProps) {
  const c = guide.currency
  const page = pageCopy(guide)
  const noPassword = guide.delivery.no_password

  const allRows = buildPriceRows(guide, ours)
  const rows = page.savings ? page.savings.amounts.map((a) => allRows.find((r) => r.amount === a)).filter((r): r is PriceRow => !!r) : []
  const showTable = rows.some((r) => r.officialUsd != null)
  const tipAmount = page.savings && 'tip_amount' in page.savings ? page.savings.tip_amount : undefined
  const tipRow = tipAmount
    ? rows.find((r) => r.amount === tipAmount)
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

  return (
    <section id="currency-guide" aria-labelledby="currency-guide-title" className="mx-auto mt-16 w-full max-w-7xl text-center sm:mt-24">
      {/* One title, and "what it is" as its subtitle (owner, 2026-10-06: the
          guide title and "What Is Robux?" read as two competing titles). */}
      <header>
        <h2 id="currency-guide-title" className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-text-primary [text-wrap:balance] sm:text-[36px]">
          {guideTitle(gameName, c)}
        </h2>
        <p className="mx-auto mt-4 max-w-6xl text-[16px] leading-[26px] text-text-secondary [text-wrap:pretty] sm:text-[17px] sm:leading-7">
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
        </p>
      </header>

      {/* 2 — Savings: five packs, official price against the cheapest seller here. */}
      {page.savings && showTable && (
        <Block id="guide-prices" title={page.savings.heading}>
          <SavingsTable rows={rows} currency={c} officialLabel={officialLabel} />
          {tipRow && tipSave >= 2 && (
            <Tip label="Tip" icon={PiggyBankIcon}>
              You save about {usd.format(tipSave).replace(/\.00$/, '')} on {formatAmount(c, tipRow.amount)} when you buy here.
            </Tip>
          )}
        </Block>
      )}

      {/* 3 — Delivery, step by step. */}
      <Block id="guide-delivery" band title={guide.delivery.heading} lead={page.delivery.text}>
        <DeliverySteps steps={steps} currencyIconUrl={iconUrl} />
        {'tip' in page.delivery && page.delivery.tip && (
          <Tip label="Did You Know?" icon={LightbulbIcon}>
            {page.delivery.tip}
          </Tip>
        )}
      </Block>

      {/* 4 — Safety. */}
      <Block
        id="guide-safety"
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

      {/* The game's support question ("Why is my Robux pending?") lives in the
          page FAQ (applyGuideToFaq), not as a one-line section here. */}

      {/* 6 — One links section: this game's other categories, then the busiest
          other games (owner, 2026-10-06: merged "More Roblox" and the
          currency carousel; category glyphs, not game art; ten at most). */}
      {related.length > 0 && (
        <Block id="guide-more" band title={guideFamily(guide) === 'roblox' ? 'More Roblox Games' : 'More Popular Games'}>
          <ul className="mx-auto mt-8 grid max-w-5xl grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {related.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="group flex flex-col items-center gap-2.5 rounded-md px-2 py-1 text-[14px] font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <CategoryMark type={l.type} />
                  <span className="text-center leading-snug">{l.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <p className="mx-auto mt-14 text-[12px] leading-5 text-text-tertiary">
        {trademarkLine(guide.trademark_owner, gameName, c)}
      </p>
    </section>
  )
}

/**
 * The not-affiliated line: names the marks, says we're independent and not
 * affiliated, sponsored or endorsed. One line on desktop (owner, 2026-10-06).
 */
export function trademarkLine(owner: string, gameName: string, currency: string): string {
  const stop = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)
  const who = owner.replace(/[.\s]+$/, '')
  if (/\btrademark\b/i.test(owner)) {
    return `${stop(owner)} DropMarket is independent and isn't affiliated with, sponsored or endorsed by them.`
  }
  const marks = currency.toLowerCase().includes(gameName.toLowerCase()) ? currency : `${gameName} and ${currency}`
  return `${marks} are trademarks of ${who}. DropMarket is independent and isn't affiliated with, sponsored or endorsed by ${who}.`
}
