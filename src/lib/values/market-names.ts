/**
 * The admin side of the match log (public.market_name_matches, written by the
 * price jobs through scripts/lib/market-names.mjs): what to show in the Values
 * tab and the three decisions an admin can make. Service role only.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

type Db = SupabaseClient

export type MarketNameStatus = 'auto' | 'confirmed' | 'rejected' | 'unmatched'
export type MarketNameDecision = { kind: 'confirm' } | { kind: 'reject' } | { kind: 'link'; itemSlug: string }

export interface MarketNameRow {
  marketName: string
  /** Human label: MM2 keys "gun|chroma|ember bow" read "Ember Bow · Chroma Gun". */
  label: string
  itemSlug: string | null
  status: MarketNameStatus
  score: number | null
  suggestions: { slug: string; score: number }[]
  offers: number
  lastSeenAt: string
}

const title = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** "type|variant|name" keys (values_items games) → "Name · Variant Type"; anything else as is. */
export function marketNameLabel(marketName: string): string {
  const parts = marketName.split('|')
  if (parts.length < 3) return marketName
  const [type, variant, ...name] = parts
  return `${title(name.join('|'))} · ${title(`${variant === 'default' ? '' : `${variant} `}${type}`)}`
}

/** A slug as a readable name, for suggestions ("malaysian-tapir" → "Malaysian Tapir"). */
export const slugLabel = (slug: string) => title(slug.replace(/-/g, ' '))

/** What needs a look: automatic matches, then unmatched names that still have listings. */
export async function loadMarketNameReview(db: Db, gameSlug: string): Promise<MarketNameRow[]> {
  const { data, error } = await db
    .from('market_name_matches')
    .select('market_name,item_slug,status,score,suggestions,offers,last_seen_at')
    .eq('game_slug', gameSlug)
    .eq('source', 'eldorado')
    .in('status', ['auto', 'unmatched'])
    .order('offers', { ascending: false })
    .limit(200)
  if (error) throw new Error(`market_name_matches: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[])
    .filter((r) => r.status === 'auto' || Number(r.offers) > 0)
    .map((r) => ({
      marketName: r.market_name as string,
      label: marketNameLabel(r.market_name as string),
      itemSlug: (r.item_slug as string | null) ?? null,
      status: r.status as MarketNameStatus,
      score: r.score == null ? null : Number(r.score),
      suggestions: Array.isArray(r.suggestions) ? (r.suggestions as { slug: string; score: number }[]) : [],
      offers: Number(r.offers) || 0,
      lastSeenAt: r.last_seen_at as string,
    }))
    .sort((a, b) => (a.status === b.status ? b.offers - a.offers : a.status === 'auto' ? -1 : 1))
}

/** Is `slug` an item of this game's catalogue (the table the game's price job reads)? */
async function itemExists(db: Db, gameSlug: string, slug: string): Promise<boolean> {
  if (gameSlug === 'steal-a-brainrot') {
    const { data } = await db.from('sab_brainrots').select('id').eq('slug', slug).maybeSingle()
    return !!data
  }
  if (gameSlug === 'adopt-me') {
    const { data } = await db.from('adopt_me_pets').select('id').eq('slug', slug).maybeSingle()
    return !!data
  }
  const { data: game } = await db.from('games').select('id').eq('slug', gameSlug).maybeSingle()
  if (!game) return false
  const { data } = await db.from('values_items').select('id').eq('game_id', game.id).eq('slug', slug).maybeSingle()
  return !!data
}

/** Applies from the next daily price run. */
export async function decideMarketName(db: Db, gameSlug: string, marketName: string, decision: MarketNameDecision, adminId: string): Promise<void> {
  const decided = { decided_by: adminId, decided_at: new Date().toISOString() }
  let patch: Record<string, unknown>
  if (decision.kind === 'link') {
    if (!(await itemExists(db, gameSlug, decision.itemSlug))) throw new Error(`No item "${decision.itemSlug}" in this game.`)
    patch = { status: 'confirmed', item_slug: decision.itemSlug, ...decided }
  } else if (decision.kind === 'confirm') {
    patch = { status: 'confirmed', ...decided }
  } else {
    patch = { status: 'rejected', ...decided }
  }
  let q = db.from('market_name_matches').update(patch).eq('game_slug', gameSlug).eq('source', 'eldorado').eq('market_name', marketName)
  // Confirming needs an item to confirm.
  if (decision.kind === 'confirm') q = q.not('item_slug', 'is', null)
  const { data, error } = await q.select('market_name')
  if (error) throw new Error(`market_name_matches: ${error.message}`)
  if (!data?.length) throw new Error('That name is gone or has no item to confirm; refresh and try again.')
}
