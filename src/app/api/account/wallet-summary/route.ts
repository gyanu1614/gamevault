/**
 * GET /api/account/wallet-summary: the balance panel and recent withdrawals for
 * Settings → Payouts, from the same reads the wallet page uses, so the two never
 * show different numbers.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readSellerEarnings, readWalletOverview, readWithdrawalRequests, withdrawnTotal } from '@/lib/wallet/reads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE })

  try {
    const [overview, earnings, requests] = await Promise.all([
      readWalletOverview(user.id),
      readSellerEarnings(user.id),
      readWithdrawalRequests(supabase, user.id),
    ])
    return NextResponse.json(
      { overview, earnings, withdrawn: withdrawnTotal(requests), requests: requests.slice(0, 5) },
      { headers: NO_STORE },
    )
  } catch (err) {
    console.error('[wallet-summary] read failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not load' }, { status: 500, headers: NO_STORE })
  }
}
