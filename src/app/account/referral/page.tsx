/**
 * P5.1 — Referral Program Dashboard
 *
 * Server component: fetches referral stats and renders the full page.
 * Client sub-component handles copy-to-clipboard interactivity.
 */

import { getReferralStats } from '@/lib/actions/referral'
import ReferralClient from './ReferralClient'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { AccountCard, AccountPage } from '@/components/account/AccountSurface'

export const metadata = {
  title: 'Refer & Earn',
  description: 'Share your referral link and earn commissions on every purchase your friends make.',
}

export default async function ReferralPage() {
  const result = await getReferralStats()

  if (!result.success || !result.data) {
    return (
      <AccountPage>
        <AccountPageHeader title="Refer & Earn" />
        <AccountCard className="mt-6 px-6 py-12 text-center">
          <p className="text-[15px] font-semibold text-text-primary">Couldn’t Load Your Referral Data</p>
          <p className="mt-1 text-[13px] text-text-secondary">Refresh the page in a moment. {result.error}</p>
        </AccountCard>
      </AccountPage>
    )
  }

  return <ReferralClient stats={result.data} />
}
