'use client'

/**
 * V17y — Per-game CURRENCY config editor.
 *
 * Lives inside the tabbed `/admin/games/[id]/edit` detail page. Reads
 * the row from `category_configs (game_id, 'currency')` via the
 * server action and writes back the same way. Form state is local
 * until "Save" — no autosave (predictable, easy to undo by leaving
 * the page).
 *
 * Default empty state: if no row exists yet, we hydrate from
 * DEFAULT_CURRENCY_CONFIG. The admin can edit and the first save
 * creates the row.
 */

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  fetchCategoryConfigAdmin,
  upsertCategoryConfig,
} from '@/lib/actions/admin-category-configs'
import {
  DEFAULT_CURRENCY_CONFIG,
  type CurrencyConfig,
} from '@/lib/types/category-configs'
import { PlatformFieldsSection } from './PlatformFieldsSection'
import { CurrencyBundlesSection } from './CurrencyBundlesSection'
import { uploadCurrencyImage } from '@/lib/actions/admin-category-configs'

export function CurrencyConfigForm({ gameId }: { gameId: string }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<CurrencyConfig | null>(null)

  const query = useQuery({
    queryKey: ['admin-category-config', gameId, 'currency'],
    queryFn: async () => {
      const cfg = await fetchCategoryConfigAdmin(gameId, 'currency')
      // Seed local draft state once on first load.
      setDraft(cfg ?? DEFAULT_CURRENCY_CONFIG)
      return cfg
    },
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: async (next: CurrencyConfig) =>
      upsertCategoryConfig(gameId, 'currency', next),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Currency settings saved')
      qc.invalidateQueries({ queryKey: ['admin-category-config', gameId, 'currency'] })
    },
    onError: (err: any) => toast.error(err?.message ?? 'Save failed'),
  })

  // V19/P24/P2 — Icon-upload hooks must live ABOVE the early loading
  // return so React sees the same hook order on every render
  // (Rules of Hooks). Putting them after the `if (loading) return`
  // caused "Rendered more hooks than during the previous render"
  // the moment the query resolved and the form mounted.
  const iconFileRef = useRef<HTMLInputElement | null>(null)
  const [iconUploading, setIconUploading] = useState(false)

  if (query.isLoading || !draft) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading currency settings…
      </div>
    )
  }

  const patch = (p: Partial<CurrencyConfig>) =>
    setDraft((d) => (d ? { ...d, ...p } : d))

  // V19/P24/P2 — Currency icon upload. Reuses uploadCurrencyImage
  // which writes to the existing category-icons bucket under a
  // currency/ prefix. The URL gets persisted into the config blob
  // when the admin clicks Save (we don't auto-save the upload).
  const onUploadIcon = (file: File | null | undefined) => {
    if (!file) return
    setIconUploading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = String(reader.result ?? '')
      const res = await uploadCurrencyImage(gameId, {
        name: file.name,
        type: file.type,
        size: file.size,
        base64,
      })
      setIconUploading(false)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      patch({ currency_icon_url: res.data.url })
    }
    reader.readAsDataURL(file)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!draft) return
        mutation.mutate(draft)
      }}
      className="space-y-7"
    >
      {/* ── Identity ──
          V19/P24/P7.b — Compact two-column layout: icon tile on the
          left, all text fields stacked on the right. No more giant
          empty band under the icon. */}
      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <h3 className="text-[15px] font-semibold text-text-primary">Identity</h3>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* Icon tile — fixed size, on the left */}
          <div className="flex flex-col items-start gap-2 sm:w-[88px]">
            <Label className="text-[12px] text-text-secondary">Icon</Label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => iconFileRef.current?.click()}
                className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-default bg-bg-overlay transition-colors hover:border-lime-tint-border"
                aria-label="Upload currency icon"
              >
                {draft.currency_icon_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={draft.currency_icon_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : iconUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
                ) : (
                  <Upload className="h-5 w-5 text-text-tertiary" />
                )}
                <input
                  ref={iconFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => onUploadIcon(e.target.files?.[0])}
                />
              </button>
              {draft.currency_icon_url && (
                <button
                  type="button"
                  onClick={() => patch({ currency_icon_url: null })}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-default bg-bg-overlay text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
                  aria-label="Remove icon"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right side — Unit label / Glyph / Tagline stacked */}
          <div className="flex-1 space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field label="Unit label" hint="What the currency is called">
                <Input
                  value={draft.unit_label}
                  onChange={(e) => patch({ unit_label: e.target.value })}
                  placeholder="Robux"
                />
              </Field>
              <Field label="Glyph" hint="Short symbol">
                <Input
                  value={draft.glyph}
                  onChange={(e) => patch({ glyph: e.target.value.slice(0, 6) })}
                  placeholder="R$"
                  className="text-center"
                />
              </Field>
            </div>
            <Field label="Tagline" hint="Shown above the hero">
              <Input
                value={draft.tagline}
                onChange={(e) => patch({ tagline: e.target.value })}
                placeholder="In-game currency for ..."
              />
            </Field>
          </div>
        </div>
      </section>

      {/* ── Pricing rules ── */}
      {(() => {
        // V19/P24/P4.a — Bundle mode collapses the Granularity / Min
        // quantity / Quantity step fields. Each bundle IS the unit,
        // so those rules are managed implicitly by the bundle row.
        // The price floor still applies (cheapest $/bundle accepted)
        // but the label drops "per K" — admins reading floor in
        // bundle mode are setting "$ per bundle".
        const isBundleMode = (draft.bundles?.length ?? 0) > 0
        return (
      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <h3 className="text-[15px] font-semibold text-text-primary">Pricing rules</h3>
        {isBundleMode && (
          <div className="rounded-xl border border-lime-tint-border bg-lime-tint-bg/40 px-3 py-2 text-[12.5px] text-text-secondary">
            <span className="font-semibold text-lime-text">Bundle mode.</span>{' '}
            Each bundle is its own quantity unit, so granularity, minimum quantity,
            and quantity step don’t apply. The price floor below still gates the
            cheapest $ a seller can list per bundle.
          </div>
        )}
        <p className="text-[12.5px] text-text-secondary">
          The seller wizard rejects per-unit prices below this minimum. The buyer page automatically
          surfaces the cheapest active listing as the recommended offer.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={
              isBundleMode
                ? 'Minimum listing price ($)'
                : `Minimum price per ${formatGranularityLabel(draft)}`
            }
            hint={
              isBundleMode
                ? 'Sellers can’t list below this price'
                : 'Cheapest accepted $ per unit of granularity'
            }
          >
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={draft.price_floor}
              onChange={(e) => patch({ price_floor: parseFloat(e.target.value) || 0 })}
            />
          </Field>
        </div>
        {!isBundleMode && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Minimum quantity" hint="Lowest order size buyers can pick">
              <Input
                type="number"
                step="1"
                min="1"
                value={draft.min_quantity}
                onChange={(e) => patch({ min_quantity: parseInt(e.target.value || '0', 10) })}
              />
            </Field>
            <Field label="Quantity step" hint="Increment used by the +/- buttons">
              <Input
                type="number"
                step="1"
                min="1"
                value={draft.quantity_step}
                onChange={(e) => patch({ quantity_step: parseInt(e.target.value || '0', 10) })}
              />
            </Field>
            {/* V19/P2.b — Granularity controls the suffix everywhere a
                quantity is displayed. "Unit" = absolute count, "Thousand"
                = a 1 in qty means 1,000 actual units, "Million" likewise. */}
            <Field label="Granularity" hint="What 1 unit of quantity equals">
              <Select
                value={draft.quantity_granularity ?? 'unit'}
                onValueChange={(v) =>
                  patch({ quantity_granularity: v as 'unit' | 'thousand' | 'million' })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unit">Unit</SelectItem>
                  <SelectItem value="thousand">Thousand (K)</SelectItem>
                  <SelectItem value="million">Million (M)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
      </section>
        )
      })()}

      {/* ── Seller-side instructions ── */}
      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <h3 className="text-[15px] font-semibold text-text-primary">Seller instructions</h3>
        <Field
          label="Placeholder text"
          hint="Shown to sellers as a hint while filling out their listing"
        >
          <Textarea
            value={draft.seller_instructions_placeholder}
            onChange={(e) => patch({ seller_instructions_placeholder: e.target.value })}
            rows={3}
            placeholder="e.g. Send us gamepass or in-game item details ..."
          />
        </Field>
      </section>

      {/* ── V19/P3 — Platform / region / device requirements ── */}
      <PlatformFieldsSection
        gameId={gameId}
        value={draft.platform_fields}
        onChange={(platform_fields) => patch({ platform_fields })}
      />

      {/* ── V19/P24 — Fixed bundles list ── */}
      <CurrencyBundlesSection
        gameId={gameId}
        value={draft.bundles}
        onChange={(bundles) => patch({ bundles })}
      />

      {/* ── How it works ── */}
      <StepsEditor
        steps={draft.steps}
        onChange={(steps) => patch({ steps })}
      />

      {/* ── FAQ ── */}
      <FaqEditor
        faq={draft.faq}
        onChange={(faq) => patch({ faq })}
      />

      <div className="sticky bottom-4 z-10 flex justify-end gap-2 rounded-xl border border-border-default bg-bg-raised/95 p-3 backdrop-blur-md shadow-elevated">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-4 py-2 text-[13px] font-semibold text-text-inverse transition-colors hover:bg-lime-hover disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save currency settings
        </button>
      </div>
    </form>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────── */

/**
 * V19/P6 — "Price per K" / "Price per Robux" / "Price per M Tokens"
 * depending on granularity + unit_label. Keeps the admin-facing
 * label honest: when the admin sets unit_label="Tokens" and
 * granularity="thousand", they see "Minimum price per K Tokens".
 */
function formatGranularityLabel(draft: CurrencyConfig): string {
  const unit = (draft.unit_label || 'unit').trim()
  switch (draft.quantity_granularity) {
    case 'thousand': return `K ${unit}`
    case 'million':  return `M ${unit}`
    case 'unit':
    default:         return unit
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  // V19/P24/P5 — Label and hint stacked vertically. Previously they
  // shared a row via `justify-between`, which made both wrap into
  // letter-soup whenever the surrounding grid column got narrow
  // (the Identity section is the canonical victim). Stacking gives
  // each its own line and the hint sits as a quiet caption below.
  return (
    <div className="space-y-1.5">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        {hint && <p className="text-[11px] leading-snug text-text-tertiary">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function StepsEditor({
  steps,
  onChange,
}: {
  steps: CurrencyConfig['steps']
  onChange: (next: CurrencyConfig['steps']) => void
}) {
  const update = (i: number, p: Partial<CurrencyConfig['steps'][number]>) => {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...p } : s)))
  }
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i))
  const add = () =>
    onChange([
      ...steps,
      { n: steps.length + 1, title: 'New step', body: '' },
    ])

  return (
    <section className="space-y-3 rounded-2xl border border-border-default bg-bg-raised p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-text-primary">How it works</h3>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-[12px] font-semibold text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary"
        >
          <Plus className="h-3 w-3" /> Step
        </button>
      </div>
      <p className="text-[12.5px] text-text-secondary">
        Three short steps shown on the buyer page below the sellers list.
      </p>
      <div className="space-y-2.5">
        {steps.map((s, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-xl border border-border-subtle bg-bg-overlay/40 p-3 sm:grid-cols-[64px_1fr_auto]"
          >
            <Input
              type="number"
              value={s.n}
              onChange={(e) => update(i, { n: parseInt(e.target.value || '0', 10) })}
              className="text-center"
            />
            <div className="space-y-2">
              <Input
                value={s.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Step title"
              />
              <Textarea
                value={s.body}
                onChange={(e) => update(i, { body: e.target.value })}
                rows={2}
                placeholder="Step description"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="h-8 w-8 self-start rounded-lg text-text-tertiary transition-colors hover:bg-error-bg hover:text-error"
              title="Remove step"
            >
              <Trash2 className="mx-auto h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function FaqEditor({
  faq,
  onChange,
}: {
  faq: CurrencyConfig['faq']
  onChange: (next: CurrencyConfig['faq']) => void
}) {
  const update = (i: number, p: Partial<CurrencyConfig['faq'][number]>) => {
    onChange(faq.map((f, idx) => (idx === i ? { ...f, ...p } : f)))
  }
  const remove = (i: number) => onChange(faq.filter((_, idx) => idx !== i))
  const add = () => onChange([...faq, { q: '', a: '' }])

  return (
    <section className="space-y-3 rounded-2xl border border-border-default bg-bg-raised p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-text-primary">FAQ</h3>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-[12px] font-semibold text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary"
        >
          <Plus className="h-3 w-3" /> Question
        </button>
      </div>
      <p className="text-[12.5px] text-text-secondary">
        Shown as an accordion near the bottom of the buyer page. Keep answers short.
      </p>
      <div className="space-y-2.5">
        {faq.map((f, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-xl border border-border-subtle bg-bg-overlay/40 p-3 sm:grid-cols-[1fr_auto]"
          >
            <div className="space-y-2">
              <Input
                value={f.q}
                onChange={(e) => update(i, { q: e.target.value })}
                placeholder="Question"
              />
              <Textarea
                value={f.a}
                onChange={(e) => update(i, { a: e.target.value })}
                rows={3}
                placeholder="Answer"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="h-8 w-8 self-start rounded-lg text-text-tertiary transition-colors hover:bg-error-bg hover:text-error"
              title="Remove"
            >
              <Trash2 className="mx-auto h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
