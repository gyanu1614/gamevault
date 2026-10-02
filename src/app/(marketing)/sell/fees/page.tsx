/**
 * /sell/fees — the public seller commission schedule (fee engine PR 5, D3;
 * docs/design/fee-engine.md §4.1, §4.2, §9 A7/A13).
 *
 * Every number on this page is the resolver's answer with p_seller_id NULL —
 * the headline rate before any seller's founding or rank adjustment — read
 * through lib/fees/public-rates (anon client, unstable_cache under
 * FEE_RULES_TAG). An admin fee write revalidates it; the 24 h `revalidate` is
 * the backstop. /fees stays the legal document (rules, not numbers) and links
 * here. Static-first: no cookie client, no searchParams, force-static.
 */

import type { Metadata } from 'next'
import Link from '@/components/navigation/AppLink'
import {
  PercentIcon,
  CalendarBlankIcon,
  CrownSimpleIcon,
  SparkleIcon,
  WalletIcon,
  ArrowRightIcon,
  CheckIcon,
} from '@phosphor-icons/react/dist/ssr'

import { FaqCards } from '@/components/marketplace/FaqCards'
import { TierIcon } from '@/components/seller/tiers/TierIcon'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { JsonLd, faqPage } from '@/lib/seo/jsonld'
import { getPublicFeeSchedule, getPublicWithdrawalTerms, describeWithdrawalFee, formatScheduleDateUtc, type PublicFeeSchedule } from '@/lib/fees/public-rates'

export const revalidate = 86400
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Seller Fees',
  description:
    'What it costs to sell on DropMarket: commission by category, per-game rates, the rank discount ladder and the founding-seller programme — read live from the fee table checkout uses.',
  alternates: { canonical: '/sell/fees' },
  openGraph: {
    title: 'Seller Fees on DropMarket',
    description: 'Commission by category, per-game rates, rank discounts and the founding programme — no listing fee, ever.',
    url: '/sell/fees',
    type: 'website',
  },
}

const fmtDate = formatScheduleDateUtc
const pct = (n: number) => `${Number(n).toFixed(2).replace(/\.?0+$/, '')}%`
const pts = (n: number) => `${Number(n).toFixed(2).replace(/\.?0+$/, '')}`
const hoursText = (h: number) => (h % 24 === 0 && h >= 24 ? `${h / 24} day${h === 24 ? '' : 's'}` : `${h} hour${h === 1 ? '' : 's'}`)

const FAQ = [
  {
    q: 'Is there a listing fee?',
    a: 'No. Listing is free and stays free — commission is charged only on the item price when an order completes, never on the buyer fee.',
  },
  {
    q: 'Why does my own rate differ from this page?',
    a: 'This page shows the headline rate before any seller adjustment. Your rank discount and the founding programme apply on top of it; the exact rate for your account is shown on the listing form before you publish and on every order.',
  },
  {
    q: 'How much notice do I get before a rate changes?',
    a: 'Standard rates change only on a dated schedule with the notice period stated in the Terms; scheduled changes are listed on this page in advance. Promotional rates can start immediately but always have an end date.',
  },
  {
    q: 'Can a rate go up after I sell?',
    a: 'No. The commission on an order is fixed at the moment it is placed and recorded on the order itself — a later rate change never touches a past order.',
  },
]

export default async function SellerFeesPage() {
  const [s, w] = await Promise.all([getPublicFeeSchedule(), getPublicWithdrawalTerms()])
  const hasNext = s.nextChange != null && s.categories.some((c) => c.nextPct != null)
  // Same rule for the per-game table: the "From" column shows only while a
  // dated change moves a listed rate, and disappears once that date passes.
  const hasNextPair = s.nextChange != null && s.overrides.some((o) => o.nextPct != null)

  return (
    <main className="min-h-screen bg-bg-base">
      <JsonLd data={faqPage(FAQ)} />

      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-text-secondary sm:text-[14px]">
            <PercentIcon size={15} weight="bold" aria-hidden /> Seller Fees
          </p>
          <h1 className="mt-3 text-[32px] font-bold leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[42px]">
            What it costs to sell on DropMarket
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
            No listing fee. Commission is charged on the item price only, when an order completes. The rates below are
            read live from the same table checkout uses — the number you see here is the number an order is priced with.
          </p>
          <EffectiveLine s={s} />
        </header>

        {/* ── Category table ──────────────────────────────────────────────── */}
        <Section title="Commission by Category" lead="The standard rate for each category, before any per-game override or seller adjustment.">
          <Table
            head={hasNext ? ['Category', 'Rate now', `From ${fmtDate(s.nextChange!)}`] : ['Category', 'Rate']}
            rows={s.categories.map((c) => [
              c.label,
              c.pct == null ? '—' : pct(c.pct),
              ...(hasNext ? [c.nextPct == null ? 'unchanged' : pct(c.nextPct)] : []),
            ])}
          />
        </Section>

        {/* ── Per-game overrides ──────────────────────────────────────────── */}
        <Section
          title="Per-Game Rates"
          lead="Some game economies carry their own rate instead of the category standard. Everything not listed here uses the category rate above."
        >
          {s.overrides.length === 0 ? (
            <p className="text-[14px] text-text-tertiary">No per-game rates are in force right now.</p>
          ) : (
            <Table
              head={hasNextPair ? ['Game', 'Category', 'Rate now', `From ${fmtDate(s.nextChange!)}`, 'Type'] : ['Game', 'Category', 'Rate', 'Type']}
              rows={s.overrides.map((o) => [
                o.gameName,
                o.categoryName,
                pct(o.pct),
                ...(hasNextPair ? [o.nextPct == null ? 'unchanged' : pct(o.nextPct)] : []),
                o.kind === 'promo' ? `Promotion until ${o.endsAt ? fmtDate(o.endsAt) : 'further notice'}` : 'Standard',
              ])}
              linkFirst={(i) => `/${s.overrides[i].gameSlug}/${s.overrides[i].categorySlug}`}
            />
          )}
        </Section>

        {/* ── Rank ladder + founding ──────────────────────────────────────── */}
        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          <Card icon={<CrownSimpleIcon size={16} weight="bold" />} title="Seller Rank Discount">
            <p className="text-[14px] text-text-secondary">
              Each rank takes points off your category rate. The discount never brings a rate below the floor of{' '}
              <b className="text-text-primary">{pct(s.rankFloorPct)}</b>, and a rate already at or under the floor is unchanged.
            </p>
            <ul className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-md bg-white/[0.03]">
              {s.ranks.map((r) => (
                <li key={r.tier} className="flex items-center justify-between px-4 py-2.5 text-[14px]">
                  <span className="inline-flex items-center gap-2.5 text-text-primary">
                    <TierIcon tier={r.tier} size={18} decorative />
                    {r.displayName}
                  </span>
                  <span className="tabular-nums text-text-secondary">
                    {r.discountPts > 0 ? `−${pts(r.discountPts)} pts` : 'standard rate'}
                  </span>
                </li>
              ))}
            </ul>
            <CardLink href="/account/tiers">How Ranks Are Earned</CardLink>
          </Card>
          <Card icon={<SparkleIcon size={16} weight="bold" />} title="Founding Seller Programme">
            <p className="text-[14px] text-text-secondary">
              Founding sellers pay <b className="text-text-primary">{pct(s.founding.discountPct)} less</b> than the
              category rate on every sale for their first{' '}
              <b className="text-text-primary">{s.founding.months} months</b>. The founding rate replaces the rank
              discount while it runs; after that the rank ladder applies as usual.
            </p>
            <CardLink href="/early-seller?src=sell-fees">Become a Founding Seller</CardLink>
          </Card>
        </div>

        {/* ── Getting paid (PR 7) — the only seller surface besides /fees that carries payout numbers ── */}
        <Section
          title="Getting Paid"
          lead="When a sale becomes withdrawable, and what each payout method costs. Read live from the same tables the withdrawal page quotes from."
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Table
              head={['Payout method', 'Fee', 'Minimum withdrawal']}
              rows={w.methods.map((m) => [m.displayName, describeWithdrawalFee(m), `$${m.minWithdrawal.toFixed(0)}`])}
            />
            <Card icon={<WalletIcon size={16} weight="bold" />} title="Timing and Rules">
              <ul className="space-y-2.5 text-[14px] leading-relaxed text-text-secondary [&>li]:relative [&>li]:pl-4 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.6em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-white/25 [&>li]:before:content-['']">
                <li>
                  A sale is credited when the buyer confirms receipt and becomes withdrawable{' '}
                  <b className="text-text-primary">{hoursText(w.completionHoldHours)}</b> later. If the buyer does nothing,
                  the order completes automatically when its SafeDrop Protection window closes and the credit is withdrawable at once.
                </li>
                <li>
                  Protection windows:{' '}
                  {w.windows.map((x, i) => (
                    <span key={x.type}>
                      {i > 0 && ' · '}
                      {x.label} <b className="text-text-primary">{hoursText(x.hours)}</b>
                    </span>
                  ))}
                  .
                </li>
                <li>
                  Buyers can open a dispute for <b className="text-text-primary">{w.disputeWindowDays} days</b> after delivery.
                  While a dispute is open the order&apos;s amount is set aside; we handle the dispute on your behalf and release or refund it when it is decided.
                </li>
                <li>
                  Withdrawals open <b className="text-text-primary">{w.minAccountAgeDays} days</b> after your seller account is approved.
                </li>
                <li>
                  Changing your payout details pauses withdrawals for <b className="text-text-primary">{hoursText(w.payoutFreezeHours)}</b>. One withdrawal can be in progress at a time.
                </li>
              </ul>
            </Card>
          </div>
        </Section>

        {/* ── Rules ───────────────────────────────────────────────────────── */}
        <Section title="How the Rate Is Applied">
          <ul className={cn('space-y-3 rounded-lg p-5 text-[14px] leading-relaxed text-text-secondary sm:p-6', SURFACE)}>
            <Rule>Commission applies to the item price only — never to the buyer&apos;s marketplace or processing fee.</Rule>
            <Rule>Your exact rate, with your rank and founding adjustments, is shown on the listing form before you publish.</Rule>
            <Rule>The rate is fixed and recorded on each order when it is placed; later changes never touch a past order.</Rule>
            <Rule>
              Standard rates change only on a dated schedule with {s.noticeDays} days&apos; notice; promotional rates may
              start at once but always end on a stated date.
            </Rule>
            <Rule>
              Buyer fees and warranty terms are set out in the{' '}
              <Link href="/fees" className="font-semibold text-text-primary underline decoration-white/30 underline-offset-4 hover:decoration-white/70">Fees &amp; Charges</Link> document; withdrawal
              terms are in &ldquo;Getting paid&rdquo; above.
            </Rule>
          </ul>
        </Section>

        <Section title="Questions">
          <FaqCards items={FAQ} defaultOpen={-1} />
        </Section>
      </div>
    </main>
  )
}

const SURFACE = MARKET_CARD

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ')
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-white/[0.07] text-text-primary">
        <CheckIcon size={11} weight="bold" aria-hidden />
      </span>
      <span>{children}</span>
    </li>
  )
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-white/[0.06] px-3 text-[13.5px] font-semibold text-text-primary transition-colors hover:bg-white/[0.1]"
    >
      {children}
      <ArrowRightIcon size={13} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function EffectiveLine({ s }: { s: PublicFeeSchedule }) {
  return (
    <p className="mt-5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-white/[0.05] px-3 py-2 text-[13px] text-text-secondary">
      <CalendarBlankIcon size={15} weight="bold" aria-hidden className="text-text-tertiary" />
      {s.effectiveFrom ? <span>Rates effective from <b className="text-text-primary">{fmtDate(s.effectiveFrom)}</b></span> : <span>Current rates</span>}
      {s.nextChange && (
        <span>
          · Next change: <b className="text-text-primary">{fmtDate(s.nextChange)}</b>
        </span>
      )}
    </p>
  )
}

function Section({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-[22px] font-bold tracking-[-0.01em] text-text-primary">{title}</h2>
      {lead && <p className="mt-1.5 max-w-2xl text-[14px] text-text-secondary">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg p-5 sm:p-6', SURFACE)}>
      <h3 className="flex items-center gap-3 text-[16px] font-semibold text-text-primary">
        <span aria-hidden className="grid h-9 w-9 place-items-center rounded-md bg-white/[0.06] text-text-secondary">{icon}</span>
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Table({ head, rows, linkFirst }: { head: string[]; rows: string[][]; linkFirst?: (rowIndex: number) => string }) {
  return (
    <div className={cn('overflow-x-auto overscroll-x-contain rounded-lg', SURFACE)}>
      <table className="w-full text-left text-[14px]">
        <thead>
          <tr className="border-b border-white/[0.07] bg-black/[0.14] text-[13px] font-semibold text-text-tertiary">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 sm:px-5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {rows.map((r, i) => (
            <tr key={i} className="transition-colors hover:bg-white/[0.02]">
              {r.map((cell, j) => (
                <td key={j} className={j === 0 ? 'px-4 py-3 font-medium text-text-primary sm:px-5' : 'px-4 py-3 tabular-nums text-text-secondary sm:px-5'}>
                  {j === 0 && linkFirst ? (
                    <Link href={linkFirst(i)} className="underline-offset-4 hover:underline">{cell}</Link>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
