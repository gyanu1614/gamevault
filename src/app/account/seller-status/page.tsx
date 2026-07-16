/**
 * Seller Application Status Page
 *
 * Shows the current status of the user's seller application:
 * - Pending: Waiting for admin review
 * - Under Review: Admin is reviewing the application
 * - Approved: Application accepted, seller account active
 * - Rejected: Application denied with tiered cooldown (7d/30d/90d/permanent)
 * - Withdrawn: User withdrew their application
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import {
  getApplicationStatus,
  withdrawApplication,
  type ApplicationStatusResult,
} from '@/lib/actions/seller-application-status'
import {
  getRejectionCategoryLabel,
  getCooldownLabel,
} from '@/lib/utils/seller-application'
import CountdownTimer from '@/components/seller/CountdownTimer'
import ApplicationTimeline from '@/components/seller/ApplicationTimeline'
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  FileText,
  Trash2,
  Ban,
  RefreshCcw,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

export default function ApplicationStatusPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  // Beta C — use-auth opens a realtime channel that updates
  // user.sellerApplicationStatus the instant an admin acts. We key the fetch
  // effect off it so the status card + timeline re-render without a refresh.
  const liveStatus = user?.sellerApplicationStatus ?? null
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatusResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [cooldownExpired, setCooldownExpired] = useState(false)

  useEffect(() => {
    async function fetchStatus() {
      if (authLoading) return

      if (!user) {
        router.push('/login?redirect=/account/seller-status')
        return
      }

      try {
        const result = await getApplicationStatus()

        if (result.success && result.data) {
          setApplicationStatus(result.data)
        } else {
          setError(result.error || 'Failed to fetch application status')
        }
      } catch (err) {
        console.error('Error fetching application status:', err)
        setError('An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    // liveStatus is included so a realtime status change (approval, info
    // request, rejection) re-pulls the full record without a manual refresh.
  }, [user, authLoading, router, liveStatus])

  // Handle application withdrawal
  const handleWithdraw = async () => {
    setIsWithdrawing(true)
    try {
      const result = await withdrawApplication()

      if (result.success) {
        toast.success('Application withdrawn successfully')

        // Show spam warning if flagged
        if (result.data?.flagged_for_spam) {
          toast.warning('Multiple withdrawals detected. Please submit a complete application.')
        }

        // Redirect to seller register page after a delay
        setTimeout(() => {
          router.push('/account/become-seller')
        }, 1500)
      } else {
        toast.error(result.error || 'Failed to withdraw application')
        setShowWithdrawModal(false)
      }
    } catch (err) {
      console.error('Error withdrawing application:', err)
      toast.error('An unexpected error occurred')
      setShowWithdrawModal(false)
    } finally {
      setIsWithdrawing(false)
    }
  }

  // Handle countdown completion
  const handleCountdownComplete = () => {
    setCooldownExpired(true)
    toast.success('Cooldown period expired! You can now reapply.')
  }

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-sm text-text-secondary">Loading application status...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-error" />
          <p className="mt-4 text-lg text-white">Error</p>
          <p className="mt-2 text-sm text-text-secondary">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 rounded-lg bg-primary/10 px-6 py-2 text-sm font-medium text-primary hover:bg-primary/20"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  // No application found
  if (!applicationStatus || applicationStatus.status === 'none') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-text-tertiary" />
          <p className="mt-4 text-lg text-white">No Application Found</p>
          <p className="mt-2 text-sm text-text-secondary">
            You haven&apos;t submitted a seller application yet.
          </p>
          <button
            onClick={() => router.push('/account/become-seller')}
            className="mt-6 rounded-lg bg-primary/10 px-6 py-2 text-sm font-medium text-primary hover:bg-primary/20"
          >
            Start Application
          </button>
        </div>
      </div>
    )
  }

  const { status, canReapply, rejection, withdrawal, application } = applicationStatus

  // Status badge component
  const StatusBadge = () => {
    const badges: Record<string, { icon: any; text: string; color: string }> = {
      pending: {
        icon: Clock,
        text: 'Pending Review',
        color: 'text-warning bg-warning-bg border-[rgba(251,191,36,0.25)]',
      },
      under_review: {
        icon: Clock,
        text: 'Under Review',
        color: 'text-lime-text bg-lime/10 border-lime-tint-border',
      },
      info_requested: {
        icon: Info,
        text: 'Information Requested',
        color: 'text-warning bg-warning-bg border-[rgba(251,191,36,0.25)]',
      },
      approved: {
        icon: CheckCircle2,
        text: 'Approved',
        color: 'text-success bg-success-bg border-[rgba(74,222,128,0.25)]',
      },
      rejected: {
        icon: XCircle,
        text: 'Rejected',
        color: 'text-error bg-error-bg border-error/40',
      },
      withdrawn: {
        icon: Ban,
        text: 'Withdrawn',
        color: 'text-text-secondary bg-white/[0.06] border-border-default',
      },
    }

    const badge = badges[status] || badges.pending
    const Icon = badge.icon

    return (
      <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 ${badge.color}`}>
        <Icon className="h-5 w-5" />
        <span className="font-medium">{badge.text}</span>
      </div>
    )
  }

  // Status message component with three scenarios
  const StatusMessage = () => {
    // Scenario 1: Withdrawn - Direct to /account/become-seller
    if (status === 'withdrawn') {
      return (
        <div className="rounded-lg border border-white/5 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Application Withdrawn</h3>
          <p className="mt-2 text-sm text-text-secondary">
            You have withdrawn your seller application. You can submit a new application anytime.
          </p>

          {withdrawal && withdrawal.withdrawalCount >= 3 && (
            <div className="mt-4 rounded-lg bg-warning-bg p-4 border border-[rgba(251,191,36,0.25)]">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-warning mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-warning">Multiple Withdrawals Detected</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    You have withdrawn {withdrawal.withdrawalCount} applications. Please ensure your next application is complete to avoid delays.
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => router.push('/account/become-seller')}
            className="mt-4 rounded-lg bg-primary/10 px-6 py-2 text-sm font-medium text-primary hover:bg-primary/20"
          >
            Start New Application
          </button>
        </div>
      )
    }

    // Scenario 2: Approved - Direct to /account/dashboard
    if (status === 'approved') {
      return (
        <div className="rounded-lg border border-white/5 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">🎉 Congratulations! You are now a seller</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Your application has been approved. You can now start listing your products and services on DropMarket.
          </p>

          <button
            onClick={() => router.push('/account/dashboard')}
            className="mt-4 rounded-lg bg-success-bg px-6 py-2 text-sm font-medium text-success hover:bg-success-bg"
          >
            Go to Dashboard
          </button>
        </div>
      )
    }

    // Scenario 3: Rejected - Show countdown timer + rejection details
    if (status === 'rejected' && rejection) {
      return (
        <div className="space-y-6">
          {/* Rejection Details */}
          <div className="rounded-lg border border-error/40 bg-red-500/5 p-6">
            <h3 className="text-lg font-semibold text-white">Application Not Approved</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Unfortunately, we were unable to approve your application at this time.
            </p>

            {/* Rejection Reason */}
            <div className="mt-4 rounded-lg bg-error-bg p-4 border border-error/40">
              <p className="text-sm font-medium text-error">Rejection Reason:</p>
              <p className="mt-1 text-sm text-text-secondary">{rejection.reason}</p>

              {rejection.category && (
                <p className="mt-2 text-xs text-text-secondary">
                  Category: {getRejectionCategoryLabel(rejection.category)}
                </p>
              )}
            </div>

            {/* Rejection Count & Tier Info */}
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-bg p-4 border border-[rgba(251,191,36,0.25)]">
              <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning">
                  {rejection.isPermanentBan ? 'Permanent Ban' : `Rejection ${rejection.rejectionCount} of 3`}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {rejection.isPermanentBan
                    ? 'You have exceeded the maximum number of rejections. Please contact support to appeal.'
                    : `Cooldown period: ${getCooldownLabel(rejection.rejectionCount - 1)}`}
                </p>
              </div>
            </div>
          </div>

          {/* Countdown Timer or Permanent Ban Message */}
          {rejection.isPermanentBan ? (
            <div className="rounded-lg border border-error/40 bg-red-500/5 p-6">
              <div className="flex items-start gap-3">
                <Ban className="h-6 w-6 text-error" />
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-white">Account Permanently Restricted</h4>
                  <p className="mt-2 text-sm text-text-secondary">
                    You have been permanently restricted from becoming a seller due to multiple application rejections.
                    If you believe this is a mistake, please contact our support team with your application reference number.
                  </p>
                  <button
                    onClick={() => router.push('/support')}
                    className="mt-4 rounded-lg bg-primary/10 px-6 py-2 text-sm font-medium text-primary hover:bg-primary/20"
                  >
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
          ) : rejection.canReapplyAt ? (
            <div className="rounded-lg border border-white/5 bg-white/5 p-6">
              <CountdownTimer
                targetDate={rejection.canReapplyAt}
                onComplete={handleCountdownComplete}
              />

              {/* Reverify Button */}
              <button
                onClick={() => router.push('/account/become-seller')}
                disabled={!cooldownExpired && !canReapply}
                className={`mt-6 w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors ${
                  cooldownExpired || canReapply
                    ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                    : 'bg-white/[0.06] text-text-tertiary cursor-not-allowed border border-border-default'
                }`}
              >
                <RefreshCcw className="h-4 w-4" />
                {cooldownExpired || canReapply ? 'Reapply Now' : 'Reverify (Disabled During Cooldown)'}
              </button>
            </div>
          ) : null}
        </div>
      )
    }

    // Scenario 4: Information Requested — surface the admin's message + a CTA
    // back into the application to supply the missing details.
    if (status === 'info_requested') {
      return (
        <div className="rounded-lg border border-[rgba(251,191,36,0.25)] bg-warning-bg p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">We Need More Information</h3>
              <p className="mt-2 text-sm text-text-secondary">
                Our review team asked for some additional details before they can
                continue. Please review their message and update your application.
              </p>
              {application?.admin_notes && (
                <div className="mt-4 rounded-lg border border-border-subtle bg-white/[0.03] p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
                    Message From Our Team
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">
                    {application.admin_notes}
                  </p>
                </div>
              )}
              <button
                onClick={() => router.push('/account/become-seller')}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-6 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <RefreshCcw className="h-4 w-4" />
                Update Application
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Default: Pending/Under Review
    const messages: Record<string, { title: string; description: string }> = {
      pending: {
        title: 'Your application is in the queue',
        description:
          'Our team will review your application within 2-3 business days. You will receive an email once the review begins.',
      },
      under_review: {
        title: 'Your application is being reviewed',
        description:
          'One of our team members is currently reviewing your application and documents. This typically takes 24-48 hours.',
      },
    }

    const message = messages[status] || messages.pending

    return (
      <div className="rounded-lg border border-white/5 bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white">{message.title}</h3>
        <p className="mt-2 text-sm text-text-secondary">{message.description}</p>

        {/* Withdraw button for pending/under_review */}
        {(status === 'pending' || status === 'under_review') && (
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="mt-4 flex items-center gap-2 rounded-lg border border-error/40 bg-error-bg px-6 py-2 text-sm font-medium text-error hover:bg-error-bg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Withdraw Application
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-black/95 to-black/90" />
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-border-subtle bg-[rgba(10,10,15,0.5)] backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <button
              onClick={() => router.push('/')}
              className="mb-4 flex items-center gap-2 text-sm text-text-secondary hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </button>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Application Status</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Track the progress of your seller application
            </p>
          </div>
        </div>

        {/* Status Content */}
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          {/* Status Badge */}
          <div className="mb-8 text-center">
            <StatusBadge />
          </div>

          {/* Status Message (Three Scenarios) */}
          <StatusMessage />

          {/* Timeline — extracted to a design-system component (Beta C). */}
          <div className="mt-8">
            <ApplicationTimeline
              status={status}
              createdAt={application?.created_at}
              submittedAt={application?.submitted_at}
              reviewedAt={application?.reviewed_at}
              withdrawnAt={withdrawal?.withdrawnAt}
              rejectedAt={rejection?.rejectedAt}
            />
          </div>

          {/* Application ID */}
          <div className="mt-8 rounded-lg border border-white/5 bg-white/5 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">Application Reference</h4>
                <p className="mt-1 font-mono text-sm text-text-secondary">{application?.id || 'N/A'}</p>
                <p className="mt-3 text-xs leading-relaxed text-text-secondary">
                  Use this reference number when contacting our support team for inquiries regarding your application status or any assistance you may need.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Withdraw Confirmation Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => !isWithdrawing && setShowWithdrawModal(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border-default bg-[rgba(10,10,15,0.95)] backdrop-blur-2xl p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-bg">
              <AlertCircle className="h-6 w-6 text-error" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Withdraw Application?</h3>
            <p className="text-sm text-text-secondary mb-6">
              Are you sure you want to withdraw your seller application? This action cannot be undone, but you can submit a new application anytime.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawModal(false)}
                disabled={isWithdrawing}
                className="flex-1 rounded-lg border border-white/10 bg-bg-overlay px-4 py-2.5 text-sm font-medium text-white hover:bg-bg-overlay disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={isWithdrawing}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-error-bg border border-error/40 px-4 py-2.5 text-sm font-medium text-error hover:bg-error-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isWithdrawing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Withdrawing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Withdraw
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
