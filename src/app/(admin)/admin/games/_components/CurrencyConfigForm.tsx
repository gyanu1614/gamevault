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

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  fetchCategoryConfigAdmin,
  upsertCategoryConfig,
} from '@/lib/actions/admin-category-configs'
import {
  DEFAULT_CURRENCY_CONFIG,
  type CurrencyConfig,
} from '@/lib/types/category-configs'

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

  if (query.isLoading || !draft) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading currency settings…
      </div>
    )
  }

  const patch = (p: Partial<CurrencyConfig>) =>
    setDraft((d) => (d ? { ...d, ...p } : d))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!draft) return
        mutation.mutate(draft)
      }}
      className="space-y-7"
    >
      {/* ── Identity ── */}
      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <h3 className="text-[15px] font-semibold text-text-primary">Identity</h3>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
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
        <Field label="Tagline" hint="One-line description shown above the hero">
          <Input
            value={draft.tagline}
            onChange={(e) => patch({ tagline: e.target.value })}
            placeholder="In-game currency for ..."
          />
        </Field>
      </section>

      {/* ── Pricing rules ── */}
      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <h3 className="text-[15px] font-semibold text-text-primary">Pricing rules</h3>
        <p className="text-[12.5px] text-text-secondary">
          The seller wizard rejects per-unit prices below the floor or above the ceiling.
          Recommended price is what the buyer page surfaces as a benchmark.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price floor" hint="Cheapest accepted $/unit">
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={draft.price_floor}
              onChange={(e) => patch({ price_floor: parseFloat(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Recommended" hint="Surfaced to buyers">
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={draft.recommended_price}
              onChange={(e) => patch({ recommended_price: parseFloat(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Price ceiling" hint="Most expensive accepted $/unit">
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={draft.price_ceiling}
              onChange={(e) => patch({ price_ceiling: parseFloat(e.target.value) || 0 })}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </section>

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

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
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
