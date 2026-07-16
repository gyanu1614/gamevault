'use client'

import { CheckCircle2, Clock, XCircle, Ban, Info, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Beta C — Seller application timeline.
 *
 * Rectangular, design-system timeline (rounded-lg card, grey connector, lime
 * for the single active step only, success/error tints for terminal states).
 * Replaces the ~130 lines of hand-rolled step divs that previously lived
 * inline in the status page.
 *
 * Steps are derived from the normalized application row + status, so the same
 * component renders every path: submitted → under review → approved, plus the
 * Info Requested / Withdrawn / Rejected terminal nodes.
 */

type ApplicationStatus =
  | 'pending'
  | 'under_review'
  | 'info_requested'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'none'

type StepState = 'done' | 'active' | 'upcoming' | 'error' | 'neutral'

interface TimelineStep {
  key: string
  label: string
  timestamp?: string | null
  hint?: string
  state: StepState
  icon: React.ComponentType<{ className?: string }>
}

interface ApplicationTimelineProps {
  status: ApplicationStatus
  createdAt?: string | null
  submittedAt?: string | null
  reviewedAt?: string | null
  withdrawnAt?: string | null
  rejectedAt?: string | null
}

function fmt(ts?: string | null): string | null {
  if (!ts) return null
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return null
  }
}

function buildSteps(props: ApplicationTimelineProps): TimelineStep[] {
  const { status, createdAt, submittedAt, reviewedAt, withdrawnAt, rejectedAt } = props
  const steps: TimelineStep[] = []

  // Step 1 — Application Started (always done once a row exists)
  steps.push({
    key: 'started',
    label: 'Application Started',
    timestamp: createdAt,
    state: 'done',
    icon: CheckCircle2,
  })

  // Step 2 — Submitted
  if (submittedAt) {
    steps.push({
      key: 'submitted',
      label: 'Application Submitted',
      timestamp: submittedAt,
      state: 'done',
      icon: CheckCircle2,
    })
  }

  const isTerminal =
    status === 'approved' || status === 'rejected' || status === 'withdrawn'

  // Step 3 — Review In Progress
  const reviewActive = status === 'under_review' || status === 'info_requested'
  steps.push({
    key: 'review',
    label: 'Review In Progress',
    timestamp: reviewedAt,
    hint:
      status === 'under_review'
        ? 'Our team is reviewing your application'
        : status === 'info_requested'
          ? undefined
          : !reviewedAt && !isTerminal
            ? 'Waiting for review'
            : undefined,
    state: reviewActive ? 'active' : reviewedAt || isTerminal ? 'done' : 'upcoming',
    icon: reviewActive ? Clock : reviewedAt || isTerminal ? CheckCircle2 : Circle,
  })

  // Step 3b — Info Requested (active branch node)
  if (status === 'info_requested') {
    steps.push({
      key: 'info_requested',
      label: 'Information Requested',
      hint: 'We need a few more details to continue',
      state: 'active',
      icon: Info,
    })
  }

  // Terminal nodes
  if (status === 'withdrawn') {
    steps.push({
      key: 'withdrawn',
      label: 'Application Withdrawn',
      timestamp: withdrawnAt,
      state: 'neutral',
      icon: Ban,
    })
  } else if (status === 'rejected') {
    steps.push({
      key: 'rejected',
      label: 'Application Rejected',
      timestamp: rejectedAt,
      state: 'error',
      icon: XCircle,
    })
  } else if (status === 'approved') {
    steps.push({
      key: 'approved',
      label: 'Application Approved',
      timestamp: reviewedAt,
      state: 'done',
      icon: CheckCircle2,
    })
  }

  return steps
}

const NODE_STYLES: Record<StepState, string> = {
  done: 'bg-success-bg text-success',
  active: 'bg-lime/15 text-lime-text',
  error: 'bg-error-bg text-error',
  neutral: 'bg-white/[0.06] text-text-secondary',
  upcoming: 'bg-white/5 text-text-tertiary',
}

export default function ApplicationTimeline(props: ApplicationTimelineProps) {
  const steps = buildSteps(props)

  return (
    <div className="rounded-lg border border-border-subtle bg-white/[0.03] p-6">
      <h3 className="text-lg font-semibold text-white">Timeline</h3>
      <ol className="mt-6 space-y-6">
        {steps.map((step, i) => {
          const Icon = step.icon
          const isLast = i === steps.length - 1
          const time = fmt(step.timestamp)
          return (
            <li key={step.key} className="relative flex items-start gap-4">
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-4 top-9 h-[calc(100%-4px)] w-px bg-white/10"
                />
              )}
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-4 ring-bg-base',
                  NODE_STYLES[step.state],
                )}
              >
                {step.state === 'upcoming' ? (
                  <span className="h-2 w-2 rounded-full bg-text-disabled" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 pb-1">
                <p
                  className={cn(
                    'text-sm font-medium',
                    step.state === 'upcoming' ? 'text-text-tertiary' : 'text-white',
                  )}
                >
                  {step.label}
                </p>
                {time && <p className="mt-0.5 text-xs text-text-secondary">{time}</p>}
                {step.hint && (
                  <p className="mt-0.5 text-xs text-text-tertiary">{step.hint}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
