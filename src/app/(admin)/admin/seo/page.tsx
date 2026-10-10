/**
 * /admin/seo — Google index rate per sitemap section, the daily check's
 * alerts, IndexNow delivery, and the value-page data gate (mode switch,
 * planned date, the pages that need the owner's call). Auth: the (admin)
 * layout; data via admin-guarded actions (lib/actions/admin-seo).
 */
import { getSeoHealth } from '@/lib/actions/admin-seo'

import SeoHealthClient from './_SeoHealthClient'

export const metadata = { title: 'SEO Health' }

export default async function AdminSeoPage() {
  const result = await getSeoHealth()
  return <SeoHealthClient data={result.ok ? result.data : null} fetchError={result.ok ? undefined : result.error} />
}
