/**
 * /admin/seo — the weekly check (Google + Bing, this week vs last), Google's
 * pipeline per sitemap section, Bing's top pages and queries, the daily
 * check's alerts, IndexNow delivery, and the value-page data gate. Auth: the
 * (admin) layout; data via admin-guarded actions (lib/actions/admin-seo).
 */
import { getSeoHealth, getSeoReport } from '@/lib/actions/admin-seo'

import SeoHealthClient from './_SeoHealthClient'

export const metadata = { title: 'SEO Health' }

export default async function AdminSeoPage() {
  const [result, report] = await Promise.all([getSeoHealth(), getSeoReport()])
  return (
    <SeoHealthClient
      data={result.ok ? result.data : null}
      fetchError={result.ok ? undefined : result.error}
      report={report.ok ? report.data : null}
      reportError={report.ok ? undefined : report.error}
    />
  )
}
