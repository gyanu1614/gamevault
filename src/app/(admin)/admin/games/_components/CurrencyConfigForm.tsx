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
 *
 * Look: the flat admin kit — solid cards (bg-bg-raised) with a PanelHead,
 * fields one step lighter, repeated rows as bg-bg-overlay boxes, no
 * outlines or glows.
 */

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CircleNotch, Plus, Trash, UploadSimple, X } from '@phosphor-icons/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { accountInputCls } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'
import { PanelHead, adminBtnSm } from '../../components/kit'
import { SaveBar } from './form-bits'
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

/** A titled card on the page canvas. */
const CARD = 'rounded-lg bg-bg-raised p-4 sm:p-5'
/** A field inside a repeated-row box (bg-bg-overlay): one step lighter again. */
const ROW_INPUT = cn(accountInputCls, 'bg-white/[0.06]')
/** Icon-only row action (remove). 36px tap target. */
const ICON_BTN_DANGER =
  'grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors ' +
  'hover:bg-[color-mix(in_srgb,var(--color-error)_14%,transparent)] hover:text-error'

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
    // The queryFn seeds the editable draft, so a background refetch (tab refocus)
    // would wipe unsaved edits. Refetch only after a save (invalidate).
    refetchOnWindowFocus: false,
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
      <div className="space-y-4" aria-busy aria-label="Loading currency settings">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={CARD}>
            <div className="skeleton h-4 w-40 rounded" />
            <div className="skeleton mt-2 h-3 w-64 max-w-full rounded" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="skeleton h-16 rounded-md" />
              <div className="skeleton h-16 rounded-md" />
            </div>
          </div>
        ))}
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
      className="space-y-4"
    >
      {/* ── Identity ──
          V19/P24/P7.b — Compact two-column layout: icon tile on the
          left, all text fields stacked on the right. No more giant
          empty band under the icon. */}
      <section className={CARD}>
        <PanelHead title="Identity" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          {/* Icon tile — fixed size, on the left */}
          <div className="flex flex-col items-start sm:w-[88px]">
            <span className="mb-1.5 block text-[13px] font-medium text-text-secondary">Icon</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => iconFileRef.current?.click()}
                className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-overlay transition-colors hover:bg-bg-overlay-2"
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
                  <CircleNotch aria-hidden weight="bold" className="h-5 w-5 animate-spin text-text-tertiary" />
                ) : (
                  <UploadSimple aria-hidden weight="bold" className="h-5 w-5 text-text-tertiary" />
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
                  className="grid h-9 w-9 place-items-center rounded-md text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
                  aria-label="Remove icon"
                >
                  <X aria-hidden weight="bold" className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right side — Unit label / Glyph / Tagline stacked */}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
              <Field label="Unit Label" hint="What the currency is called" htmlFor="cc-unit-label">
                <input
                  id="cc-unit-label"
                  value={draft.unit_label}
                  onChange={(e) => patch({ unit_label: e.target.value })}
                  placeholder="Robux"
                  className={accountInputCls}
                />
              </Field>
              <Field label="Glyph" hint="Short symbol" htmlFor="cc-glyph">
                <input
                  id="cc-glyph"
                  value={draft.glyph}
                  onChange={(e) => patch({ glyph: e.target.value.slice(0, 6) })}
                  placeholder="R$"
                  className={cn(accountInputCls, 'text-center')}
                />
              </Field>
            </div>
            <Field label="Tagline" hint="Shown above the hero" htmlFor="cc-tagline">
              <input
                id="cc-tagline"
                value={draft.tagline}
                onChange={(e) => patch({ tagline: e.target.value })}
                placeholder="In-game currency for ..."
                className={accountInputCls}
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
      <section className={CARD}>
        <PanelHead
          title="Pricing Rules"
          subtitle="The seller wizard rejects per-unit prices below this minimum. The buyer page automatically surfaces the cheapest active listing as the recommended offer."
        />
        {isBundleMode && (
          <div className="mb-4 rounded-md bg-info-bg px-3.5 py-2.5 text-[13px] leading-relaxed text-text-secondary">
            <span className="font-semibold text-info">Bundle mode.</span>{' '}
            Each bundle is its own quantity unit, so granularity, minimum quantity,
            and quantity step don’t apply. The price floor below still gates the
            cheapest $ a seller can list per bundle.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={
              isBundleMode
                ? 'Minimum Listing Price ($)'
                : `Minimum Price per ${formatGranularityLabel(draft)}`
            }
            hint={
              isBundleMode
                ? 'Sellers can’t list below this price'
                : 'Cheapest accepted $ per unit of granularity'
            }
            htmlFor="cc-price-floor"
          >
            <input
              id="cc-price-floor"
              type="number"
              step="0.0001"
              min="0"
              value={draft.price_floor}
              onChange={(e) => patch({ price_floor: parseFloat(e.target.value) || 0 })}
              className={cn(accountInputCls, 'tabular-nums')}
            />
          </Field>
        </div>
        {!isBundleMode && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Minimum Quantity" hint="Lowest order size buyers can pick" htmlFor="cc-min-quantity">
              <input
                id="cc-min-quantity"
                type="number"
                step="1"
                min="1"
                value={draft.min_quantity}
                onChange={(e) => patch({ min_quantity: parseInt(e.target.value || '0', 10) })}
                className={cn(accountInputCls, 'tabular-nums')}
              />
            </Field>
            <Field label="Quantity Step" hint="Increment used by the +/- buttons" htmlFor="cc-quantity-step">
              <input
                id="cc-quantity-step"
                type="number"
                step="1"
                min="1"
                value={draft.quantity_step}
                onChange={(e) => patch({ quantity_step: parseInt(e.target.value || '0', 10) })}
                className={cn(accountInputCls, 'tabular-nums')}
              />
            </Field>
            {/* V19/P2.b — Granularity controls the suffix everywhere a
                quantity is displayed. "Unit" = absolute count, "Thousand"
                = a 1 in qty means 1,000 actual units, "Million" likewise. */}
            <Field label="Granularity" hint="What 1 unit of quantity equals" htmlFor="cc-granularity">
              <Select
                value={draft.quantity_granularity ?? 'unit'}
                onValueChange={(v) =>
                  patch({ quantity_granularity: v as 'unit' | 'thousand' | 'million' })
                }
              >
                <SelectTrigger
                  id="cc-granularity"
                  className="h-10 rounded-md border-0 bg-bg-overlay px-3.5 hover:bg-bg-overlay-2 data-[state=open]:ring-focus-soft"
                >
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
      <section className={CARD}>
        <PanelHead title="Seller Instructions" />
        <Field
          label="Placeholder Text"
          hint="Shown to sellers as a hint while filling out their listing"
          htmlFor="cc-seller-placeholder"
        >
          <textarea
            id="cc-seller-placeholder"
            value={draft.seller_instructions_placeholder}
            onChange={(e) => patch({ seller_instructions_placeholder: e.target.value })}
            rows={3}
            placeholder="e.g. Send us gamepass or in-game item details ..."
            className={cn(accountInputCls, 'resize-none')}
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

      <SaveBar label="Save Currency Settings" pending={mutation.isPending} />
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
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  // V19/P24/P5 — Label and hint stacked vertically. Previously they
  // shared a row via `justify-between`, which made both wrap into
  // letter-soup whenever the surrounding grid column got narrow
  // (the Identity section is the canonical victim). Stacking gives
  // each its own line and the hint sits as a quiet caption below.
  // The control sits at the bottom (mt-auto) so side-by-side fields
  // line up even when one hint wraps to two lines.
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-1.5">
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-text-secondary">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-[12px] leading-snug text-text-tertiary">{hint}</p>}
      </div>
      <div className="mt-auto">{children}</div>
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
    <section className={CARD}>
      <PanelHead
        title="How It Works"
        subtitle="Three short steps shown on the buyer page below the sellers list."
        aside={
          <button type="button" onClick={add} className={adminBtnSm.secondary}>
            <Plus aria-hidden weight="bold" className="h-3.5 w-3.5" /> Add Step
          </button>
        }
      />
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div
            key={i}
            className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-2 rounded-md bg-bg-overlay p-3"
          >
            <input
              type="number"
              value={s.n}
              onChange={(e) => update(i, { n: parseInt(e.target.value || '0', 10) })}
              aria-label={`Step ${i + 1} number`}
              className={cn(ROW_INPUT, 'col-start-1 row-start-1 self-start px-2 text-center tabular-nums')}
            />
            <div className="col-span-3 row-start-2 min-w-0 space-y-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
              <input
                value={s.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Step title"
                aria-label={`Step ${i + 1} title`}
                className={ROW_INPUT}
              />
              <textarea
                value={s.body}
                onChange={(e) => update(i, { body: e.target.value })}
                rows={2}
                placeholder="Step description"
                aria-label={`Step ${i + 1} description`}
                className={cn(ROW_INPUT, 'resize-none')}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className={cn(ICON_BTN_DANGER, 'col-start-3 row-start-1 self-start justify-self-end')}
              title="Remove step"
              aria-label="Remove step"
            >
              <Trash aria-hidden weight="bold" className="h-4 w-4" />
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
    <section className={CARD}>
      <PanelHead
        title="FAQ"
        subtitle="Shown as an accordion near the bottom of the buyer page. Keep answers short."
        aside={
          <button type="button" onClick={add} className={adminBtnSm.secondary}>
            <Plus aria-hidden weight="bold" className="h-3.5 w-3.5" /> Add Question
          </button>
        }
      />
      <div className="space-y-2">
        {faq.map((f, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md bg-bg-overlay p-3"
          >
            <div className="min-w-0 space-y-2">
              <input
                value={f.q}
                onChange={(e) => update(i, { q: e.target.value })}
                placeholder="Question"
                aria-label={`Question ${i + 1}`}
                className={ROW_INPUT}
              />
              <textarea
                value={f.a}
                onChange={(e) => update(i, { a: e.target.value })}
                rows={3}
                placeholder="Answer"
                aria-label={`Answer ${i + 1}`}
                className={cn(ROW_INPUT, 'resize-none')}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className={cn(ICON_BTN_DANGER, 'self-start')}
              title="Remove"
              aria-label="Remove question"
            >
              <Trash aria-hidden weight="bold" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
