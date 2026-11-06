/**
 * /account/wallet: server page. The balance, earnings and withdrawals are read
 * together here, in one request with one sign-in check, so the top of the page
 * arrives with its numbers. Only the tab's list loads in the browser.
 *
 * Before this: a server shell, then six reads from the browser, most of them server
 * actions, which Next runs one at a time behind the navbar's own. One of them
 * (loyalty stats) was never shown at all.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ActivityFilter } from '@/lib/wallet/activity'
import { readSellerEarnings, readWalletOverview, readWithdrawalRequests } from '@/lib/wallet/reads'
import WalletClient from './_WalletClient'

export const metadata: Metadata = {
  title: 'Wallet',
  robots: { index: false, follow: false },
}

function orNull<T>(what: string, read: Promise<T>): Promise<T | null> {
  return read.catch((err) => {
    console.error(`[wallet] ${what} failed:`, err instanceof Error ? err.message : err)
    return null
  })
}

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=${encodeURIComponent('/account/wallet')}`)

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const isSeller = (profile as { role?: string } | null)?.role === 'seller'

  const [overview, earnings, requests, { tab }] = await Promise.all([
    orNull('balance', readWalletOverview(user.id)),
    isSeller ? orNull('earnings', readSellerEarnings(user.id)) : null,
    isSeller ? orNull('withdrawals', readWithdrawalRequests(supabase, user.id)) : [],
    searchParams,
  ])

  // Older links name the tabs the page used to have.
  const FROM_TAB: Record<string, ActivityFilter> = { earnings: 'sales', payouts: 'withdrawals', purchases: 'purchases' }
  const initialFilter: ActivityFilter = isSeller ? ((tab ? FROM_TAB[tab] : undefined) ?? 'all') : 'purchases'

  return (
    <WalletClient
      userId={user.id}
      isSeller={isSeller}
      initialFilter={initialFilter}
      overview={overview}
      earnings={earnings}
      requests={requests ?? []}
    />
  )
}
