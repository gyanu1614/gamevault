/**
 * P5.1 — Referral Program Dashboard
 *
 * Server component: fetches referral stats and renders the full page.
 * Client sub-component handles copy-to-clipboard interactivity.
 */

import { getReferralStats } from '@/lib/actions/referral'
import ReferralClient from './ReferralClient'

export const metadata = {
  title: 'Refer & Earn | GameVault',
  description: 'Share your referral link and earn commissions on every purchase your friends make.',
}

export default async function ReferralPage() {
  const result = await getReferralStats()

  if (!result.success || !result.data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-2">Could not load referral data.</p>
          <p className="text-sm text-text-disabled">{result.error}</p>
        </div>
      </div>
    )
  }

  return <ReferralClient stats={result.data} />
}
