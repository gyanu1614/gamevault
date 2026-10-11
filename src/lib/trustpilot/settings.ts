/**
 * trustpilot_settings (one row): the review count an admin sets on /admin.
 *
 * Every read FAILS CLOSED to 0: a database hiccup hides the TrustBox rather
 * than risking an empty widget. Public pages read it cookie-free and cached
 * under TRUSTPILOT_SETTINGS_TAG; the admin save revalidates that tag.
 */
import { unstable_cache } from 'next/cache'

import { createAnonClient } from '@/lib/supabase/anon'
import { TRUSTPILOT_SETTINGS_TAG } from '@/lib/revalidation/tags'
import { TRUSTBOX_MIN_REVIEWS } from './links'

type Db = any

export async function readReviewCount(db: Db): Promise<number> {
  try {
    const { data, error } = await db.from('trustpilot_settings').select('review_count').eq('id', 1).maybeSingle()
    const n = Number(data?.review_count)
    return !error && Number.isInteger(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

/** Show the public TrustBox? Only with real reviews to show. */
export function trustboxVisible(reviewCount: number): boolean {
  return reviewCount >= TRUSTBOX_MIN_REVIEWS
}

export const getPublicReviewCount = unstable_cache(
  async () => readReviewCount(createAnonClient()),
  ['trustpilot-review-count'],
  { tags: [TRUSTPILOT_SETTINGS_TAG], revalidate: 86400 },
)
