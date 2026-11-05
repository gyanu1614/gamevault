/**
 * GET /api/account/withdrawal-quote?method=<id>&amount=<usd>: the live fee sum as a
 * seller types. A plain request so each keystroke's answer never queues with server
 * actions, and the page can cancel one it no longer needs. withdrawal_quote still
 * computes every number, and withdrawal_request re-runs it when the request is made.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { quoteWithdrawal } from '@/lib/actions/withdrawals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET(request: NextRequest) {
  const method = request.nextUrl.searchParams.get('method')
  if (!method) return NextResponse.json({ error: 'Missing method' }, { status: 400, headers: NO_STORE })

  const amount = Number(request.nextUrl.searchParams.get('amount'))
  const result = await quoteWithdrawal(method, Number.isFinite(amount) && amount > 0 ? amount : 0)
  if (!result.success || !result.quote) {
    return NextResponse.json({ error: result.error ?? 'Could not quote' }, { status: 400, headers: NO_STORE })
  }
  return NextResponse.json({ quote: result.quote }, { headers: NO_STORE })
}
