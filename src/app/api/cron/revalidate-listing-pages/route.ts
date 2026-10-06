import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import {
  GAME_DIRECTORY_TAG,
  HOME_LISTINGS_TAG,
  PAUSED_SELLERS_TAG,
  TEST_SELLERS_TAG,
} from '@/lib/revalidation/tags'
import { isCronAuthorized } from '@/lib/security/cron-auth'

/**
 * Nightly full revalidate of the listing surfaces (Step 7b).
 *
 * `/[gameSlug]/[categorySlug]` is prerendered for every enabled pair with a
 * 24 h TTL and refreshed by listing mutations (lib/revalidation/listings).
 * This is the safety net for anything that changes what those pages show
 * without a mutation path: a DB-side status change, an admin toggling a game
 * or category, a revalidateTag that failed. Once a night every category page
 * and game hub is marked stale by ROUTE PATTERN (the only form Next matches
 * for a dynamic route), along with the shared reads and the homepage rails.
 * Lazy: a page re-renders on its next visit, so the cost is bounded by the
 * traffic those pages get anyway.
 *
 * The pattern must include the route group: Next 14 tags a render with its
 * FILE path (`/(marketplace)/[gameSlug]/[categorySlug]/page`), so
 * `revalidatePath('/[gameSlug]/[categorySlug]', 'page')` matched nothing —
 * until 2026-10-05 this backstop refreshed no listing data at all. The path
 * tag also purges every fetch those renders made, untagged ones included.
 * Guarded by listings-data-tags.guard.test.ts.
 *
 * Auth: the same CRON_SECRET bearer every cron uses; unset → 401, never open.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // PAY-020: constant-time bearer compare, fails closed when CRON_SECRET is unset.
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Literal calls, so the guard can check each pattern names a real page file.
  revalidatePath('/(marketplace)/[gameSlug]/[categorySlug]', 'page')
  revalidatePath('/(marketplace)/[gameSlug]', 'page')
  const paths = ['/(marketplace)/[gameSlug]/[categorySlug]', '/(marketplace)/[gameSlug]']
  const tags = [PAUSED_SELLERS_TAG, TEST_SELLERS_TAG, GAME_DIRECTORY_TAG, HOME_LISTINGS_TAG]
  for (const tag of tags) revalidateTag(tag)

  return NextResponse.json({
    ok: true,
    revalidated: [...paths, ...tags],
    revalidated_at: new Date().toISOString(),
  })
}
