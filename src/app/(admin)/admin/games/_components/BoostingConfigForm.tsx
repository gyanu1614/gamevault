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
import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { accountInputCls } from '@/components/account/AccountSurface'
import { adminBtnSm } from '../../components/kit'
import { FIELD_LABEL, FormLoading, FormSection, SaveBar } from './form-bits'
import {
  fetchCategoryConfigAdmin,
  upsertCategoryConfig,
} from '@/lib/actions/admin-category-configs'
import {
  DEFAULT_BOOSTING_CONFIG,
  type BoostingConfig,
} from '@/lib/types/category-configs'

const ICON =
  'grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.08] hover:text-text-primary disabled:opacity-40'

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
    // The queryFn seeds the editable draft, so a background refetch (tab refocus)
    // would wipe unsaved edits. Refetch only after a save (invalidate).
    refetchOnWindowFocus: false,
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
    return <FormLoading cards={3} />
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
      className="space-y-4"
    >
      <FormSection
        title="Tier Ladder"
        subtitle={<>Ordered low → high. Sellers pick a &quot;from&quot; and &quot;to&quot; tier when listing.</>}
        aside={
          <button type="button" onClick={addTier} className={adminBtnSm.secondary}>
            <Plus aria-hidden weight="bold" className="h-3.5 w-3.5" /> Add Tier
          </button>
        }
      >
        <div className="space-y-1.5">
          {draft.tiers.length === 0 ? (
            <p className="rounded-md bg-bg-overlay px-4 py-6 text-center text-[12.5px] text-text-tertiary">
              No tiers yet. Add the lowest rank first, then work up to the highest.
            </p>
          ) : (
            draft.tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-md bg-bg-overlay p-1.5 pl-3">
                <span className="w-5 shrink-0 text-[12px] font-semibold tabular-nums text-text-tertiary">{i + 1}</span>
                <input
                  value={t}
                  onChange={(e) => updateTier(i, e.target.value)}
                  placeholder={i === 0 ? 'Lowest rank' : `Tier ${i + 1}`}
                  aria-label={`Tier ${i + 1}`}
                  className={cn(accountInputCls, 'h-9 min-w-0 flex-1 bg-bg-overlay-2 py-0')}
                />
                <button type="button" onClick={() => moveTier(i, -1)} disabled={i === 0} className={ICON} aria-label="Move up" title="Move up">
                  <ArrowUp aria-hidden weight="bold" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTier(i, 1)}
                  disabled={i === draft.tiers.length - 1}
                  className={ICON}
                  aria-label="Move down"
                  title="Move down"
                >
                  <ArrowDown aria-hidden weight="bold" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeTier(i)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-error-bg hover:text-error"
                  aria-label="Remove tier"
                  title="Remove"
                >
                  <Trash aria-hidden weight="bold" className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </FormSection>

      <FormSection title="Delivery Benchmark" subtitle="Surfaced as a benchmark on the buyer page.">
        <label htmlFor="boosting-avg-hours" className={FIELD_LABEL}>Average Delivery (Hours)</label>
        <input
          id="boosting-avg-hours"
          type="number"
          min="0"
          step="1"
          value={draft.avg_delivery_hours}
          onChange={(e) => patch({ avg_delivery_hours: parseInt(e.target.value || '0', 10) })}
          className={cn(accountInputCls, 'max-w-[200px] tabular-nums')}
        />
      </FormSection>

      <FormSection title="Seller Instructions">
        <label htmlFor="boosting-instructions" className={FIELD_LABEL}>Placeholder Text</label>
        <textarea
          id="boosting-instructions"
          value={draft.seller_instructions_placeholder}
          onChange={(e) => patch({ seller_instructions_placeholder: e.target.value })}
          rows={3}
          className={cn(accountInputCls, 'resize-none')}
        />
      </FormSection>

      <SaveBar label="Save Boosting Settings" pending={mutation.isPending} />
    </form>
  )
}
