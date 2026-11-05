/**
 * GET /api/account/identity-check: the signed-in seller's own check state. Only the
 * state word and whether checks are open; no session link or provider data.
 */
import { NextResponse } from 'next/server'
import { getIdentityCheckStatus } from '@/lib/identity/status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getIdentityCheckStatus(), { headers: { 'Cache-Control': 'private, no-store' } })
}
