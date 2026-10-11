'use client'

/**
 * Step 4 — the bulk import list + "new import" form.
 *
 * Flow: pick the store + game + pricing, paste (or drop a CSV), Preview. The
 * preview is a separate page (`/admin/imports/[id]`) because it is the thing an
 * admin reads carefully before applying, and it needs its own URL to come back
 * to.
 *
 * Nothing here writes a listing — Preview only stores the batch and its rows.
 */
import { useMemo, useRef, useState, useTransition } from 'react'
import Link from '@/components/navigation/AppLink'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Upload, FileSpreadsheet, ChevronRight, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader, AdminPanel, StatusBadge, TABLE, SectionLabel } from '../../components/kit'
import {
  createImportBatch,
  type BatchSummaryRow,
  type ImportableGame,
  type StoreSellerOption,
} from '@/lib/actions/admin-imports'

const INPUT_CLASS =
  'w-full rounded-lg border border-border-subtle bg-[rgba(18,18,24,0.7)] px-3 py-2 text-[14px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-border-strong'

export default function ImportsPageClient({
  initialBatches,
  games,
  sellers,
  loadError,
}: {
  initialBatches: BatchSummaryRow[]
  games: ImportableGame[]
  sellers: StoreSellerOption[]
  loadError: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const firstReady = games.find((g) => g.categoryEnabled)
  const [sellerId, setSellerId] = useState(sellers[0]?.id ?? '')
  const [gameId, setGameId] = useState(firstReady?.id ?? games[0]?.id ?? '')
  const [label, setLabel] = useState('')
  const [pricingMode, setPricingMode] = useState<'auto' | 'explicit'>('auto')
  const [undercutPct, setUndercutPct] = useState('10')
  const [allowEstimated, setAllowEstimated] = useState(false)
  const [defaultQuantity, setDefaultQuantity] = useState('1')
  const [text, setText] = useState('')
  const [source, setSource] = useState<'paste' | 'csv'>('paste')

  const game = useMemo(() => games.find((g) => g.id === gameId) ?? null, [games, gameId])
  const rowCount = useMemo(() => text.split(/\r?\n/).filter((l) => l.trim()).length, [text])

  const blocked =
    !sellerId || !gameId || !text.trim() || !game?.categoryEnabled || pending

  async function onFile(file: File) {
    const body = await file.text()
    setText(body)
    setSource('csv')
    toast.success(`Loaded ${file.name}`)
  }

  function submit() {
    startTransition(async () => {
      const res = await createImportBatch({
        sellerId,
        gameId,
        source,
        label: label || null,
        pricingMode,
        undercutPct: Number(undercutPct) || 0,
        allowEstimated,
        defaultQuantity: Number(defaultQuantity) || 1,
        text,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      const s = res.data.summary
      toast.success(`${s.matched} of ${s.total} rows matched`)
      for (const w of res.data.inputErrors) toast.warning(w)
      router.push(`/admin/imports/${res.data.batchId}`)
    })
  }

  return (
    <div>
      <PageHeader
        title="Bulk Import"
        description="Turn a supplier's stock list into listings. Nothing goes live until you apply a batch."
      />

      {loadError && (
        <AdminPanel className="mb-6 border-red-500/30">
          <p className="text-[13.5px] text-red-300">{loadError}</p>
        </AdminPanel>
      )}

      {/* ── New batch ─────────────────────────────────────────────── */}
      <AdminPanel className="mb-8">
        <SectionLabel>New Import</SectionLabel>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-text-secondary">Store Account</span>
            <select value={sellerId} onChange={(e) => setSellerId(e.target.value)} className={INPUT_CLASS}>
              {sellers.length === 0 && <option value="">No active sellers</option>}
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shopName || s.username} ({s.activeListings} live)
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-text-secondary">Game</span>
            <select value={gameId} onChange={(e) => setGameId(e.target.value)} className={INPUT_CLASS}>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.categoryEnabled ? '' : ' — category off'}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-text-secondary">Pricing</span>
            <select
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as 'auto' | 'explicit')}
              className={INPUT_CLASS}
            >
              <option value="auto">Market price, minus undercut</option>
              <option value="explicit">Prices from the sheet</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-text-secondary">
              Undercut %{pricingMode === 'explicit' && ' (unused)'}
            </span>
            <input
              type="number"
              min={0}
              max={90}
              value={undercutPct}
              onChange={(e) => setUndercutPct(e.target.value)}
              disabled={pricingMode === 'explicit'}
              className={cn(INPUT_CLASS, pricingMode === 'explicit' && 'opacity-40')}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-text-secondary">Batch Label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={game ? `${game.name} restock` : 'Optional'}
              className={INPUT_CLASS}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-text-secondary">
              Default Stock
            </span>
            <input
              type="number"
              min={1}
              value={defaultQuantity}
              onChange={(e) => setDefaultQuantity(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>

          <label className="flex items-start gap-2 sm:col-span-2 sm:pt-6">
            <input
              type="checkbox"
              checked={allowEstimated}
              onChange={(e) => setAllowEstimated(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-lime-400"
            />
            <span className="text-[12.5px] leading-snug text-text-secondary">
              <span className="font-semibold text-text-primary">Use estimated values.</span>{' '}
              Some items only have a derived value, not one observed from live listings. Off, those
              rows are skipped instead of priced from a guess.
            </span>
          </label>
        </div>

        {game && !game.categoryEnabled && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-[12.5px] text-amber-200">
              The <strong>{game.categorySlug}</strong> category is switched off for {game.name}. Turn
              it on in{' '}
              <Link href="/admin/games" className="underline">
                Admin → Games
              </Link>{' '}
              before importing.
            </p>
          </div>
        )}

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-text-secondary">
              Rows{' '}
              <span className="font-normal text-text-tertiary">
                — {game?.itemNoun ?? 'item'}
                {game?.variantNoun ? `, ${game.variantNoun}` : ''}, quantity, price
              </span>
            </span>
            <div className="flex items-center gap-2">
              {rowCount > 0 && (
                <span className="text-[11.5px] text-text-tertiary">{rowCount} lines</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onFile(f)
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1 text-[12px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload CSV
              </button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setSource('paste')
            }}
            rows={10}
            spellCheck={false}
            placeholder={
              game?.variantNoun
                ? 'Frost Dragon\tFR\t3\nShadow Dragon\tNFR\t1\t24.99'
                : 'Jungle Egg\t5\nVolcano Egg\t2\t1.20'
            }
            className={cn(INPUT_CLASS, 'font-mono text-[12.5px] leading-relaxed')}
          />
          <p className="mt-1.5 text-[11.5px] text-text-tertiary">
            Paste straight from a spreadsheet, or upload a CSV. A header row is optional. A row with
            its own price uses that price; the rest follow the pricing mode above.
          </p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={blocked}
            className="inline-flex items-center gap-2 rounded-lg bg-lime-400 px-4 py-2 text-[13.5px] font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {pending ? 'Matching…' : 'Preview Import'}
          </button>
          <span className="text-[12px] text-text-tertiary">
            Preview matches every row against the catalogue. Nothing is published yet.
          </span>
        </div>
      </AdminPanel>

      {/* ── Batch history ─────────────────────────────────────────── */}
      <SectionLabel>Batches</SectionLabel>
      <AdminPanel pad={false} className="mt-3">
        {initialBatches.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13.5px] text-text-tertiary">
            No imports yet. Your first batch will appear here.
          </p>
        ) : (
          <div className={TABLE.wrap}>
            <table className={TABLE.table}>
              <thead>
                <tr>
                  <th className={TABLE.th}>Batch</th>
                  <th className={TABLE.th}>Game</th>
                  <th className={TABLE.th}>Store</th>
                  <th className={TABLE.th}>Status</th>
                  <th className={TABLE.th}>Rows</th>
                  <th className={TABLE.th}>Live</th>
                  <th className={TABLE.th}>Needs Review</th>
                  <th className={TABLE.th}>Created</th>
                  <th className={TABLE.th} />
                </tr>
              </thead>
              <tbody>
                {initialBatches.map((b) => (
                  <tr key={b.id} className={TABLE.row}>
                    <td className={TABLE.tdPrimary}>{b.label || 'Untitled batch'}</td>
                    <td className={TABLE.td}>{b.gameName}</td>
                    <td className={TABLE.td}>{b.sellerName}</td>
                    <td className={TABLE.td}>
                      <StatusBadge status={b.status} />
                    </td>
                    <td className={TABLE.td}>{b.rowCount}</td>
                    <td className={TABLE.td}>{b.live}</td>
                    <td className={TABLE.td}>
                      {b.needsReview > 0 ? (
                        <span className="font-semibold text-amber-300">{b.needsReview}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={TABLE.td}>{new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</td>
                    <td className={TABLE.td}>
                      <Link
                        href={`/admin/imports/${b.id}`}
                        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-lime-text hover:opacity-80"
                      >
                        Open
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </div>
  )
}
