/**
 * StatusView — the PRESENTATIONAL seller-application status page (Forest
 * Ledger world): a full-bleed sell-hero photo under a forest scrim, a floating
 * white title, and ONE centered light card holding everything — the
 * ?submitted=1 "Application Received" banner, the status chip, the
 * status-specific content, a custom-icon timeline, the application reference,
 * and the contextual actions. The logic page (page.tsx) feeds it data; the
 * dev preview (/dev/seller-status-preview) feeds it mocks.
 */

'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Ban,
  RefreshCcw,
  Info,
  Copy,
  FileText,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import CountdownTimer from '@/components/seller/CountdownTimer'
import {
  getRejectionCategoryLabel,
  getCooldownLabel,
} from '@/lib/utils/seller-application'
import type { ApplicationStatusResult } from '@/lib/actions/seller-application-status'
import type { HqUser } from '@/lib/founding/hq-data'
import HqProfileChip from '@/app/founding/_components/HqProfileChip'
import { IconSubmitted, IconReview, IconDecision } from './StatusIcons'
import TeamMessages from './TeamMessages'

/* Forest Ledger palette (kept local — this page is deliberately light). */
const P = {
  ivory: '#FAFAF7',
  paper: '#FFFFFF',
  forest: '#14432A',
  forest2: '#1B5E3A',
  forest3: '#0F3320',
  lime: '#A3E635',
  ink: '#1A1D19',
  ink2: '#5B6157',
  line: '#E4E5DE',
  red: '#B42318',
  redBg: '#FEF2F1',
  amber: '#92400E',
  amberBg: '#FEF3C7',
}

export interface StatusViewProps {
  data: ApplicationStatusResult
  /** Show the post-submit "Application Received" banner. */
  justSubmitted: boolean
  cooldownExpired: boolean
  isWithdrawing: boolean
  showWithdrawModal: boolean
  onShowWithdraw: (open: boolean) => void
  onWithdraw: () => void
  onCountdownComplete: () => void
  onNavigate: (path: string) => void
  /**
   * Signed-in viewer for the top-right profile dropdown (same chip as the
   * Founding HQ). Null when the user record isn't resolvable — the chip is
   * simply omitted in that case.
   */
  hqUser: HqUser | null
}

const CHIP: Record<string, { icon: typeof Clock; text: string; fg: string; bg: string }> = {
  pending: { icon: Clock, text: 'Pending Review', fg: P.amber, bg: P.amberBg },
  under_review: { icon: Loader2, text: 'Under Review', fg: P.forest2, bg: 'rgba(20,67,42,0.08)' },
  info_requested: { icon: Info, text: 'Information Requested', fg: P.amber, bg: P.amberBg },
  approved: { icon: CheckCircle2, text: 'Approved', fg: P.forest2, bg: 'rgba(163,230,53,0.25)' },
  rejected: { icon: XCircle, text: 'Not Approved', fg: P.red, bg: P.redBg },
  withdrawn: { icon: Ban, text: 'Withdrawn', fg: P.ink2, bg: 'rgba(20,67,42,0.06)' },
}

const HEADLINE: Record<string, { title: string; sub: string }> = {
  pending: {
    title: 'Your Application Is In The Queue',
    sub: 'Our team reviews applications within 2–3 business days. We’ll email you the moment the review begins.',
  },
  under_review: {
    title: 'Your Application Is Being Reviewed',
    sub: 'A member of our team is reviewing your details and documents right now. This typically takes 24–48 hours.',
  },
  info_requested: {
    title: 'We Need A Little More From You',
    sub: 'Our review team asked for additional details before they can continue.',
  },
  approved: {
    title: 'Congratulations — You’re A Seller!',
    sub: 'Your application has been approved. Set up your first listing and start selling on DropMarket.',
  },
  rejected: {
    title: 'We Couldn’t Approve This Application',
    sub: 'See the reason below — in most cases you can reapply after a short cooldown.',
  },
  withdrawn: {
    title: 'Application Withdrawn',
    sub: 'You withdrew this application. You can start a new one whenever you’re ready.',
  },
}

export default function StatusView({
  data,
  justSubmitted,
  cooldownExpired,
  isWithdrawing,
  showWithdrawModal,
  onShowWithdraw,
  onWithdraw,
  onCountdownComplete,
  onNavigate,
  hqUser,
}: StatusViewProps) {
  const { status, canReapply, rejection, withdrawal, application } = data
  const chip = CHIP[status] ?? CHIP.pending
  const head = HEADLINE[status] ?? HEADLINE.pending
  const ChipIcon = chip.icon

  const [showSummary, setShowSummary] = useState(false)

  const copyReference = () => {
    if (application?.id) {
      navigator.clipboard?.writeText(application.id)
      toast.success('Reference copied')
    }
  }

  return (
    <div className="relative min-h-screen">
      <TeamMessages />
      {/* Backdrop photo + scrim (subtle, fades toward the bottom) */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/assets/heroes/sell.avif"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(15,51,32,0.92) 0%, rgba(15,51,32,0.82) 45%, rgba(15,51,32,0.9) 100%)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 pb-6 pt-4 sm:px-6 sm:pt-5">
        {/* Floating brand + profile — no navbar on this page. Logo (links home)
            top-left with a secondary "Back To Home" link beneath it; the shared
            HQ profile dropdown sits top-right. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => onNavigate('/')}
              className="-my-1 flex min-h-[36px] items-center gap-2.5 py-1"
              aria-label="DropMarket home"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-mark-white.png"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
              <span className="text-[15px] font-bold tracking-tight text-white">
                Drop<span className="text-white/70">Market</span>
              </span>
            </button>
            <button
              onClick={() => onNavigate('/')}
              className="-m-1.5 flex w-fit items-center gap-1.5 rounded-lg p-1.5 text-xs text-white/55 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back To Home
            </button>
          </div>
          {hqUser && <HqProfileChip user={hqUser} />}
        </div>

        {/* Everything below is vertically centered in the remaining viewport so
            the card + header fill one screen without scrolling on desktop. */}
        <div className="flex flex-1 flex-col justify-center py-4">
          <div className="animate-fade-in text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Application Status<span style={{ color: P.lime }}>.</span>
            </h1>
            <p className="mt-1.5 text-sm text-white/60">
              Track the progress of your seller application
            </p>
          </div>

          {/* THE card */}
          <div
            className="animate-fade-up mt-4 overflow-hidden rounded-2xl shadow-2xl sm:mt-5"
            style={{ backgroundColor: P.paper }}
          >
          {/* Post-submit banner */}
          {justSubmitted && (
            <div
              className="flex items-start gap-3 px-6 py-4 sm:px-8"
              style={{ backgroundColor: 'rgba(163,230,53,0.22)' }}
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: P.forest2 }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: P.forest }}>
                  Application Received
                </p>
                <p className="mt-0.5 text-xs" style={{ color: P.ink2 }}>
                  A confirmation email is on its way to your inbox.
                </p>
              </div>
            </div>
          )}

          <div className="px-6 py-5 sm:px-8 sm:py-6">
            {/* Status chip */}
            <div className="flex justify-center">
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
                style={{ color: chip.fg, backgroundColor: chip.bg }}
              >
                <ChipIcon
                  className={`h-4 w-4 ${status === 'under_review' ? 'animate-spin' : ''}`}
                />
                {chip.text}
              </span>
            </div>

            {/* Headline */}
            <h2
              className="mt-4 text-center text-xl font-semibold sm:text-2xl"
              style={{ color: P.forest, textWrap: 'balance' }}
            >
              {head.title}
            </h2>
            <p
              className="mx-auto mt-1.5 max-w-md text-center text-sm leading-relaxed"
              style={{ color: P.ink2 }}
            >
              {head.sub}
            </p>

            {/* ── Status-specific content ── */}
            {status === 'info_requested' && application?.admin_notes && (
              <div
                className="mt-4 rounded-xl border p-4"
                style={{ borderColor: '#F1DCA7', backgroundColor: P.amberBg }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: P.amber }}>
                  Message From Our Team
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: P.ink }}>
                  {application.admin_notes}
                </p>
              </div>
            )}

            {status === 'rejected' && rejection && (
              <div className="mt-4 space-y-2.5">
                <div
                  className="rounded-xl border p-3.5"
                  style={{ borderColor: '#F4CDC7', backgroundColor: P.redBg }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: P.red }}>
                    Reason
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: P.ink }}>
                    {rejection.reason}
                  </p>
                  {rejection.category && (
                    <p className="mt-2 text-xs" style={{ color: P.ink2 }}>
                      Category: {getRejectionCategoryLabel(rejection.category)}
                    </p>
                  )}
                </div>
                <div
                  className="rounded-xl border p-3.5"
                  style={{ borderColor: '#F1DCA7', backgroundColor: P.amberBg }}
                >
                  <p className="text-sm font-semibold" style={{ color: P.amber }}>
                    {rejection.isPermanentBan
                      ? 'Account Permanently Restricted'
                      : `Rejection ${rejection.rejectionCount} of 3`}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: P.ink2 }}>
                    {rejection.isPermanentBan
                      ? 'You’ve exceeded the maximum number of rejections. Contact support with your reference below to appeal.'
                      : `Cooldown before reapplying: ${getCooldownLabel(rejection.rejectionCount - 1)}`}
                  </p>
                </div>
                {!rejection.isPermanentBan && rejection.canReapplyAt && (
                  <div className="rounded-xl p-3.5" style={{ backgroundColor: P.forest3 }}>
                    <CountdownTimer
                      targetDate={rejection.canReapplyAt}
                      onComplete={onCountdownComplete}
                    />
                  </div>
                )}
              </div>
            )}

            {status === 'withdrawn' && withdrawal && withdrawal.withdrawalCount >= 3 && (
              <div
                className="mt-4 rounded-xl border p-3.5"
                style={{ borderColor: '#F1DCA7', backgroundColor: P.amberBg }}
              >
                <p className="text-sm font-semibold" style={{ color: P.amber }}>
                  Multiple Withdrawals Detected
                </p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: P.ink2 }}>
                  You’ve withdrawn {withdrawal.withdrawalCount} applications. Make sure your
                  next one is complete to avoid delays.
                </p>
              </div>
            )}

            {/* ── Timeline ── */}
            <div className="mt-4 border-t pt-4" style={{ borderColor: P.line }}>
              <Timeline data={data} />
            </div>

            {/* ── Reference ── */}
            {application?.id && (
              <div
                className="mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5"
                style={{ borderColor: P.line, backgroundColor: P.ivory }}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: P.ink2 }}>
                    Application Reference
                  </p>
                  <p className="truncate font-mono text-xs" style={{ color: P.ink }}>
                    {application.id}
                  </p>
                </div>
                <button
                  onClick={copyReference}
                  aria-label="Copy reference"
                  className="-m-1.5 shrink-0 rounded-lg p-3.5 transition-colors hover:bg-black/5"
                  style={{ color: P.forest2 }}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* ── Actions ── */}
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:justify-center">
              {status === 'approved' && (
                <PrimaryButton onClick={() => onNavigate('/account/dashboard')}>
                  Go To Seller Dashboard
                </PrimaryButton>
              )}
              {status === 'withdrawn' && (
                <PrimaryButton onClick={() => onNavigate('/account/become-seller')}>
                  Start New Application
                </PrimaryButton>
              )}
              {status === 'info_requested' && (
                <PrimaryButton onClick={() => onNavigate('/account/become-seller')}>
                  <RefreshCcw className="h-4 w-4" />
                  Update Application
                </PrimaryButton>
              )}
              {status === 'rejected' && rejection && !rejection.isPermanentBan && (
                <PrimaryButton
                  disabled={!cooldownExpired && !canReapply}
                  onClick={() => onNavigate('/account/become-seller')}
                >
                  <RefreshCcw className="h-4 w-4" />
                  {cooldownExpired || canReapply ? 'Reapply Now' : 'Reapply After Cooldown'}
                </PrimaryButton>
              )}
              {status === 'rejected' && rejection?.isPermanentBan && (
                <a
                  href="mailto:support@dropmarket.gg"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: P.forest }}
                >
                  Contact Support
                </a>
              )}

              {/* Application Summary — available for any real application so the
                  seller can review exactly what they submitted. */}
              {application && (
                <button
                  onClick={() => setShowSummary(true)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-colors hover:bg-black/[0.03]"
                  style={{ borderColor: P.line, color: P.forest }}
                >
                  <FileText className="h-4 w-4" />
                  Application Summary
                </button>
              )}

              {(status === 'pending' || status === 'under_review') && (
                <button
                  onClick={() => onShowWithdraw(true)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-colors hover:bg-red-50"
                  style={{ borderColor: '#F4CDC7', color: P.red }}
                >
                  <Trash2 className="h-4 w-4" />
                  Withdraw Application
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Withdraw confirmation — light modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Cancel"
            className="animate-fade-in absolute inset-0 cursor-default"
            style={{ backgroundColor: 'rgba(15,51,32,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => !isWithdrawing && onShowWithdraw(false)}
          />
          <div
            className="animate-fade-up relative z-10 w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ backgroundColor: P.paper }}
          >
            <div
              className="mb-4 flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: P.redBg }}
            >
              <AlertCircle className="h-5 w-5" style={{ color: P.red }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: P.forest }}>
              Withdraw Application?
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: P.ink2 }}>
              This can’t be undone, but you can submit a new application anytime.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => onShowWithdraw(false)}
                disabled={isWithdrawing}
                className="min-h-[44px] flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors hover:bg-black/[0.03] disabled:opacity-50"
                style={{ borderColor: P.line, color: P.ink }}
              >
                Keep Application
              </button>
              <button
                onClick={onWithdraw}
                disabled={isWithdrawing}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: P.red }}
              >
                {isWithdrawing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Withdrawing…
                  </>
                ) : (
                  'Withdraw'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application summary — light modal, same Forest Ledger world */}
      {showSummary && application && (
        <SummaryModal
          data={data}
          onClose={() => setShowSummary(false)}
          onCopyReference={copyReference}
        />
      )}
    </div>
  )
}

/* ── Application summary modal ─────────────────────────────────────────────── */

function SummaryModal({
  data,
  onClose,
  onCopyReference,
}: {
  data: ApplicationStatusResult
  onClose: () => void
  onCopyReference: () => void
}) {
  const { status, application } = data
  const app = application as Record<string, any>

  const fmtDate = (d?: string | null) =>
    d
      ? new Date(d).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null

  const sellerType = (app?.seller_type as string) || null
  const shopOrDisplay =
    (app?.shop_name as string) || (app?.display_name as string) || null
  const displayName = (app?.display_name as string) || null

  // Games resolved server-side (UUID → name + icon); other_games stays free text.
  const resolvedGames = data.games ?? []
  const otherGames =
    typeof app?.other_games === 'string' && app.other_games.trim()
      ? app.other_games.trim()
      : null

  const VOLUME_LABELS: Record<string, string> = {
    under_500: 'Under $500 / Month',
    '500_2000': '$500 – $2,000 / Month',
    '2000_10000': '$2,000 – $10,000 / Month',
    over_10000: 'Over $10,000 / Month',
  }

  // Rows shown only when the value exists — never render empty placeholders.
  const rows: { label: string; value: React.ReactNode }[] = []
  if (sellerType)
    rows.push({ label: 'Seller Type', value: prettyLabel(sellerType) })
  if (displayName) rows.push({ label: 'Store Name', value: displayName })
  if (app?.country) rows.push({ label: 'Country', value: app.country as string })
  if (Array.isArray(app?.languages_spoken) && app.languages_spoken.length)
    rows.push({ label: 'Languages', value: (app.languages_spoken as string[]).join(', ') })
  if (resolvedGames.length)
    rows.push({
      label: 'Games',
      value: (
        <span className="flex flex-wrap gap-1.5">
          {resolvedGames.map((g) => (
            <span
              key={g.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium"
              style={{ borderColor: P.line, backgroundColor: P.ivory, color: P.ink }}
            >
              {g.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.image_url} alt="" className="h-4 w-4 rounded object-cover" />
              )}
              {g.name}
            </span>
          ))}
        </span>
      ),
    })
  if (otherGames) rows.push({ label: 'Other Games', value: otherGames })
  if (app?.expected_monthly_volume)
    rows.push({
      label: 'Monthly Volume',
      value:
        VOLUME_LABELS[app.expected_monthly_volume as string] ??
        prettyLabel(app.expected_monthly_volume as string),
    })
  if (typeof app?.selling_experience === 'string' && app.selling_experience.trim())
    rows.push({
      label: 'Experience',
      value:
        app.selling_experience.trim().length > 160
          ? `${app.selling_experience.trim().slice(0, 160)}…`
          : app.selling_experience.trim(),
    })
  const submitted = fmtDate(app?.submitted_at ?? app?.created_at)
  if (submitted) rows.push({ label: 'Submitted', value: submitted })
  const reviewed = fmtDate(app?.reviewed_at)
  if (reviewed) rows.push({ label: 'Reviewed', value: reviewed })
  rows.push({ label: 'Status', value: (CHIP[status] ?? CHIP.pending).text })

  const missingCore = !sellerType && !shopOrDisplay && !resolvedGames.length

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Application summary"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        aria-label="Close"
        className="animate-fade-in absolute inset-0 cursor-default"
        style={{ backgroundColor: 'rgba(15,51,32,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div
        className="animate-fade-up relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: P.paper }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 border-b px-6 py-4"
          style={{ borderColor: P.line }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(20,67,42,0.08)' }}
            >
              <FileText className="h-5 w-5" style={{ color: P.forest2 }} />
            </span>
            <div>
              <h3 className="text-base font-semibold" style={{ color: P.forest }}>
                Application Summary
              </h3>
              <p className="text-xs" style={{ color: P.ink2 }}>
                What you submitted to our review team
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-m-2 shrink-0 rounded-lg p-2 transition-colors hover:bg-black/5"
            style={{ color: P.ink2 }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4">
          <dl className="divide-y" style={{ borderColor: P.line }}>
            {rows.map((r) => (
              <div key={r.label} className="flex gap-4 py-2.5">
                <dt
                  className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: P.ink2 }}
                >
                  {r.label}
                </dt>
                <dd className="min-w-0 flex-1 text-sm" style={{ color: P.ink }}>
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>

          {missingCore && (
            <p className="mt-3 text-xs leading-relaxed" style={{ color: P.ink2 }}>
              Some details from this application aren’t available to display here.
              Use the reference below if you contact support.
            </p>
          )}

          {/* Reference */}
          {app?.id && (
            <div
              className="mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5"
              style={{ borderColor: P.line, backgroundColor: P.ivory }}
            >
              <div className="min-w-0">
                <p
                  className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: P.ink2 }}
                >
                  Application Reference
                </p>
                <p className="truncate font-mono text-xs" style={{ color: P.ink }}>
                  {app.id}
                </p>
              </div>
              <button
                onClick={onCopyReference}
                aria-label="Copy reference"
                className="-m-1.5 shrink-0 rounded-lg p-3 transition-colors hover:bg-black/5"
                style={{ color: P.forest2 }}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3" style={{ borderColor: P.line }}>
          <button
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: P.forest }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/** Turn a snake_case enum value into a Title Case label ("business" → "Business"). */
function prettyLabel(v: string): string {
  return v
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/* ── Timeline ─────────────────────────────────────────────────────────────── */

function Timeline({ data }: { data: ApplicationStatusResult }) {
  const { status, application, rejection, withdrawal } = data

  const fmt = (d?: string | null) =>
    d
      ? new Date(d).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null

  const decided = status === 'approved' || status === 'rejected' || status === 'withdrawn'
  const decisionDate =
    fmt(rejection?.rejectedAt) ?? fmt(withdrawal?.withdrawnAt) ?? fmt(application?.reviewed_at)
  const decisionLabel =
    status === 'approved' ? 'Approved' : status === 'rejected' ? 'Decision' : status === 'withdrawn' ? 'Withdrawn' : 'Decision'

  const steps = [
    {
      Icon: IconSubmitted,
      label: 'Submitted',
      date: fmt(application?.submitted_at ?? application?.created_at),
      state: 'done' as const,
    },
    {
      Icon: IconReview,
      label: 'In Review',
      date: fmt(application?.reviewed_at),
      state: (decided ? 'done' : status === 'under_review' ? 'current' : 'upcoming') as
        | 'done'
        | 'current'
        | 'upcoming',
    },
    {
      Icon: IconDecision,
      label: decisionLabel,
      date: decided ? decisionDate : null,
      state: (decided ? 'done' : 'upcoming') as 'done' | 'current' | 'upcoming',
    },
  ]

  return (
    <div className="flex items-start justify-between">
      {steps.map((s, i) => {
        const dim = s.state === 'upcoming'
        return (
          <div key={s.label} className="relative flex flex-1 flex-col items-center">
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[calc(50%+28px)] right-[calc(-50%+28px)] top-6 h-px"
                style={{
                  background: dim
                    ? P.line
                    : `linear-gradient(to right, ${P.line}, ${P.lime})`,
                }}
              />
            )}
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(160deg, rgba(20,67,42,0.07), rgba(20,67,42,0.035))',
                boxShadow: `inset 0 0 0 1px ${P.line}`,
                opacity: dim ? 0.45 : 1,
              }}
            >
              <s.Icon size={26} />
            </span>
            <p
              className="mt-2 text-xs font-semibold"
              style={{ color: dim ? P.ink2 : P.forest }}
            >
              {s.label}
            </p>
            {s.date && (
              <p className="mt-0.5 text-[11px]" style={{ color: P.ink2 }}>
                {s.date}
              </p>
            )}
            {s.state === 'current' && (
              <p className="mt-0.5 text-[11px] font-medium" style={{ color: P.forest2 }}>
                In progress
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Primary button ───────────────────────────────────────────────────────── */

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: P.forest }}
    >
      {children}
    </button>
  )
}
