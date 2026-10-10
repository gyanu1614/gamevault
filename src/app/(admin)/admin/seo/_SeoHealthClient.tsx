'use client'

/**
 * SEO Health. Built on the admin kit: a numbers strip, the data-gate panel
 * (mode switch + planned date + per-game counts), the pages that need the
 * owner's call, the index rate per sitemap section, then alerts and IndexNow
 * failures. Server-rendered data; actions refresh the route.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlass, Warning } from '@phosphor-icons/react'

import { StatStrip } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'
import { setSeoGateMode, setSeoIndexOverride, setSeoPlannedEnforceDate, type SeoHealth } from '@/lib/actions/admin-seo'
import { AdminEmpty, PageHeader, PanelHead, StatusBadge, TABLE, adminBtnSm, adminFieldCls } from '../components/kit'

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)
const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(0)}%` : '–')
const dateLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not set'

const SECTION_LABELS: Record<string, string> = {
  static: 'Static Pages',
  hubs: 'Hubs',
  buy: 'Buy Pages',
  sell: 'Sell Pages',
  blog: 'Blog',
}
const sectionLabel = (s: string) => SECTION_LABELS[s] ?? (s.startsWith('values-') ? `Values: ${s.slice(7).replace(/-/g, ' ')}` : s)

export default function SeoHealthClient({ data, fetchError }: { data: SeoHealth | null; fetchError?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [plannedDate, setPlannedDate] = useState(data?.plannedEnforceOn ?? '')

  if (!data) {
    return (
      <>
        <PageHeader title="SEO Health" />
        <AdminEmpty
          icon={Warning}
          tone="error"
          title="Could not load SEO health"
          hint={
            /seo_|schema cache|does not exist/i.test(fetchError ?? '')
              ? 'The SEO tables are not in this database yet: apply migration 20261009210010_seo_pipeline (supabase db push).'
              : fetchError
          }
        />
      </>
    )
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>, done: string) =>
    start(async () => {
      const r = await fn()
      setMessage(r.ok ? done : `Failed: ${r.error}`)
      setConfirming(false)
      router.refresh()
    })

  const totals = data.sections.reduce(
    (t, s) => ({ inspected: t.inspected + s.inspected, indexed: t.indexed + s.indexed, clicks: t.clicks + s.clicks, urls: t.urls + s.sitemapUrls }),
    { inspected: 0, indexed: 0, clicks: 0, urls: 0 },
  )
  const wouldHide = data.gate.reduce((n, g) => n + g.wouldHide, 0)
  const passing = data.gate.reduce((n, g) => n + g.passing, 0)
  const pages = data.gate.reduce((n, g) => n + g.pages, 0)
  const alerts7d = data.alerts.filter((a) => Date.now() - Date.parse(a.createdAt) < 7 * 86_400_000).length
  const enforced = data.mode === 'enforce'

  return (
    <>
      <PageHeader
        title="SEO Health"
        description="Google index rate per page type, the daily check's alerts, IndexNow delivery and the value-page data gate."
      />

      <div className="space-y-5">
        <StatStrip
          stats={[
            { label: 'Indexed On Google', value: pct(totals.indexed, totals.inspected), hint: `${fmt(totals.indexed)} of ${fmt(totals.inspected)} inspected` },
            { label: 'Google Clicks (28 Days)', value: fmt(totals.clicks), hint: `${fmt(totals.urls)} URLs in the sitemap` },
            { label: 'IndexNow Sent (24 h)', value: fmt(data.events.sent24h), hint: `${fmt(data.events.pending)} waiting · ${fmt(data.events.failed)} failed` },
            { label: 'Alerts (7 Days)', value: fmt(alerts7d), hint: data.sectionsDay ? `Last check ${dateLabel(data.sectionsDay)}` : 'No check yet' },
          ]}
        />

        {message && <p className="rounded-md bg-bg-raised px-4 py-3 text-[13px] text-text-secondary">{message}</p>}

        {/* ── Data gate ─────────────────────────────────────────── */}
        <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
          <PanelHead
            title="Value Page Data Gate"
            subtitle={`A value page is indexed only with at least ${data.thresholds.observations} offers we track and ${data.thresholds.historyDays} days of price history. In report mode nothing is hidden; switching on hides the failing pages and takes them out of the sitemap.`}
            aside={<StatusBadge status={enforced ? 'On' : 'Report Only'} tone={enforced ? 'success' : 'info'} />}
          />

          <div className="mb-4 flex flex-wrap items-end gap-3">
            {enforced ? (
              <button className={adminBtnSm.secondary} disabled={pending} onClick={() => run(() => setSeoGateMode('report'), 'Gate back to report only: every value page is indexable again.')}>
                Back To Report Only
              </button>
            ) : confirming ? (
              <>
                <button className={adminBtnSm.primary} disabled={pending} onClick={() => run(() => setSeoGateMode('enforce'), `Gate on: ${wouldHide} pages hidden and logged for IndexNow.`)}>
                  Hide {fmt(wouldHide)} Pages Now
                </button>
                <button className={adminBtnSm.secondary} disabled={pending} onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className={adminBtnSm.primary} disabled={pending} onClick={() => setConfirming(true)}>
                Switch Gate On
              </button>
            )}
            <label className="flex items-center gap-2 text-[12.5px] text-text-tertiary">
              Planned Switch-On
              <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} className={cn(adminFieldCls, 'h-8 w-40')} />
            </label>
            <button
              className={adminBtnSm.secondary}
              disabled={pending || plannedDate === (data.plannedEnforceOn ?? '')}
              onClick={() => run(() => setSeoPlannedEnforceDate(plannedDate || null), 'Planned date saved.')}
            >
              Save Date
            </button>
            <p className="text-[12.5px] text-text-tertiary">
              {enforced ? `On since ${dateLabel(data.enforcedSince)}` : `Planned: ${dateLabel(data.plannedEnforceOn)}`} · {fmt(passing)} of {fmt(pages)} pages pass
            </p>
          </div>

          <div className={TABLE.wrap}>
            <table className={TABLE.table}>
              <thead>
                <tr>
                  <th className={TABLE.th}>Game</th>
                  <th className={TABLE.th}>Pages</th>
                  <th className={TABLE.th}>Pass</th>
                  <th className={TABLE.th}>Hidden When On</th>
                  <th className={TABLE.th}>Need Your Call</th>
                </tr>
              </thead>
              <tbody>
                {data.gate.map((g) => (
                  <tr key={g.game} className={TABLE.row}>
                    <td className={cn(TABLE.tdPrimary, 'capitalize')}>{g.game.replace(/-/g, ' ')}</td>
                    <td className={TABLE.td}>{fmt(g.pages)}</td>
                    <td className={TABLE.td}>{fmt(g.passing)}</td>
                    <td className={TABLE.td}>{fmt(g.wouldHide)}</td>
                    <td className={TABLE.td}>{fmt(g.protectedFailing)}</td>
                  </tr>
                ))}
                {data.gate.length === 0 && (
                  <tr>
                    <td className={TABLE.td} colSpan={5}>
                      No evidence yet. It fills after the next price run or the nightly refresh.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── The owner's call ──────────────────────────────────── */}
        {data.decisions.length > 0 && (
          <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
            <PanelHead
              title="Pages That Need Your Call"
              subtitle="These fail the gate but Google has them indexed or they earned clicks, so the gate never hides them on its own. Keep holds them in the index; Hide noindexes them now."
            />
            <div className={TABLE.wrap}>
              <table className={TABLE.table}>
                <thead>
                  <tr>
                    <th className={TABLE.th}>Page</th>
                    <th className={TABLE.th}>Offers</th>
                    <th className={TABLE.th}>Days</th>
                    <th className={TABLE.th}>Decision</th>
                    <th className={TABLE.th} />
                  </tr>
                </thead>
                <tbody>
                  {data.decisions.map((d) => (
                    <tr key={d.path} className={TABLE.row}>
                      <td className={TABLE.tdPrimary}>
                        <a href={d.path} target="_blank" rel="noreferrer" className="hover:underline">
                          {d.path}
                        </a>
                        {!d.hasPrice && <span className="ml-2 text-[12px] font-normal text-text-tertiary">no price</span>}
                      </td>
                      <td className={TABLE.td}>{d.observations}</td>
                      <td className={TABLE.td}>{d.historyDays}</td>
                      <td className={TABLE.td}>{d.override ? <StatusBadge status={d.override === 'index' ? 'Keep' : 'Hidden'} tone={d.override === 'index' ? 'success' : 'neutral'} /> : 'Protected'}</td>
                      <td className={cn(TABLE.td, 'whitespace-nowrap text-right')}>
                        <div className="inline-flex gap-2">
                          <button className={adminBtnSm.secondary} disabled={pending || d.override === 'index'} onClick={() => run(() => setSeoIndexOverride(d.path, 'index'), `Keeping ${d.path} indexed.`)}>
                            Keep
                          </button>
                          <button className={adminBtnSm.danger} disabled={pending || d.override === 'noindex'} onClick={() => run(() => setSeoIndexOverride(d.path, 'noindex'), `${d.path} hidden.`)}>
                            Hide
                          </button>
                          {d.override && (
                            <button className={adminBtnSm.secondary} disabled={pending} onClick={() => run(() => setSeoIndexOverride(d.path, null), `${d.path} back to the gate.`)}>
                              Clear
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Index rate per section ────────────────────────────── */}
        <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
          <PanelHead
            title="Index Rate Per Section"
            subtitle={data.sectionsDay ? `Daily Google check of ${dateLabel(data.sectionsDay)}. The rate counts the URLs inspected so far; the check rotates through the whole sitemap.` : 'The daily Google check has not run yet.'}
          />
          {data.sections.length === 0 ? (
            <AdminEmpty icon={MagnifyingGlass} title="No Google data yet" hint="The daily check runs at 06:20 UTC once GSC_SERVICE_ACCOUNT_KEY_B64 is set." className="bg-bg-overlay" />
          ) : (
            <div className={TABLE.wrap}>
              <table className={TABLE.table}>
                <thead>
                  <tr>
                    <th className={TABLE.th}>Section</th>
                    <th className={TABLE.th}>In Sitemap</th>
                    <th className={TABLE.th}>Inspected</th>
                    <th className={TABLE.th}>Indexed</th>
                    <th className={TABLE.th}>Rate</th>
                    <th className={TABLE.th}>Week Ago</th>
                    <th className={TABLE.th}>Clicks (28 Days)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sections.map((s) => (
                    <tr key={s.section} className={TABLE.row}>
                      <td className={cn(TABLE.tdPrimary, 'capitalize')}>{sectionLabel(s.section)}</td>
                      <td className={TABLE.td}>{fmt(s.sitemapUrls)}</td>
                      <td className={TABLE.td}>{fmt(s.inspected)}</td>
                      <td className={TABLE.td}>{fmt(s.indexed)}</td>
                      <td className={TABLE.tdPrimary}>{pct(s.indexed, s.inspected)}</td>
                      <td className={TABLE.td}>{s.inspectedWeekAgo != null ? pct(s.indexedWeekAgo ?? 0, s.inspectedWeekAgo) : '–'}</td>
                      <td className={TABLE.td}>{fmt(s.clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Alerts + IndexNow failures ────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
            <PanelHead title="Recent Alerts" subtitle="Posted to Discord when DISCORD_SEO_WEBHOOK_URL is set." />
            {data.alerts.length === 0 ? (
              <p className="text-[13px] text-text-tertiary">No alerts.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {data.alerts.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <p className="text-[13.5px] text-text-primary">{a.message}</p>
                    <p className="mt-0.5 text-[12px] text-text-tertiary">
                      {dateLabel(a.createdAt)} · {a.posted ? 'posted' : 'not posted'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
            <PanelHead title="IndexNow Failures" subtitle="Given up after 6 attempts or rejected by IndexNow." />
            {data.events.recentFailed.length === 0 ? (
              <p className="text-[13px] text-text-tertiary">None.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {data.events.recentFailed.map((f, i) => (
                  <li key={`${f.url}-${i}`} className="py-2.5">
                    <p className="truncate text-[13.5px] text-text-primary">{f.url.replace(/^https?:\/\/[^/]+/, '') || '/'}</p>
                    <p className="mt-0.5 text-[12px] text-text-tertiary">
                      {f.reason} · {f.attempts} attempts · {f.error ?? 'error'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
