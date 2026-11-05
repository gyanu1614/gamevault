/**
 * GET /api/account/menu: what a seller's profile menu shows, their store credit
 * and whether the store is paused. A plain request so it never queues with server
 * actions, and one sign-in check instead of one per read.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWalletBalance } from '@/lib/wallet/wallet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE })

  try {
    const [creditMinor, presence] = await Promise.all([
      getWalletBalance(user.id, 'USD'),
      supabase.from('seller_presence').select('store_paused').eq('seller_id', user.id).maybeSingle(),
    ])
    return NextResponse.json(
      {
        walletBalance: Number(creditMinor) / 100,
        storePaused: (presence.data as { store_paused?: boolean } | null)?.store_paused === true,
      },
      { headers: NO_STORE },
    )
  } catch (err) {
    console.error('[account-menu] read failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not load' }, { status: 500, headers: NO_STORE })
  }
}
