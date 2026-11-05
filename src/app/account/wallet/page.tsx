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
import { readSellerEarnings, readWalletOverview, readWithdrawalRequests, withdrawnTotal } from '@/lib/wallet/reads'
import WalletClient, { type WalletTab } from './_WalletClient'

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

  const sellerTabs: WalletTab[] = ['earnings', 'purchases', 'payouts']
  const initialTab: WalletTab = isSeller ? (sellerTabs.includes(tab as WalletTab) ? (tab as WalletTab) : 'earnings') : 'purchases'

  return (
    <WalletClient
      userId={user.id}
      isSeller={isSeller}
      initialTab={initialTab}
      overview={overview}
      earnings={earnings}
      requests={requests ?? []}
      withdrawn={withdrawnTotal(requests ?? [])}
    />
  )
}
