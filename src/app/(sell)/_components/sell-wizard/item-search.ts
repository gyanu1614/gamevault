import { MM2_SELL_FORM } from '@/lib/catalogue/sell-form/config'
import type { Attribute } from '@/lib/actions/new-schema'
import { applyOptionSets } from '@/lib/sell/option-sets'

import { isVisible } from './attribute-tree'

/**
 * The search-first item picker's rules, pure (owner, 2026-11-06). The seller types
 * a name, picks a row, and the form's own fields fill from it: the list, then its
 * parents through the fields' rules, then the title if they haven't written one.
 *
 * Rows come from the form's own lists, never a second list of items, so a pick can
 * always fill the form and a listing can always be saved. A row the catalogue has
 * and the form doesn't reaches the form through the daily sync (lib/catalogue/sell-form).
 */
export interface ItemSearchGame {
  /** Is this field one of the game's item lists? */
  isList: (slug: string) => boolean
  /** Fields the form no longer asks (the sync's legacy and retired fields). */
  hidden: readonly string[]
  /** Asked after the pick, unless the pick is in `noTraitLists`. */
  traitField?: string
  /** Eggs and potions have no trait. */
  noTraitLists?: readonly string[]
  /** A real name for the empty box. */
  example: string
  /**
   * One item looks the same in every offer, so the catalogue's picture is the offer's
   * (owner, 2026-11-06). Not Steal a Brainrot: income and mutation differ per offer,
   * and a seller's photo shows it.
   */
  fixedPicture?: boolean
}

const MM2_LIST = new RegExp(`^(${MM2_SELL_FORM.types.map((t) => t.key).join('|')})-(?!name)`)
const AM_LISTS = new Set(['pet-name', 'egg-name', 'potion-name'])

const GAMES: Record<string, ItemSearchGame> = {
  'murder-mystery-2': { isList: (s) => MM2_LIST.test(s), hidden: [...MM2_SELL_FORM.legacyFields, ...(MM2_SELL_FORM.retiredFields ?? [])], example: 'Sunrise', fixedPicture: true },
  'adopt-me': { isList: (s) => AM_LISTS.has(s), hidden: [], traitField: 'trait', noTraitLists: ['egg-name', 'potion-name'], example: 'Bat Dragon', fixedPicture: true },
  'steal-a-brainrot': { isList: (s) => /^select-brainrot(-\d+)?$/.test(s), hidden: [], example: 'Dragon Cannelloni' },
}

/** Null keeps today's form: another game, or a category with no item lists. */
export function itemSearchGame(gameSlug: string | null | undefined, categorySlug: string | null | undefined): ItemSearchGame | null {
  if (categorySlug !== 'items' || !gameSlug) return null
  return GAMES[gameSlug] ?? null
}

export interface ItemRow {
  /** The option's value: what the list field stores. */
  value: string
  label: string
  attributeId: string
  /** "Gun", "Pet", "Brainrot", from the list's name. */
  type: string
}

const NOT_AN_ITEM: ReadonlySet<string> = new Set(['other', 'none'])

const typeOf = (a: Attribute) => a.name.replace(/^Select\s+/i, '').replace(/\s+Name$/i, '')

export function buildItemRows(game: ItemSearchGame, attributes: readonly Attribute[]): ItemRow[] {
  const rows: ItemRow[] = []
  const seen = new Set<string>()
  for (const a of attributes) {
    if (a.type !== 'select' || !game.isList(a.slug)) continue
    for (const o of a.options ?? []) {
      if (NOT_AN_ITEM.has(o.value) || seen.has(o.value)) continue
      seen.add(o.value)
      rows.push({ value: o.value, label: o.label, attributeId: a.id, type: typeOf(a) })
    }
  }
  return rows.sort((x, y) => x.label.localeCompare(y.label))
}

const byIdOf = (attributes: readonly Attribute[]) => new Map(attributes.map((a) => [a.id, a]))

/** The item lists and every field above them: what a pick fills, so what a new pick clears. */
export function itemChainIds(game: ItemSearchGame, attributes: readonly Attribute[]): Set<string> {
  const byId = byIdOf(attributes)
  const chain = new Set<string>()
  for (const a of attributes) {
    if (!game.isList(a.slug)) continue
    let cur: Attribute | undefined = a
    while (cur && !chain.has(cur.id)) {
      chain.add(cur.id)
      const parent: string | undefined = cur.conditional_rules?.[0]?.trigger_attribute_id
      cur = parent ? byId.get(parent) : undefined
    }
  }
  return chain
}

/** The lists alone: not asked under a pick's nested fields. */
export function itemListIds(game: ItemSearchGame, attributes: readonly Attribute[]): Set<string> {
  return new Set(attributes.filter((a) => game.isList(a.slug)).map((a) => a.id))
}

export function withoutIds(values: Record<string, unknown>, ids: Iterable<string>): Record<string, unknown> {
  const next = { ...values }
  for (const id of ids) delete next[id]
  return next
}

/** The answers once this row is picked: the list, its parents, and nothing left from the last pick. */
export function valuesForPick(
  game: ItemSearchGame,
  attributes: readonly Attribute[],
  row: ItemRow,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const byId = byIdOf(attributes)
  const list = byId.get(row.attributeId)
  const hiddenIds = attributes.filter((a) => game.hidden.includes(a.slug)).map((a) => a.id)
  let next = withoutIds(values, [...itemChainIds(game, attributes), ...hiddenIds])
  if (list && game.noTraitLists?.includes(list.slug)) {
    const trait = attributes.find((a) => a.slug === game.traitField)
    if (trait) next = withoutIds(next, [trait.id])
  }
  next[row.attributeId] = row.value
  const seen = new Set<string>()
  let cur = list
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    const rule: NonNullable<Attribute['conditional_rules']>[number] | undefined = cur.conditional_rules?.[0]
    const parent = rule ? byId.get(rule.trigger_attribute_id) : undefined
    const value = rule?.trigger_values?.[0]
    if (parent && typeof value === 'string') next[parent.id] = value
    cur = parent
  }
  return applyOptionSets(attributes, row.attributeId, row.value, next)
}

/** The row these answers name, or null. A value on a hidden branch doesn't count. */
export function pickedRow(rows: readonly ItemRow[], attributes: readonly Attribute[], values: Record<string, unknown>): ItemRow | null {
  const byId = byIdOf(attributes)
  for (const r of rows) {
    if (values[r.attributeId] !== r.value) continue
    const a = byId.get(r.attributeId)
    if (a && isVisible(a, values, byId)) return r
  }
  return null
}

/** Eggs and potions have no trait, so a picked one isn't asked for it. */
export function pickHasNoTrait(game: ItemSearchGame, attributes: readonly Attribute[], row: ItemRow): boolean {
  const list = attributes.find((a) => a.id === row.attributeId)
  return game.noTraitLists?.includes(list?.slug ?? '') ?? false
}

/** A picked item whose picture is the catalogue's: the form asks for no photos. */
export const pickUsesItemPicture = (game: ItemSearchGame | null, picked: ItemRow | null): boolean => !!game?.fixedPicture && !!picked

/** What's still asked under a picked item: the trait, the mutation. */
export function fieldsAfterPick(game: ItemSearchGame, attributes: readonly Attribute[], row: ItemRow, values: Record<string, unknown>): Attribute[] {
  const byId = byIdOf(attributes)
  const chain = itemChainIds(game, attributes)
  const noTrait = pickHasNoTrait(game, attributes, row)
  return attributes
    .filter((a) => !chain.has(a.id) && !game.hidden.includes(a.slug) && isVisible(a, values, byId) && !(noTrait && a.slug === game.traitField))
    .sort((x, y) => x.sort_order - y.sort_order)
}

export const itemTitle = (name: string, gameName: string) => (name.trim() ? `${name.trim()} - ${gameName}` : '')

/** A title the seller wrote stays. One we filled follows the item. */
export function nextTitle(current: string, lastAuto: string, auto: string): string {
  return !current.trim() || current === lastAuto ? auto : current
}

/**
 * The title an existing listing opens with counts as ours if it's exactly what a
 * pick would fill, so changing the item changes it too. A duplicate of "Sunrise -
 * Murder Mystery 2" re-picked as Embersickle mustn't keep selling under Sunrise.
 */
export function initialAutoTitle(title: string, row: ItemRow | null, gameName: string): string {
  return row && title === itemTitle(row.label, gameName) ? title : ''
}

/**
 * How an existing listing opens: on its item, else manually if it has any answers
 * (it sells something we don't list), else on the search.
 */
export function initialItemEntry(picked: ItemRow | null, chainIds: ReadonlySet<string>, values: Record<string, unknown>): 'search' | 'manual' {
  if (picked) return 'search'
  return [...chainIds].some((id) => values[id] !== undefined && values[id] !== '') ? 'manual' : 'search'
}
