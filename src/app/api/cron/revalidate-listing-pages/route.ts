import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { GAME_DIRECTORY_TAG, PAUSED_SELLERS_TAG, TEST_SELLERS_TAG } from '@/lib/revalidation/tags'

/**
 * Nightly full revalidate of the listing surfaces (Step 7b).
 *
 * `/[gameSlug]/[categorySlug]` is prerendered for every enabled pair with a
 * 24 h TTL and refreshed by listing mutations (lib/revalidation/listings).
 * This is the safety net for anything that changes what those pages show
 * without a mutation path: a DB-side status change, an admin toggling a game
 * or category, a revalidateTag that failed. Once a night every category page
 * is marked stale by ROUTE PATTERN (the only form Next matches for a dynamic
 * route), along with the shared reads. Lazy: a page re-renders on its next
 * visit, so the cost is bounded by the traffic those pages get anyway.
 *
 * Auth: the same CRON_SECRET bearer every cron uses; unset → 401, never open.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  revalidatePath('/[gameSlug]/[categorySlug]', 'page')
  const tags = [PAUSED_SELLERS_TAG, TEST_SELLERS_TAG, GAME_DIRECTORY_TAG]
  for (const tag of tags) revalidateTag(tag)

  return NextResponse.json({
    ok: true,
    revalidated: ['/[gameSlug]/[categorySlug]', ...tags],
    revalidated_at: new Date().toISOString(),
  })
}
