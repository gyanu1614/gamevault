/**
 * POST /api/presence/online: the seller's heartbeat. A plain request so it never
 * queues with server actions and makes a click wait.
 */
import { NextResponse } from 'next/server'
import { updatePresenceOnline } from '@/lib/actions/seller-presence'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const result = await updatePresenceOnline()
  return NextResponse.json(result, { status: result.success ? 200 : 401, headers: { 'Cache-Control': 'private, no-store' } })
}
