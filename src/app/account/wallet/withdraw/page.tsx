/**
 * /account/wallet/withdraw: server page. Every read runs together here, in one
 * request with one sign-in check, and the page arrives with its data. It used to
 * load in the browser through server actions, which Next runs one at a time behind
 * the navbar's own, so the balance appeared after seven or eight round trips.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { readPayoutDetails, readWalletOverview, readWithdrawalMethods, readWithdrawalRequests } from '@/lib/wallet/reads'
import WithdrawClient from './_WithdrawClient'

export const metadata: Metadata = {
  title: 'Withdraw Funds',
  robots: { index: false, follow: false },
}

/** A failed read draws a Try Again on the page, not a crash. */
function orNull<T>(what: string, read: Promise<T>): Promise<T | null> {
  return read.catch((err) => {
    console.error(`[withdraw] ${what} failed:`, err instanceof Error ? err.message : err)
    return null
  })
}

export default async function WithdrawPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=${encodeURIComponent('/account/wallet/withdraw')}`)

  const [overview, details, methods, requests] = await Promise.all([
    orNull('balance', readWalletOverview(user.id)),
    orNull('payout details', readPayoutDetails(user.id)),
    orNull('methods', readWithdrawalMethods(supabase)),
    orNull('requests', readWithdrawalRequests(supabase, user.id)),
  ])

  return <WithdrawClient overview={overview} details={details} methods={methods} requests={requests ?? []} />
}
