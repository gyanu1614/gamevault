'use client'

/** GameWizard step 3: toggle each global category and set its per-pair options. */

import Link from '@/components/navigation/AppLink'
import { toast } from 'sonner'
import { Check, Clock, Globe, Lightning, Monitor, SlidersHorizontal } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { PanelHead, adminBtnSm } from '../../components/kit'
import type { CategoryDraft } from './game-wizard-model'

export function CategoriesStep({
  categories,
  enabledCount,
  gameId,
  updateCategory,
}: {
  categories: CategoryDraft[]
  enabledCount: number
  gameId: string | null
  updateCategory: (gcId: string, patch: Partial<CategoryDraft>) => void
}) {
  return (
    <div>
      <PanelHead
        title="Categories"
        subtitle="Toggle which categories this game supports. Boosting is disabled at launch."
        aside={
          <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-semibold tabular-nums text-text-secondary">
            {enabledCount} of {categories.length} enabled
          </span>
        }
      />

      <div className="space-y-2">
        {categories.map((c) => {
          const disabledGlobally = !c.is_active
          return (
            <div
              key={c.global_category_id}
              className={cn(
                'rounded-md transition-colors',
                c.is_enabled ? 'bg-white/[0.07]' : 'bg-white/[0.03]',
                disabledGlobally && 'opacity-60'
              )}
            >
              {/* The whole row is the on/off control: lighter fill + check when on. */}
              <button
                type="button"
                onClick={() => updateCategory(c.global_category_id, { is_enabled: !c.is_enabled })}
                disabled={disabledGlobally}
                className={cn(
                  'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors sm:px-4',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring',
                  c.is_enabled ? 'rounded-t-md' : 'rounded-md',
                  disabledGlobally ? 'cursor-not-allowed' : 'hover:bg-white/[0.03]'
                )}
                aria-pressed={c.is_enabled}
                title={disabledGlobally ? 'This category is disabled at launch' : ''}
              >
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/[0.05] text-[18px] leading-none"
                >
                  {c.icon_emoji ?? '•'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-text-primary">{c.name}</span>
                  <span className="block truncate text-[12px] text-text-tertiary">
                    {disabledGlobally ? 'Disabled at launch' : `Slug: ${c.slug}`}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors',
                    c.is_enabled ? 'bg-success text-text-inverse' : 'bg-white/[0.08] text-transparent'
                  )}
                >
                  <Check weight="bold" className="h-3.5 w-3.5" />
                </span>
              </button>

              {/* Per-category settings — only show when enabled */}
              {c.is_enabled && (
                <div className="divide-y divide-white/[0.06] border-t border-white/[0.06] px-3.5 sm:px-4">
                  {/* Delivery modes */}
                  <div className="py-3">
                    <div className="mb-2 text-[12px] font-medium text-text-tertiary">Delivery Modes</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(['manual', 'instant'] as const).map((mode) => {
                        const on = c.delivery_modes.includes(mode)
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              const next = on
                                ? c.delivery_modes.filter((m) => m !== mode)
                                : [...c.delivery_modes, mode]
                              // Always require at least one mode
                              if (next.length === 0) {
                                toast.error('At least one delivery mode is required')
                                return
                              }
                              updateCategory(c.global_category_id, { delivery_modes: next })
                            }}
                            aria-pressed={on}
                            className={cn(
                              'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors',
                              on
                                ? 'bg-white/[0.14] text-text-primary'
                                : 'bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary'
                            )}
                          >
                            {mode === 'manual'
                              ? <Clock aria-hidden weight="bold" className="h-3.5 w-3.5" />
                              : <Lightning aria-hidden weight={on ? 'fill' : 'bold'} className="h-3.5 w-3.5" />}
                            {mode === 'manual' ? 'Manual' : 'Instant'}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Region toggle */}
                  <label className="flex cursor-pointer items-center gap-3 py-3">
                    <Globe aria-hidden weight="bold" className="h-4 w-4 shrink-0 text-text-tertiary" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-text-primary">Requires Region</span>
                      <span className="block text-[12px] text-text-tertiary">Buyer must pick a region</span>
                    </span>
                    <Switch
                      checked={c.requires_region}
                      onCheckedChange={() => updateCategory(c.global_category_id, { requires_region: !c.requires_region })}
                      aria-label={`${c.name}: requires region`}
                      className="data-[state=unchecked]:bg-white/[0.12]"
                    />
                  </label>

                  {/* Platform toggle */}
                  <label className="flex cursor-pointer items-center gap-3 py-3">
                    <Monitor aria-hidden weight="bold" className="h-4 w-4 shrink-0 text-text-tertiary" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-text-primary">Requires Platform</span>
                      <span className="block text-[12px] text-text-tertiary">E.g. PC / PlayStation / Xbox</span>
                    </span>
                    <Switch
                      checked={c.requires_platform}
                      onCheckedChange={() => updateCategory(c.global_category_id, { requires_platform: !c.requires_platform })}
                      aria-label={`${c.name}: requires platform`}
                      className="data-[state=unchecked]:bg-white/[0.12]"
                    />
                  </label>

                  <div className="py-3">
                    {gameId && (
                      <Link
                        href={`/admin/games/${gameId}/templates/${c.slug}`}
                        className={adminBtnSm.secondary}
                      >
                        <SlidersHorizontal aria-hidden weight="bold" className="h-3.5 w-3.5" />
                        Edit Attribute Template
                      </Link>
                    )}
                    {!gameId && (
                      <p className="text-[12px] leading-relaxed text-text-tertiary">
                        Save identity step first, then come back here to edit this category&apos;s attribute template.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
