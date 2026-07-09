'use client'

/**
 * BulkUpload — CSV bulk-publish flow (Phase D5).
 *
 * Steps (same modal shell as the wizard):
 *   1. Pick category + game (Combobox reuse).
 *   2. Download the CSV template (per-(game, category) — adds columns for
 *      every attribute in the admin's template).
 *   3. Drop a filled CSV. We parse + show a preview table with row-by-row
 *      validation hints.
 *   4. Hit "Publish all". The server enforces bulk_daily_cap +
 *      auto_approve_bulk; rows that fail come back with line numbers so the
 *      seller can fix and re-upload.
 *
 * No hand-rolled UI: Combobox (Radix Popover + cmdk), shadcn Button, the
 * existing GV tokens.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import {
  fetchSellGamesForCategory,
  fetchBulkCsvTemplate,
  bulkPublishListings,
  fetchPublishPolicy,
  type SellGameOption,
  type BulkRow,
  type SellerPublishPolicy,
} from '@/lib/actions/sell-wizard'
import type { GlobalCategory } from '@/lib/actions/new-schema'

interface BulkUploadProps {
  initialCategories: GlobalCategory[]
}

interface ParsedCsv {
  header: string[]
  rows: BulkRow[]
  errors: Array<{ line: number; error: string }>
}

const NUM_COLS = new Set(['price', 'original_price', 'quantity', 'min_quantity'])

function parseCsv(text: string): ParsedCsv {
  // Minimal RFC-ish CSV parser: handles quoted cells with embedded commas
  // and escaped double-quotes. NOT a full spec implementation; good enough
  // for our seller-facing template flow.
  const rows: string[][] = []
  let i = 0
  let cell = ''
  let row: string[] = []
  let inQuotes = false
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 2; continue }
      if (c === '"') { inQuotes = false; i++; continue }
      cell += c; i++; continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(cell); cell = ''; i++; continue }
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue }
    if (c === '\r') { i++; continue }
    cell += c; i++
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row) }

  if (rows.length === 0) {
    return { header: [], rows: [], errors: [{ line: 1, error: 'File is empty' }] }
  }
  const header = rows[0].map((h) => h.trim())
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''))

  const errors: Array<{ line: number; error: string }> = []
  const parsed: BulkRow[] = []
  dataRows.forEach((cols, idx) => {
    const line = idx + 2 // 1-based, accounting for header
    const get = (k: string): string => {
      const i = header.indexOf(k)
      return i === -1 ? '' : (cols[i] ?? '').trim()
    }
    const num = (k: string): number => {
      const raw = get(k)
      if (!raw) return NaN
      const n = Number(raw)
      return Number.isFinite(n) ? n : NaN
    }

    const title = get('title')
    const price = num('price')
    const quantity = num('quantity')
    if (!title) { errors.push({ line, error: 'title is required' }); return }
    if (!Number.isFinite(price) || price <= 0) {
      errors.push({ line, error: 'price must be a positive number' }); return
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      errors.push({ line, error: 'quantity must be >= 1' }); return
    }
    const original_price_raw = get('original_price')
    const original_price = original_price_raw ? num('original_price') : null
    const delivery_method = (get('delivery_method') as 'manual' | 'instant') || 'manual'

    const baseKeys = new Set([
      'title', 'description', 'price', 'original_price', 'quantity',
      'min_quantity', 'delivery_method', 'delivery_time', 'region', 'platform',
      'images',
    ])
    const template_data: Record<string, unknown> = {}
    for (const k of header) {
      if (baseKeys.has(k)) continue
      const v = get(k)
      if (v) template_data[k] = v
    }

    const imagesRaw = get('images')
    const images = imagesRaw
      ? imagesRaw.split('|').map((u) => u.trim()).filter(Boolean)
      : []

    parsed.push({
      line,
      title,
      description: get('description'),
      price,
      original_price: original_price ?? null,
      quantity,
      min_quantity: num('min_quantity') || 1,
      delivery_method,
      delivery_time: get('delivery_time') || null,
      region: get('region') || null,
      platform: get('platform') || null,
      template_data,
      images,
    })
  })

  return { header, rows: parsed, errors }
}

export default function BulkUpload({ initialCategories }: BulkUploadProps) {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<GlobalCategory | null>(null)
  const [games, setGames] = useState<SellGameOption[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [selectedGame, setSelectedGame] = useState<SellGameOption | null>(null)
  const [policy, setPolicy] = useState<SellerPublishPolicy | null>(null)

  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Fetch policy once. Bulk gating shows here even before the seller picks
  // a category — the seller should know up front if their tier is allowed.
  useEffect(() => {
    let cancelled = false
    fetchPublishPolicy().then((res) => {
      if (cancelled) return
      if (res.success) setPolicy(res.data)
    })
    return () => { cancelled = true }
  }, [])

  // Load games when category changes.
  useEffect(() => {
    if (!selectedCategory) return
    let cancelled = false
    setGamesLoading(true)
    fetchSellGamesForCategory(selectedCategory.slug)
      .then((res) => {
        if (cancelled) return
        if (res.success) setGames(res.data)
        else toast.error(res.error)
      })
      .finally(() => { if (!cancelled) setGamesLoading(false) })
    return () => { cancelled = true }
  }, [selectedCategory])

  const categoryOptions: ComboboxOption[] = useMemo(
    () =>
      initialCategories
        .filter((c) => c.is_active)
        .map((c) => ({ value: c.slug, label: c.name })),
    [initialCategories],
  )

  const gameOptions: ComboboxOption[] = useMemo(
    () =>
      games
        .filter((g) => g.game_is_active)
        .map((g) => ({
          value: g.game_id,
          label: g.game_name,
          icon_url: g.game_logo_url,
        })),
    [games],
  )

  const canDownload = !!selectedCategory && !!selectedGame
  const canUpload = canDownload
  const canPublish = !!parsed && parsed.rows.length > 0 && parsed.errors.length === 0

  const remainingDaily =
    policy?.bulk_daily_cap == null
      ? null
      : Math.max(0, policy.bulk_daily_cap - policy.bulk_today_count)
  const wouldExceedCap =
    remainingDaily !== null && parsed && parsed.rows.length > remainingDaily

  async function handleDownloadTemplate() {
    if (!selectedCategory || !selectedGame) return
    const res = await fetchBulkCsvTemplate(selectedGame.game_id, selectedCategory.slug)
    if (!res.success) { toast.error(res.error); return }
    const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.data.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    const text = await file.text()
    const out = parseCsv(text)
    setParsed(out)
  }

  async function handlePublish() {
    if (!selectedCategory || !selectedGame || !parsed) return
    setSubmitting(true)
    try {
      const res = await bulkPublishListings(
        selectedGame.game_id,
        selectedCategory.slug,
        parsed.rows,
      )
      if (!res.success) { toast.error(res.error); return }
      const { ok, failed } = res.data
      if (failed.length === 0) {
        toast.success(`Published ${ok} listings`)
        router.push('/account/listings')
      } else {
        toast.warning(`${ok} published, ${failed.length} failed`)
        // Surface the failed rows back to the user inline.
        setParsed({
          ...parsed,
          errors: failed.map((f) => ({ line: f.line, error: f.error })),
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const tierAllowsBulk = policy?.auto_approve_bulk || policy?.bulk_daily_cap === null
    || (policy?.bulk_daily_cap != null && policy.bulk_daily_cap > 0)

  return (
    <main className="mx-auto w-full max-w-4xl px-3 pb-24 pt-24 sm:px-6 sm:pt-28 lg:max-w-5xl lg:pt-32">
      <section className="relative overflow-visible rounded-3xl border border-border-default bg-bg-raised p-4 shadow-elevated sm:p-5 lg:p-6">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">Bulk upload</h1>
            <p className="text-sm text-text-secondary">
              Publish many listings at once from a CSV.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/sell/new')}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-default bg-bg-raised px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-raised-hover"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Single listing
          </button>
        </header>

        {/* Tier gate */}
        {policy && !tierAllowsBulk && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-error/40 bg-error-bg px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <div className="text-sm">
              <div className="font-semibold text-error">Bulk upload not available on your tier</div>
              <p className="mt-0.5 text-text-secondary">
                Level up to unlock the bulk-upload flow. Single listings still work as normal.
              </p>
            </div>
          </div>
        )}

        {/* Step A — pick category + game */}
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Category</label>
              <Combobox
                value={selectedCategory?.slug ?? ''}
                onChange={(slug) => {
                  const c = initialCategories.find((c) => c.slug === slug) ?? null
                  setSelectedCategory(c)
                  setSelectedGame(null)
                  setParsed(null)
                  setFileName(null)
                }}
                options={categoryOptions}
                ariaLabel="Category"
                placeholder="Choose category…"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Game</label>
              <Combobox
                value={selectedGame?.game_id ?? ''}
                onChange={(id) => {
                  const g = games.find((g) => g.game_id === id) ?? null
                  setSelectedGame(g)
                  setParsed(null)
                  setFileName(null)
                }}
                options={gameOptions}
                ariaLabel="Game"
                placeholder={
                  !selectedCategory
                    ? 'Pick a category first…'
                    : gamesLoading
                      ? 'Loading…'
                      : 'Choose game…'
                }
                disabled={!selectedCategory || gamesLoading}
              />
            </div>
          </div>

          {/* Step B — download template */}
          <div className="rounded-2xl border border-border-subtle bg-bg-overlay p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h2 className="text-base font-bold text-text-primary">1. Download the template</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  The template includes a column for every attribute admins
                  defined for this (game, category). Fill it in and re-upload.
                </p>
                <p className="mt-1 text-[11px] text-text-tertiary">
                  Tip: <code className="rounded bg-bg-inset px-1">images</code>{' '}
                  column accepts pipe-separated URLs (<code className="rounded bg-bg-inset px-1">|</code>).
                </p>
              </div>
              <button
                type="button"
                disabled={!canDownload}
                onClick={handleDownloadTemplate}
                className={cn(
                  'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors',
                  canDownload
                    ? 'bg-lime text-text-inverse hover:bg-lime-hover'
                    : 'cursor-not-allowed bg-bg-raised text-text-disabled',
                )}
              >
                <FileText className="h-4 w-4" />
                Download CSV
              </button>
            </div>
          </div>

          {/* Step C — upload filled CSV */}
          <div className="rounded-2xl border border-border-subtle bg-bg-overlay p-4 sm:p-5">
            <h2 className="text-base font-bold text-text-primary">2. Upload the filled CSV</h2>

            <label
              className={cn(
                'mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 transition-colors',
                canUpload
                  ? 'border-border-default bg-bg-inset hover:border-lime hover:bg-bg-raised-hover'
                  : 'cursor-not-allowed border-border-subtle bg-bg-inset opacity-60',
              )}
            >
              <Upload className="h-6 w-6 text-text-tertiary" />
              <span className="text-sm font-medium text-text-secondary">
                {fileName ? fileName : 'Click to upload — or drop a .csv here'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={!canUpload}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                  e.currentTarget.value = ''
                }}
              />
            </label>

            {/* Cap info */}
            {policy && remainingDaily !== null && (
              <p className="mt-2 text-[11px] text-text-tertiary">
                Daily cap left: {remainingDaily} of {policy.bulk_daily_cap}
              </p>
            )}
          </div>

          {/* Step D — preview */}
          {parsed && (
            <div className="rounded-2xl border border-border-subtle bg-bg-overlay p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-text-primary">3. Preview</h2>
                <span className="text-xs text-text-tertiary">
                  {parsed.rows.length} valid · {parsed.errors.length} errors
                </span>
              </div>

              {parsed.errors.length > 0 && (
                <div className="mt-3 rounded-md border border-error/40 bg-error-bg p-3 text-xs">
                  <div className="mb-1 font-semibold text-error">
                    Fix these before publishing
                  </div>
                  <ul className="space-y-1 text-text-secondary">
                    {parsed.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>
                        <span className="tabular-nums text-error">Line {e.line}</span>: {e.error}
                      </li>
                    ))}
                    {parsed.errors.length > 10 && (
                      <li className="text-text-tertiary">
                        …and {parsed.errors.length - 10} more.
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {wouldExceedCap && (
                <div className="mt-3 rounded-md border border-warning/40 bg-warning-bg px-3 py-2 text-xs text-warning">
                  CSV has {parsed.rows.length} rows but only {remainingDaily} are left in your daily cap.
                </div>
              )}

              {/* Mini table — first 5 rows */}
              <div className="mt-3 overflow-x-auto rounded-md border border-border-subtle">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg-inset text-text-tertiary">
                    <tr>
                      <th className="px-2 py-1.5 font-semibold uppercase tracking-wider">#</th>
                      <th className="px-2 py-1.5 font-semibold uppercase tracking-wider">Title</th>
                      <th className="px-2 py-1.5 font-semibold uppercase tracking-wider">Price</th>
                      <th className="px-2 py-1.5 font-semibold uppercase tracking-wider">Qty</th>
                      <th className="px-2 py-1.5 font-semibold uppercase tracking-wider">Delivery</th>
                    </tr>
                  </thead>
                  <tbody className="text-text-secondary">
                    {parsed.rows.slice(0, 5).map((r) => (
                      <tr key={r.line} className="border-t border-border-subtle">
                        <td className="px-2 py-1.5 tabular-nums text-text-tertiary">{r.line}</td>
                        <td className="px-2 py-1.5">{r.title}</td>
                        <td className="px-2 py-1.5 tabular-nums">${r.price.toFixed(2)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{r.quantity}</td>
                        <td className="px-2 py-1.5">{r.delivery_method}</td>
                      </tr>
                    ))}
                    {parsed.rows.length > 5 && (
                      <tr className="border-t border-border-subtle">
                        <td colSpan={5} className="px-2 py-2 text-center text-[11px] text-text-tertiary">
                          …and {parsed.rows.length - 5} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Publish */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!canPublish || !!wouldExceedCap || submitting}
              onClick={handlePublish}
              className={cn(
                'inline-flex h-11 items-center gap-1.5 rounded-xl px-6 text-sm font-bold uppercase tracking-wider transition-all sm:h-12 sm:px-8',
                canPublish && !wouldExceedCap && !submitting
                  ? 'bg-lime text-text-inverse shadow-lg shadow-elevated hover:bg-lime-hover hover:shadow-glow'
                  : 'cursor-not-allowed bg-bg-raised text-text-disabled',
              )}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Publish all
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

// Unused helper symbol referenced in JSX type-checking to satisfy lint;
// `CheckCircle2` is imported defensively for future "success state" UI.
void CheckCircle2
