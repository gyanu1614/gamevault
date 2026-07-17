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
} from 'lucide-react'
import { toast } from 'sonner'
import CountdownTimer from '@/components/seller/CountdownTimer'
import {
  getRejectionCategoryLabel,
  getCooldownLabel,
} from '@/lib/utils/seller-application'
import type { ApplicationStatusResult } from '@/lib/actions/seller-application-status'
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
    title: 'Your application is in the queue',
    sub: 'Our team reviews applications within 2–3 business days. We’ll email you the moment the review begins.',
  },
  under_review: {
    title: 'Your application is being reviewed',
    sub: 'A member of our team is reviewing your details and documents right now. This typically takes 24–48 hours.',
  },
  info_requested: {
    title: 'We need a little more from you',
    sub: 'Our review team asked for additional details before they can continue.',
  },
  approved: {
    title: 'Congratulations — you’re a seller!',
    sub: 'Your application has been approved. Set up your first listing and start selling on DropMarket.',
  },
  rejected: {
    title: 'We couldn’t approve this application',
    sub: 'See the reason below — in most cases you can reapply after a short cooldown.',
  },
  withdrawn: {
    title: 'Application withdrawn',
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
}: StatusViewProps) {
  const { status, canReapply, rejection, withdrawal, application } = data
  const chip = CHIP[status] ?? CHIP.pending
  const head = HEADLINE[status] ?? HEADLINE.pending
  const ChipIcon = chip.icon

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

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-16 pt-7 sm:px-6">
        {/* Floating brand + back — no navbar on this page */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => onNavigate('/')}
            className="-my-2 flex min-h-[44px] items-center gap-2.5 py-2"
            aria-label="DropMarket home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-mark-white.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="text-base font-bold tracking-tight text-white">
              Drop<span className="text-white/70">Market</span>
            </span>
          </button>
          <button
            onClick={() => onNavigate('/')}
            className="-m-3 flex min-h-[44px] items-center gap-2 rounded-lg p-3 text-sm text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back To Home
          </button>
        </div>
        <div className="animate-fade-in mt-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Application Status<span style={{ color: P.lime }}>.</span>
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Track the progress of your seller application
          </p>
        </div>

        {/* THE card */}
        <div
          className="animate-fade-up mt-8 overflow-hidden rounded-2xl shadow-2xl"
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

          <div className="px-6 py-7 sm:px-8">
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
              className="mt-5 text-center text-xl font-semibold sm:text-2xl"
              style={{ color: P.forest, textWrap: 'balance' }}
            >
              {head.title}
            </h2>
            <p
              className="mx-auto mt-2 max-w-md text-center text-sm leading-relaxed"
              style={{ color: P.ink2 }}
            >
              {head.sub}
            </p>

            {/* ── Status-specific content ── */}
            {status === 'info_requested' && application?.admin_notes && (
              <div
                className="mt-6 rounded-xl border p-4"
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
              <div className="mt-6 space-y-3">
                <div
                  className="rounded-xl border p-4"
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
                  className="rounded-xl border p-4"
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
                  <div className="rounded-xl p-4" style={{ backgroundColor: P.forest3 }}>
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
                className="mt-6 rounded-xl border p-4"
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
            <div className="mt-7 border-t pt-6" style={{ borderColor: P.line }}>
              <Timeline data={data} />
            </div>

            {/* ── Reference ── */}
            {application?.id && (
              <div
                className="mt-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
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
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
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
    </div>
  )
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
