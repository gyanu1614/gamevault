'use client'

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Combobox } from '@/components/ui/combobox'
import { type SellGameOption } from '@/lib/actions/sell-wizard'
import { type GlobalCategory } from '@/lib/actions/new-schema'
import { SubCard } from '@/app/(sell)/_components/sell-wizard/ui/SubCard'
import { FIELD_SURFACE } from '../styles'

// ─── Step 2: game picker ────────────────────────────────────────────────────

export function Step2Game({
  category, games, loading, selected, onSelect, filter, onFilter,
  recentGameIds, sortMode, onSortMode,
  region, onRegion, platform, onPlatform,
}: {
  category: GlobalCategory
  games: SellGameOption[]
  loading: boolean
  selected: SellGameOption | null
  onSelect: (g: SellGameOption) => void
  filter: string
  onFilter: (s: string) => void
  recentGameIds: string[]
  sortMode: 'popular' | 'recent'
  onSortMode: (m: 'popular' | 'recent') => void
  region: string
  onRegion: (s: string) => void
  platform: string
  onPlatform: (s: string) => void
}) {
  // Reorder games by tab
  const ordered = useMemo(() => {
    const filtered = games.filter((g) =>
      !filter ||
      g.game_name.toLowerCase().includes(filter.toLowerCase()) ||
      g.game_slug.includes(filter.toLowerCase())
    )
    if (sortMode === 'recent') {
      const rank = new Map<string, number>()
      recentGameIds.forEach((id, idx) => rank.set(id, idx))
      return [...filtered].sort((a, b) => {
        const ra = rank.has(a.game_id) ? rank.get(a.game_id)! : 9999
        const rb = rank.has(b.game_id) ? rank.get(b.game_id)! : 9999
        if (ra !== rb) return ra - rb
        return a.game_sort_order - b.game_sort_order
      })
    }
    return filtered // already sorted by sort_order in the action
  }, [games, filter, sortMode, recentGameIds])

  /** The seller's last few games, newest first, as quick chips. */
  const recentGames = useMemo(
    () =>
      recentGameIds
        .map((id) => games.find((g) => g.game_id === id))
        .filter((g): g is NonNullable<typeof g> => !!g)
        .slice(0, 5),
    [recentGameIds, games],
  )

  return (
    // The picker lives in a titled card (SubCard, the Step 3 panel), so all
    // three steps share one pattern: page title = context ("Sell Items"),
    // card title = the question ("Choose A Game").
    <SubCard title="Choose A Game">
    <div className="space-y-4">
      {/* A searchable dropdown rather than a wall of tiles. The catalogue
          runs to hundreds of games; a grid made the seller hunt visually
          and truncated every label. Combobox (Radix Popover + cmdk) gives
          type-ahead, keyboard nav and the small per-game icon for free —
          and it is the same control the rest of the app already uses. */}
      {loading ? (
        <div className={cn(FIELD_SURFACE, 'flex h-12 items-center gap-2 px-3.5 text-[15px] text-text-tertiary sm:h-[52px]')}>
          <Loader2 className="h-4 w-4 animate-spin text-lime-text" />
          Loading games…
        </div>
      ) : games.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-tertiary">
          No games have {category.name} enabled yet. An admin needs to enable it.
        </p>
      ) : (
        <Combobox
          value={selected?.game_id ?? ''}
          onChange={(id) => {
            const g = games.find((x) => x.game_id === id)
            if (g) onSelect(g)
          }}
          options={games.map((g) => ({
            value: g.game_id,
            label: g.game_name,
            icon_url: g.game_logo_url ?? null,
          }))}
          placeholder="Search Games…"
          emptyText="No games match that search."
          ariaLabel="Choose a game"
          tone="neutral"
          iconInTrigger
          size="lg"
          sheetOnTouch
        />
      )}

      {/* Recently used, as quick chips under the field — keeps the one
          genuinely useful part of the old Popular/Recent tabs without
          re-introducing a second browsing surface. */}
      {recentGames.length > 0 && (
        // One row, never a second: overflow scrolls sideways (scrollbar
        // hidden) and the right edge fades so a cut-off chip reads as
        // "more this way" rather than as clipped.
        <div className="flex items-center gap-2 border-t border-white/[0.07] pt-4">
          <span className="mr-1 shrink-0 text-[13px] font-medium text-text-tertiary">Recent</span>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {recentGames.map((g) => (
            <button
              key={g.game_id}
              type="button"
              onClick={() => onSelect(g)}
              className={cn(
                // Same radius family as the fields; 28px logos so games read at a glance.
                'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] border pl-1.5 pr-3 text-[13.5px] font-medium transition-colors active:scale-[0.98]',
                selected?.game_id === g.game_id
                  ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                  : 'border-transparent bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary',
              )}
            >
              {g.game_logo_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={g.game_logo_url} alt="" className="h-7 w-7 rounded-[7px] object-cover" />
              )}
              {g.game_name}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
    </SubCard>
  )
}
