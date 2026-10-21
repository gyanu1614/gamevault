import { MagnifyingGlass } from '@phosphor-icons/react'

import type { SeoReport } from '@/lib/seo/report'
import { delta } from '@/lib/seo/weekly'
import { AdminEmpty, PanelHead, TABLE } from '../components/kit'

const fmt = (n: number | null | undefined) => (n == null ? '–' : new Intl.NumberFormat('en-US').format(n))
const pathOf = (url: string) => {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

/** Daily Bing clicks as small bars (last 35 days) — plain SVG, no chart library on an admin page. */
function ClicksBars({ days }: { days: SeoReport['bingDays'] }) {
  const max = Math.max(1, ...days.map((d) => d.clicks ?? 0))
  const w = 6
  const gap = 2
  const h = 48
  return (
    <svg viewBox={`0 0 ${days.length * (w + gap)} ${h}`} className="h-12 w-full" preserveAspectRatio="none" role="img" aria-label="Bing clicks per day">
      {days.map((d, i) => {
        const bh = Math.max(1, ((d.clicks ?? 0) / max) * h)
        return (
          <rect key={d.day} x={i * (w + gap)} y={h - bh} width={w} height={bh} rx={1.5} fill="#7FB2FF" opacity={d.clicks == null ? 0.2 : 0.85}>
            <title>{`${d.day}: ${fmt(d.clicks)} clicks`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

/**
 * Bing — where most of our search traffic comes from: clicks per day, the top
 * pages and queries of the latest week Bing reports (against the week before).
 * Synced once a day by /api/cron/seo-bing.
 */
export function SeoBing({ report }: { report: SeoReport }) {
  if (report.bingDays.length === 0) {
    return (
      <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
        <PanelHead title="Bing" subtitle="Clicks, impressions, pages in Bing's index, top pages and queries — synced once a day." />
        <AdminEmpty
          icon={MagnifyingGlass}
          title="No Bing data yet"
          hint="In Bing Webmaster Tools open Settings → API Access → API Key, generate a key, and add it in Vercel as BING_WEBMASTER_API_KEY (Production). The daily sync runs at 07:40 UTC."
          className="bg-bg-overlay"
        />
      </section>
    )
  }
  const pages = report.weekly.topBingPages
  return (
    <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
      <PanelHead title="Bing" subtitle={`Clicks per day, last ${report.bingDays.length} days. Top pages and queries are Bing's latest week against the week before.`} />
      <ClicksBars days={report.bingDays} />
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>Top Pages</th>
                <th className={TABLE.th}>Clicks</th>
                <th className={TABLE.th}>Change</th>
                <th className={TABLE.th}>Impressions</th>
              </tr>
            </thead>
            <tbody>
              {pages.length === 0 ? (
                <tr><td className={TABLE.td} colSpan={4}>No page data yet.</td></tr>
              ) : (
                pages.map((p) => (
                  <tr key={p.url} className={TABLE.row}>
                    <td className={TABLE.tdPrimary}>
                      <a href={p.url} target="_blank" rel="noreferrer" className="block max-w-[260px] truncate hover:underline">{pathOf(p.url)}</a>
                    </td>
                    <td className={TABLE.td}>{fmt(p.clicks)}</td>
                    <td className={TABLE.td}>{delta(p.clicks, p.clicksPrevWeek) ?? 'new'}</td>
                    <td className={TABLE.td}>{fmt(p.impressions)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>Top Queries</th>
                <th className={TABLE.th}>Clicks</th>
                <th className={TABLE.th}>Change</th>
                <th className={TABLE.th}>Position</th>
              </tr>
            </thead>
            <tbody>
              {report.bingQueries.length === 0 ? (
                <tr><td className={TABLE.td} colSpan={4}>No query data yet.</td></tr>
              ) : (
                report.bingQueries.map((q) => (
                  <tr key={q.query} className={TABLE.row}>
                    <td className={TABLE.tdPrimary}><span className="block max-w-[260px] truncate">{q.query}</span></td>
                    <td className={TABLE.td}>{fmt(q.clicks)}</td>
                    <td className={TABLE.td}>{delta(q.clicks, q.clicksPrevWeek) ?? 'new'}</td>
                    <td className={TABLE.td}>{q.avgPosition == null ? '–' : q.avgPosition.toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
