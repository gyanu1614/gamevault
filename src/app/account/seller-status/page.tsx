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
  }, [user, authLoading, router])

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
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-sm text-gray-400">Loading application status...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-4 text-lg text-white">Error</p>
          <p className="mt-2 text-sm text-gray-400">{error}</p>
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
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-500" />
          <p className="mt-4 text-lg text-white">No Application Found</p>
          <p className="mt-2 text-sm text-gray-400">
            You haven't submitted a seller application yet.
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
        color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      },
      under_review: {
        icon: Clock,
        text: 'Under Review',
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      },
      approved: {
        icon: CheckCircle2,
        text: 'Approved',
        color: 'text-green-400 bg-green-500/10 border-green-500/20',
      },
      rejected: {
        icon: XCircle,
        text: 'Rejected',
        color: 'text-red-400 bg-red-500/10 border-red-500/20',
      },
      withdrawn: {
        icon: Ban,
        text: 'Withdrawn',
        color: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
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
          <p className="mt-2 text-sm text-gray-400">
            You have withdrawn your seller application. You can submit a new application anytime.
          </p>

          {withdrawal && withdrawal.withdrawalCount >= 3 && (
            <div className="mt-4 rounded-lg bg-yellow-500/5 p-4 border border-yellow-500/20">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-yellow-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-400">Multiple Withdrawals Detected</p>
                  <p className="mt-1 text-sm text-gray-300">
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
          <p className="mt-2 text-sm text-gray-400">
            Your application has been approved. You can now start listing your products and services on GameVault.
          </p>

          <button
            onClick={() => router.push('/account/dashboard')}
            className="mt-4 rounded-lg bg-green-500/10 px-6 py-2 text-sm font-medium text-green-400 hover:bg-green-500/20"
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
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
            <h3 className="text-lg font-semibold text-white">Application Not Approved</h3>
            <p className="mt-2 text-sm text-gray-400">
              Unfortunately, we were unable to approve your application at this time.
            </p>

            {/* Rejection Reason */}
            <div className="mt-4 rounded-lg bg-red-500/10 p-4 border border-red-500/20">
              <p className="text-sm font-medium text-red-400">Rejection Reason:</p>
              <p className="mt-1 text-sm text-gray-300">{rejection.reason}</p>

              {rejection.category && (
                <p className="mt-2 text-xs text-gray-400">
                  Category: {getRejectionCategoryLabel(rejection.category)}
                </p>
              )}
            </div>

            {/* Rejection Count & Tier Info */}
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-yellow-500/5 p-4 border border-yellow-500/20">
              <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-400">
                  {rejection.isPermanentBan ? 'Permanent Ban' : `Rejection ${rejection.rejectionCount} of 3`}
                </p>
                <p className="mt-1 text-sm text-gray-300">
                  {rejection.isPermanentBan
                    ? 'You have exceeded the maximum number of rejections. Please contact support to appeal.'
                    : `Cooldown period: ${getCooldownLabel(rejection.rejectionCount - 1)}`}
                </p>
              </div>
            </div>
          </div>

          {/* Countdown Timer or Permanent Ban Message */}
          {rejection.isPermanentBan ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
              <div className="flex items-start gap-3">
                <Ban className="h-6 w-6 text-red-400" />
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-white">Account Permanently Restricted</h4>
                  <p className="mt-2 text-sm text-gray-400">
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
                    : 'bg-gray-500/10 text-gray-500 cursor-not-allowed border border-gray-500/20'
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
        <p className="mt-2 text-sm text-gray-400">{message.description}</p>

        {/* Withdraw button for pending/under_review */}
        {(status === 'pending' || status === 'under_review') && (
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-6 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Withdraw Application
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-black/95 to-black/90" />
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-white/5 bg-black/40 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <button
              onClick={() => router.push('/')}
              className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </button>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Application Status</h1>
            <p className="mt-2 text-sm text-gray-400">
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

          {/* Timeline */}
          <div className="mt-8 rounded-lg border border-white/5 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white">Timeline</h3>
            <div className="mt-6 space-y-6">
              {/* Step 1: Application Started */}
              <div className="relative flex items-start gap-4">
                <div className="absolute left-4 top-8 h-full w-px bg-white/10" />

                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-400 ring-4 ring-black">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-sm font-medium text-white">Application Started</p>
                  {application?.created_at && (
                    <p className="text-xs text-gray-400">
                      {new Date(application.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Step 2: Application Submitted */}
              {application?.submitted_at && (
                <div className="relative flex items-start gap-4">
                  <div className="absolute left-4 top-8 h-full w-px bg-white/10" />

                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-400 ring-4 ring-black">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm font-medium text-white">Application Submitted</p>
                    <p className="text-xs text-gray-400">
                      {new Date(application.submitted_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Review In Progress */}
              <div className="relative flex items-start gap-4">
                {(application?.reviewed_at || rejection || status === 'withdrawn') && (
                  <div className="absolute left-4 top-8 h-full w-px bg-white/10" />
                )}

                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-black ${
                    status === 'under_review' || application?.reviewed_at
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {status === 'under_review' || application?.reviewed_at ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-gray-500" />
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <p className={`text-sm font-medium ${status === 'under_review' || application?.reviewed_at ? 'text-white' : 'text-gray-500'}`}>
                    Review In Progress
                  </p>
                  {status === 'under_review' && (
                    <p className="text-xs text-gray-400">Our team is reviewing your application</p>
                  )}
                  {!application?.reviewed_at && status !== 'under_review' && (
                    <p className="text-xs text-gray-500">Waiting for review</p>
                  )}
                </div>
              </div>

              {/* Step 4: Withdrawal Event (if withdrawn) */}
              {status === 'withdrawn' && withdrawal && (
                <div className="relative flex items-start gap-4">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-500/10 text-gray-400 ring-4 ring-black">
                    <Ban className="h-4 w-4" />
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm font-medium text-white">Application Withdrawn</p>
                    <p className="text-xs text-gray-400">
                      {new Date(withdrawal.withdrawnAt).toLocaleString()}
                    </p>
                    {withdrawal.withdrawalCount > 1 && (
                      <p className="text-xs text-yellow-400 mt-1">
                        Withdrawal count: {withdrawal.withdrawalCount}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Rejection Event (if rejected) */}
              {status === 'rejected' && rejection && (
                <div className="relative flex items-start gap-4">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400 ring-4 ring-black">
                    <XCircle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm font-medium text-white">Application Rejected</p>
                    <p className="text-xs text-gray-400">
                      {new Date(rejection.rejectedAt).toLocaleString()}
                    </p>
                    {rejection.rejectionCount > 1 && (
                      <p className="text-xs text-red-400 mt-1">
                        Rejection #{rejection.rejectionCount}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Review Completed (approved) */}
              {status === 'approved' && (
                <div className="relative flex items-start gap-4">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-400 ring-4 ring-black">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm font-medium text-white">Application Approved</p>
                    {application?.reviewed_at && (
                      <p className="text-xs text-gray-400">
                        {new Date(application.reviewed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Application ID */}
          <div className="mt-8 rounded-lg border border-white/5 bg-white/5 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">Application Reference</h4>
                <p className="mt-1 font-mono text-sm text-gray-300">{application?.id || 'N/A'}</p>
                <p className="mt-3 text-xs leading-relaxed text-gray-400">
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
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-black/90 p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Withdraw Application?</h3>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to withdraw your seller application? This action cannot be undone, but you can submit a new application anytime.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawModal(false)}
                disabled={isWithdrawing}
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={isWithdrawing}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
