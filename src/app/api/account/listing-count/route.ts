/**
 * GET /api/account/listing-count?cap=3: how many listings the signed-in seller
 * has, up to the cap. A plain request so the seller prompt never queues with
 * server actions.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { sellerListingCount } from '@/lib/actions/seller-banner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cap = Number(request.nextUrl.searchParams.get('cap'))
  const count = await sellerListingCount(Number.isFinite(cap) && cap > 0 ? cap : undefined)
  return NextResponse.json({ count }, { headers: { 'Cache-Control': 'private, no-store' } })
}
