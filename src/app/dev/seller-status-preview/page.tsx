/**
 * Dev-only preview of the seller-status StatusView with mock data — iterate on
 * the design without auth or a real application. ?s=pending|under_review|
 * info_requested|approved|rejected|withdrawn and &submitted=1 for the banner.
 * 404s outside development. Mirrors /dev/checkout-preview.
 */

'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import StatusView from '@/app/account/seller-status/StatusView'
import type { ApplicationStatusResult } from '@/lib/actions/seller-application-status'

function mock(status: string): ApplicationStatusResult {
  const base = {
    status: status as ApplicationStatusResult['status'],
    canReapply: false,
    application: {
      id: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
      created_at: '2026-07-16T19:07:56Z',
      submitted_at: '2026-07-16T20:07:56Z',
      reviewed_at: null,
      admin_notes: null,
    },
    rejection: null,
    withdrawal: null,
  } as unknown as ApplicationStatusResult

  if (status === 'info_requested') {
    ;(base.application as any).admin_notes =
      'Your selfie photo is too blurry to match against your ID. Please re-upload a clearer selfie holding your government ID next to your face.'
  }
  if (status === 'approved') {
    ;(base.application as any).reviewed_at = '2026-07-17T09:30:00Z'
  }
  if (status === 'rejected') {
    ;(base as any).rejection = {
      reason: 'The government ID provided does not match the legal name on the application.',
      category: 'identity_mismatch',
      rejectionCount: 1,
      isPermanentBan: false,
      canReapplyAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(),
      rejectedAt: '2026-07-17T09:30:00Z',
    }
  }
  if (status === 'withdrawn') {
    ;(base as any).withdrawal = {
      withdrawnAt: '2026-07-17T08:00:00Z',
      withdrawalCount: 3,
    }
  }
  return base
}

export default function SellerStatusPreviewPage() {
  const [status, setStatus] = useState('pending')
  const [submitted, setSubmitted] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setStatus(p.get('s') || 'pending')
    setSubmitted(p.get('submitted') === '1')
  }, [])

  if (process.env.NODE_ENV !== 'development') notFound()

  return (
    <StatusView
      data={mock(status)}
      justSubmitted={submitted}
      cooldownExpired={false}
      isWithdrawing={false}
      showWithdrawModal={withdrawOpen}
      onShowWithdraw={setWithdrawOpen}
      onWithdraw={() => setWithdrawOpen(false)}
      onCountdownComplete={() => {}}
      onNavigate={() => {}}
    />
  )
}
