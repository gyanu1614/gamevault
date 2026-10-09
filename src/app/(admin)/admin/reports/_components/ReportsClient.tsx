'use client'

/**
 * Reports list: one row per report, grouped visually by listing through
 * the "N open" chip. Uphold = takedown + strike, Dismiss = clear (and
 * un-hide if the auto rule hid it). Both close every open report on that
 * listing, so the queue drains per listing, not per report.
 */
import { useState, useTransition } from 'react'
import Link from '@/components/navigation/AppLink'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AdminEmpty, FilterChip, PageHeader, StatusBadge } from '../../components/kit'
import { resolveReport, type ReportRow } from '@/lib/actions/admin-moderation-tools'
import { REPORT_REASONS, type ReportReason } from '@/lib/listings/report-reasons'
import { Flag } from '@phosphor-icons/react/dist/ssr/Flag'

export default function ReportsClient({ tab, rows, error }: { tab: 'open' | 'resolved'; rows: ReportRow[]; error: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [uphold, setUphold] = useState<{ id: string; title: string } | null>(null)
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()

  const act = (reportId: string, verdict: 'upheld' | 'dismissed', why?: string) => {
    setBusy(reportId)
    setFailed(null)
    start(async () => {
      const r = await resolveReport({ reportId, verdict, reason: why })
      setBusy(null)
      if (!r.success) return setFailed(r.error)
      setUphold(null)
      setReason('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="What buyers flagged. Three open reports hide a listing until you decide." />
      <div className="flex gap-2">
        <FilterChip selected={tab === 'open'} onClick={() => router.push('/admin/reports')}>Open</FilterChip>
        <FilterChip selected={tab === 'resolved'} onClick={() => router.push('/admin/reports?tab=resolved')}>Resolved</FilterChip>
      </div>
      {error && <p className="text-[13px] text-error">{error}</p>}
      {failed && <p className="text-[13px] text-error">{failed}</p>}
      {rows.length === 0 ? (
        <AdminEmpty icon={Flag} title={tab === 'open' ? 'No open reports' : 'Nothing resolved yet'} hint="Buyers report listings from the listing page." />
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.06] bg-bg-raised">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/admin/active-sellers/${r.listing.seller_id}`} className="min-w-0 truncate text-[14px] font-semibold text-text-primary hover:underline">
                    {r.listing.title}
                  </Link>
                  <StatusBadge status={r.listing.status} />
                  {r.listing.open_reports >= 2 && <span className="rounded-full bg-error-bg px-2 py-0.5 text-[11.5px] font-semibold text-error">{r.listing.open_reports} open</span>}
                </div>
                <p className="mt-0.5 text-[12.5px] text-text-tertiary">
                  {r.listing.shop_name ?? 'Unknown store'} · reported by @{r.reporter.username ?? 'unknown'} · {new Date(r.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                <p className="mt-1 text-[13px] text-text-secondary">
                  <span className="font-medium text-text-primary">{REPORT_REASONS[r.reason as ReportReason] ?? r.reason}</span>
                  {r.details ? ` — ${r.details}` : ''}
                </p>
              </div>
              {tab === 'open' ? (
                <div className="flex shrink-0 gap-2">
                  <button type="button" disabled={pending && busy === r.id} onClick={() => act(r.id, 'dismissed')} className="h-9 rounded-md border border-white/[0.12] px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary disabled:opacity-60">
                    Dismiss
                  </button>
                  <button type="button" disabled={pending && busy === r.id} onClick={() => setUphold({ id: r.id, title: r.listing.title })} className="h-9 rounded-md bg-error px-3 text-[13px] font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-60">
                    Uphold &amp; Remove
                  </button>
                </div>
              ) : (
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold', r.status === 'upheld' ? 'bg-error-bg text-error' : 'bg-white/[0.07] text-text-secondary')}>{r.status}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {uphold && (
        <div role="dialog" aria-modal aria-labelledby="uphold-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[440px] rounded-lg border border-white/[0.08] bg-[#16171B] p-5">
            <h2 id="uphold-title" className="text-[17px] font-semibold text-text-primary">Remove “{uphold.title}”</h2>
            <p className="mt-1 text-[13px] text-text-secondary">The listing is taken down, the seller is emailed this reason, and gets a strike. Every open report on it is closed as upheld.</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason the seller will read" className="mt-3 w-full resize-none rounded-md border border-white/[0.08] bg-bg-well px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-white/25" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setUphold(null)} className="h-9 rounded-md border border-white/[0.12] px-3 text-[13px] font-semibold text-text-secondary hover:bg-white/[0.06]">Cancel</button>
              <button type="button" disabled={pending || reason.trim().length < 3} onClick={() => act(uphold.id, 'upheld', reason)} className="h-9 rounded-md bg-error px-3 text-[13px] font-semibold text-white disabled:opacity-60">{pending ? 'Removing…' : 'Remove Listing'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
