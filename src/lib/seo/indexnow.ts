/**
 * IndexNow ping — tells IndexNow-participating engines (Bing, Yandex,
 * Seznam, Naver) about new/changed URLs the moment they go live,
 * instead of waiting for the next sitemap crawl.
 *
 * Ownership proof: public/d148151df903b69420ca02e9de02d8be.txt is
 * served from the site root and contains the key verbatim.
 *
 * NOTE (coverage boundary): only the sell-wizard publish path pings
 * eagerly. Client-side listing status changes — pause/activate/price
 * edits from the seller offers table — are deliberately NOT wired to
 * IndexNow; the sitemap's per-page lastmod (max listing updated_at)
 * covers those on the next crawl.
 */

import { SITE_URL } from '@/config/site'

const INDEXNOW_KEY = 'd148151df903b69420ca02e9de02d8be'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

/**
 * Fire-and-forget IndexNow submission. Accepts site-relative paths
 * (or absolute URLs) and posts them as absolute URLs on the canonical
 * domain. Swallows every error — a failed ping must never break the
 * calling server action — and no-ops outside production so dev/preview
 * publishes don't advertise localhost content.
 */
export async function pingIndexNow(paths: string[]): Promise<void> {
  // Build env AND deployment env: Vercel previews run NODE_ENV=production
  // but must never advertise canonical URLs for preview content.
  if (process.env.NODE_ENV !== 'production') return
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return
  if (paths.length === 0) return

  try {
    await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(SITE_URL).hostname,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: paths.map((p) =>
          p.startsWith('http') ? p : `${SITE_URL}${p.startsWith('/') ? '' : '/'}${p}`,
        ),
      }),
      // Cap the wait so a slow IndexNow endpoint can't stall a publish.
      signal: AbortSignal.timeout(4000),
    })
  } catch {
    // Swallow — never break the caller over an SEO ping.
  }
}
