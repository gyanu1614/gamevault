'use client'

/**
 * Step 4 — the batch preview and its controls.
 *
 * The table is the whole point: every input row, with what it matched, what it
 * will cost and why it will not apply. Apply runs in chunks (the action returns
 * `remaining`), so a 1,000-row batch is a progress bar rather than a timeout.
 *
 * Unmatched rows can be resolved in place: pick the right item from the
 * candidates and it is remembered for every future batch.
 */
import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Download, Pause, Play, Archive, Rocket, Wand2, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader, AdminPanel, StatCard, StatusBadge, TABLE, SectionLabel } from '../../components/kit'
import {
  applyImportBatch,
  pauseImportBatch,
  resumeImportBatch,
  removeImportBatch,
  teachImportAlias,
  type BatchDetail,
  type BatchRowView,
} from '@/lib/actions/admin-imports'

const STATUS_TONE: Record<string, string> = {
  matched: 'text-lime-text',
  ambiguous: 'text-amber-300',
  unmatched: 'text-amber-300',
  rejected: 'text-red-300',
}

function money(n: number | null): string {
  return n == null ? '—' : `$${n.toFixed(2)}`
}

/**
 * The preview's thumbnail.
 *
 * Renders ONLY images we host. A row that has not been applied yet carries the
 * SOURCE url (a catalogue or wiki address), and those cannot be trusted to
 * render in a browser: the Fandom CDN hotlink-blocks by Referer, and — measured
 * 2026-09-30 — answers a blocked request with `404 + an image body`, so the
 * browser decodes it happily, `onError` never fires, and the table fills with
 * someone else's "not found" graphic. A server-side fetch (no Referer, bot UA)
 * gets a 200, which is why the import itself is unaffected.
 *
 * So: before apply, every row shows a neutral placeholder saying the image is
 * fetched on import. After apply the row's url points at our own bucket and the
 * real thumbnail renders. `onError` is still wired for the ordinary case of one
 * of our own objects having gone missing.
 */
const OWN_IMAGE_MARKER = '/listing-images/'

function RowThumb({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false)
  const ours = !!url && url.includes(OWN_IMAGE_MARKER)

  if (!ours || broken) {
    return (
      <span
        title={
          url
            ? 'Image is copied into our own storage when you apply this batch — source images are not shown here because some hosts block hotlinking.'
            : 'No catalogue image — the importer fetches one from the game wiki when you apply this batch.'
        }
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border-subtle bg-[rgba(255,255,255,0.03)]"
      >
        <ImageOff className="h-3.5 w-3.5 text-text-tertiary" />
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      onError={() => setBroken(true)}
      className="h-7 w-7 shrink-0 rounded object-contain"
    />
  )
}

export default function BatchDetailClient({ batch }: { batch: BatchDetail }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [progress, setProgress] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'matched' | 'review' | 'rejected'>('all')

  const rows = useMemo(() => {
    if (filter === 'all') return batch.rows
    if (filter === 'matched') return batch.rows.filter((r) => r.status === 'matched')
    if (filter === 'rejected') return batch.rows.filter((r) => r.status === 'rejected')
    return batch.rows.filter((r) => r.status === 'ambiguous' || r.status === 'unmatched')
  }, [batch.rows, filter])

  const unappliedMatched = batch.rows.filter((r) => r.status === 'matched' && !r.listingId).length
  const canApply = unappliedMatched > 0 && batch.status !== 'removed'

  /** Apply chunk after chunk until the action reports nothing left. */
  function apply() {
    startTransition(async () => {
      let created = 0
      let updated = 0
      let failed = 0
      for (let guard = 0; guard < 200; guard += 1) {
        const res = await applyImportBatch(batch.id)
        if (!res.success) {
          toast.error(res.error)
          break
        }
        created += res.data.created
        updated += res.data.updated
        failed += res.data.failed
        setProgress(
          `${created + updated} of ${unappliedMatched} done` +
            (res.data.remaining > 0 ? ` — ${res.data.remaining} to go` : ''),
        )
        if (res.data.remaining === 0) break
      }
      setProgress(null)
      toast.success(`${created} created, ${updated} updated${failed ? `, ${failed} failed` : ''}`)
      router.refresh()
    })
  }

  function lifecycle(fn: typeof pauseImportBatch, verb: string) {
    startTransition(async () => {
      const res = await fn(batch.id)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(`${verb} ${res.data.affected} listing${res.data.affected === 1 ? '' : 's'}`)
      router.refresh()
    })
  }

  function teach(row: BatchRowView, itemRef: string) {
    startTransition(async () => {
      const res = await teachImportAlias({ batchId: batch.id, rowId: row.id, itemRef })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(`"${res.data.alias}" will match from now on — re-preview to pick it up`)
      router.refresh()
    })
  }

  /** Download the rows a human still has to deal with. */
  function downloadReview() {
    const needy = batch.rows.filter((r) => r.status !== 'matched')
    const header = 'row,item,variant,quantity,price,status,reason\n'
    const body = needy
      .map((r) =>
        [
          r.rowNo,
          r.raw.item ?? '',
          r.raw.variant ?? '',
          r.raw.quantity ?? '',
          r.raw.price ?? '',
          r.status,
          r.error ?? '',
        ]
          .map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c)))
          .join(','),
      )
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `import-${batch.id.slice(0, 8)}-review.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <Link
        href="/admin/imports"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Imports
      </Link>

      <PageHeader
        title={batch.label || 'Untitled batch'}
        description={`${batch.gameName} · ${batch.sellerName} · ${
          batch.pricingMode === 'auto' ? `market − ${batch.undercutPct}%` : 'prices from the sheet'
        }${batch.allowEstimated ? ' · estimated values allowed' : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadReview}
              disabled={batch.needsReview + (batch.rowCount - batch.matched) === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              Review CSV
            </button>
            {batch.status === 'applied' && (
              <button
                type="button"
                onClick={() => lifecycle(pauseImportBatch, 'Paused')}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-40"
              >
                <Pause className="h-3.5 w-3.5" />
                Pause All
              </button>
            )}
            {batch.status === 'paused' && (
              <button
                type="button"
                onClick={() => lifecycle(resumeImportBatch, 'Resumed')}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" />
                Resume All
              </button>
            )}
            {batch.status !== 'removed' && batch.applied > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`Archive all ${batch.applied} listings from this batch? They stop showing on the site; order history is kept.`)) return
                  lifecycle(removeImportBatch, 'Archived')
                }}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-2.5 py-1.5 text-[12.5px] font-semibold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-40"
              >
                <Archive className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
            {canApply && (
              <button
                type="button"
                onClick={apply}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-lime-400 px-3.5 py-1.5 text-[13px] font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Rocket className="h-4 w-4" />
                {pending ? progress ?? 'Applying…' : `Apply ${unappliedMatched} Rows`}
              </button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Rows" value={String(batch.rowCount)} />
        <StatCard label="Ready" value={String(batch.matched)} />
        <StatCard label="Live" value={String(batch.applied)} />
        <StatCard label="Needs Review" value={String(batch.needsReview)} />
        <StatCard label="Failed" value={String(batch.failed)} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SectionLabel className="mr-2">Rows</SectionLabel>
        {(['all', 'matched', 'review', 'rejected'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-[12px] font-semibold capitalize transition-colors',
              filter === f
                ? 'border-lime-400/40 bg-lime-400/10 text-lime-text'
                : 'border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <AdminPanel pad={false}>
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>#</th>
                <th className={TABLE.th}>Input</th>
                <th className={TABLE.th}>Matched</th>
                <th className={TABLE.th}>Title</th>
                <th className={TABLE.th}>Stock</th>
                <th className={TABLE.th}>Market</th>
                <th className={TABLE.th}>Price</th>
                <th className={TABLE.th}>State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={TABLE.row}>
                  <td className={TABLE.td}>{r.rowNo}</td>
                  <td className={TABLE.td}>
                    <span className="font-mono text-[12px] text-text-tertiary">
                      {[r.raw.item, r.raw.variant].filter(Boolean).join(' · ') || '(empty)'}
                    </span>
                  </td>
                  <td className={TABLE.tdPrimary}>
                    {r.itemName ? (
                      <span className="flex items-center gap-2">
                        <RowThumb url={r.imageUrl} />
                        <span>
                          {r.itemName}
                          {r.variantLabel && (
                            <span className="ml-1 text-[12px] font-normal text-text-tertiary">
                              {r.variantLabel}
                            </span>
                          )}
                        </span>
                      </span>
                    ) : r.candidates.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Wand2 className="h-3.5 w-3.5 text-amber-400" />
                        {r.candidates.map((c) => (
                          <button
                            key={c.ref}
                            type="button"
                            onClick={() => teach(r, c.ref)}
                            disabled={pending}
                            className="rounded border border-border-subtle px-1.5 py-0.5 text-[11.5px] font-semibold text-text-secondary transition-colors hover:border-lime-400/40 hover:text-lime-text disabled:opacity-40"
                          >
                            {c.name}
                          </button>
                        ))}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className={TABLE.td}>
                    <span className="text-[12.5px]">{r.title ?? '—'}</span>
                  </td>
                  <td className={TABLE.td}>{r.quantity ?? '—'}</td>
                  <td className={TABLE.td}>{money(r.marketPrice)}</td>
                  <td className={TABLE.tdPrimary}>{money(r.resolvedPrice)}</td>
                  <td className={TABLE.td}>
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className={cn('text-[12px] font-semibold capitalize', STATUS_TONE[r.status])}>
                          {r.status}
                        </span>
                        {r.action && <StatusBadge status={r.action} />}
                      </span>
                      {r.error && (
                        <span className="max-w-[320px] text-[11.5px] leading-snug text-text-tertiary">
                          {r.error}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className={TABLE.td} colSpan={8}>
                    <p className="py-6 text-center text-text-tertiary">No rows in this filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  )
}
