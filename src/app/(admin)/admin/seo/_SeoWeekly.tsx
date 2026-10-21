import { MagnifyingGlass } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'
import type { SeoReport } from '@/lib/seo/report'
import { delta, pct } from '@/lib/seo/weekly'
import { AdminEmpty, PanelHead, TABLE } from '../components/kit'

const fmt = (n: number | null | undefined) => (n == null ? '–' : new Intl.NumberFormat('en-US').format(n))

/** A number with its change since last week, coloured by direction (green up, red down; reversed where down is good). */
function Change({ text, goodWhenDown = false }: { text: string | null; goodWhenDown?: boolean }) {
  if (!text || text === '±0' || text === '±0%') return text ? <span className="text-text-tertiary">{text}</span> : null
  const up = text.startsWith('+')
  const good = goodWhenDown ? !up : up
  return <span className={good ? 'text-[#3FD986]' : 'text-[#FF6B6B]'}>{text}</span>
}

function Stat({ label, value, change, goodWhenDown, hint }: { label: string; value: string; change?: string | null; goodWhenDown?: boolean; hint?: string }) {
  return (
    <div className="rounded-md bg-bg-overlay px-4 py-3">
      <p className="text-[12px] text-text-tertiary">{label}</p>
      <p className="mt-1 flex items-baseline gap-2 text-[20px] font-semibold tabular-nums text-text-primary">
        {value}
        {change !== undefined && (
          <span className="text-[13px] font-medium">
            <Change text={change ?? null} goodWhenDown={goodWhenDown} />
          </span>
        )}
      </p>
      {hint && <p className="mt-0.5 text-[12px] text-text-tertiary">{hint}</p>}
    </div>
  )
}

/** Indexed / crawled / discovered / unknown as one bar, so the pipeline reads at a glance. */
function PipelineBar({ indexed, crawled, discovered, unknown }: { indexed: number; crawled: number; discovered: number; unknown: number }) {
  const total = indexed + crawled + discovered + unknown
  if (total === 0) return null
  const parts = [
    { label: 'Indexed', n: indexed, color: '#3FD986' },
    { label: 'Crawled, Not Indexed', n: crawled, color: '#F5C542' },
    { label: 'Discovered', n: discovered, color: '#7FB2FF' },
    { label: 'Unknown To Google', n: unknown, color: 'rgba(255,255,255,0.18)' },
  ]
  return (
    <div className="mt-4">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label={parts.map((p) => `${p.label} ${p.n}`).join(', ')}>
        {parts.map((p) => (p.n > 0 ? <span key={p.label} style={{ width: `${(p.n / total) * 100}%`, background: p.color }} /> : null))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-tertiary">
        {parts.map((p) => (
          <li key={p.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} {fmt(p.n)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * "This Week" — the weekly SEO check: Google's pipeline and 28-day clicks
 * against a week ago, Bing's last 7 days against the 7 before. Then Google's
 * pipeline per section (the old index-rate table, with where the rest sit).
 */
export function SeoWeekly({ report, sectionLabel }: { report: SeoReport; sectionLabel: (s: string) => string }) {
  const g = report.weekly.google
  const b = report.weekly.bing
  return (
    <>
      <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
        <PanelHead
          title="This Week"
          subtitle="Each number against the same day last week. Google's index moves slowly; pages travel unknown → discovered → crawled → indexed first. Posted to #seo-alerts every Thursday."
        />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Stat label="Indexed On Google" value={fmt(g.now.indexed)} change={delta(g.now.indexed, g.weekAgo?.indexed)} />
          <Stat label="Discovered, Not Crawled" value={fmt(g.now.discovered)} change={delta(g.now.discovered, g.weekAgo?.discovered)} />
          <Stat label="Unknown To Google" value={fmt(g.now.unknown)} change={delta(g.now.unknown, g.weekAgo?.unknown)} goodWhenDown />
          <Stat label="Google Clicks (28 Days)" value={fmt(g.now.clicks28d)} change={delta(g.now.clicks28d, g.weekAgo?.clicks28d)} hint={`${fmt(g.now.impressions28d)} impressions`} />
          <Stat label="Bing Clicks (7 Days)" value={fmt(b?.clicks7d)} change={pct(b?.clicks7d, b?.clicksPrev7d)} />
          <Stat label="Bing Impressions (7 Days)" value={fmt(b?.impressions7d)} change={pct(b?.impressions7d, b?.impressionsPrev7d)} />
          <Stat label="Pages In Bing's Index" value={fmt(b?.inIndex)} change={delta(b?.inIndex, b?.inIndexWeekAgo)} />
          <Stat label="Crawled, Not Indexed" value={fmt(g.now.crawled)} change={delta(g.now.crawled, g.weekAgo?.crawled)} goodWhenDown />
        </div>
        <PipelineBar indexed={g.now.indexed} crawled={g.now.crawled} discovered={g.now.discovered} unknown={g.now.unknown} />
      </section>

      <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
        <PanelHead
          title="Google Pipeline Per Section"
          subtitle={report.day ? `Daily Google check of ${report.day}. Change is against a week ago.` : 'The daily Google check has not run yet.'}
        />
        {report.sections.length === 0 ? (
          <AdminEmpty icon={MagnifyingGlass} title="No Google data yet" hint="The daily check runs at 06:20 UTC once GSC_SERVICE_ACCOUNT_KEY_B64 is set." className="bg-bg-overlay" />
        ) : (
          <div className={TABLE.wrap}>
            <table className={TABLE.table}>
              <thead>
                <tr>
                  <th className={TABLE.th}>Section</th>
                  <th className={TABLE.th}>In Sitemap</th>
                  <th className={TABLE.th}>Indexed</th>
                  <th className={TABLE.th}>Crawled</th>
                  <th className={TABLE.th}>Discovered</th>
                  <th className={TABLE.th}>Unknown</th>
                  <th className={TABLE.th}>Clicks (28 Days)</th>
                </tr>
              </thead>
              <tbody>
                {report.sections.map((s) => (
                  <tr key={s.section} className={TABLE.row}>
                    <td className={cn(TABLE.tdPrimary, 'capitalize')}>{sectionLabel(s.section)}</td>
                    <td className={TABLE.td}>{fmt(s.sitemapUrls)}</td>
                    <td className={TABLE.tdPrimary}>
                      {fmt(s.indexed)} <span className="text-[12px] font-medium"><Change text={delta(s.indexed, s.indexedWeekAgo)} /></span>
                    </td>
                    <td className={TABLE.td}>{fmt(s.crawled)}</td>
                    <td className={TABLE.td}>{fmt(s.discovered)}</td>
                    <td className={TABLE.td}>{fmt(s.unknown)}</td>
                    <td className={TABLE.td}>
                      {fmt(s.clicks28d)} <span className="text-[12px]"><Change text={delta(s.clicks28d, s.clicks28dWeekAgo)} /></span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
