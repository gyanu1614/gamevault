/**
 * Seller Application Status Page — logic shell. All presentation lives in
 * StatusView (Forest Ledger light card on the sell-hero backdrop); this file
 * keeps the behavior: status fetch (re-keyed by the realtime seller-lifecycle
 * channel), withdraw + cooldown handling, the ?submitted=1 received banner,
 * and the loading / error / no-application gates.
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
import { AlertCircle, FileText } from 'lucide-react'
import { toast } from 'sonner'
import SellerFlowLoader from '../become-seller/_redesign/components/SellerFlowLoader'
import StatusView from './StatusView'

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

  // ?submitted=1 → show the "Application Received" banner (read via
  // window.location to avoid the useSearchParams Suspense requirement).
  const [justSubmitted, setJustSubmitted] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('submitted') === '1') {
      setJustSubmitted(true)
      // Clean the URL so a refresh doesn't re-announce it.
      window.history.replaceState(null, '', '/account/seller-status')
    }
  }, [])

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

  const handleWithdraw = async () => {
    setIsWithdrawing(true)
    try {
      const result = await withdrawApplication()

      if (result.success) {
        toast.success('Application withdrawn successfully')
        if (result.data?.flagged_for_spam) {
          toast.warning('Multiple withdrawals detected. Please submit a complete application.')
        }
        setTimeout(() => {
          router.push('/account/become-seller')
        }, 1200)
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

  const handleCountdownComplete = () => {
    setCooldownExpired(true)
    toast.success('Cooldown period expired! You can now reapply.')
  }

  if (authLoading || loading) {
    return <SellerFlowLoader label="Loading your application status…" />
  }

  if (error) {
    return (
      <CenteredNotice
        icon={<AlertCircle className="mx-auto h-10 w-10 text-red-600" />}
        title="Something Went Wrong"
        body={error}
        ctaLabel="Go To Home"
        onCta={() => router.push('/')}
      />
    )
  }

  if (!applicationStatus || applicationStatus.status === 'none') {
    return (
      <CenteredNotice
        icon={<FileText className="mx-auto h-10 w-10" style={{ color: '#1B5E3A' }} />}
        title="No Application Found"
        body="You haven't submitted a seller application yet."
        ctaLabel="Start Application"
        onCta={() => router.push('/account/become-seller')}
      />
    )
  }

  return (
    <StatusView
      data={applicationStatus}
      justSubmitted={justSubmitted}
      cooldownExpired={cooldownExpired}
      isWithdrawing={isWithdrawing}
      showWithdrawModal={showWithdrawModal}
      onShowWithdraw={setShowWithdrawModal}
      onWithdraw={handleWithdraw}
      onCountdownComplete={handleCountdownComplete}
      onNavigate={(path) => router.push(path)}
    />
  )
}

/** Small light-card notice for the error / no-application gates. */
function CenteredNotice({
  icon,
  title,
  body,
  ctaLabel,
  onCta,
}: {
  icon: React.ReactNode
  title: string
  body: string
  ctaLabel: string
  onCta: () => void
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <div
        className="animate-fade-up w-full max-w-sm rounded-2xl border p-8 text-center"
        style={{ borderColor: '#E4E5DE', backgroundColor: '#FFFFFF' }}
      >
        {icon}
        <p className="mt-4 text-lg font-semibold" style={{ color: '#14432A' }}>
          {title}
        </p>
        <p className="mt-1.5 text-sm" style={{ color: '#5B6157' }}>
          {body}
        </p>
        <button
          onClick={onCta}
          className="mt-6 rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: '#14432A' }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}
