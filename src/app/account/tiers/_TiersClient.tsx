'use client'

/**
 * /account/tiers — the seller rank page (owner, 2026-09-30: full revamp like
 * Settings, mobile + desktop, motion, "switch cards", and fix what was wrong).
 *
 *   Hero      your rank (floating medal), its rank step and offer limit, the
 *             next rank as a ring of requirements met, and the five-rank rail
 *             (tap a rank to open it below).
 *   Progress  the next rank's four bars from the SAME 90-day facts the daily
 *             check uses (see _tiers-model.ts).
 *   How       the rules, short.
 *   All Ranks a switcher: a list on desktop, tabs + swipe on phones, one card
 *             per rank with what it asks for and what it unlocks.
 *
 * Fill-only cards (card-surface system), neutral accents, green only for a
 * met requirement or the upgrade notice. Reduced motion: no springs, no
 * float, no swipe animation.
 */

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import {
  PercentIcon,
  StackIcon,
  EyeIcon,
  RocketLaunchIcon,
  UploadSimpleIcon,
  ImageSquareIcon,
  CalendarCheckIcon,
  TrendUpIcon,
  UsersThreeIcon,
  CheckCircleIcon,
  LockSimpleIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ArrowRightIcon,
  StorefrontIcon,
  SealCheckIcon,
} from '@phosphor-icons/react'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { AccountPage, SettingsCard } from '@/components/account/AccountSurface'
import { RevealGroup, RevealItem } from '@/components/account/Reveal'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { TierIcon } from '@/components/seller/tiers/TierIcon'
import SellerTierBadge from '@/components/seller/tiers/SellerTierBadge'
import { tierByKey } from '@/lib/seller/tiers'
import { cn } from '@/lib/utils'
import {
  discountLabel,
  listingLimitLabel,
  nextRank,
  pendingUpgrade,
  perksFor,
  rankStatus,
  requirementsFor,
  type RankConfig,
  type RankStatus,
  type RankWindow,
} from './_tiers-model'

interface TiersClientProps {
  ladder: RankConfig[]
  isSeller: boolean
  currentTier: string
  eligibleTier: string
  window: RankWindow
  /** platform_fee_settings.rank_floor_pct (the rate a rank step never goes below). */
  floorPct: number | null
}

const PERK_ICON: Record<string, typeof PercentIcon> = {
  discount: PercentIcon,
  listings: StackIcon,
  review: EyeIcon,
  bulk: UploadSimpleIcon,
  banner: ImageSquareIcon,
}

const STATUS_LABEL: Record<RankStatus, string> = {
  reached: 'Reached',
  current: 'Current',
  next: 'Next',
  locked: 'Locked',
}

function StatusPill({ status, className }: { status: RankStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-semibold',
        status === 'current' && 'bg-white/[0.1] text-text-primary',
        status === 'next' && 'bg-white/[0.06] text-text-secondary',
        status === 'reached' && 'bg-success-bg text-success',
        status === 'locked' && 'bg-white/[0.04] text-text-tertiary',
        className,
      )}
    >
      {status === 'reached' && <CheckCircleIcon size={13} weight="fill" aria-hidden />}
      {status === 'locked' && <LockSimpleIcon size={12} weight="bold" aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Requirements met, as a ring (two SVG circles; the arc springs in). */
function ProgressRing({ met, total }: { met: number; total: number }) {
  const reduce = useReducedMotion()
  const r = 19
  const c = 2 * Math.PI * r
  const f = total > 0 ? met / total : 1
  return (
    <div className="relative grid h-12 w-12 shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-white/[0.08]" />
        <motion.circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          className={f >= 1 ? 'stroke-success' : 'stroke-white/80'}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - f) }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 20, delay: 0.2 }}
        />
      </svg>
      <span className="relative text-[13px] font-bold tabular-nums text-text-primary">
        {met}/{total}
      </span>
    </div>
  )
}

function Bar({ progress, met, delay }: { progress: number; met: boolean; delay: number }) {
  const reduce = useReducedMotion()
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
      <motion.div
        className={cn('h-full origin-left rounded-full', met ? 'bg-success' : 'bg-white/75')}
        initial={{ scaleX: reduce ? progress : 0 }}
        animate={{ scaleX: progress }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 110, damping: 22, delay }}
      />
    </div>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function RankHero({
  ladder,
  current,
  next,
  isSeller,
  pending,
  met,
  total,
  selected,
  onSelect,
}: {
  ladder: RankConfig[]
  current: RankConfig
  next: RankConfig | null
  isSeller: boolean
  pending: RankConfig | null
  met: number
  total: number
  selected: string
  onSelect: (tier: string) => void
}) {
  const reduce = useReducedMotion()
  const def = tierByKey(current.tier)
  const at = ladder.findIndex((t) => t.tier === current.tier)
  const fill = ladder.length > 1 ? Math.max(0, at) / (ladder.length - 1) : 0

  return (
    <section className="overflow-hidden rounded-lg bg-bg-raised">
      {pending && (
        <div className="flex items-center gap-2.5 border-b border-white/[0.07] bg-success-bg px-5 py-3 text-[13px] font-medium text-success sm:px-6">
          <TrendUpIcon size={16} weight="bold" aria-hidden className="shrink-0" />
          <span>
            You qualify for {pending.display_name}. You move up at the next daily check (3 AM UTC).
          </span>
        </div>
      )}

      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-2xl bg-white/[0.04]">
            <SellerTierBadge tier={current.tier} size={46} float={isSeller} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] text-text-tertiary">{isSeller ? 'Your Rank' : 'Every Seller Starts At'}</p>
            <h2 className="mt-0.5 text-[22px] font-bold leading-tight tracking-[-0.01em] text-text-primary">
              <span className={def.colors.text}>{current.display_name}</span> Seller
            </h2>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-white/[0.06] px-2.5 text-[12.5px] font-semibold text-text-primary">
                <PercentIcon size={13} weight="bold" aria-hidden className="text-text-tertiary" />
                {Number(current.discount_pts) > 0 ? `${discountLabel(current.discount_pts)} Off Your Rate` : 'Standard Rate'}
              </span>
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-white/[0.06] px-2.5 text-[12.5px] font-semibold text-text-primary">
                <StackIcon size={13} weight="bold" aria-hidden className="text-text-tertiary" />
                {listingLimitLabel(current.listing_limit)} Offers
              </span>
            </div>
          </div>
        </div>

        {isSeller && next ? (
          <button
            type="button"
            onClick={() => onSelect(next.tier)}
            className="group flex items-center gap-3 rounded-lg bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06] sm:min-w-[250px]"
          >
            <ProgressRing met={met} total={total} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] text-text-tertiary">Next Rank</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold text-text-primary">
                <TierIcon tier={next.tier} size={16} decorative />
                {next.display_name}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-text-secondary">
                {met} of {total} requirements met
              </span>
            </span>
            <CaretRightIcon size={14} weight="bold" aria-hidden className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : isSeller ? (
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3.5 py-3 text-[13px] font-medium text-text-secondary">
            <SealCheckIcon size={18} weight="fill" aria-hidden className="text-text-primary" />
            Top rank reached
          </div>
        ) : (
          <Link
            href="/account/become-seller"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-4 text-[14px] font-semibold text-black transition-[background-color,transform] hover:bg-white/90 active:scale-[0.98]"
          >
            <StorefrontIcon size={16} weight="bold" aria-hidden />
            Become a Seller
          </Link>
        )}
      </div>

      {/* The rail: five ranks, filled up to yours. Tap one to open it below. */}
      <div className="border-t border-white/[0.07] bg-black/[0.14] px-3 py-4 sm:px-6">
        <div className="relative">
        <div aria-hidden className="pointer-events-none absolute left-[10%] right-[10%] top-[17px] h-0.5 rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full origin-left rounded-full bg-white/50"
            initial={{ scaleX: reduce ? fill : 0 }}
            animate={{ scaleX: fill }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 20, delay: 0.15 }}
          />
        </div>
        <ol className="relative grid grid-cols-5">
          {ladder.map((t) => {
            const status = rankStatus(ladder, t.tier, current.tier)
            const isSelected = t.tier === selected
            return (
              <li key={t.tier} className="relative flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onSelect(t.tier)}
                  aria-label={`${t.display_name}: ${STATUS_LABEL[status]}`}
                  aria-current={status === 'current' ? 'step' : undefined}
                  className={cn(
                    'group flex flex-col items-center gap-1.5 rounded-lg px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-9 w-9 place-items-center rounded-full bg-bg-raised transition-[box-shadow,transform] duration-200 group-hover:scale-105',
                      status === 'current'
                        ? 'shadow-[0_0_0_2px_rgba(255,255,255,0.55)]'
                        : isSelected
                          ? 'shadow-[0_0_0_2px_rgba(255,255,255,0.22)]'
                          : 'shadow-[0_0_0_1px_rgba(255,255,255,0.1)]',
                    )}
                  >
                    <TierIcon
                      tier={t.tier}
                      size={19}
                      decorative
                      className={cn(status === 'locked' || status === 'next' ? 'opacity-45 grayscale' : '')}
                    />
                  </span>
                  <span
                    className={cn(
                      'text-[12px] font-medium',
                      status === 'current' ? 'text-text-primary' : 'text-text-tertiary group-hover:text-text-secondary',
                    )}
                  >
                    {t.display_name}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        </div>
      </div>
    </section>
  )
}

// ── Progress ─────────────────────────────────────────────────────────────────

function ProgressCard({ next, window: w, isSeller }: { next: RankConfig | null; window: RankWindow; isSeller: boolean }) {
  if (!isSeller) {
    return (
      <SettingsCard
        title="Start Your Climb"
        description="Every seller starts at Bronze. Sell over any 90 days to move up, and each rank takes points off your category rate."
        footerHint="Ranks are checked every day at 3 AM UTC."
        footerAction={
          <Link
            href="/account/become-seller"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-white/[0.08] px-4 text-[14px] font-semibold text-text-primary transition-colors hover:bg-white/[0.12]"
          >
            Become a Seller
            <ArrowRightIcon size={14} weight="bold" aria-hidden />
          </Link>
        }
        className="h-full"
      />
    )
  }
  if (!next) {
    return (
      <SettingsCard
        title="Top Rank Reached"
        description="You hold the highest rank. It stays yours: ranks never drop."
        footerHint="Your numbers are still checked daily at 3 AM UTC."
        className="h-full"
      >
        <div className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-4">
          <SellerTierBadge tier="legendary" size={36} />
          <p className="text-[13.5px] text-text-secondary">Keep delivering on time: buyers see your rank on every offer.</p>
        </div>
      </SettingsCard>
    )
  }

  const rows = requirementsFor(next, w)
  const met = rows.filter((r) => r.met).length
  return (
    <SettingsCard
      title={`Progress to ${next.display_name}`}
      description="Meet every bar within the same 90 days."
      aside={
        <span className="inline-flex h-6 items-center rounded-md bg-white/[0.07] px-2 text-[12px] font-semibold tabular-nums text-text-secondary">
          {met} of {rows.length}
        </span>
      }
      footerHint="Checked every day at 3 AM UTC against your last 90 days."
      className="h-full"
    >
      <ul className="space-y-4">
        {rows.map((r, i) => (
          <li key={r.key}>
            <div className="flex items-center justify-between gap-3 text-[13.5px]">
              <span className="flex min-w-0 items-center gap-2 text-text-secondary">
                {r.met ? (
                  <CheckCircleIcon size={16} weight="fill" aria-hidden className="shrink-0 text-success" />
                ) : (
                  <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border-[1.5px] border-white/25" />
                )}
                <span className="truncate">{r.label}</span>
                <span className="sr-only">{r.met ? '(met)' : '(not met yet)'}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-text-primary">{r.value}</span>
                <span className="text-text-tertiary"> / {r.target}</span>
              </span>
            </div>
            <div className="mt-2">
              <Bar progress={r.progress} met={r.met} delay={0.1 + i * 0.07} />
            </div>
          </li>
        ))}
      </ul>
    </SettingsCard>
  )
}

// ── How it works ─────────────────────────────────────────────────────────────

function HowRanksWork({ floorPct }: { floorPct: number | null }) {
  const floor = floorPct != null ? Number(floorPct).toFixed(2).replace(/\.?0+$/, '') : null
  const items = [
    { Icon: CalendarCheckIcon, title: 'Checked Every Day', body: 'At 3 AM UTC, against your last 90 days.' },
    { Icon: TrendUpIcon, title: 'Ranks Never Drop', body: 'Once you earn a rank, it stays yours.' },
    { Icon: UsersThreeIcon, title: 'Fair Volume', body: 'One buyer counts for at most 30% of your volume.' },
    {
      Icon: PercentIcon,
      title: 'Points Off Your Rate',
      body: floor ? `Each rank takes points off your category rate, never below the ${floor}% floor.` : 'Each rank takes points off your category rate.',
    },
    { Icon: CheckCircleIcon, title: 'Completion Rate', body: 'Cancelled and refunded orders are left out.' },
  ]
  return (
    <SettingsCard
      title="How Ranks Work"
      footerHint="Category rates are listed on the Seller Fees page."
      footerAction={
        <Link
          href="/sell/fees"
          className="group inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13.5px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
        >
          See Seller Fees
          <ArrowRightIcon size={13} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      }
      className="h-full"
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map(({ Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/[0.05] text-text-secondary">
              <Icon size={16} weight="bold" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-text-primary">{title}</span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-text-secondary">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </SettingsCard>
  )
}

// ── All ranks (switcher) ─────────────────────────────────────────────────────

function RankDetail({
  rank,
  status,
  window: w,
  isSeller,
}: {
  rank: RankConfig
  status: RankStatus
  window: RankWindow
  isSeller: boolean
}) {
  const def = tierByKey(rank.tier)
  const rows = requirementsFor(rank, w)
  const perks = perksFor(rank)
  // Your own numbers only mean something for a rank still ahead of you.
  const showMine = isSeller && (status === 'next' || status === 'locked')
  return (
    <div>
      <div className="flex items-start gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/[0.04]">
          <SellerTierBadge tier={rank.tier} size={38} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[19px] font-bold leading-tight text-text-primary">
              <span className={def.colors.text}>{rank.display_name}</span>
            </h3>
            {isSeller && <StatusPill status={status} />}
          </div>
          {rank.description && <p className="mt-1 text-[13px] text-text-secondary">{rank.description}</p>}
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h4 className="text-[13px] font-semibold text-text-tertiary">What It Takes</h4>
          {rows.length === 0 ? (
            <p className="mt-2.5 rounded-lg bg-white/[0.03] p-3.5 text-[13.5px] text-text-secondary">
              Nothing. Every seller starts here.
            </p>
          ) : (
            <ul className="mt-2.5 divide-y divide-white/[0.06] rounded-lg bg-white/[0.03]">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-3 px-3.5 py-3 text-[13.5px]">
                  <span className="flex min-w-0 items-center gap-2 text-text-secondary">
                    {showMine &&
                      (r.met ? (
                        <CheckCircleIcon size={15} weight="fill" aria-hidden className="shrink-0 text-success" />
                      ) : (
                        <span aria-hidden className="h-[15px] w-[15px] shrink-0 rounded-full border-[1.5px] border-white/25" />
                      ))}
                    <span className="truncate">{r.label}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-text-primary">
                    {showMine && <span className="font-medium text-text-tertiary">{r.value} / </span>}
                    {r.target}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-[13px] font-semibold text-text-tertiary">What You Get</h4>
          <ul className="mt-2.5 space-y-1.5">
            {perks.map((p) => {
              const Icon = p.key === 'review' && !p.label.startsWith('First') ? RocketLaunchIcon : PERK_ICON[p.key]
              return (
                <li key={p.key} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3.5 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/[0.05] text-text-secondary">
                    <Icon size={16} weight="bold" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-text-primary">{p.label}</span>
                    <span className="block text-[12px] text-text-tertiary">{p.detail}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

function AllRanks({
  ladder,
  currentTier,
  selected,
  onSelect,
  window: w,
  isSeller,
  sectionRef,
}: {
  ladder: RankConfig[]
  currentTier: string
  selected: string
  onSelect: (tier: string) => void
  window: RankWindow
  isSeller: boolean
  sectionRef: React.RefObject<HTMLElement>
}) {
  const reduce = useReducedMotion()
  const index = Math.max(0, ladder.findIndex((t) => t.tier === selected))
  const [dir, setDir] = useState(1)
  const rank = ladder[index]

  const go = (to: number) => {
    const target = ladder[to]
    if (!target) return
    setDir(to > index ? 1 : -1)
    onSelect(target.tier)
  }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(index + 1)
    else if (info.offset.x > 60 || info.velocity.x > 400) go(index - 1)
  }

  return (
    <section ref={sectionRef} id="all-ranks" className="scroll-mt-24 overflow-hidden rounded-lg bg-bg-raised">
      <header className="px-5 pt-5 sm:px-6 sm:pt-6">
        <h2 className="text-[15px] font-semibold leading-tight text-text-primary">All Ranks</h2>
        <p className="mt-1 text-[13px] text-text-secondary">What each rank asks for and what it unlocks.</p>
      </header>

      <div className="p-5 sm:p-6 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-5">
        {/* Desktop: a vertical list with a sliding highlight. */}
        <div role="tablist" aria-label="Ranks" aria-orientation="vertical" className="hidden lg:flex lg:flex-col lg:gap-1">
          {ladder.map((t, i) => {
            const active = t.tier === selected
            const status = rankStatus(ladder, t.tier, currentTier)
            return (
              <button
                key={t.tier}
                type="button"
                role="tab"
                id={`ranks-tab-${t.tier}`}
                aria-selected={active}
                aria-controls="ranks-panel"
                onClick={() => go(i)}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
                  active ? 'text-text-primary' : 'text-text-secondary hover:bg-white/[0.03] hover:text-text-primary',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="ranks-list-pill"
                    aria-hidden
                    className="absolute inset-0 rounded-lg bg-white/[0.07]"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <TierIcon tier={t.tier} size={24} decorative className="relative" />
                <span className="relative min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">{t.display_name}</span>
                  <span className="block text-[12px] text-text-tertiary">{discountLabel(t.discount_pts)}</span>
                </span>
                {isSeller && (status === 'current' || status === 'reached') && (
                  <StatusPill status={status} className="relative h-5 px-1.5 text-[11px]" />
                )}
              </button>
            )
          })}
        </div>

        {/* Phones / tablets: the tab bar, then swipe the card. */}
        <div className="mb-4 lg:hidden">
          <SegmentedTabs
            tabs={ladder.map((t) => ({
              id: t.tier,
              label: (
                <>
                  <TierIcon tier={t.tier} size={14} decorative />
                  {t.display_name}
                </>
              ),
            }))}
            value={selected}
            onChange={(id) => go(ladder.findIndex((t) => t.tier === id))}
            layoutId="ranks-tabs-pill"
            ariaLabel="Ranks"
            idPrefix="ranks-m"
          />
        </div>

        <div className="min-w-0">
          <div
            id="ranks-panel"
            role="tabpanel"
            aria-labelledby={`ranks-tab-${rank.tier}`}
            className="relative overflow-hidden rounded-lg bg-black/[0.14]"
          >
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={rank.tier}
                custom={dir}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -28 }}
                transition={{ duration: reduce ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                drag={reduce ? false : 'x'}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.16}
                dragDirectionLock
                onDragEnd={onDragEnd}
                className="touch-pan-y p-4 sm:p-5 lg:cursor-default"
              >
                <RankDetail
                  rank={rank}
                  status={rankStatus(ladder, rank.tier, currentTier)}
                  window={w}
                  isSeller={isSeller}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Phones: previous / next beside the swipe. */}
          <div className="mt-3 flex items-center justify-between lg:hidden">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.05] hover:text-text-primary disabled:opacity-0"
            >
              <CaretLeftIcon size={13} weight="bold" aria-hidden />
              {ladder[index - 1]?.display_name ?? ''}
            </button>
            <span className="text-[12px] tabular-nums text-text-tertiary">
              {index + 1} / {ladder.length}
            </span>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === ladder.length - 1}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.05] hover:text-text-primary disabled:opacity-0"
            >
              {ladder[index + 1]?.display_name ?? ''}
              <CaretRightIcon size={13} weight="bold" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function TiersClient({ ladder, isSeller, currentTier, eligibleTier, window: w, floorPct }: TiersClientProps) {
  const current = ladder.find((t) => t.tier === currentTier) ?? ladder[0]
  const next = isSeller ? nextRank(ladder, current.tier) : null
  const pending = isSeller ? pendingUpgrade(ladder, current.tier, eligibleTier) : null
  const nextRows = useMemo(() => (next ? requirementsFor(next, w) : []), [next, w])
  const met = nextRows.filter((r) => r.met).length

  // The switcher opens on the rank you are working toward.
  const [selected, setSelected] = useState(next?.tier ?? current.tier)
  const allRanksRef = useRef<HTMLElement>(null)
  const openRank = (tier: string) => {
    setSelected(tier)
    allRanksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <AccountPage>
      <AccountPageHeader
        title="Seller Tiers"
        subtitle="Sell more over any 90 days to move up. Each rank takes points off your category rate."
      />
      <RevealGroup className="mt-5 space-y-4">
        <RevealItem>
          <RankHero
            ladder={ladder}
            current={current}
            next={next}
            isSeller={isSeller}
            pending={pending}
            met={met}
            total={nextRows.length}
            selected={selected}
            onSelect={openRank}
          />
        </RevealItem>
        <div className="grid gap-4 lg:grid-cols-2">
          <RevealItem>
            <ProgressCard next={next} window={w} isSeller={isSeller} />
          </RevealItem>
          <RevealItem>
            <HowRanksWork floorPct={floorPct} />
          </RevealItem>
        </div>
        <RevealItem>
          <AllRanks
            ladder={ladder}
            currentTier={current.tier}
            selected={selected}
            onSelect={setSelected}
            window={w}
            isSeller={isSeller}
            sectionRef={allRanksRef}
          />
        </RevealItem>
      </RevealGroup>
    </AccountPage>
  )
}
