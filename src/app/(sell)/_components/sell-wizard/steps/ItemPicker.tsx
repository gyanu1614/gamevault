'use client'

import { memo, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Attribute } from '@/lib/actions/new-schema'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { ItemPicture } from '@/features/items-grid/ItemPicture'
import { rarityMeta } from '@/lib/values/rarity'
import { inputCls } from '@/app/(sell)/_components/sell-wizard/styles'
import { fieldsAfterPick, type ItemRow, type ItemSearchGame } from '@/app/(sell)/_components/sell-wizard/item-search'
import { FieldCard } from '@/app/(sell)/_components/sell-wizard/steps/Step3Details'
import { SubCard } from '@/app/(sell)/_components/sell-wizard/ui/SubCard'
import type { FieldHint } from '@/app/(sell)/_components/sell-wizard/hooks/use-trait-hint'

type ItemFacts = Record<string, [string | null, string | null]>

/** Pictures and rarities, once per game. Without them the search still works. */
function useItemFacts(gameSlug: string): ItemFacts {
  const { data } = useQuery({
    queryKey: ['sell-catalogue', gameSlug] as const,
    queryFn: async (): Promise<ItemFacts> => {
      const res = await fetch(`/api/sell/catalogue/${encodeURIComponent(gameSlug)}`)
      if (!res.ok) throw new Error('Could not load the pictures')
      return ((await res.json()) as { items: ItemFacts }).items
    },
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 1,
  })
  return data ?? {}
}

function ItemMeta({ gameSlug, rarity, type }: { gameSlug: string; rarity: string | null | undefined; type: string }) {
  if (!rarity) return <>{type}</>
  const meta = rarityMeta(gameSlug, rarity)
  return (
    <>
      <span style={{ color: meta.color }}>{meta.label}</span> · {type}
    </>
  )
}

/**
 * The sell form's first question for a game with a catalogue (owner, 2026-11-06):
 * type a name, pick a row, and every item field fills. Then only what the pick
 * can't know is asked (the trait, the mutation). An item we don't list goes to the
 * manual fields. Rules in ../item-search; phones get the Combobox's bottom sheet.
 */
export const ItemPicker = memo(function ItemPicker({
  game, gameSlug, rows, picked, attributes, values, topLevel, childrenOf, manual, manualItemName, hiddenIds, hint,
  onPick, onChange, onFieldChange, onManual, onManualName, onBackToSearch,
}: {
  game: ItemSearchGame
  gameSlug: string
  rows: ItemRow[]
  picked: ItemRow | null
  attributes: Attribute[]
  values: Record<string, unknown>
  topLevel: Attribute[]
  childrenOf: Map<string, Map<string, Attribute[]>>
  manual: boolean
  manualItemName: string
  /** Not asked on the manual path: the item lists and the retired fields. */
  hiddenIds: ReadonlySet<string>
  hint: FieldHint | null
  onPick: (row: ItemRow) => void
  onChange: () => void
  onFieldChange: (id: string, value: unknown) => void
  onManual: (typed: string) => void
  onManualName: (name: string) => void
  onBackToSearch: () => void
}) {
  const facts = useItemFacts(gameSlug)
  const options = useMemo<ComboboxOption[]>(
    () => rows.map((r) => ({
      value: r.value,
      label: r.label,
      icon_url: facts[r.value]?.[0] ?? null,
      meta: <ItemMeta gameSlug={gameSlug} rarity={facts[r.value]?.[1]} type={r.type} />,
    })),
    [rows, facts, gameSlug],
  )

  if (manual) {
    return (
      <SubCard title="Offer Details">
        <div className="space-y-5">
          {topLevel.filter((a) => !hiddenIds.has(a.id)).map((a) => (
            <FieldCard key={a.id} attribute={a} values={values} onChange={onFieldChange} childrenOf={childrenOf} hint={hint} hiddenIds={hiddenIds} />
          ))}
          <div>
            <label htmlFor="manual-item-name" className="mb-2 block text-[13px] font-medium text-text-secondary">Item Name</label>
            <input id="manual-item-name" value={manualItemName} onChange={(e) => onManualName(e.target.value)} maxLength={80} className={inputCls} />
          </div>
          <button type="button" onClick={onBackToSearch} className="text-[14px] font-medium text-text-primary underline underline-offset-[3px] hover:text-text-secondary">
            Back To Search
          </button>
        </div>
      </SubCard>
    )
  }

  if (picked) {
    const [picture, rarity] = facts[picked.value] ?? [null, null]
    return (
      <SubCard title="Offer Details">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-lg bg-white/[0.035]">
              <ItemPicture src={picture} name={picked.label} size={128} placeholder="" className="h-[84%] w-[84%]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-semibold text-text-primary">{picked.label}</p>
              <p className="mt-1 truncate text-[14px] text-text-secondary">
                <ItemMeta gameSlug={gameSlug} rarity={rarity} type={picked.type} />
              </p>
            </div>
            <button type="button" onClick={onChange} className="h-9 shrink-0 rounded-md bg-white/[0.07] px-3.5 text-[14px] font-medium text-text-primary transition-colors hover:bg-white/[0.11]">
              Change
            </button>
          </div>
          {fieldsAfterPick(game, attributes, picked, values).map((a) => (
            <FieldCard key={a.id} attribute={a} values={values} onChange={onFieldChange} childrenOf={childrenOf} hint={hint} hiddenIds={hiddenIds} />
          ))}
        </div>
      </SubCard>
    )
  }

  return (
    <SubCard title="Offer Details">
      <label className="mb-2 block text-[13px] font-medium text-text-secondary" id="item-search-label">Search Item</label>
      <Combobox
        value=""
        onChange={(v) => {
          const row = rows.find((r) => r.value === v)
          if (row) onPick(row)
        }}
        options={options}
        placeholder={game.example}
        ariaLabel="Search Item"
        sheetTitle="Search Item"
        emptyText={(q) => (q ? `No Item Named “${q}”` : 'Type An Item Name')}
        unsorted
        rankMatches
        searchField
        searchInTrigger
        sheetOnTouch
        sheetSearchFirst
        tone="neutral"
        size="lg"
        iconClassName="h-10 w-10 rounded-md object-contain bg-white/[0.04] sm:h-9 sm:w-9"
        footer={({ query, close }) => (
          <div className="border-t border-white/[0.07] p-1.5">
            <button
              type="button"
              onClick={() => {
                close()
                onManual(query.trim())
              }}
              className="w-full rounded-lg px-2.5 py-2.5 text-left text-[14px] font-medium text-text-primary transition-colors hover:bg-white/[0.06]"
            >
              Not In The List? Enter It Manually
            </button>
          </div>
        )}
      />
    </SubCard>
  )
})
