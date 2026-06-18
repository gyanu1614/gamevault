'use client'

/**
 * V17y — Per-game BOOSTING config editor.
 *
 * Tier list (e.g. ["Iron","Bronze","Silver",...,"Radiant"]) the seller
 * can pick from when listing a boosting service, plus avg delivery
 * hours and an instructions placeholder. Stored under
 * category_configs (game_id, 'service').
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, GripVertical, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  fetchCategoryConfigAdmin,
  upsertCategoryConfig,
} from '@/lib/actions/admin-category-configs'
import {
  DEFAULT_BOOSTING_CONFIG,
  type BoostingConfig,
} from '@/lib/types/category-configs'

export function BoostingConfigForm({ gameId }: { gameId: string }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<BoostingConfig | null>(null)

  const query = useQuery({
    queryKey: ['admin-category-config', gameId, 'service'],
    queryFn: async () => {
      const cfg = await fetchCategoryConfigAdmin(gameId, 'service')
      setDraft(cfg ?? DEFAULT_BOOSTING_CONFIG)
      return cfg
    },
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: async (next: BoostingConfig) =>
      upsertCategoryConfig(gameId, 'service', next),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Boosting settings saved')
      qc.invalidateQueries({ queryKey: ['admin-category-config', gameId, 'service'] })
    },
    onError: (err: any) => toast.error(err?.message ?? 'Save failed'),
  })

  if (query.isLoading || !draft) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading boosting settings…
      </div>
    )
  }

  const patch = (p: Partial<BoostingConfig>) =>
    setDraft((d) => (d ? { ...d, ...p } : d))

  const updateTier = (i: number, value: string) => {
    const next = [...draft.tiers]
    next[i] = value
    patch({ tiers: next })
  }
  const removeTier = (i: number) => patch({ tiers: draft.tiers.filter((_, idx) => idx !== i) })
  const addTier = () => patch({ tiers: [...draft.tiers, ''] })
  const moveTier = (i: number, dir: -1 | 1) => {
    const target = i + dir
    if (target < 0 || target >= draft.tiers.length) return
    const next = [...draft.tiers]
    ;[next[i], next[target]] = [next[target], next[i]]
    patch({ tiers: next })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!draft) return
        const cleaned: BoostingConfig = {
          ...draft,
          tiers: draft.tiers.map((t) => t.trim()).filter(Boolean),
        }
        mutation.mutate(cleaned)
      }}
      className="space-y-7"
    >
      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-text-primary">Tier ladder</h3>
          <button
            type="button"
            onClick={addTier}
            className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-[12px] font-semibold text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary"
          >
            <Plus className="h-3 w-3" /> Tier
          </button>
        </div>
        <p className="text-[12.5px] text-text-secondary">
          Ordered low → high. Sellers pick a "from" and "to" tier when listing.
        </p>
        <div className="space-y-2">
          {draft.tiers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-default bg-bg-overlay/40 p-6 text-center text-[12.5px] text-text-tertiary">
              No tiers yet. Add the lowest rank first, then work up to the highest.
            </div>
          ) : (
            draft.tiers.map((t, i) => (
              <div
                key={i}
                className="grid grid-cols-[20px_1fr_auto_auto_auto] items-center gap-2 rounded-xl border border-border-subtle bg-bg-overlay/40 p-2.5"
              >
                <GripVertical className="h-3.5 w-3.5 text-text-tertiary" aria-hidden />
                <Input
                  value={t}
                  onChange={(e) => updateTier(i, e.target.value)}
                  placeholder={i === 0 ? 'Lowest rank' : `Tier ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => moveTier(i, -1)}
                  disabled={i === 0}
                  className="h-8 w-8 rounded-lg text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary disabled:opacity-40"
                  title="Move up"
                >
                  <ArrowUp className="mx-auto h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTier(i, 1)}
                  disabled={i === draft.tiers.length - 1}
                  className="h-8 w-8 rounded-lg text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary disabled:opacity-40"
                  title="Move down"
                >
                  <ArrowDown className="mx-auto h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeTier(i)}
                  className="h-8 w-8 rounded-lg text-text-tertiary transition-colors hover:bg-error-bg hover:text-error"
                  title="Remove"
                >
                  <Trash2 className="mx-auto h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <h3 className="text-[15px] font-semibold text-text-primary">Delivery benchmark</h3>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label>Average delivery (hours)</Label>
            <span className="text-[11px] text-text-tertiary">
              Surfaced as a benchmark on the buyer page
            </span>
          </div>
          <Input
            type="number"
            min="0"
            step="1"
            value={draft.avg_delivery_hours}
            onChange={(e) => patch({ avg_delivery_hours: parseInt(e.target.value || '0', 10) })}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-5">
        <h3 className="text-[15px] font-semibold text-text-primary">Seller instructions</h3>
        <div className="space-y-1.5">
          <Label>Placeholder text</Label>
          <Textarea
            value={draft.seller_instructions_placeholder}
            onChange={(e) => patch({ seller_instructions_placeholder: e.target.value })}
            rows={3}
          />
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end rounded-xl border border-border-default bg-bg-raised/95 p-3 backdrop-blur-md shadow-elevated">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-4 py-2 text-[13px] font-semibold text-text-inverse transition-colors hover:bg-lime-hover disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save boosting settings
        </button>
      </div>
    </form>
  )
}
